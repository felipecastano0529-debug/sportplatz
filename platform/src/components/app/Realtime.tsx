'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { RealtimePostgresInsertPayload } from '@supabase/supabase-js';
import { supabaseBrowser } from '@/lib/supabase/client';
import { toast } from '@/components/ui/Toast';

/* ==========================================================================
   Realtime · el momento que vende

   §1.3 — el jugador reserva y el dueño lo ve caer en la agenda, en la hora
   exacta, sin recargar. En la demo eso era un conmutador de rol; aquí son
   dos personas y dos dispositivos, y es la promesa comercial entera.

   Suscripción filtrada por `complejo_id`: la base solo manda lo del complejo
   que se está mirando, no todo lo que se mueve en la plataforma.

   Lo que llega NO se pinta directamente. Se pide a Next que revalide, y el
   servidor devuelve la vista ya resuelta. Es una petición más por evento,
   pero a cambio no hay dos fuentes de verdad ni un estado de cliente que se
   desincronice del de servidor.
   ========================================================================== */

export function AgendaEnVivo({
  complejoId,
  avisar = false
}: {
  complejoId: string;
  /** Si es el staff, además del refresco se anuncia. El jugador no: ya sabe
      lo que acaba de hacer. */
  avisar?: boolean;
}) {
  const router = useRouter();
  // El router cambia de identidad en cada render; guardarlo en una ref evita
  // que el efecto se desmonte y vuelva a suscribirse en cada navegación.
  const refrescar = useRef(() => router.refresh());
  refrescar.current = () => router.refresh();

  useEffect(() => {
    const sb = supabaseBrowser();

    const canal = sb
      .channel(`agenda:${complejoId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'reservas',
          filter: `complejo_id=eq.${complejoId}`
        },
        (payload: RealtimePostgresInsertPayload<{ cliente: string; origen: string }>) => {
          if (avisar) {
            const r = payload.new;
            const por =
              r.origen === 'bot' ? ' por WhatsApp'
              : r.origen === 'neo' ? ' hablando con Neo'
              : r.origen === 'app' ? ' desde la app'
              : '';
            toast(`Entró una reserva de ${r.cliente || 'alguien'}${por}`);
          }
          refrescar.current();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'reservas',
          filter: `complejo_id=eq.${complejoId}`
        },
        () => refrescar.current()
      )
      .subscribe();

    return () => { sb.removeChannel(canal); };
  }, [complejoId, avisar]);

  return null;
}
