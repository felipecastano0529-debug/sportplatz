'use server';

import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';
import { resolverTenant } from '@/lib/tenant';
import { readNum, telE164 } from '@/lib/util';
import { PALETAS, esHex, seCorrigio } from '@/lib/tema';
import type { SportId } from '@/lib/sports';
import type { Tema } from '@/lib/types';

/* ==========================================================================
   Escrituras · El negocio y sus canchas

   Todo lo que el dueño puede cambiar de su plataforma: el nombre, el logo,
   el horario, el acento, y cancha por cancha el nombre, el precio, la foto y
   si está activa.

   Dos cosas que se respetan aquí y no en la interfaz, porque la interfaz se
   puede saltar:

     · R3. Cambiar el horario NO borra reservas que queden fuera. Se avisa y
       se muestran igual. Un negocio que pierde reservas por tocar un ajuste
       no vuelve a tocar ningún ajuste.
     · R8. Cambiar la tarifa NO reescribe el pasado. `total` está congelado
       en cada reserva y aquí no se toca ni una.
   ========================================================================== */

export interface Resultado { ok?: boolean; error?: string; aviso?: string }

async function duenoDe(slug: string) {
  const s = await resolverTenant(slug);
  if (!s.dueno) throw new Error('Solo el dueño puede cambiar los ajustes del negocio.');
  if (s.soloLectura) throw new Error('El plan está vencido: los ajustes son de solo lectura.');
  return s;
}

/* ── El negocio ──────────────────────────────────────────────────────────── */

export async function guardarNegocio(
  slug: string,
  form: { nombre?: string; whatsapp?: string; horaAbre?: number; horaCierra?: number }
): Promise<Resultado> {
  const s = await duenoDe(slug);
  const sb = await supabaseServer();

  const cambios: Record<string, unknown> = {};

  if (form.nombre !== undefined) {
    const n = form.nombre.trim();
    if (n.length < 2) return { error: 'El nombre del negocio necesita al menos dos letras.' };
    cambios.nombre = n.slice(0, 120);
  }

  if (form.whatsapp !== undefined) cambios.whatsapp = telE164(form.whatsapp);

  let aviso: string | undefined;

  if (form.horaAbre !== undefined || form.horaCierra !== undefined) {
    const abre = form.horaAbre ?? s.complejo.hora_abre;
    const cierra = form.horaCierra ?? s.complejo.hora_cierra;
    if (cierra <= abre) return { error: 'La hora de cierre tiene que ir después de la de apertura.' };

    cambios.hora_abre = abre;
    cambios.hora_cierra = cierra;

    // R3: no se borra nada. Se cuenta y se dice.
    const { count } = await sb
      .from('reservas')
      .select('id', { count: 'exact', head: true })
      .eq('complejo_id', s.complejo.id)
      .in('estado', ['confirmada', 'jugada'])
      .gte('fecha', new Date().toISOString().slice(0, 10))
      .or(`inicio.lt.${String(abre).padStart(2, '0')}:00,inicio.gte.${String(cierra).padStart(2, '0')}:00`);

    if (count && count > 0) {
      aviso = count === 1
        ? 'Hay 1 reserva futura fuera del nuevo horario. No se ha borrado: sigue en la agenda.'
        : `Hay ${count} reservas futuras fuera del nuevo horario. No se han borrado: siguen en la agenda.`;
    }
  }

  if (!Object.keys(cambios).length) return { ok: true };

  const { error } = await sb.from('complejos').update(cambios).eq('id', s.complejo.id);
  if (error) return { error: `No se pudo guardar: ${error.message}` };

  revalidatePath(`/${slug}`, 'layout');
  return { ok: true, aviso };
}

export async function guardarLogo(slug: string, url: string): Promise<Resultado> {
  const s = await duenoDe(slug);
  const sb = await supabaseServer();
  const { error } = await sb.from('complejos').update({ logo_url: url }).eq('id', s.complejo.id);
  if (error) return { error: `No se pudo guardar el logo: ${error.message}` };
  revalidatePath(`/${slug}`, 'layout');
  return { ok: true };
}

