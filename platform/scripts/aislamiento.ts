/* ==========================================================================
   Aceptación de la Fase 0 · dos negocios en la misma base

   PLATAFORMA.md §7.2. La pregunta que contesta es una sola y no admite
   matices: ¿puede el dueño de un complejo ver, o tocar, UNA sola fila del
   complejo de al lado?

   Se ejecuta con la CLAVE PÚBLICA y sesiones de verdad, igual que un
   navegador. No usa la clave secreta en ningún momento: comprobar el
   aislamiento saltándose las políticas no comprueba nada.

   No va en `pruebas/` porque aquello es lógica pura y corre sin red. Esto
   necesita la base viva y `.env.local` con las claves.

   Correr:  npm run aislamiento    (después de `npm run preparar`)

   El negocio rival se crea la primera vez y se REUTILIZA en las siguientes.
   No se borra al terminar, y no es un descuido: en todo el esquema no hay una
   sola política de `delete` sobre `complejos` —R19, aquí no se borra nada— así
   que un dueño no puede eliminar su negocio ni aunque quiera. Un `delete`
   desde el cliente no falla: simplemente no toca ninguna fila. Si este script
   creara uno nuevo en cada corrida, se irían acumulando en silencio.
   ========================================================================== */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const RIVAL = { email: 'rival@sportplatz.test', password: 'sportplatz2026', nombre: 'Dueña del rival' };
const DUENO = { email: 'dueno@sportplatz.test', password: 'sportplatz2026' };
const JUGADOR = { email: 'jugador@sportplatz.test', password: 'sportplatz2026' };

/* ── Entorno ─────────────────────────────────────────────────────────────── */

const salir: (msg: string) => never = (msg) => {
  console.error('\n  ✖ ' + msg + '\n');
  process.exit(1);
};

function leerEnv(): { url: string; anon: string } {
  let url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  let anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

  if (!url || !anon) {
    try {
      for (const linea of readFileSync('.env.local', 'utf8').split('\n')) {
        const [k, ...resto] = linea.split('=');
        const v = resto.join('=').trim();
        if (k?.trim() === 'NEXT_PUBLIC_SUPABASE_URL') url ||= v;
        if (k?.trim() === 'NEXT_PUBLIC_SUPABASE_ANON_KEY') anon ||= v;
      }
    } catch { /* se dice abajo */ }
  }
  if (!url || !anon || url.includes('placeholder')) {
    salir('Faltan las claves. Están en `.env.local`, y salen de Supabase → Settings → API.');
  }
  return { url, anon };
}

/* ── Utilidades ──────────────────────────────────────────────────────────── */

let fallos = 0;

/** Una afirmación con nombre. Ni lanza ni corta: cuenta y sigue, para que un
    fallo no esconda a los cinco de abajo. */
function exigir(nombre: string, cumple: boolean, detalle = '') {
  if (cumple) {
    console.log(`     ✓ ${nombre}`);
  } else {
    fallos++;
    console.log(`     ✖ ${nombre}${detalle ? ' — ' + detalle : ''}`);
  }
}

const paso = (n: number, t: string) => console.log(`\n  ${n}. ${t}`);

/** Cuántas filas ve de verdad, sin que el tope de mil de PostgREST mienta. */
async function cuantasVe(sb: SupabaseClient, tabla: string): Promise<number> {
  const { count, error } = await sb.from(tabla).select('id', { count: 'exact', head: true });
  if (error) return -1;
  return count ?? 0;
}

async function sesion(url: string, anon: string, quien: { email: string; password: string }) {
  const sb = createClient(url, anon, { auth: { persistSession: false } });
  const { error } = await sb.auth.signInWithPassword(quien);
  if (error) salir(`No se pudo entrar como ${quien.email}: ${error.message}. ¿Corriste \`npm run preparar\`?`);
  return sb;
}

/* ── Lo principal ────────────────────────────────────────────────────────── */

