/* ==========================================================================
   Poner en marcha un complejo de prueba

   Crea las dos cuentas —dueño y jugador—, el complejo con sus canchas, tres
   meses de historia, equipos con plantilla y dos torneos. Al terminar dice
   con qué correo entrar a cada lado.

   Correr:  npx tsx scripts/preparar.ts

   Usa la clave ANÓNIMA a propósito, no la `service_role`. Eso significa que
   todo lo que escribe pasa por las MISMAS políticas de fila que va a usar la
   aplicación: si este script consigue escribir, es que las políticas dejan
   escribir a quien tiene que escribir. Es la primera prueba de RLS, y sale
   gratis.

   Requisito en Supabase: la confirmación de correo desactivada. Con ella
   puesta no hay sesión después de registrarse y el script no puede seguir.
   En el proyecto `sportplatz` ya está así (`mailer_autoconfirm`), y está
   anotado en `../docs/BASE.md` como una de las cosas que hay que volver a
   encender antes de abrirle esto a un cliente de verdad.
   ========================================================================== */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { iso, addDays } from '../src/lib/util';
import { bracketShape, resolveBracket, TEAM_COLORS, type Torneo, type Partido, type Cupo } from '../src/lib/tournament';
import {
  PLAN_DEMO, telefono, canchasDeSemilla, reservasDeSemilla,
  equiposDeSemilla, plantillasDeSemilla, planDeTorneos, marcadoresDeSemilla
} from '../src/lib/seed';
import type { SportId } from '../src/lib/sports';

/* ── Configuración ───────────────────────────────────────────────────────── */

const NOMBRE_COMPLEJO = 'Complejo Deportivo La 70';
const WHATSAPP = '+573001234567';

const DUENO = { email: 'dueno@sportplatz.test', password: 'sportplatz2026', nombre: 'Felipe Castaño' };
const JUGADOR = { email: 'jugador@sportplatz.test', password: 'sportplatz2026', nombre: 'Juan Camilo Restrepo' };

/* ── Entorno ─────────────────────────────────────────────────────────────── */

function leerEnv(): { url: string; anon: string } {
  let url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  let anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

  if (!url || !anon) {
    try {
      const texto = readFileSync('.env.local', 'utf8');
      for (const linea of texto.split('\n')) {
        const [k, ...resto] = linea.split('=');
        const v = resto.join('=').trim();
        if (k?.trim() === 'NEXT_PUBLIC_SUPABASE_URL') url ||= v;
        if (k?.trim() === 'NEXT_PUBLIC_SUPABASE_ANON_KEY') anon ||= v;
      }
    } catch { /* no hay .env.local: se dirá abajo */ }
  }

  if (!url || url.includes('placeholder')) {
    salir('Falta NEXT_PUBLIC_SUPABASE_URL. Está en Supabase → Settings → API → Project URL.');
  }
  if (!anon || anon.includes('placeholder')) {
    salir('Falta NEXT_PUBLIC_SUPABASE_ANON_KEY. Está en Supabase → Settings → API → anon public.');
  }

  return { url, anon };
}

const salir: (msg: string) => never = (msg) => {
  console.error('\n  ✖ ' + msg + '\n');
  process.exit(1);
};

const paso = (n: number, t: string) => console.log(`\n  ${n}. ${t}`);
const ok = (t: string) => console.log(`     ✓ ${t}`);

/* ── Cuentas ─────────────────────────────────────────────────────────────── */

async function entrarOCrear(
  sb: SupabaseClient,
  quien: { email: string; password: string; nombre: string }
): Promise<string> {
  const { data: entrada } = await sb.auth.signInWithPassword({
    email: quien.email,
    password: quien.password
  });

  if (entrada.user) return entrada.user.id;

  const { data, error } = await sb.auth.signUp({
    email: quien.email,
    password: quien.password,
    options: { data: { nombre: quien.nombre, telefono: telefono() } }
  });

  if (error) salir(`No se pudo crear ${quien.email}: ${error.message}`);
  if (!data.session) {
    salir(
      `${quien.email} quedó creada pero sin sesión: Supabase está pidiendo confirmar el correo.\n` +
      '    Ve a Authentication → Providers → Email y desactiva "Confirm email" mientras pruebas.'
    );
  }

  return data.user!.id;
}

