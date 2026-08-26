-- ===========================================================================
-- Leads · el formulario de la web pública
--
-- Esta es LA EXCEPCIÓN a la regla 3 del README ("ninguna política para
-- `anon`"), y por eso vive en su propia migración en vez de escondida dentro
-- del esquema de la plataforma. Quien rellena el formulario de `web/` no
-- tiene cuenta todavía —ese es el punto entero— así que escribe como anónimo.
--
-- La excepción está acotada a lo mínimo:
--
--   · `insert` para `anon`, y nada más. No hay `select`, `update` ni `delete`
--     para nadie: un visitante puede dejar su correo y no puede leer el de
--     los demás. La lista se mira desde el panel de Supabase con la clave
--     secreta, que no vive en ningún repo.
--   · Los topes de longitud son restricciones de columna, no validación de
--     JavaScript. El navegador se puede saltar; la base no.
--   · Esta tabla no se relaciona con ninguna otra. Si mañana entra basura,
--     se vacía sin tocar un solo dato de un complejo real.
-- ===========================================================================

create table if not exists public.leads (
  id       uuid        primary key default gen_random_uuid(),
  creado   timestamptz not null default now(),

  -- Lo único obligatorio. Sin una forma de contestar, un lead no es un lead.
  email    text        not null check (
                         length(email) between 6 and 160
                         and email like '%_@_%.__%'
                       ),

  nombre   text        check (length(nombre)   <= 120),
  negocio  text        check (length(negocio)  <= 160),
  telefono text        check (length(telefono) <= 40),
  mensaje  text        check (length(mensaje)  <= 2000),

  -- Cuántas canchas dice tener. La web usa el número para el precio, así que
  -- es la señal más útil que se puede pedir sin espantar a nadie.
  canchas  smallint    check (canchas between 1 and 200),

  -- De dónde llegó: 'web', 'demo', 'presentacion'. Sirve para saber cuál de
  -- las tres piezas trae gente de verdad.
  origen   text        not null default 'web' check (length(origen) <= 40),

  -- Seguimiento manual. Nadie lo escribe desde el navegador.
  atendido boolean     not null default false
);

create index if not exists leads_recientes on public.leads (creado desc);

alter table public.leads enable row level security;

drop policy if exists "dejar un lead" on public.leads;

-- Insert y solo insert. Sin `select` acompañante, así que el cliente tiene
-- que llamar a `.insert(...)` SIN `.select()` encima: pedir la fila de vuelta
-- exige permiso de lectura y la petición fallaría entera.
create policy "dejar un lead" on public.leads for insert to anon
  with check (true);

comment on table public.leads is
  'Formulario de la web pública. anon inserta, nadie lee. Se consulta con la clave secreta.';
