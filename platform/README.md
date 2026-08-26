# Sportplatz · plataforma

La plataforma real: Next.js 16, multi-tenant, con cuentas y dinero. La
especificación es **[../docs/PLATAFORMA.md](../docs/PLATAFORMA.md)** y la piel
es **[../DESIGN.md](../DESIGN.md)**. Cuando este README y el documento maestro
no coincidan, gana el documento maestro.

## Arrancar

```bash
npm install
vercel env pull              # trae las claves del proyecto de Vercel
npm run dev                  # http://localhost:3000
```

Sin las variables de entorno el proyecto compila pero no entra nadie: todas
las lecturas pasan por Supabase.

| Variable | Qué es | ¿Es secreta? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | La URL del proyecto | No |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | La clave publishable (`sb_publishable_…`) | **No** — viaja al navegador por diseño |

La clave secreta (`sb_secret_…`) **no aparece en este proyecto y no debe
hacerlo**: salta RLS por completo.

El proyecto de Supabase, las claves, lo que hay dentro y cómo se comprueba
están en **[../docs/BASE.md](../docs/BASE.md)**. Léelo antes de tocar el
esquema.

## La base

El esquema vive en `supabase/migrations/`, en cuatro archivos, y los cuatro
están **aplicados** al proyecto `sportplatz`. Cómo aplicar uno nuevo, en
[../docs/BASE.md](../docs/BASE.md).

| | |
|---|---|
| `0001_plataforma.sql` | El esquema: doce tablas, RLS, triggers, el bucket |
| `0002_realtime.sql` | Publica `reservas` para que el Realtime emita |
| `0003_leads.sql` | La tabla de la web pública |
| `0004_alta_de_complejo.sql` | La función `crear_complejo()` |

Trece tablas, RLS en todas, y tres cosas que no son negociables:

1. **La no-doble-reserva es una restricción, no una comprobación** (R4): un
   índice único parcial sobre `(cancha_id, fecha, inicio)`. Dos personas
   pulsando a la vez: una gana, la otra recibe un `23505` y un mensaje claro.
2. **`abonado` no se escribe a mano.** Todo movimiento de plata es una fila en
   `pagos` y un trigger recalcula. Una devolución es un monto negativo, nunca
   una resta que nadie puede auditar.
3. **Una sola política para `anon` en todo el esquema:** el `insert` de
   `leads`, para el formulario de la web pública, y está documentada en su
   propia migración. Fuera de eso, quien no ha entrado no lee ni escribe.

## Cómo está organizado

```
src/
  app/
    (auth)/            entrar · registro · bienvenida (onboarding)
    (app)/[complejo]/  la plataforma, multi-tenant por slug
      panel/ canchas/ reservas/ torneos/ equipos/ ajustes/
      j/               el lado del jugador
  lib/
    util.ts            puro · portado de demo/app/core/util.js
    sports.ts          puro · balones y planos de cancha, copiados tal cual
    tournament.ts      puro · llaves, tabla, valla, podio (R22–R30)
    records.ts         puro · el histórico DERIVADO (R31–R34)
    tema.ts            puro · el acento del negocio y su derivación de contraste
    queries/           lectura · Server Components
    actions/           escritura · Server Actions
    supabase/          los dos clientes; nada más sabe que Supabase existe
  components/          la piel
  styles/
    momentum.css       LOS TOKENS — copiados de la demo sin tocar un valor
    base.css           los componentes de la demo
    premium.css        el detalle de la demo
    plataforma.css     solo lo que la demo no tenía
  proxy.ts             refresco de sesión y portero (Next 16 lo llama proxy)
```

**`lib/` no toca el DOM.** Por eso se copió de la demo casi sin cambios: fue
partido por esa costura a propósito.

## Lo que se corrigió al portar

Dos fallos que la demo tenía y que aquí no se heredaron (también arreglados en
`../demo/app/base.css`):

- `.btn-primary` pedía `var(--on-brand)`, un token que no existe en ningún
  sitio. El `var()` inválido dejaba el botón heredando `--ink`: texto casi
  negro sobre el verde, 3.59:1. Ahora usa `--on-accent`.
- `.view-bg .media-img` cerraba con una llave de más. El navegador lo perdona;
  Lightning CSS no compila.

Y una trampa del documento maestro que **desaparece** con el bundler: `ASSET_V`
ya no existe, porque los nombres de archivo llevan huella.

## Estado

| Fase | Qué | Estado |
|---|---|---|
| 0 | Cimientos: esquema, RLS, auth, layout multi-tenant | **Aplicado y aceptado** |
| 1 | Panel, Canchas, Reservas, Ajustes | Escrito |
| — | Torneos, Equipos | Escrito |
| — | Neo AI, lado del jugador | Pendiente |
| 3 | Pasarela y suscripción | Pendiente |
| 4 | WhatsApp Cloud API | Pendiente |

La Fase 0 está aceptada contra la base real desde el 23 de agosto de 2026: dos
complejos conviviendo y el dueño de uno sin ver ni una fila del otro. Se
vuelve a comprobar cuando haga falta:

```bash
npm run preparar      # un complejo de prueba con tres meses de historia
npm run aislamiento   # 18 comprobaciones de aislamiento entre negocios
```

Los dos escriben con la clave pública, nunca con la secreta: comprobar el
aislamiento saltándose las políticas no comprueba nada.

Conectarlo sacó tres fallos que no daban error en consola —el Realtime no
emitía, el alta de un complejo devolvía 42501 y el panel enseñaba $0 con 335
millones dentro—. Los tres están arreglados y contados en
[../docs/BASE.md](../docs/BASE.md). Lo que sigue pendiente es el primer
despliegue: `sportplatz-platform` tiene las variables puestas y ningún deploy.
