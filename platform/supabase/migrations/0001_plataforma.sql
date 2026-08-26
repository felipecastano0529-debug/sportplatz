-- ===========================================================================
-- Sportplatz · plataforma · esquema inicial
--
-- Implementa PLATAFORMA.md §5.2 (modelo), §5.4 (RLS) y §7.2 (aislamiento).
-- Multi-tenant por `complejo_id`, con seguridad de fila en TODAS las tablas.
--
-- Tres decisiones que atraviesan el archivo:
--
--   1. SIN COLUMNAS ACUMULADAS (R31–R33). El histórico se deriva de los
--      partidos y de las anotaciones en tiempo de lectura. La única
--      acumulación es `reservas.abonado`, que la mantiene un trigger sobre
--      `pagos` y es reconstruible de cero con una sola consulta.
--
--   2. LA NO-DOBLE-RESERVA ES UNA RESTRICCIÓN, NO UNA COMPROBACIÓN (R4). En
--      la demo se validaba en cliente; aquí es un índice único parcial. Dos
--      personas pulsando a la vez: una gana, la otra recibe 23505 y un
--      mensaje claro. Nunca hay dos.
--
--   3. NINGUNA POLÍTICA PARA `anon`. Quien no ha entrado no lee ni escribe.
--      La clave pública viaja al navegador por diseño; lo único que separa
--      los datos de un negocio de los de otro son estas políticas.
-- ===========================================================================

create extension if not exists "pgcrypto";

-- ── Tenencia ───────────────────────────────────────────────────────────────

create table if not exists public.complejos (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null
                check (slug ~ '^[a-z0-9][a-z0-9-]{1,39}$'),
  nombre        text not null check (length(trim(nombre)) between 1 and 120),
  whatsapp      text,
  logo_url      text,
  -- El horario de atención es del negocio (R2). Cambiarlo NO borra reservas
  -- que queden fuera (R3): se muestran igual y se avisa.
  hora_abre     smallint not null default 6  check (hora_abre  between 0 and 23),
  hora_cierra   smallint not null default 23 check (hora_cierra between 1 and 24),
  moneda        text not null default 'COP',
  zona_horaria  text not null default 'America/Bogota',
  -- El acento y el modo de fondo que elige el dueño en Ajustes. Es jsonb
  -- porque es piel, no dato de negocio: nada lo consulta ni lo agrega.
  --   { "accent": "#047857", "accentHi": "#34d399", "fondo": "estadio" }
  tema          jsonb not null default '{}'::jsonb,
  plan          text not null default 'trial'
                check (plan in ('trial','activo','vencido','solo_lectura')),
  creado_en     timestamptz not null default now(),
  check (hora_cierra > hora_abre)
);

-- Un ser humano. Puede ser dueño de un complejo y jugador en otro: los
-- perfiles no se duplican, se enlazan por esta fila.
create table if not exists public.personas (
  id         uuid primary key references auth.users(id) on delete cascade,
  nombre     text not null default 'Jugador',
  telefono   text unique,
  email      text,
  avatar_url text,
  -- Color de identidad, para el avatar dibujado cuando no hay foto.
  color      text not null default '#0f8a4d',
  creado_en  timestamptz not null default now()
);

-- Quién puede qué, dentro de qué complejo. Es la tabla que resuelve el
-- tenant: nunca se confía en un `complejo_id` que venga del cliente.
create table if not exists public.membresias (
  complejo_id uuid not null references public.complejos(id) on delete cascade,
  persona_id  uuid not null references public.personas(id)  on delete cascade,
  rol         text not null check (rol in ('dueno','operador','jugador')),
  creado_en   timestamptz not null default now(),
  primary key (complejo_id, persona_id, rol)
);
create index if not exists membresias_persona on public.membresias (persona_id);

-- ── Recursos ───────────────────────────────────────────────────────────────

create table if not exists public.canchas (
  id          uuid primary key default gen_random_uuid(),
  complejo_id uuid not null references public.complejos(id) on delete cascade,
  deporte     text not null check (deporte in
                ('futbol','padel','tenis','voleibol','paintball')),
  numero      smallint not null,
  nombre      text not null,
  precio      integer not null check (precio >= 0),   -- COP, sin decimales
  foto_url    text,
  activa      boolean not null default true,          -- R7
  orden       smallint not null default 0
);
create index if not exists canchas_complejo on public.canchas (complejo_id, deporte, orden);

