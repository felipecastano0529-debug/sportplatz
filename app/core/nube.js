/* ==========================================================================
   NÚCLEO · Nube (Supabase)

   Es lo único del proyecto que sabe que Supabase existe. `store.js` le
   pregunta si hay sesión y, si la hay, le pasa el estado; el resto de la app
   no se entera de nada.

   Tres reglas que guiaron el diseño:

   1. **Sin configurar, la app funciona igual.** Si faltan las claves, todo
      esto queda inerte y el estado vive en el navegador. Nunca una pantalla
      en blanco por una variable que no llegó.

   2. **El documento entero, con número de versión.** Se guarda el estado
      completo y se envía la versión que se leyó. Si otro guardó entretanto,
      la base rechaza la escritura y devuelve lo bueno, en vez de dejar que
      uno pise al otro en silencio.

   3. **Un fallo de red no puede perder el trabajo.** Si el guardado remoto
      falla, se cae al respaldo local en vez de tragarse el error.
   ========================================================================== */

import { SUPABASE_URL, SUPABASE_ANON, nubeConfigurada } from './config.js';

let cliente = null;
let cargando = null;

/** Carga el cliente una sola vez, y solo si hay algo que configurar. */
async function init() {
  if (!nubeConfigurada()) return null;
  if (cliente) return cliente;
  if (cargando) return cargando;

  cargando = (async () => {
    if (!self.supabase) {
      await new Promise((ok, fail) => {
        const s = document.createElement('script');
        s.src = 'app/vendor/supabase.umd.js';
        s.onload = ok;
        s.onerror = () => fail(new Error('no se pudo cargar el cliente de Supabase'));
        document.head.appendChild(s);
      });
    }
    cliente = self.supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'sportplatz.auth'
      }
    });
    return cliente;
  })();

  try { return await cargando; }
  catch (e) { cargando = null; console.warn('[nube]', e.message); return null; }
}

export const hayNube = () => nubeConfigurada();

/* ── Sesión ──────────────────────────────────────────────────────────────── */

let sesion = null;
const oyentes = new Set();

export const usuario = () => sesion?.user ?? null;
export const haySesion = () => !!sesion;

/** Avisa cuando alguien entra o sale. */
export function alCambiarSesion(fn) {
  oyentes.add(fn);
  return () => oyentes.delete(fn);
}
const avisar = () => oyentes.forEach(fn => { try { fn(sesion); } catch (e) { console.warn(e); } });

export async function recuperarSesion() {
  const c = await init();
  if (!c) return null;
  const { data } = await c.auth.getSession();
  sesion = data.session ?? null;
  c.auth.onAuthStateChange((_evento, s) => { sesion = s; avisar(); });
  return sesion;
}

export async function registrarse(email, password) {
  const c = await init();
  if (!c) throw new Error('La nube no está configurada todavía');
  const { data, error } = await c.auth.signUp({ email, password });
  if (error) throw traducir(error);
  // Con la confirmación por correo desactivada, `signUp` ya devuelve sesión.
  sesion = data.session ?? null;
  return { sesion, necesitaConfirmar: !data.session };
}

export async function entrar(email, password) {
  const c = await init();
  if (!c) throw new Error('La nube no está configurada todavía');
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw traducir(error);
  sesion = data.session;
  return sesion;
}

export async function salir() {
  const c = await init();
  if (!c) return;
  await c.auth.signOut();
  sesion = null;
  espacioId = null;
  version = 0;
}

/* Los mensajes de Supabase vienen en inglés y en jerga. Se traducen a algo
   que un dueño de canchas pueda entender y accionar. */
function traducir(error) {
  const m = (error.message || '').toLowerCase();
  if (m.includes('invalid login')) return new Error('Correo o contraseña incorrectos');
  if (m.includes('already registered') || m.includes('already been registered'))
    return new Error('Ese correo ya tiene cuenta. Entra en vez de registrarte.');
  if (m.includes('password') && m.includes('6')) return new Error('La contraseña necesita al menos 6 caracteres');
  if (m.includes('invalid email') || m.includes('valid email')) return new Error('Ese correo no parece válido');
  if (m.includes('rate limit') || m.includes('too many'))
    return new Error('Demasiados intentos seguidos. Espera un minuto.');
  if (m.includes('fetch') || m.includes('network'))
    return new Error('Sin conexión con el servidor. Revisa tu internet.');
  return new Error(error.message || 'Algo falló al conectar');
}

/* ── El espacio del negocio ──────────────────────────────────────────────── */

let espacioId = null;
let version = 0;

export const idEspacio = () => espacioId;

/** Lee el negocio del usuario, o null si todavía no ha creado ninguno. */
export async function leerEspacio() {
  const c = await init();
  if (!c || !sesion) return null;
  const { data, error } = await c
    .from('espacios')
    .select('id, estado, version')
    .eq('owner_id', sesion.user.id)
    .maybeSingle();
  if (error) { console.warn('[nube] leer:', error.message); return null; }
  if (!data) return null;
  espacioId = data.id;
  version = data.version;
  return data.estado;
}

/** Crea el negocio la primera vez. Devuelve el estado tal como quedó. */
export async function crearEspacio(estado) {
  const c = await init();
  if (!c || !sesion) throw new Error('No hay sesión');
  const { data, error } = await c
    .from('espacios')
    .insert({ owner_id: sesion.user.id, nombre: estado?.business?.name || 'Mi complejo', estado })
    .select('id, version')
    .single();
  if (error) throw traducir(error);
  espacioId = data.id;
  version = data.version;
  return estado;
}

/**
 * Guarda con control de versión.
 * Devuelve { ok: true } si entró, o { ok: false, estado } si alguien había
 * guardado antes — en ese caso `estado` es lo que hay de verdad en la base.
 */
export async function guardarEspacio(estado) {
  const c = await init();
  if (!c || !sesion) return { ok: false, motivo: 'sin-sesion' };
  if (!espacioId) { await crearEspacio(estado); return { ok: true }; }

  const { data, error } = await c.rpc('guardar_espacio', {
    p_id: espacioId, p_estado: estado, p_version: version
  });
  if (error) return { ok: false, motivo: 'error', mensaje: error.message };

  const fila = Array.isArray(data) ? data[0] : data;
  if (!fila) return { ok: false, motivo: 'error' };

  version = fila.version;
  if (fila.ok) return { ok: true };
  // Conflicto: otro dispositivo guardó primero. No se intenta fusionar dos
  // documentos JSON automáticamente — eso corrompe en silencio. Se devuelve
  // lo que hay y quien llama decide.
  return { ok: false, motivo: 'conflicto', estado: fila.estado };
}

export async function borrarEspacio() {
  const c = await init();
  if (!c || !sesion || !espacioId) return;
  await c.from('espacios').delete().eq('id', espacioId);
  espacioId = null;
  version = 0;
}

/* ── En vivo ─────────────────────────────────────────────────────────────── */

let canal = null;

/** Avisa cuando el espacio cambia desde otro dispositivo. */
export async function escucharEspacio(alCambiar) {
  const c = await init();
  if (!c || !sesion || !espacioId) return () => {};
  dejarDeEscuchar();
  canal = c.channel('espacio:' + espacioId)
    .on('postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'espacios', filter: `id=eq.${espacioId}` },
      (payload) => {
        const nueva = payload.new?.version;
        if (nueva && nueva > version) {
          version = nueva;
          alCambiar(payload.new.estado);
        }
      })
    .subscribe();
  return dejarDeEscuchar;
}

export function dejarDeEscuchar() {
  if (canal) { canal.unsubscribe(); canal = null; }
}
