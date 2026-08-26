import { cache } from 'react';
import { supabaseServer } from '@/lib/supabase/server';
import type { Cancha } from '@/lib/types';

/* ==========================================================================
   Consultas · Canchas

   Todo lo de aquí pasa por RLS: la sesión del usuario viaja en la cookie y
   la base decide qué filas devuelve. No hay ni un `complejo_id` que venga
   del cliente sin haber pasado antes por `resolverTenant`.
   ========================================================================== */

export const canchasDe = cache(async (complejoId: string): Promise<Cancha[]> => {
  const sb = await supabaseServer();
  const { data, error } = await sb
    .from('canchas')
    .select('*')
    .eq('complejo_id', complejoId)
    .order('deporte', { ascending: true })
    .order('orden', { ascending: true })
    .order('numero', { ascending: true });

  if (error) throw new Error(`No se pudieron leer las canchas: ${error.message}`);
  return (data ?? []) as Cancha[];
});

/** Solo las que se pueden reservar. Una cancha inactiva no cuenta (R7). */
export const canchasActivas = cache(async (complejoId: string) =>
  (await canchasDe(complejoId)).filter(c => c.activa));

/** Los deportes que este complejo ofrece de verdad, en orden de catálogo. */
export const deportesDe = cache(async (complejoId: string) => {
  const canchas = await canchasDe(complejoId);
  return [...new Set(canchas.map(c => c.deporte))];
});