-- ── Agenda ─────────────────────────────────────────────────────────────────

create table if not exists public.reservas (
  id           uuid primary key default gen_random_uuid(),
  complejo_id  uuid not null references public.complejos(id) on delete cascade,
  cancha_id    uuid not null references public.canchas(id)   on delete cascade,
  fecha        date not null,
  inicio       time not null,                 -- siempre en punto (R1)
  fin          time not null,
  persona_id   uuid references public.personas(id) on delete set null,
  cliente      text not null,                 -- nombre congelado
  telefono     text,
  total        integer not null check (total >= 0),          -- congelado (R8)
  abonado      integer not null default 0
               check (abonado >= 0 and abonado <= total),    -- R9, R15
  origen       text not null default 'mostrador'
               check (origen in ('mostrador','app','neo','bot')),   -- R18
  estado       text not null default 'confirmada'
               check (estado in ('confirmada','jugada','cancelada','no_show')),
  nota         text not null default '',
  -- R48: el código corto con el que se cancela por WhatsApp. Generado, no
  -- guardado a mano: no puede desincronizarse del id.
  codigo       text generated always as
               ('SP-' || upper(right(id::text, 4))) stored,
  cancelada_en  timestamptz,
  cancelada_por uuid references public.personas(id) on delete set null,
  creado_en    timestamptz not null default now()
);

-- R4. Parcial a propósito: una reserva cancelada libera su franja, y por eso
-- cancelar NO borra la fila (R19) — el negocio necesita saber qué se cayó.
create unique index if not exists reservas_franja_unica
  on public.reservas (cancha_id, fecha, inicio)
  where estado in ('confirmada','jugada');

create index if not exists reservas_agenda  on public.reservas (complejo_id, fecha);
create index if not exists reservas_persona on public.reservas (persona_id, fecha desc);

-- Cada movimiento de plata, no un contador (P4, P5, P6). `abonado` se
-- mantiene por trigger sobre esta tabla: es la única acumulación permitida.
create table if not exists public.pagos (
  id          uuid primary key default gen_random_uuid(),
  complejo_id uuid not null references public.complejos(id) on delete cascade,
  reserva_id  uuid not null references public.reservas(id) on delete cascade,
  monto       integer not null check (monto <> 0),   -- negativo = devolución
  medio       text not null check (medio in
                ('efectivo','transferencia','pasarela','cortesia')),
  referencia  text,                                  -- id de la pasarela
  registrado_por uuid references public.personas(id) on delete set null,
  creado_en   timestamptz not null default now()
);
create index if not exists pagos_reserva on public.pagos (reserva_id);
-- P4: un webhook repetido no cobra dos veces.
create unique index if not exists pagos_referencia_unica
  on public.pagos (complejo_id, referencia) where referencia is not null;

-- ── Comunidad ──────────────────────────────────────────────────────────────

create table if not exists public.equipos (
  id          uuid primary key default gen_random_uuid(),
  complejo_id uuid not null references public.complejos(id) on delete cascade,
  nombre      text not null,
  deporte     text not null check (deporte in
                ('futbol','padel','tenis','voleibol','paintball')),
  color       text not null default '#0f8a4d',
  escudo_url  text,
  capitan_id  uuid references public.personas(id) on delete set null,
  creado_en   timestamptz not null default now()
);
create index if not exists equipos_complejo on public.equipos (complejo_id);

create table if not exists public.plantillas (
  equipo_id  uuid not null references public.equipos(id)  on delete cascade,
  persona_id uuid not null references public.personas(id) on delete cascade,
  posicion   text,                                        -- R37
  desde      date not null default current_date,
  primary key (equipo_id, persona_id)                     -- R35
);
create index if not exists plantillas_persona on public.plantillas (persona_id);

create table if not exists public.torneos (
  id           uuid primary key default gen_random_uuid(),
  complejo_id  uuid not null references public.complejos(id) on delete cascade,
  nombre       text not null,
  deporte      text not null check (deporte in
                 ('futbol','padel','tenis','voleibol','paintball')),
  tamano       smallint not null check (tamano in (4,8,16)),   -- R22
  fecha_inicio date not null,
  inscripcion_abierta boolean not null default false,          -- R28
  creado_en    timestamptz not null default now()
);
create index if not exists torneos_complejo on public.torneos (complejo_id);

