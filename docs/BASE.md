# La base · Supabase

Dos proyectos de Supabase, uno por cada lado del negocio. No comparten
esquema ni base de datos — cada uno tiene su propio traspaso más abajo.

| | Sostiene | Por qué separado |
|---|---|---|
| **`sportplatz`** | **plataforma** + **web** | Cuentas y dinero de verdad |
| **`sportplatz-demo`** | **demo** pública | Cualquier visitante puede registrarse y escribir. Que llene esa base de basura no le pesa nada a la de un cliente real |

Este documento es el traspaso de los dos. Si vas a trabajar en `platform/` o
en `web/`, la sección que te importa es **El proyecto: `sportplatz`**. Si vas
a trabajar en `demo/`, es **El proyecto: `sportplatz-demo`**, al final.

---

## El proyecto: `sportplatz`

| | |
|---|---|
| **Nombre** | `sportplatz` |
| **Ref** | `mhawocnkqieuklyjquvx` |
| **URL** | `https://mhawocnkqieuklyjquvx.supabase.co` |
| **Panel** | https://supabase.com/dashboard/project/mhawocnkqieuklyjquvx |
| **Región** | `us-east-1` · East US (North Virginia) |
| **Organización** | `felipecastano0529-debug's Org` — plan **pro** |
| **Creado** | 23 de agosto de 2026 |

La región no es indiferente: las funciones de Vercel en Hobby corren en
`iad1`, que **es** us-east-1. Base y servidor en el mismo sitio se ahorran un
salto en cada consulta. Si algún día la plataforma se mueve de región, esto se
mueve con ella.

El plan pro tampoco es un lujo: en el plan gratis Supabase pausa el proyecto
tras una semana sin tráfico. Ya pasó una vez —el proyecto anterior,
`Barenas Sport`, terminó pausado y luego borrado— y una plataforma que un
cliente puede abrir cualquier martes no se puede permitir eso.

---

## Las claves

| Variable | Qué es | ¿Secreta? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | La URL de arriba | No |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | La clave **publishable** (`sb_publishable_…`) | **No** — viaja al navegador por diseño |
| — | La clave **secret** (`sb_secret_…`) | **Sí. No entra en ningún repo.** |

Tres cosas que conviene tener claras antes de tocar nada:

**La variable se llama `ANON_KEY` pero la clave ya no es la `anon`.** Supabase
cambió el esquema: ahora hay `sb_publishable_` (pública) y `sb_secret_`
(secreta), y las viejas `anon` / `service_role` quedaron como legado. Está
puesta la publishable, que se puede revocar sola sin rotar el secreto JWT del
proyecto entero. El nombre de la variable se dejó como estaba porque así la
leen los cinco sitios del código que la usan; cambiarlo era tocar cinco
archivos para no ganar nada.

**Que la clave pública viaje al navegador no es un descuido, es el diseño.**
Lo único que separa los datos de un negocio de los del de al lado son las
políticas de fila. Si alguna vez alguien "arregla" esto escondiendo la clave,
no habrá arreglado nada.

**La clave secreta salta RLS por completo.** No va en `.env.local`, ni en
Vercel, ni en un comentario. Se usa desde el panel de Supabase y punto.

### Dónde están puestas

- **Local:** `platform/.env.local` (ignorado por git).
- **Vercel:** proyecto `sportplatz-platform`, en los tres entornos —
  Production, Preview y Development.
- **Contraseña de la base:** `.secretos/sportplatz-db-password.txt`, fuera del
  repo. Solo hace falta para conectarse por Postgres directo.

Para traerlas a una máquina nueva: `cd platform && vercel env pull`.

---

## Qué hay dentro

Cuatro migraciones, en `platform/supabase/migrations/`. Las cuatro están
**aplicadas** a la base y verificadas contra ella.

| Archivo | Qué mete |
|---|---|
| `0001_plataforma.sql` | El esquema: 12 tablas, RLS en todas, los triggers, el bucket `publico` |
| `0002_realtime.sql` | Publica `reservas` para que el Realtime emita |
| `0003_leads.sql` | La tabla `leads` de la web pública |
| `0004_alta_de_complejo.sql` | La función `crear_complejo()` |

Comprobado en la base, no supuesto:

- 13 tablas, **RLS activo en todas**.
- **Una sola política para `anon`** en todo el esquema: la de `leads`. Nada
  más se puede leer ni escribir sin haber entrado.
- Bucket `publico` con sus tres políticas de storage (lectura abierta,
  escritura acotada a `complejos/<uuid>/…`).
- Los tres triggers: `al_crear_usuario`, `al_crear_complejo`,
  `pagos_recalculan_abonado`.

### Para aplicar una migración nueva

No hace falta la CLI ni pegar nada a mano:

