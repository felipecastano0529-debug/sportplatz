import { cache } from 'react';
import { notFound, redirect } from 'next/navigation';
import { supabaseServer } from './supabase/server';
import type { Complejo, Persona, Rol } from './types';

/* ==========================================================================
   El tenant

   §7.2.2: el complejo se resuelve EN EL SERVIDOR, del slug de la URL, contra
   `membresias`. Nunca de un campo del formulario ni de un id que mande el
   cliente. Todo lo que hay debajo de `/[complejo]` pasa por aquí primero.

   `cache()` es por petición, no entre peticiones: el layout, la página y
   media docena de componentes preguntan quién es el usuario, y sin esto eso
   serían seis viajes a la base para responder lo mismo.
   ========================================================================== */

export interface Sesion {
  persona: Persona;
  complejo: Complejo;
  rol: Rol;
  /** Dueño u operador: manda en la agenda. */
  staff: boolean;
  /** Solo el dueño ve el dinero agregado y toca Ajustes (§7.2.3). */
  dueno: boolean;
  /** El plan vencido no borra datos: pasa la plataforma a solo lectura (§8.3). */
  soloLectura: boolean;
}

export const miPersona = cache(async (): Promise<Persona | null> => {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const { data } = await sb.from('personas').select('*').eq('id', user.id).single();
  return (data as Persona) ?? null;
});

/** Los complejos a los que pertenece quien está dentro, con su rol. */
export const misComplejos = cache(async () => {
  const sb = await supabaseServer();
  const { data } = await sb
    .from('membresias')
    .select('rol, complejos!inner(id, slug, nombre, logo_url)')
    .order('creado_en', { ascending: true });

  return (data ?? []) as unknown as {
    rol: Rol;
    complejos: Pick<Complejo, 'id' | 'slug' | 'nombre' | 'logo_url'>;
  }[];
});

/**
 * Resuelve el complejo del slug y el rol de quien mira. Si no hay sesión,
 * a entrar; si el slug no existe o no es suyo, 404 — y son la misma
 * respuesta a propósito: "existe pero no es tuyo" ya es información.
 *
 * La primera versión encadenaba CUATRO viajes de red en fila —
 * `getUser()`, `personas`, `complejos`, `membresias`— antes de que la
 * página empezara a pedir un solo dato suyo. Solo el primero depende de
 * verdad de algo previo (hace falta el `user.id` para preguntar el resto);
 * las otras dos preguntas —quién es esta persona, y a qué complejo con este
 * slug pertenece— no dependen una de la otra, así que van a la vez. Y la de
 * membresía se combina con la del complejo en una sola consulta con
 * embebido: PostgREST trae `complejos` colgado de la fila de `membresias`
 * en la misma petición, así que esa pareja deja de ser dos viajes y pasa a
 * ser uno.
 */
export const resolverTenant = cache(async (slug: string): Promise<Sesion> => {
  const sb = await supabaseServer();

  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect('/entrar');

  const [{ data: persona }, { data: filas }] = await Promise.all([
    sb.from('personas').select('*').eq('id', user.id).maybeSingle(),
    sb.from('membresias')
      .select('rol, complejos!inner(*)')
      .eq('persona_id', user.id)
      .eq('complejos.slug', slug)
  ]);

  if (!persona) redirect('/entrar');

  const membresias = (filas ?? []) as unknown as { rol: Rol; complejos: Complejo }[];
  if (!membresias.length) notFound();

  const roles = membresias.map(m => m.rol);
  // Si alguien es dueño Y jugador del mismo complejo, manda el rol de más
  // alcance: el conmutador de la demo es cosa de la demo, aquí es la sesión.
  const rol: Rol = roles.includes('dueno') ? 'dueno'
    : roles.includes('operador') ? 'operador' : 'jugador';

  const c = membresias[0].complejos;
  return {
    persona: persona as Persona,
    complejo: c,
    rol,
    staff: rol === 'dueno' || rol === 'operador',
    dueno: rol === 'dueno',
    soloLectura: c.plan === 'vencido' || c.plan === 'solo_lectura'
  };
});

/** El mismo, pero exigiendo mando: lo usan Panel, Ajustes y las escrituras. */
export async function exigirStaff(slug: string): Promise<Sesion> {
  const s = await resolverTenant(slug);
  if (!s.staff) redirect(`/${slug}/j/inicio`);
  return s;
}

export async function exigirDueno(slug: string): Promise<Sesion> {
  const s = await resolverTenant(slug);
  if (!s.dueno) redirect(`/${slug}/panel`);
  return s;
}

/**
 * A dónde va alguien recién autenticado. El rol no es un filtro de permisos:
 * son dos productos distintos sobre el mismo estado (§2), así que el destino
 * es una vista distinta, no la misma con cosas ocultas.
 */
export async function miDestino(): Promise<string> {
  const lista = await misComplejos();
  if (!lista.length) return '/bienvenida';

  const staff = lista.find(m => m.rol === 'dueno' || m.rol === 'operador');
  if (staff) return `/${staff.complejos.slug}/panel`;

  return `/${lista[0].complejos.slug}/j/inicio`;
}