export async function quitarLogo(slug: string): Promise<Resultado> {
  const s = await duenoDe(slug);
  const sb = await supabaseServer();
  const { error } = await sb.from('complejos').update({ logo_url: null }).eq('id', s.complejo.id);
  if (error) return { error: `No se pudo quitar el logo: ${error.message}` };
  revalidatePath(`/${slug}`, 'layout');
  return { ok: true };
}

/**
 * El acento del negocio. Se admite un color libre, pero se COMPRUEBA: si no
 * llega a 4.5:1 sobre blanco se oscurece hasta que llegue, y se dice. El
 * sistema entero se apoya en que el mismo color sirva de relleno y de texto
 * (DESIGN.md §1); dejar pasar un amarillo pastel rompe media interfaz sin
 * dar un solo error en consola.
 */
export async function guardarTema(
  slug: string,
  form: { accent?: string; fondo?: 'estadio' | 'sobrio' | 'propio'; fondoUrl?: string }
): Promise<Resultado> {
  const s = await duenoDe(slug);
  const sb = await supabaseServer();

  const tema: Tema = { ...s.complejo.tema };
  let aviso: string | undefined;

  if (form.accent !== undefined) {
    const dePaleta = PALETAS.find(p => p.id === form.accent);
    if (dePaleta) {
      tema.accent = dePaleta.id;
      delete tema.custom;
    } else if (esHex(form.accent)) {
      const hex = form.accent.startsWith('#') ? form.accent : '#' + form.accent;
      tema.accent = 'custom';
      // Se guarda lo que ELIGIÓ, no lo derivado: la derivación se recalcula
      // al leer, así que afinarla arregla los temas ya guardados.
      tema.custom = hex.toLowerCase();
      if (seCorrigio(hex)) {
        aviso = 'Ese color era demasiado claro para llevar texto blanco encima, ' +
          'así que lo oscurecimos lo justo para que se lea. El tono es el mismo.';
      }
    } else {
      return { error: 'Ese no es un color válido.' };
    }
  }

  if (form.fondo !== undefined) tema.fondo = form.fondo;
  if (form.fondoUrl !== undefined) tema.fondoUrl = form.fondoUrl || undefined;

  const { error } = await sb.from('complejos').update({ tema }).eq('id', s.complejo.id);
  if (error) return { error: `No se pudo guardar el color: ${error.message}` };

  revalidatePath(`/${slug}`, 'layout');
  return { ok: true, aviso };
}

/* ── Canchas ─────────────────────────────────────────────────────────────── */

/**
 * Renombrar y tarifar. Era un hueco de personalización: el negocio se
 * llamaba como quisiera, pero sus canchas eran siempre "Sintética 1".
 */
export async function guardarCancha(
  slug: string,
  canchaId: string,
  form: { nombre?: string; precio?: number | string; activa?: boolean }
): Promise<Resultado> {
  const s = await duenoDe(slug);
  const sb = await supabaseServer();

  const cambios: Record<string, unknown> = {};

  if (form.nombre !== undefined) {
    const n = form.nombre.trim();
    if (!n) return { error: 'La cancha necesita un nombre.' };
    cambios.nombre = n.slice(0, 28);
  }

  if (form.precio !== undefined) {
    const p = typeof form.precio === 'number' ? form.precio : readNum(form.precio);
    if (p < 0) return { error: 'El precio no puede ser negativo.' };
    cambios.precio = Math.round(p);
  }

  if (form.activa !== undefined) cambios.activa = form.activa;
  if (!Object.keys(cambios).length) return { ok: true };

  const { error } = await sb
    .from('canchas').update(cambios)
    .eq('id', canchaId).eq('complejo_id', s.complejo.id);

  if (error) return { error: `No se pudo guardar la cancha: ${error.message}` };

  revalidatePath(`/${slug}`, 'layout');
  return { ok: true };
}

