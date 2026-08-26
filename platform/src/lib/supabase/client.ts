'use client';

import { createBrowserClient } from '@supabase/ssr';

/* ==========================================================================
   Supabase · cliente de navegador

   Solo para lo que el servidor no puede hacer: escuchar realtime (que el
   dueño vea caer la reserva del jugador sin recargar, §6.2) y subir
   archivos. Las lecturas de página van por Server Components, y las
   escrituras por Server Actions.

   La clave `anon` viaja aquí: es su propósito. Lo que separa los datos de un
   negocio de los de otro son las políticas de fila, no esconder la clave.
   ========================================================================== */

let unico: ReturnType<typeof createBrowserClient> | null = null;

export function supabaseBrowser() {
  // Uno solo por pestaña: dos clientes son dos sockets de realtime y dos
  // refrescos de token compitiendo por la misma cookie.
  unico ??= createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  return unico;
}
