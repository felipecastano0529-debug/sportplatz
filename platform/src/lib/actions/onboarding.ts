'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';
import { miPersona } from '@/lib/tenant';
import { telE164 } from '@/lib/util';
import { SPORTS, esDeporte, type SportId } from '@/lib/sports';

/* ==========================================================================
   Onboarding · cuatro preguntas y el negocio existe

   No da la bienvenida: PERSONALIZA. Con cuatro respuestas —nombre y
   WhatsApp, qué deportes, cuántas canchas de cada uno y a cuánto la hora— se
   crean el complejo y todas sus canchas, y se entra al Panel.

   Se escribe en dos pasos y no en una transacción porque no hace falta: si
   el complejo se crea y las canchas fallan, el dueño entra a un complejo sin
   canchas y las agrega desde Ajustes. Lo contrario —canchas sin complejo— no
   puede pasar: la clave foránea lo impide.
   ========================================================================== */

export interface AltaComplejo {
  nombre: string;
  whatsapp: string;
  deportes: SportId[];
  cuantas: Partial<Record<SportId, number>>;
  precios: Partial<Record<SportId, number>>;
}

export interface ResultadoAlta { error?: string }

export async function crearComplejo(datos: AltaComplejo): Promise<ResultadoAlta> {
  const persona = await miPersona();
  if (!persona) redirect('/entrar');

  const nombre = datos.nombre.trim();
  if (nombre.length < 2) return { error: 'El nombre del complejo necesita al menos dos letras.' };

  const deportes = datos.deportes.filter(esDeporte);
  if (!deportes.length) return { error: 'Elige al menos un deporte.' };

  const sb = await supabaseServer();

  // Una sola llamada: slug libre, complejo y membresía de dueño en la misma
  // transacción. No es un insert porque no puede serlo: `.insert().select()`
  // pide la fila de vuelta dentro de la misma sentencia, y en ese instante
  // la membresía todavía no existe, así que la política de lectura la
  // rechaza con un 42501. Está contado entero en
  // `supabase/migrations/0004_alta_de_complejo.sql`.
  const { data: filas, error } = await sb.rpc('crear_complejo', {
    p_nombre: nombre,
    p_whatsapp: telE164(datos.whatsapp)
  });

  if (error) return { error: `No se pudo crear el complejo: ${error.message}` };

  const complejo = (filas as { id: string; slug: string }[] | null)?.[0];
  if (!complejo) return { error: 'No se pudo crear el complejo.' };

  // La membresía de dueño ya está puesta. Aquí solo quedan las canchas.
  const canchas: Record<string, unknown>[] = [];
  let orden = 0;

  for (const deporte of deportes) {
    const cuantas = Math.max(1, Math.min(40, datos.cuantas[deporte] ?? 1));
    const precio = Math.max(0, Math.round(datos.precios[deporte] ?? SPORTS[deporte].price));

    for (let n = 1; n <= cuantas; n++) {
      canchas.push({
        complejo_id: complejo.id,
        deporte,
        numero: n,
        // "Sintética 1" es un nombre por defecto que se puede cambiar en
        // Ajustes, no una etiqueta del sistema.
        nombre: `${SPORTS[deporte].short} ${n}`,
        precio,
        orden: orden++
      });
    }
  }

  const { error: eCanchas } = await sb.from('canchas').insert(canchas);
  if (eCanchas) {
    revalidatePath('/', 'layout');
    return {
      error: `El complejo quedó creado, pero las canchas no: ${eCanchas.message}. ` +
        'Puedes agregarlas desde Ajustes.'
    };
  }

  revalidatePath('/', 'layout');
  redirect(`/${complejo.slug}/panel`);
}

/**
 * El jugador entra al complejo por el link que le manda el negocio. La
 * función de la base también le atribuye las reservas que el mostrador ya
 * creó a su teléfono (§7.1): el teléfono es la llave de unión.
 */
export async function unirmeAComplejo(slug: string): Promise<ResultadoAlta> {
  const persona = await miPersona();
  if (!persona) redirect('/entrar');

  const limpio = slug.trim().toLowerCase().replace(/^.*\//, '');
  if (!limpio) return { error: 'Escribe la dirección del complejo.' };

  const sb = await supabaseServer();
  const { error } = await sb.rpc('unirme_al_complejo', { s: limpio });

  if (error) {
    return error.message.includes('no encontrado')
      ? { error: `No existe ningún complejo en «${limpio}». Revisa el link que te mandaron.` }
      : { error: `No se pudo entrar: ${error.message}` };
  }

  revalidatePath('/', 'layout');
  redirect(`/${limpio}/j/inicio`);
}
