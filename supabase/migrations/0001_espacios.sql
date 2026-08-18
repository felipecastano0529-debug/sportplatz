-- ===========================================================================
-- Sportplatz · esquema inicial
--
-- Un negocio = una fila en `espacios`, con todo su estado en una columna
-- `jsonb`. No está normalizado en veinte tablas, y es una decisión, no una
-- prisa:
--
--   · La app entera lee el estado de forma SÍNCRONA (`S.bookings.filter(...)`
--     aparece en cada vista). Normalizar obligaría a volver asíncrona cada
--     función de cálculo y cada render — una reescritura completa, no una
--     migración.
--   · El documento de un complejo real ronda 1 MB. Postgres lo guarda en
--     TOAST comprimido sin despeinarse.
--   · Realtime sobre una fila entera es exactamente lo que hace falta aquí:
--     el dueño ve aparecer la reserva del jugador sin más maquinaria.
--
-- Cuándo dejará de servir, para que quede escrito: cuando haga falta consultar
-- ENTRE negocios (informes agregados), cuando dos personas editen a la vez de
-- forma habitual, o cuando el documento pase de unos pocos MB. Ahí se
-- normaliza `reservas` primero, que es la tabla que más crece.
-- ===========================================================================

create extension if not exists "pgcrypto";

-- ── Espacios ───────────────────────────────────────────────────────────────

create table if not exists public.espacios (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users (id) on delete cascade,
  nombre      text not null check (length(trim(nombre)) between 1 and 120),
  estado      jsonb not null,
  -- Concurrencia optimista: quien escribe manda la versión que leyó. Si no
  -- coincide, la escritura se rechaza y el cliente relee en vez de pisar.
  version     bigint not null default 1,
  creado_en   timestamptz not null default now(),
  actualizado timestamptz not null default now()
);

-- Un dueño, un espacio. Se quita este índice el día que un mismo dueño
-- administre varios complejos.
create unique index if not exists espacios_owner_unico
  on public.espacios (owner_id);

create index if not exists espacios_actualizado
  on public.espacios (actualizado desc);

-- ── Seguridad a nivel de fila ──────────────────────────────────────────────
-- La clave `anon` viaja al navegador de cualquier visitante: es pública por
-- diseño. Lo único que separa los datos de un negocio de los de otro son
-- estas políticas. Si esto está mal, todo lo demás da igual.

alter table public.espacios enable row level security;

drop policy if exists "leer lo propio"     on public.espacios;
drop policy if exists "crear lo propio"    on public.espacios;
drop policy if exists "editar lo propio"   on public.espacios;
drop policy if exists "borrar lo propio"   on public.espacios;

create policy "leer lo propio" on public.espacios
  for select to authenticated
  using (auth.uid() = owner_id);

create policy "crear lo propio" on public.espacios
  for insert to authenticated
  with check (auth.uid() = owner_id);

create policy "editar lo propio" on public.espacios
  for update to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "borrar lo propio" on public.espacios
  for delete to authenticated
  using (auth.uid() = owner_id);

-- Sin política para `anon`: quien no ha entrado no lee ni escribe nada.
-- El modo demo no toca esta tabla; vive en el navegador.

-- ── Marca de tiempo y versión ──────────────────────────────────────────────

create or replace function public.tocar_espacio()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  new.actualizado := now();
  new.version     := old.version + 1;
  new.owner_id    := old.owner_id;   -- el dueño no se reasigna desde el cliente
  new.creado_en   := old.creado_en;
  return new;
end;
$$;

drop trigger if exists espacios_tocar on public.espacios;
create trigger espacios_tocar
  before update on public.espacios
  for each row execute function public.tocar_espacio();

-- ── Guardado con control de versión ────────────────────────────────────────
-- El cliente llama a esto en vez de un UPDATE directo. Si la versión que trae
-- no es la que hay en la base, otro escribió entretanto: se devuelve el estado
-- bueno y el cliente decide, en vez de perder datos en silencio.

create or replace function public.guardar_espacio(
  p_id      uuid,
  p_estado  jsonb,
  p_version bigint
)
returns table (ok boolean, version bigint, estado jsonb)
language plpgsql
security invoker set search_path = ''
as $$
declare
  v_actual bigint;
begin
  select e.version into v_actual
    from public.espacios e
   where e.id = p_id and e.owner_id = auth.uid()
   for update;

  if v_actual is null then
    raise exception 'espacio inexistente o ajeno' using errcode = '42501';
  end if;

  if v_actual <> p_version then
    -- Conflicto: alguien más guardó. Se devuelve lo que hay.
    return query
      select false, e.version, e.estado
        from public.espacios e where e.id = p_id;
    return;
  end if;

  update public.espacios e
     set estado = p_estado
   where e.id = p_id;

  return query
    select true, e.version, null::jsonb
      from public.espacios e where e.id = p_id;
end;
$$;

revoke all on function public.guardar_espacio(uuid, jsonb, bigint) from public, anon;
grant execute on function public.guardar_espacio(uuid, jsonb, bigint) to authenticated;

-- ── Realtime ───────────────────────────────────────────────────────────────
-- Para que el dueño vea aparecer la reserva del jugador sin recargar.
-- Publica solo las filas que RLS ya deja ver.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and tablename = 'espacios'
  ) then
    alter publication supabase_realtime add table public.espacios;
  end if;
end $$;