create table if not exists public.torneo_cupos (
  id         uuid primary key default gen_random_uuid(),
  torneo_id  uuid not null references public.torneos(id) on delete cascade,
  posicion   smallint not null,
  -- R30: apunta a un equipo REAL. Es lo único que hace posible el histórico.
  equipo_id  uuid references public.equipos(id) on delete set null,
  nombre     text not null,
  color      text not null,
  unique (torneo_id, posicion)
);

create table if not exists public.partidos (
  id         uuid primary key default gen_random_uuid(),
  torneo_id  uuid not null references public.torneos(id) on delete cascade,
  ronda      text not null check (ronda in
               ('octavos','cuartos','semis','final','tercero')),   -- R23
  idx        smallint not null,
  cupo_a     uuid references public.torneo_cupos(id) on delete set null,
  cupo_b     uuid references public.torneo_cupos(id) on delete set null,
  marcador_a smallint check (marcador_a >= 0),
  marcador_b smallint check (marcador_b >= 0),
  fecha      date,
  hora       time,
  cancha_id  uuid references public.canchas(id) on delete set null,
  jugado     boolean not null default false,
  unique (torneo_id, ronda, idx)
);

-- Anotaciones: el hecho, no el total (R31).
create table if not exists public.anotaciones (
  id         uuid primary key default gen_random_uuid(),
  partido_id uuid not null references public.partidos(id) on delete cascade,
  cupo_id    uuid not null references public.torneo_cupos(id) on delete cascade,
  persona_id uuid references public.personas(id) on delete set null,
  nombre     text not null,          -- congelado, por si no tiene cuenta
  goles      smallint not null default 1 check (goles > 0)
);
create index if not exists anotaciones_partido on public.anotaciones (partido_id);

-- ===========================================================================
-- Automatismos
-- ===========================================================================

-- Toda cuenta de auth nace con su fila en `personas`. Sin esto, un usuario
-- recién registrado no puede hacer NADA: todas las políticas cuelgan de aquí.
create or replace function public.persona_al_registrarse()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.personas (id, nombre, email, telefono)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'nombre'), ''),
             split_part(coalesce(new.email, 'Jugador'), '@', 1)),
    new.email,
    nullif(new.raw_user_meta_data ->> 'telefono', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists al_crear_usuario on auth.users;
create trigger al_crear_usuario
  after insert on auth.users
  for each row execute function public.persona_al_registrarse();

-- `abonado` se recalcula desde `pagos` y nunca se escribe a mano. Es la
-- única acumulación del esquema y es reconstruible: si algún día se sospecha
-- de ella, este mismo SELECT la regenera entera.
create or replace function public.recalcular_abonado()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  r uuid := coalesce(new.reserva_id, old.reserva_id);
begin
  update public.reservas res
     set abonado = least(
           res.total,
           greatest(0, (select coalesce(sum(p.monto), 0)
                          from public.pagos p where p.reserva_id = r)))
   where res.id = r;
  return null;
end;
$$;

drop trigger if exists pagos_recalculan_abonado on public.pagos;
create trigger pagos_recalculan_abonado
  after insert or update or delete on public.pagos
  for each row execute function public.recalcular_abonado();

-- ===========================================================================
-- Seguridad de fila
--
-- Si esto está mal, todo lo demás da igual.
-- ===========================================================================

-- La función que usan todas las políticas. `security definer` para poder
-- leer `membresias` sin caer en recursión de políticas, y `search_path`
-- vacío para que nadie pueda colar un esquema propio delante.
create or replace function public.es_del_complejo(c uuid, roles text[] default null)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.membresias m
     where m.complejo_id = c
       and m.persona_id = auth.uid()
       and (roles is null or m.rol = any(roles))
  );
$$;

