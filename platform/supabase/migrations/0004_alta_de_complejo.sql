-- ===========================================================================
-- El alta de un complejo · de insert crudo a operación con nombre
--
-- SÍNTOMA
--   `actions/onboarding.ts` daba de alta el negocio con
--   `.insert({...}).select('id, slug')` y la base contestaba 42501:
--   "new row violates row-level security policy for table complejos".
--   El primer paso del producto —registrarte y crear tu complejo— no
--   funcionaba contra 0001. Salió corriendo `npm run preparar`.
--
-- CAUSA, en dos capas
--   La política de insert es `with check (true)`, así que el insert nunca
--   estuvo en discusión. Fallaba el `.select()`: PostgREST lo traduce a
--   `insert ... returning`, y Postgres comprueba la política de SELECT sobre
--   la fila devuelta DENTRO de la sentencia del insert. En ese instante la
--   membresía de dueño todavía no existía, así que `es_del_complejo(id)` era
--   falso: la base escribía la fila y acto seguido se negaba a enseñársela a
--   quien la acababa de escribir.
--
--   El primer intento fue adelantar el trigger de `after` a `before`. No
--   basta, y el motivo es sutil: `es_del_complejo` está declarada `stable`,
--   así que trabaja con el snapshot tomado al empezar la sentencia y NO ve
--   filas escritas por un trigger dentro de esa misma sentencia. Ningún
--   orden de triggers gana esa carrera. Marcarla `volatile` la arreglaría y
--   costaría una reevaluación por fila en cada política del esquema: cara
--   equivocada de la moneda.
--
-- ARREGLO
--   Crear el complejo deja de ser un insert con un trigger mágico detrás y
--   pasa a ser una operación con nombre: `crear_complejo()`. Hace las tres
--   cosas —slug libre, complejo, membresía de dueño— en una transacción y
--   devuelve la fila directamente, sin pedirle permiso a una política de
--   lectura que en ese momento aún no puede decir que sí.
--
--   `security definer` no abre nada aquí: la función exige sesión y la única
--   fila que sabe escribir es un complejo cuyo dueño es quien la llama. Es
--   exactamente lo que la política `with check (true)` ya permitía, pero sin
--   la carrera.
--
--   El trigger `al_crear_complejo` se queda como estaba —`after insert`— por
--   si alguien inserta directo: la membresía se sigue poniendo sola. Lo que
--   ya no se puede es pedir la fila de vuelta en el mismo viaje, y para eso
--   está esta función.
-- ===========================================================================

-- Se revierte el intento anterior: la clave foránea vuelve a ser inmediata,
-- la función del trigger deja de aplazarla, y el trigger vuelve a `after`,
-- que es su sitio natural.
alter table public.membresias
  drop constraint membresias_complejo_id_fkey,
  add  constraint membresias_complejo_id_fkey
       foreign key (complejo_id) references public.complejos(id) on delete cascade;

create or replace function public.dueno_al_crear_complejo()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.membresias (complejo_id, persona_id, rol)
  values (new.id, auth.uid(), 'dueno')
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists al_crear_complejo on public.complejos;
create trigger al_crear_complejo
  after insert on public.complejos
  for each row when (auth.uid() is not null)
  execute function public.dueno_al_crear_complejo();

-- ── La operación ───────────────────────────────────────────────────────────

create or replace function public.crear_complejo(p_nombre text, p_whatsapp text default null)
returns table (id uuid, slug text)
language plpgsql volatile security definer set search_path = '' as $$
declare
  quien  uuid := auth.uid();
  limpio text := trim(p_nombre);
  base   text;
  libre  text;
  n      int  := 1;
  nuevo  uuid;
begin
  -- Sin sesión no hay alta. `security definer` salta RLS, así que esta línea
  -- es la puerta y no un adorno.
  if quien is null then
    raise exception 'hay que entrar para crear un complejo' using errcode = '42501';
  end if;

  if length(limpio) < 2 then
    raise exception 'el nombre del complejo necesita al menos dos letras' using errcode = '23514';
  end if;
  limpio := left(limpio, 120);

  -- El slug se resuelve aquí, que es donde vive la restricción de unicidad.
  -- Hacerlo en el cliente es una carrera con quien se registre en el mismo
  -- segundo.
  base := regexp_replace(lower(limpio), '[^a-z0-9]+', '-', 'g');
  base := trim(both '-' from base);
  if length(base) < 2 then base := 'complejo'; end if;
  base := left(base, 36);

  libre := base;
  while exists (select 1 from public.complejos c where c.slug = libre) loop
    n := n + 1;
    libre := left(base, 36 - length(n::text) - 1) || '-' || n;
  end loop;

  insert into public.complejos (slug, nombre, whatsapp)
  values (libre, limpio, nullif(trim(coalesce(p_whatsapp, '')), ''))
  returning complejos.id into nuevo;

  -- El trigger `after insert` ya la habrá puesto; esto la garantiza aunque
  -- alguien lo quite algún día. La clave primaria hace el resto.
  insert into public.membresias (complejo_id, persona_id, rol)
  values (nuevo, quien, 'dueno')
  on conflict do nothing;

  return query select nuevo, libre;
end;
$$;

revoke execute on function public.crear_complejo(text, text) from public, anon;
grant  execute on function public.crear_complejo(text, text) to authenticated;

comment on function public.crear_complejo(text, text) is
  'Alta de un complejo: slug libre + complejo + membresía de dueño, en una transacción. '
  'Devuelve la fila sin pasar por la política de lectura, que en ese instante todavía no puede aprobarla.';