```bash
TOKEN=$(security find-generic-password -s "Supabase CLI" -w)
curl -s -X POST "https://api.supabase.com/v1/projects/mhawocnkqieuklyjquvx/database/query" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  --data-binary "$(python3 -c "import json;print(json.dumps({'query':open('supabase/migrations/000N_lo_tuyo.sql').read()}))")"
```

Una trampa que cuesta un rato: Cloudflare bloquea a `Python-urllib` con un
**error 1010**. Si automatizas esto, hazlo por `curl`, no por
`urllib.request`.

---

## Tres cosas que se arreglaron al conectar

Ninguna daba error en consola. Las tres aparecieron al correr el código contra
una base de verdad con datos de verdad, que es exactamente para lo que sirve
hacerlo.

### 1. El Realtime no emitía (`0002`)

`components/app/Realtime.tsx` escucha `postgres_changes` sobre `reservas`, y la
tabla nunca se añadió a la publicación `supabase_realtime`. La suscripción se
conecta, devuelve `SUBSCRIBED`, y no llega un solo evento. Sin error, sin fila
roja en la pestaña de red, sin nada: la agenda simplemente deja de moverse
sola. Y eso es §1.3, el momento que vende el producto.

### 2. El alta de un complejo estaba rota (`0004`)

`actions/onboarding.ts` daba de alta el negocio con
`.insert({...}).select('id, slug')` y la base contestaba **42501**. El primer
paso del producto —registrarte y crear tu complejo— no funcionaba.

La causa tiene dos capas y la segunda es la interesante. PostgREST traduce ese
`.select()` a `insert … returning`, y Postgres comprueba la política de
**lectura** sobre la fila devuelta dentro de la sentencia del insert; en ese
instante la membresía de dueño todavía no existía. Adelantar el trigger de
`after` a `before` **no** lo arregla: `es_del_complejo` está declarada
`stable`, así que trabaja con el snapshot del principio de la sentencia y no ve
filas escritas por un trigger dentro de esa misma sentencia. Ningún orden de
triggers gana esa carrera.

La salida fue dejar de fingir que es un insert. Crear un complejo son tres
cosas a la vez —slug libre, complejo, membresía de dueño— y ahora es una
operación con nombre:

```ts
const { data } = await sb.rpc('crear_complejo', {
  p_nombre: nombre,
  p_whatsapp: whatsapp   // opcional
});
const complejo = data?.[0];   // { id, slug }
```

Exige sesión y solo sabe crear un complejo cuyo dueño es quien la llama. Sin
sesión devuelve 401. Ya está cambiado en `onboarding.ts` y en `preparar.ts`;
**si escribes un alta nueva, usa la función, no un insert.**

### 3. El panel enseñaba $0 con 335 millones en la base

Este no está en ninguna migración: es de `lib/queries/agenda.ts`, y solo se ve
con datos de volumen real.

**PostgREST devuelve como mucho mil filas, y no lo dice.** No hay error, no hay
bandera, la respuesta se corta y ya. El panel pedía sus ciento veinte días
ordenados por fecha **ascendente**, recibía las mil reservas más *viejas* del
rango —hasta el 17 de julio— y pintaba «Facturado hoy $0» un 23 de agosto. La
gráfica de las últimas dos semanas salía plana. Todo correcto según el código,
todo falso en pantalla.

`reservasEntre` y `misReservas` ahora piden por bloques hasta que un bloque
viene incompleto (`todasLasFilas`, al principio del archivo). Después del
arreglo, el mismo panel: $4.965.000 hoy, $29.510.000 en siete días, 27% de
ocupación.

Subir el tope del servidor habría tapado esto sin resolverlo: diez complejos de
tamaño normal llegan a mil filas en una semana. **Si escribes una consulta que
pueda devolver muchas filas, pásala por `todasLasFilas`** — o usa
`count: 'exact', head: true` si lo único que necesitas es contar, que no trae
filas y no le afecta el tope.

---

## Cómo se comprueba que sigue en pie

```bash
cd platform
npm run preparar      # un complejo de prueba con tres meses de historia
npm run aislamiento   # la aceptación de la Fase 0
```

Los dos escriben con la **clave pública**, nunca con la secreta. Es a
propósito: comprobar el aislamiento saltándose las políticas no comprueba
nada.

`npm run aislamiento` levanta un segundo negocio con otra dueña y hace 19
comprobaciones — que no vea ni una fila ajena, que pedir una cancha ajena por
su id exacto devuelva vacío, que no pueda colar una cancha en el complejo de
al lado, que no pueda hacerse dueña de él, que el jugador vea lo suyo y no lo
de los otros clientes, que sin sesión no se vea nada. **Estado a 26 de agosto
de 2026: las 19 pasan**, y se puede correr dos veces seguidas sin ensuciar
nada.