export async function guardarFotoCancha(
  slug: string,
  canchaId: string,
  url: string
): Promise<Resultado> {
  const s = await duenoDe(slug);
  const sb = await supabaseServer();
  const { error } = await sb
    .from('canchas').update({ foto_url: url })
    .eq('id', canchaId).eq('complejo_id', s.complejo.id);

  if (error) return { error: `No se pudo guardar la foto: ${error.message}` };
  revalidatePath(`/${slug}`, 'layout');
  return { ok: true };
}

/**
 * La foto de fondo de un deporte entero: se aplica a todas las canchas de
 * ese deporte que no tengan una propia. Es lo que se sube desde la barra de
 * Canchas, donde el fondo es la sección completa.
 */
export async function guardarFotoDeporte(
  slug: string,
  deporte: SportId,
  url: string
): Promise<Resultado> {
  const s = await duenoDe(slug);
  const sb = await supabaseServer();
  const { error } = await sb
    .from('canchas').update({ foto_url: url })
    .eq('complejo_id', s.complejo.id).eq('deporte', deporte);

  if (error) return { error: `No se pudo guardar la foto: ${error.message}` };
  revalidatePath(`/${slug}`, 'layout');
  return { ok: true };
}

export async function quitarFotoCancha(slug: string, canchaId: string): Promise<Resultado> {
  const s = await duenoDe(slug);
  const sb = await supabaseServer();
  const { error } = await sb
    .from('canchas').update({ foto_url: null })
    .eq('id', canchaId).eq('complejo_id', s.complejo.id);

  if (error) return { error: `No se pudo quitar la foto: ${error.message}` };
  revalidatePath(`/${slug}`, 'layout');
  return { ok: true };
}

/** Agregar una cancha suelta sin volver a pasar por el onboarding. */
export async function crearCancha(
  slug: string,
  form: { deporte: SportId; nombre: string; precio: number }
): Promise<Resultado> {
  const s = await duenoDe(slug);
  const sb = await supabaseServer();

  const { data } = await sb
    .from('canchas').select('numero, orden')
    .eq('complejo_id', s.complejo.id).eq('deporte', form.deporte);

  const numero = Math.max(0, ...(data ?? []).map(x => x.numero as number)) + 1;
  const orden = Math.max(0, ...(data ?? []).map(x => x.orden as number)) + 1;

  const { error } = await sb.from('canchas').insert({
    complejo_id: s.complejo.id,
    deporte: form.deporte,
    numero,
    orden,
    nombre: form.nombre.trim().slice(0, 28) || `Cancha ${numero}`,
    precio: Math.max(0, Math.round(form.precio))
  });

  if (error) return { error: `No se pudo crear la cancha: ${error.message}` };
  revalidatePath(`/${slug}`, 'layout');
  return { ok: true };
}

/**
 * Desactivar, no borrar. Una cancha con historia no puede desaparecer: sus
 * reservas quedarían huérfanas y el histórico dejaría de cuadrar. Inactiva
 * no se ofrece ni cuenta para ocupación (R7), que es lo que de verdad se
 * quiere cuando alguien dice "quitar".
 */
export async function borrarCancha(slug: string, canchaId: string): Promise<Resultado> {
  const s = await duenoDe(slug);
  const sb = await supabaseServer();

  const { count } = await sb
    .from('reservas')
    .select('id', { count: 'exact', head: true })
    .eq('cancha_id', canchaId);

  if (count && count > 0) {
    const { error } = await sb
      .from('canchas').update({ activa: false })
      .eq('id', canchaId).eq('complejo_id', s.complejo.id);
    if (error) return { error: `No se pudo desactivar: ${error.message}` };
    revalidatePath(`/${slug}`, 'layout');
    return {
      ok: true,
      aviso: `Esa cancha tiene ${count} ${count === 1 ? 'reserva' : 'reservas'} en su historia, ` +
        'así que se desactivó en vez de borrarse. Deja de ofrecerse y de contar para la ocupación.'
    };
  }

  const { error } = await sb
    .from('canchas').delete()
    .eq('id', canchaId).eq('complejo_id', s.complejo.id);

  if (error) return { error: `No se pudo borrar: ${error.message}` };
  revalidatePath(`/${slug}`, 'layout');
  return { ok: true };
}