-- Atajo legible: "manda en este complejo" = dueño u operador.
create or replace function public.es_staff(c uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.es_del_complejo(c, array['dueno','operador']);
$$;

create or replace function public.es_dueno(c uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.es_del_complejo(c, array['dueno']);
$$;

alter table public.complejos    enable row level security;
alter table public.personas     enable row level security;
alter table public.membresias   enable row level security;
alter table public.canchas      enable row level security;
alter table public.reservas     enable row level security;
alter table public.pagos        enable row level security;
alter table public.equipos      enable row level security;
alter table public.plantillas   enable row level security;
alter table public.torneos      enable row level security;
alter table public.torneo_cupos enable row level security;
alter table public.partidos     enable row level security;
alter table public.anotaciones  enable row level security;

-- ── Complejos ──────────────────────────────────────────────────────────────
drop policy if exists "ver mi complejo"     on public.complejos;
drop policy if exists "crear complejo"      on public.complejos;
drop policy if exists "el dueño edita"      on public.complejos;

create policy "ver mi complejo" on public.complejos for select to authenticated
  using (public.es_del_complejo(id));

-- Cualquiera con cuenta puede dar de alta SU complejo; el trigger de abajo
-- le pone la membresía de dueño en el mismo momento.
create policy "crear complejo" on public.complejos for insert to authenticated
  with check (true);

create policy "el dueño edita" on public.complejos for update to authenticated
  using (public.es_dueno(id)) with check (public.es_dueno(id));

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

-- ── Personas ───────────────────────────────────────────────────────────────
drop policy if exists "verme"             on public.personas;
drop policy if exists "ver a los del complejo" on public.personas;
drop policy if exists "editarme"          on public.personas;

create policy "verme" on public.personas for select to authenticated
  using (id = auth.uid());

-- El staff ve a las personas de su complejo: sin esto no hay directorio de
-- jugadores ni plantillas.
create policy "ver a los del complejo" on public.personas for select to authenticated
  using (exists (
    select 1 from public.membresias m
     where m.persona_id = public.personas.id
       and public.es_del_complejo(m.complejo_id)
  ));

create policy "editarme" on public.personas for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- ── Membresías ─────────────────────────────────────────────────────────────
drop policy if exists "ver membresías"    on public.membresias;
drop policy if exists "el dueño invita"   on public.membresias;
drop policy if exists "el dueño revoca"   on public.membresias;
drop policy if exists "apuntarme como jugador" on public.membresias;

create policy "ver membresías" on public.membresias for select to authenticated
  using (persona_id = auth.uid() or public.es_staff(complejo_id));

create policy "el dueño invita" on public.membresias for insert to authenticated
  with check (public.es_dueno(complejo_id));

-- Un jugador se apunta solo a un complejo, nunca se asciende: el rol está
-- clavado a 'jugador' en la propia política.
create policy "apuntarme como jugador" on public.membresias for insert to authenticated
  with check (persona_id = auth.uid() and rol = 'jugador');

create policy "el dueño revoca" on public.membresias for delete to authenticated
  using (public.es_dueno(complejo_id) and not (persona_id = auth.uid() and rol = 'dueno'));

-- ── Canchas ────────────────────────────────────────────────────────────────
drop policy if exists "ver canchas"     on public.canchas;
drop policy if exists "el staff edita canchas" on public.canchas;

-- El jugador necesita ver las canchas para poder reservar. Lo que NO ve es
-- la agenda de las demás personas: eso lo resuelve la política de reservas.
create policy "ver canchas" on public.canchas for select to authenticated
  using (public.es_del_complejo(complejo_id));

create policy "el staff edita canchas" on public.canchas for all to authenticated
  using (public.es_staff(complejo_id)) with check (public.es_staff(complejo_id));

-- ── Reservas ───────────────────────────────────────────────────────────────
drop policy if exists "agenda del complejo" on public.reservas;
drop policy if exists "mis reservas"        on public.reservas;
drop policy if exists "el staff agenda"     on public.reservas;
drop policy if exists "reservar"            on public.reservas;
drop policy if exists "cancelar lo mío"     on public.reservas;

create policy "agenda del complejo" on public.reservas for select to authenticated
  using (public.es_staff(complejo_id));

create policy "mis reservas" on public.reservas for select to authenticated
  using (persona_id = auth.uid());

create policy "el staff agenda" on public.reservas for all to authenticated
  using (public.es_staff(complejo_id)) with check (public.es_staff(complejo_id));

-- El jugador reserva A SU NOMBRE, en un complejo donde está inscrito, y no
-- puede darse por pagado: `abonado` entra en 0 y solo lo mueve un `pago`.
create policy "reservar" on public.reservas for insert to authenticated
  with check (persona_id = auth.uid()
              and abonado = 0
              and estado = 'confirmada'
              and origen in ('app','neo')
              and public.es_del_complejo(complejo_id));

create policy "cancelar lo mío" on public.reservas for update to authenticated
  using (persona_id = auth.uid()) with check (persona_id = auth.uid());

-- ── Pagos ──────────────────────────────────────────────────────────────────
drop policy if exists "ver pagos del complejo" on public.pagos;
drop policy if exists "ver mis pagos"          on public.pagos;
drop policy if exists "el staff cobra"         on public.pagos;

create policy "ver pagos del complejo" on public.pagos for select to authenticated
  using (public.es_staff(complejo_id));

create policy "ver mis pagos" on public.pagos for select to authenticated
  using (exists (select 1 from public.reservas r
                  where r.id = reserva_id and r.persona_id = auth.uid()));

create policy "el staff cobra" on public.pagos for all to authenticated
  using (public.es_staff(complejo_id)) with check (public.es_staff(complejo_id));

-- ── Comunidad ──────────────────────────────────────────────────────────────
drop policy if exists "ver equipos"        on public.equipos;
drop policy if exists "el staff edita equipos" on public.equipos;
drop policy if exists "el capitán edita su equipo" on public.equipos;
drop policy if exists "crear mi equipo"    on public.equipos;

create policy "ver equipos" on public.equipos for select to authenticated
  using (public.es_del_complejo(complejo_id));

create policy "el staff edita equipos" on public.equipos for all to authenticated
  using (public.es_staff(complejo_id)) with check (public.es_staff(complejo_id));

create policy "crear mi equipo" on public.equipos for insert to authenticated
  with check (capitan_id = auth.uid() and public.es_del_complejo(complejo_id));

create policy "el capitán edita su equipo" on public.equipos for update to authenticated
  using (capitan_id = auth.uid()) with check (capitan_id = auth.uid());

drop policy if exists "ver plantillas"   on public.plantillas;
drop policy if exists "armar plantilla"  on public.plantillas;

create policy "ver plantillas" on public.plantillas for select to authenticated
  using (exists (select 1 from public.equipos e
                  where e.id = equipo_id and public.es_del_complejo(e.complejo_id)));

create policy "armar plantilla" on public.plantillas for all to authenticated
  using (exists (select 1 from public.equipos e
                  where e.id = equipo_id
                    and (e.capitan_id = auth.uid() or public.es_staff(e.complejo_id))))
  with check (exists (select 1 from public.equipos e
                  where e.id = equipo_id
                    and (e.capitan_id = auth.uid() or public.es_staff(e.complejo_id))));

drop policy if exists "ver torneos"        on public.torneos;
drop policy if exists "el staff organiza"  on public.torneos;

create policy "ver torneos" on public.torneos for select to authenticated
  using (public.es_del_complejo(complejo_id));

create policy "el staff organiza" on public.torneos for all to authenticated
  using (public.es_staff(complejo_id)) with check (public.es_staff(complejo_id));

drop policy if exists "ver cupos"     on public.torneo_cupos;
drop policy if exists "el staff sortea" on public.torneo_cupos;

create policy "ver cupos" on public.torneo_cupos for select to authenticated
  using (exists (select 1 from public.torneos t
                  where t.id = torneo_id and public.es_del_complejo(t.complejo_id)));

create policy "el staff sortea" on public.torneo_cupos for all to authenticated
  using (exists (select 1 from public.torneos t
                  where t.id = torneo_id and public.es_staff(t.complejo_id)))
  with check (exists (select 1 from public.torneos t
                  where t.id = torneo_id and public.es_staff(t.complejo_id)));

drop policy if exists "ver partidos"      on public.partidos;
drop policy if exists "el staff marca"    on public.partidos;

create policy "ver partidos" on public.partidos for select to authenticated
  using (exists (select 1 from public.torneos t
                  where t.id = torneo_id and public.es_del_complejo(t.complejo_id)));

create policy "el staff marca" on public.partidos for all to authenticated
  using (exists (select 1 from public.torneos t
                  where t.id = torneo_id and public.es_staff(t.complejo_id)))
  with check (exists (select 1 from public.torneos t
                  where t.id = torneo_id and public.es_staff(t.complejo_id)));

drop policy if exists "ver anotaciones"   on public.anotaciones;
drop policy if exists "el staff anota"    on public.anotaciones;

create policy "ver anotaciones" on public.anotaciones for select to authenticated
  using (exists (select 1 from public.partidos p
                  join public.torneos t on t.id = p.torneo_id
                 where p.id = partido_id and public.es_del_complejo(t.complejo_id)));

create policy "el staff anota" on public.anotaciones for all to authenticated
  using (exists (select 1 from public.partidos p
                  join public.torneos t on t.id = p.torneo_id
                 where p.id = partido_id and public.es_staff(t.complejo_id)))
  with check (exists (select 1 from public.partidos p
                  join public.torneos t on t.id = p.torneo_id
                 where p.id = partido_id and public.es_staff(t.complejo_id)));

-- ===========================================================================
-- Funciones de aplicación
-- ===========================================================================

-- El jugador tiene que saber qué horas están libres SIN poder leer las
-- reservas ajenas: le sirve la franja ocupada, no quién la ocupa ni cuánto
-- pagó. Por eso esto es `security definer` y devuelve dos columnas y nada
-- más — es la costura exacta entre "puedo reservar" y "puedo cotillear".
create or replace function public.franjas_ocupadas(c uuid, d date)
returns table (cancha_id uuid, inicio time)
language sql stable security definer set search_path = '' as $$
  select r.cancha_id, r.inicio
    from public.reservas r
   where r.complejo_id = c
     and r.fecha = d
     and r.estado in ('confirmada','jugada')
     and public.es_del_complejo(c);
$$;

-- Un jugador entra a un complejo por su slug (el link que le manda el
-- negocio) y queda inscrito. Devuelve el complejo para poder redirigir.
create or replace function public.unirme_al_complejo(s text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare cid uuid;
begin
  select id into cid from public.complejos where slug = s;
  if cid is null then raise exception 'complejo no encontrado: %', s; end if;

  insert into public.membresias (complejo_id, persona_id, rol)
  values (cid, auth.uid(), 'jugador')
  on conflict do nothing;

  -- §7.1: el teléfono es la llave de unión. Las reservas que el mostrador
  -- creó a nombre de este número pasan a ser suyas al abrir cuenta.
  update public.reservas r
     set persona_id = auth.uid()
   where r.complejo_id = cid
     and r.persona_id is null
     and r.telefono is not null
     and r.telefono = (select p.telefono from public.personas p where p.id = auth.uid());

  return cid;
end;
$$;

-- El slug libre más cercano al nombre del negocio. Se resuelve en la base y
-- no en el cliente porque es donde vive la restricción de unicidad.
create or replace function public.slug_libre(base text)
returns text language plpgsql stable security definer set search_path = '' as $$
declare s text := base; n int := 1;
begin
  while exists (select 1 from public.complejos where slug = s) loop
    n := n + 1;
    s := base || '-' || n;
  end loop;
  return s;
end;
$$;

grant execute on function public.franjas_ocupadas(uuid, date) to authenticated;
grant execute on function public.unirme_al_complejo(text)     to authenticated;
grant execute on function public.slug_libre(text)             to authenticated;
grant execute on function public.es_del_complejo(uuid, text[]) to authenticated;
grant execute on function public.es_staff(uuid)                to authenticated;
grant execute on function public.es_dueno(uuid)                to authenticated;

-- ===========================================================================
-- Archivos
--
-- Un solo bucket público para lo que se enseña (logo, fotos de cancha,
-- escudos, avatares). Público de lectura porque son imágenes de marca que
-- van dentro de la app; la escritura sí está cerrada por carpeta.
-- ===========================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('publico', 'publico', true, 8388608,
        array['image/jpeg','image/png','image/webp','image/avif','image/svg+xml'])
on conflict (id) do update
  set public = true,
      file_size_limit = 8388608,
      allowed_mime_types = array['image/jpeg','image/png','image/webp','image/avif','image/svg+xml'];

drop policy if exists "leer publico"        on storage.objects;
drop policy if exists "subir a mi complejo" on storage.objects;
drop policy if exists "borrar de mi complejo" on storage.objects;

create policy "leer publico" on storage.objects for select
  using (bucket_id = 'publico');

-- La ruta es `complejos/<uuid>/...`. La segunda carpeta ES el complejo, así
-- que la pertenencia se comprueba sobre el propio nombre del archivo: nadie
-- puede escribir en la carpeta de otro negocio.
create policy "subir a mi complejo" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'publico'
    and (storage.foldername(name))[1] = 'complejos'
    and public.es_staff(((storage.foldername(name))[2])::uuid)
  );

create policy "borrar de mi complejo" on storage.objects for delete to authenticated
  using (
    bucket_id = 'publico'
    and (storage.foldername(name))[1] = 'complejos'
    and public.es_staff(((storage.foldername(name))[2])::uuid)
  );