El negocio rival (`canchas-el-poblado`) y la cuenta `rival@sportplatz.test`
**se quedan en la base entre corridas, a propósito.** En todo el esquema no
hay una sola política de `delete` sobre `complejos` —R19: aquí no se borra
nada— así que un dueño no puede eliminar su negocio. Y ojo con esto, porque
muerde: un `delete` sin política **no falla**. PostgREST devuelve que todo fue
bien, con cero filas tocadas. La primera versión de este script daba por hecho
que había limpiado y fue dejando complejos rivales por el camino hasta que una
comprobación empezó a fallar sola. Ahora reutiliza el que ya existe, y
comprueba que efectivamente NO se puede borrar.

### Las cuentas de prueba

| Quién | Correo | Contraseña |
|---|---|---|
| Dueño | `dueno@sportplatz.test` | `sportplatz2026` |
| Jugador | `jugador@sportplatz.test` | `sportplatz2026` |

El complejo es `complejo-deportivo-la-70`, con 10 canchas y 4023 reservas con
sus pagos. Entra con los dos a la vez en dos ventanas: reserva como jugador y
mira caer la reserva en la agenda del dueño.

---

## Auth, tal como está configurado

| Ajuste | Valor | Por qué |
|---|---|---|
| Site URL | `https://sportplatz-platform.vercel.app` | A donde vuelven los correos |
| Redirect URLs | `localhost:3000`, el dominio de Vercel y sus previews | Sin esto los enlaces de recuperación mueren |
| Confirmar correo | **desactivado** | Con él no hay sesión tras registrarse y el seed no puede correr |
| Correo / contraseña | activado | |
| Teléfono (OTP) | desactivado | Necesita Twilio, que se paga. El código todavía no lo usa |
| Contraseña mínima | 8 | |

> **Antes de que entre un cliente de verdad, volver a encender la
> confirmación de correo.** Hoy cualquiera puede registrarse con un correo que
> no es suyo. Es un ajuste de fase de pruebas, no una decisión.
>
> ```bash
> TOKEN=$(security find-generic-password -s "Supabase CLI" -w)
> curl -s -X PATCH "https://api.supabase.com/v1/projects/mhawocnkqieuklyjquvx/config/auth" \
>   -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
>   --data-binary '{"mailer_autoconfirm": false}'
> ```
>
> Y con eso, `npm run preparar` deja de funcionar contra esta base. Es el
> intercambio, y es el correcto.

---

## Para la web

`web/` **no toca Supabase hoy**, y no le hace falta: es un HTML sin build y no
tiene un solo `<form>`. Lo que hay preparado es la tabla `leads`, para cuando
lo tenga.

```js
// insert y nada más. Sin .select() encima: pedir la fila de vuelta exige
// permiso de lectura, y anon no lo tiene — la petición fallaría entera.
await sb.from('leads').insert({
  email, nombre, negocio, telefono, canchas, mensaje, origen: 'web'
});
```

Campos: `email` (obligatorio, con formato comprobado en la base), `nombre`,
`negocio`, `telefono`, `mensaje`, `canchas` (1–200), `origen`, `atendido`.
Los topes de longitud son restricciones de columna: el navegador se puede
saltar, la base no.

Los leads se leen desde el panel de Supabase con la clave secreta. Por RLS
**nadie** puede leerlos desde el navegador, ni siquiera con sesión iniciada.
Eso es a propósito.

### Dos avisos antes de poner el formulario

**El CTA final promete lo contrario.** Hoy dice, con estas palabras: *"No pide
correo, no pide tarjeta y no hay nadie esperando al otro lado."* Un formulario
de correo en esa sección contradice la página. O va en otro sitio —los planes,
por ejemplo— o hay que reescribir esa frase. No las dos cosas.

**Esta tabla es la única excepción del esquema a "ninguna política para
`anon`".** Está acotada a `insert` y documentada en su migración. Si mañana
hace falta otra excepción, que sea igual de estrecha y con el mismo comentario
explicando por qué.

---

## El proyecto: `sportplatz-demo`

| | |
|---|---|
| **Nombre** | `sportplatz-demo` |
| **Ref** | `yhprxfgxmfvnlkcksbxb` |
| **URL** | `https://yhprxfgxmfvnlkcksbxb.supabase.co` |
| **Panel** | https://supabase.com/dashboard/project/yhprxfgxmfvnlkcksbxb |
| **Región** | `us-east-1` · East US (North Virginia) |
| **Organización** | `felipecastano0529-debug's Org` — plan **pro** |
| **Creado** | 26 de agosto de 2026 |

Antes de esto la demo funcionaba —y sigue funcionando si algún día se vacían
estas claves— guardando todo en el navegador de cada visitante. Eso no era una
limitación provisional: es el modo de respaldo a propósito, para que la app
nunca se rompa por falta de configuración. Conectarla es una mejora, no un
requisito.

