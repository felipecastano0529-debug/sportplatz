-- ===========================================================================
-- Realtime · publicar las reservas
--
-- `components/app/Realtime.tsx` escucha `postgres_changes` sobre
-- `public.reservas` filtrando por `complejo_id`. Esa suscripción se conecta
-- y devuelve SUBSCRIBED aunque la tabla no esté publicada: simplemente no
-- llega nunca un evento. No hay error en consola, no hay fila roja en la red,
-- no hay nada. La agenda deja de moverse sola y parece un fallo de la vista.
--
-- Por eso esto es una migración y no un clic en el panel: si la base se
-- reconstruye desde cero, §1.3 —el jugador reserva y el dueño lo ve caer en
-- la hora exacta, sin recargar— tiene que volver a funcionar sin que nadie
-- se acuerde de esto.
--
-- Lo que sale por el canal sigue pasando por RLS: Realtime evalúa las
-- políticas de `reservas` contra el JWT de quien escucha. Publicar la tabla
-- no enseña de más; solo la conecta.
-- ===========================================================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'reservas'
  ) then
    alter publication supabase_realtime add table public.reservas;
  end if;
end
$$;

-- El payload de un UPDATE trae solo las columnas que cambiaron y la clave
-- primaria. `Realtime.tsx` lee `cliente` y `origen` de la fila para anunciar
-- quién reservó, así que hace falta la fila entera.
alter table public.reservas replica identity full;