/* ── Lo principal ────────────────────────────────────────────────────────── */

async function main() {
  const { url, anon } = leerEnv();
  const sb = createClient(url, anon, { auth: { persistSession: false } });

  console.log(`\n  Sportplatz · preparando un complejo de prueba en ${new URL(url).host}`);

  /* 1. El dueño ------------------------------------------------------------ */
  paso(1, 'Cuenta del dueño');
  const duenoId = await entrarOCrear(sb, DUENO);
  ok(`${DUENO.email}`);

  /* 2. El complejo --------------------------------------------------------- */
  paso(2, 'Complejo y canchas');

  const { data: yaTiene } = await sb
    .from('membresias')
    .select('complejo_id, complejos(slug, nombre)')
    .eq('persona_id', duenoId)
    .eq('rol', 'dueno')
    .maybeSingle();

  let complejoId: string;
  let slug: string;

  if (yaTiene) {
    complejoId = yaTiene.complejo_id as string;
    slug = (yaTiene.complejos as unknown as { slug: string }).slug;
    ok(`ya existía: ${slug}`);
  } else {
    // Por la función y no por un insert: `.insert().select()` pide la fila de
    // vuelta dentro de la misma sentencia, antes de que exista la membresía
    // de dueño, y la política de lectura la rechaza. Lo cuenta entero
    // `supabase/migrations/0004_alta_de_complejo.sql`.
    const { data, error } = await sb.rpc('crear_complejo', {
      p_nombre: NOMBRE_COMPLEJO,
      p_whatsapp: WHATSAPP
    });

    if (error) salir(`No se pudo crear el complejo: ${error.message}`);
    const fila = (data as { id: string; slug: string }[] | null)?.[0];
    if (!fila) salir('No se pudo crear el complejo: la base no devolvió la fila.');
    complejoId = fila.id;
    slug = fila.slug;
    ok(`creado: ${slug}`);
  }

  const { data: hayCanchas } = await sb
    .from('canchas').select('id, precio, deporte').eq('complejo_id', complejoId);

  let canchas = hayCanchas ?? [];
  if (!canchas.length) {
    const { error } = await sb.from('canchas').insert(canchasDeSemilla(complejoId, PLAN_DEMO));
    if (error) salir(`No se pudieron crear las canchas: ${error.message}`);
    const { data } = await sb.from('canchas').select('id, precio, deporte').eq('complejo_id', complejoId);
    canchas = data ?? [];
  }
  ok(`${canchas.length} canchas`);

  /* 3. El jugador ---------------------------------------------------------- */
  paso(3, 'Cuenta del jugador');
  const sbJugador = createClient(url, anon, { auth: { persistSession: false } });
  await entrarOCrear(sbJugador, JUGADOR);
  await sbJugador.rpc('unirme_al_complejo', { s: slug });
  ok(`${JUGADOR.email} · inscrito en ${slug}`);

  /* Vuelta al dueño para todo lo demás. */
  await sb.auth.signInWithPassword({ email: DUENO.email, password: DUENO.password });

  /* 4. Gente --------------------------------------------------------------- */
  paso(4, 'Jugadores del complejo');
  const { data: yaHay } = await sb
    .from('membresias')
    .select('personas!inner(id, nombre, telefono)')
    .eq('complejo_id', complejoId);

  const clientes = ((yaHay ?? []) as unknown as { personas: { id: string; nombre: string; telefono: string | null } }[])
    .map(x => x.personas)
    .filter(Boolean);

  ok(`${clientes.length} con cuenta (el resto de reservas van a nombre suelto)`);

  /* 5. La agenda ----------------------------------------------------------- */
  paso(5, 'Tres meses de agenda');

  const { count: yaReservas } = await sb
    .from('reservas').select('id', { count: 'exact', head: true }).eq('complejo_id', complejoId);

  if (yaReservas && yaReservas > 0) {
    ok(`ya había ${yaReservas} reservas · no se toca nada`);
  } else {
    const filas = reservasDeSemilla(
      complejoId,
      canchas.map(c => ({ id: c.id as string, precio: c.precio as number })),
      clientes
    );

    // Por lotes: un solo INSERT de doce mil filas desborda la petición.
    const LOTE = 500;
    let puestas = 0;
    for (let i = 0; i < filas.length; i += LOTE) {
      const trozo = filas.slice(i, i + LOTE);
      const pagos = trozo.map(f => f.abonado as number);
      // `abonado` lo mantiene el trigger: se quita de la reserva y se mete
      // como pago, que es de donde tiene que salir.
      const sinAbonado = trozo.map(f => { const { abonado, ...r } = f; void abonado; return r; });

      const { data, error } = await sb.from('reservas').insert(sinAbonado).select('id');
      if (error) salir(`Falló el lote ${i / LOTE + 1}: ${error.message}`);

      const conPago = (data ?? [])
        .map((r, k) => ({ id: r.id as string, monto: pagos[k] }))
        .filter(x => x.monto > 0)
        .map(x => ({
          complejo_id: complejoId,
          reserva_id: x.id,
          monto: x.monto,
          medio: 'efectivo',
          registrado_por: duenoId
        }));

      if (conPago.length) {
        const { error: ePago } = await sb.from('pagos').insert(conPago);
        if (ePago) salir(`Falló el pago del lote ${i / LOTE + 1}: ${ePago.message}`);
      }

      puestas += trozo.length;
      process.stdout.write(`\r     … ${puestas} de ${filas.length} reservas`);
    }
    console.log(`\r     ✓ ${puestas} reservas con sus pagos          `);
  }

  /* 6. Equipos ------------------------------------------------------------- */
  paso(6, 'Equipos y plantillas');

  const deporte = (canchas[0]?.deporte ?? 'futbol') as SportId;
  const { data: yaEquipos } = await sb
    .from('equipos').select('id, nombre, color, deporte').eq('complejo_id', complejoId);

  let equipos = yaEquipos ?? [];
  if (!equipos.length) {
    const { error } = await sb.from('equipos').insert(equiposDeSemilla(complejoId, deporte, 8));
    if (error) salir(`No se pudieron crear los equipos: ${error.message}`);
    const { data } = await sb
      .from('equipos').select('id, nombre, color, deporte').eq('complejo_id', complejoId);
    equipos = data ?? [];

    if (clientes.length) {
      const { error: ePl } = await sb.from('plantillas').insert(
        plantillasDeSemilla(
          equipos.map(e => ({ id: e.id as string, deporte: e.deporte as SportId })),
          clientes
        )
      );
      if (ePl) console.warn(`     ! plantillas: ${ePl.message}`);
    }
  }
  ok(`${equipos.length} equipos`);

  /* 7. Torneos ------------------------------------------------------------- */
  paso(7, 'Torneos');

  const { count: yaTorneos } = await sb
    .from('torneos').select('id', { count: 'exact', head: true }).eq('complejo_id', complejoId);

  if (yaTorneos && yaTorneos > 0) {
    ok(`ya había ${yaTorneos} · no se toca nada`);
  } else {
    const planes = planDeTorneos(
      equipos.map(e => ({
        id: e.id as string, nombre: e.nombre as string,
        color: e.color as string, deporte: e.deporte as SportId
      })),
      deporte
    );

    for (const plan of planes) {
      const { data: tn, error } = await sb
        .from('torneos')
        .insert({
          complejo_id: complejoId,
          nombre: plan.nombre,
          deporte: plan.deporte,
          tamano: plan.tamano,
          fecha_inicio: plan.fechaInicio,
          inscripcion_abierta: plan.inscripcionAbierta
        })
        .select('id')
        .single();

      if (error) salir(`No se pudo crear ${plan.nombre}: ${error.message}`);

      const cupos = Array.from({ length: plan.tamano }, (_, i) => {
        const e = plan.equipos[i];
        return {
          torneo_id: tn!.id,
          posicion: i,
          equipo_id: e?.id ?? null,
          nombre: e?.nombre ?? `Cupo libre ${i + 1}`,
          color: e?.color ?? TEAM_COLORS[i % TEAM_COLORS.length]
        };
      });

      const { data: creados, error: eCupos } = await sb
        .from('torneo_cupos').insert(cupos).select('id, posicion');
      if (eCupos) salir(`Cupos de ${plan.nombre}: ${eCupos.message}`);

      const porPos = new Map((creados ?? []).map(c => [c.posicion as number, c.id as string]));
      const forma = bracketShape(plan.tamano);
      const primera = forma[0].ronda;
      const marcadores = marcadoresDeSemilla(plan.tamano, plan.rondasJugadas);

      const partidos = forma.map(f => {
        const m = marcadores.find(x => x.ronda === f.ronda && x.idx === f.idx);
        return {
          torneo_id: tn!.id,
          ronda: f.ronda,
          idx: f.idx,
          cupo_a: f.ronda === primera ? porPos.get(f.idx * 2) ?? null : null,
          cupo_b: f.ronda === primera ? porPos.get(f.idx * 2 + 1) ?? null : null,
          marcador_a: m?.marcadorA ?? null,
          marcador_b: m?.marcadorB ?? null,
          jugado: !!m,
          fecha: iso(addDays(new Date(plan.fechaInicio), f.semana * 7)),
          hora: f.ronda === 'tercero' ? '15:00' : String(17 + (f.idx % 5)).padStart(2, '0') + ':00'
        };
      });

      const { data: puestos, error: ePart } = await sb
        .from('partidos').insert(partidos).select('id, ronda, idx, cupo_a, cupo_b, marcador_a, marcador_b, jugado');
      if (ePart) salir(`Llave de ${plan.nombre}: ${ePart.message}`);

      /* Los ganadores avanzan solos (R24). Se resuelve con el MISMO motor que
         usa la aplicación, no con una copia: si esto queda bien, la llave de
         la app queda bien. */
      if (plan.rondasJugadas > 0) {
        const enMemoria: Torneo = {
          id: tn!.id, nombre: plan.nombre, deporte: plan.deporte, tamano: plan.tamano,
          fechaInicio: plan.fechaInicio, inscripcionAbierta: plan.inscripcionAbierta,
          cupos: (creados ?? []).map(c => ({
            id: c.id as string, posicion: c.posicion as number,
            equipoId: null, nombre: '', color: ''
          })) as Cupo[],
          partidos: (puestos ?? []).map(p => ({
            id: p.id as string, ronda: p.ronda as Partido['ronda'], idx: p.idx as number,
            cupoA: p.cupo_a as string | null, cupoB: p.cupo_b as string | null,
            marcadorA: p.marcador_a as number | null, marcadorB: p.marcador_b as number | null,
            fecha: null, hora: null, canchaId: null, jugado: p.jugado as boolean
          })),
          anotaciones: []
        };

        const tocados = resolveBracket(enMemoria);
        for (const t of tocados) {
          await sb.from('partidos').update({ cupo_a: t.cupoA, cupo_b: t.cupoB }).eq('id', t.id);
        }
      }

      ok(`${plan.nombre} · ${plan.rondasJugadas ? `${plan.rondasJugadas} rondas jugadas` : 'abierto a inscripción'}`);
    }
  }

  /* Listo ------------------------------------------------------------------ */
  const { count: totalReservas } = await sb
    .from('reservas').select('id', { count: 'exact', head: true }).eq('complejo_id', complejoId);

  console.log(`
  ────────────────────────────────────────────────────────────
  Listo. ${NOMBRE_COMPLEJO} tiene ${totalReservas} reservas.

  Dueño     ${DUENO.email}  ·  ${DUENO.password}
            → /${slug}/panel

  Jugador   ${JUGADOR.email}  ·  ${JUGADOR.password}
            → /${slug}/j/inicio

  Entra con los dos a la vez en dos ventanas: reserva como
  jugador y mira caer la reserva en la agenda del dueño.
  ────────────────────────────────────────────────────────────
`);
}

main().catch(e => salir(e instanceof Error ? e.message : String(e)));