async function main() {
  const { url, anon } = leerEnv();
  console.log(`\n  Sportplatz · aislamiento entre negocios en ${new URL(url).host}`);

  /* 1. El negocio rival ---------------------------------------------------- */
  paso(1, 'Un segundo negocio, con dueña distinta');

  const sbRival = createClient(url, anon, { auth: { persistSession: false } });
  const { error: eEntrar } = await sbRival.auth.signInWithPassword(RIVAL);
  if (eEntrar) {
    const { error } = await sbRival.auth.signUp({
      email: RIVAL.email,
      password: RIVAL.password,
      options: { data: { nombre: RIVAL.nombre } }
    });
    if (error) salir(`No se pudo crear ${RIVAL.email}: ${error.message}`);
  }

  // Si ya lo tiene de una corrida anterior, se reutiliza. Crear uno nuevo cada
  // vez los iría amontonando, porque no hay manera de borrarlos.
  const { data: suyos } = await sbRival
    .from('membresias').select('complejos(id, slug)').eq('rol', 'dueno');

  let rival = (suyos ?? [])
    .map(m => (m as unknown as { complejos: { id: string; slug: string } }).complejos)
    .filter(Boolean)[0];

  if (rival) {
    console.log(`     ✓ ${rival.slug} (ya existía, se reutiliza)`);
  } else {
    const { data: creado, error: eCrear } = await sbRival.rpc('crear_complejo', {
      p_nombre: 'Canchas El Poblado',
      p_whatsapp: '+573009998877'
    });
    if (eCrear) salir(`No se pudo crear el complejo rival: ${eCrear.message}`);
    rival = (creado as { id: string; slug: string }[])[0];
    console.log(`     ✓ ${rival.slug}`);
  }

  const sbDueno = await sesion(url, anon, DUENO);
  const sbJugador = await sesion(url, anon, JUGADOR);

  const { data: mio } = await sbDueno.from('complejos').select('id, slug').limit(1).single();
  if (!mio) salir('El dueño de prueba no tiene complejo. Corre `npm run preparar` primero.');

  /* 2. Lo que ve cada uno --------------------------------------------------- */
  paso(2, 'Lo que alcanza a ver la dueña del negocio de al lado');

  for (const tabla of ['canchas', 'reservas', 'pagos', 'equipos', 'torneos'] as const) {
    const n = await cuantasVe(sbRival, tabla);
    exigir(`${tabla}: ninguna fila ajena`, n === 0, `ve ${n}`);
  }
  // No se cuenta "que vea exactamente uno" —podría tener varios legítimamente—
  // sino que ninguno de los que ve sea ajeno.
  const { data: losQueVe } = await sbRival.from('complejos').select('id, slug');
  const ajenos = (losQueVe ?? []).filter(c => c.id !== rival.id);
  exigir('complejos: ninguno ajeno',
    ajenos.length === 0, ajenos.map(c => c.slug).join(', '));

  /* 3. Ataques dirigidos ---------------------------------------------------- */
  paso(3, 'Pidiendo filas ajenas por su id exacto');

  const { data: cancha } = await sbDueno.from('canchas').select('id').limit(1).single();
  const { data: reserva } = await sbDueno.from('reservas').select('id').limit(1).single();

  const { data: canchaAjena } = await sbRival.from('canchas').select('id').eq('id', cancha!.id);
  exigir('una cancha ajena por su id devuelve vacío', (canchaAjena ?? []).length === 0);

  const { data: reservaAjena } = await sbRival.from('reservas').select('id').eq('id', reserva!.id);
  exigir('una reserva ajena por su id devuelve vacío', (reservaAjena ?? []).length === 0);

  const { data: complejoAjeno } = await sbRival.from('complejos').select('id').eq('id', mio.id);
  exigir('el complejo ajeno por su id devuelve vacío', (complejoAjeno ?? []).length === 0);

  /* 4. Escritura ------------------------------------------------------------ */
  paso(4, 'Intentando escribir en el negocio ajeno');

  const { error: eColar } = await sbRival.from('canchas').insert({
    complejo_id: mio.id, deporte: 'futbol', numero: 99, nombre: 'Colada', precio: 1, orden: 99
  });
  exigir('colar una cancha en el complejo ajeno se rechaza', !!eColar, eColar ? '' : 'la dejó entrar');

  const { error: eRenombrar, count: nRenombradas } = await sbRival
    .from('complejos').update({ nombre: 'Mío ahora' }, { count: 'exact' }).eq('id', mio.id);
  exigir('renombrar el complejo ajeno no cambia nada',
    !!eRenombrar || nRenombradas === 0, `filas tocadas: ${nRenombradas}`);

  const { error: eAutodueno } = await sbRival.from('membresias').insert({
    complejo_id: mio.id, persona_id: (await sbRival.auth.getUser()).data.user!.id, rol: 'dueno'
  });
  exigir('hacerse dueña del complejo ajeno se rechaza', !!eAutodueno, eAutodueno ? '' : 'se hizo dueña');

  /* 5. El jugador de la casa ------------------------------------------------ */
  paso(5, 'El jugador del propio complejo: ve lo suyo, no lo de los demás');

  const totalDelComplejo = await cuantasVe(sbDueno, 'reservas');
  const delJugador = await cuantasVe(sbJugador, 'reservas');
  exigir('el jugador ve menos reservas que el dueño',
    delJugador < totalDelComplejo, `jugador ${delJugador} · dueño ${totalDelComplejo}`);

  const { data: yo } = await sbJugador.auth.getUser();
  const { data: ajena } = await sbDueno
    .from('reservas').select('id').neq('persona_id', yo.user!.id).limit(1).single();
  const { data: laVe } = await sbJugador.from('reservas').select('id').eq('id', ajena!.id);
  exigir('una reserva de otro cliente le devuelve vacío', (laVe ?? []).length === 0);

  /* 6. Sin sesión ----------------------------------------------------------- */
  paso(6, 'Sin haber entrado');

  const sbAnon = createClient(url, anon, { auth: { persistSession: false } });
  for (const tabla of ['complejos', 'canchas', 'reservas', 'personas'] as const) {
    const n = await cuantasVe(sbAnon, tabla);
    exigir(`${tabla}: nada`, n <= 0, `ve ${n}`);
  }

  /* 7. Lo que queda --------------------------------------------------------- */
  paso(7, 'Lo que queda en la base');

  // Se intenta borrar y se COMPRUEBA, en vez de dar por hecho que salió. Sin
  // política de `delete`, esto no falla: no toca ninguna fila y devuelve
  // tranquilamente que todo fue bien.
  await sbRival.from('complejos').delete().eq('id', rival.id);
  const { data: sigue } = await sbRival.from('complejos').select('id').eq('id', rival.id);
  const borrado = (sigue ?? []).length === 0;

  exigir('un dueño no puede borrar su complejo (R19: aquí no se borra nada)', !borrado,
    'se borró, y no debería poder');

  console.log(`     · ${rival.slug} y la cuenta ${RIVAL.email} se quedan, y se reutilizan`);

  /* ── Veredicto ─────────────────────────────────────────────────────────── */
  console.log('\n  ' + '─'.repeat(60));
  if (fallos) {
    console.log(`  ✖ ${fallos} comprobación(es) fallaron. El aislamiento NO se sostiene.`);
    console.log('  ' + '─'.repeat(60) + '\n');
    process.exit(1);
  }
  console.log('  Aislamiento intacto. Fase 0 aceptada.');
  console.log('  ' + '─'.repeat(60) + '\n');
}

main().catch(e => salir(e instanceof Error ? e.message : String(e)));