### El esquema es OTRO, no una copia del de la plataforma

Una sola tabla, `espacios`, con el negocio entero en una columna `jsonb`. Es
la decisión de fondo del proyecto —está explicada en la cabecera de
`demo/supabase/migrations/0001_espacios.sql`— porque la app entera lee su
estado de forma síncrona (`S.bookings.filter(...)` aparece en cada vista) y
normalizar en tablas obligaría a volver asíncrona cada función de cálculo.

| | |
|---|---|
| Migración | `demo/supabase/migrations/0001_espacios.sql` — una sola, ya trae RLS, el trigger de versión y el Realtime en el mismo archivo |
| RLS | Activo. **Cero políticas para `anon`** — ni siquiera la excepción que sí tiene la plataforma para `leads`, porque la demo no tiene formulario público |
| Concurrencia | Optimista: `guardar_espacio(id, estado, version)` compara versiones y si alguien más guardó entretanto, devuelve el estado bueno en vez de pisarlo |
| Realtime | `espacios` publicada desde la propia migración — a diferencia de la plataforma, aquí no hizo falta una migración aparte |

### Las claves ya están puestas — y no en `.env`

`demo/` es HTML sin build: no hay proceso que lea variables de entorno. Las
claves van directas en **`demo/app/core/config.js`**, y ya están:

```js
export const SUPABASE_URL  = 'https://yhprxfgxmfvnlkcksbxb.supabase.co';
export const SUPABASE_ANON = 'sb_publishable_FP2xV4BcwAeoHrXhi-PS3w_pjhYJejp';
```

Esto **sí se commitea**, y está bien que se commitee: la propia cabecera del
archivo lo explica — la clave pública viaja al navegador de cualquier
visitante por diseño, lo que separa un negocio de otro es RLS, no el secreto.
La clave `sb_secret_…` de este proyecto no aparece en ningún archivo del
repo.

### Auth

| Ajuste | Valor |
|---|---|
| Site URL | `https://sportplatz-eight.vercel.app` |
| Redirect URLs | `localhost:5173`, el dominio de Vercel y sus previews |
| Confirmar correo | **desactivado** — igual que en `sportplatz`, para que el alta de un negocio de prueba no se quede sin sesión |
| Contraseña mínima | 8 |

### Verificado contra la base real, no solo aplicado

Con dos cuentas y la clave pública, por API directa —sin Node de por medio,
así que sirve para cualquiera que quiera repetirlo—:

- Alta de cuenta y sesión: OK para las dos.
- `crear el espacio` con `.insert().select()` — el mismo patrón que rompía en
  la plataforma— funciona aquí a la primera. La diferencia: `owner_id` se fija
  al valor de `auth.uid()` en el momento del insert, no lo pone un trigger
  después. La política `auth.uid() = owner_id` no necesita esperar a nada, así
  que no hay carrera que ganar.
- El negocio de la dueña **B** pedido por su id exacto desde la sesión de
  **A**: `[]`.
- **A** intenta guardar sobre el espacio de **B** vía `guardar_espacio()`:
  `42501 — espacio inexistente o ajeno`.
- Sin sesión: `[]`.

Los dos espacios de prueba se borraron al terminar. La base quedó como estaba.

---

## Lo que queda pendiente

- **Renombrar la organización de Supabase.** Se pidió que fuera `BROTE`
  renombrada, y no se pudo: el token de Management API no tiene ese permiso
  (401). Además `BROTE` es plan free y el tope del plan gratis es de **2
  proyectos activos por usuario sumando todas las organizaciones** —los dos
  estaban gastados por `Fily&Co` y `motos-colombia-soc`—, así que los dos
  proyectos de Sportplatz viven en la organización pro. Renombrarla es un
  clic: Organization Settings → General → Name.
- **`sportplatz-platform` no se ha desplegado nunca.** Las variables ya están
  puestas en los tres entornos; falta el primer `vercel deploy`.
- **Volver a encender la confirmación de correo** en `sportplatz` antes de que
  entre nadie de verdad (arriba está el comando). En `sportplatz-demo` puede
  quedarse apagada: es el punto de la demo, que cualquiera la use sin fricción.
- **El WhatsApp de la web es un placeholder:** `wa.me/57XXXXXXXXXX`, en dos
  sitios de `web/index.html`.
- **Un desajuste de hidratación en el layout de la plataforma**, ajeno a la
  base y anterior a ella: el servidor manda `<body>` sin `data-view`,
  `data-role` ni `data-bleed`, y el cliente se los añade después. React avisa
  («A tree hydrated but some attributes… didn't match») y el badge de Next
  marca 1 issue en cada carga. La página funciona; el aviso no se va solo.

---

*Sportplatz · Fily & Co · 23 y 26 de agosto de 2026.*
