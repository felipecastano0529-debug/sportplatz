# Brief para Cursor

Pega esto como primer mensaje. Ajusta la sección "Qué quiero ahora" según lo
que vayas a hacer en esa sesión.

---

## Contexto

Este repo es una **demo funcional en HTML/CSS/JS plano** de una plataforma de
reservas de canchas (sintética, pádel, tenis, voleibol, paintball). No es un
prototipo de pantallas: la lógica funciona de verdad — reservas con adelanto y
saldo, torneos con llaves que avanzan solas, tablas, y un bot de WhatsApp
llamado **Neo AI**.

Está terminada a nivel de diseño y de comportamiento. **No la rediseñes.**

Archivos:

- `index.html` — la página; carga `app/main.js` como módulo ES
- `app/core/` — estado, cálculos y reglas. **No toca el DOM**
- `app/ui/` — shell, movimiento, iconos, gráficos, modal, fichas
- `app/views/` — las seis vistas del dueño y el onboarding
- `app/player/` — las cinco vistas del jugador
- `app/base.css` — componentes
- `app/premium.css` — escenario, vidrio oscuro y comunidad
- `themes/momentum.css` — los tokens
- `DESIGN.md` — el sistema de diseño y el porqué de cada decisión
- `README.md` — qué hace cada sección

Son módulos ES: hay que servirlo por HTTP (`python3 dev-server.py`).

## Reglas que no se negocian

1. **Lee `DESIGN.md` antes de tocar CSS.** Trae las trampas ya documentadas
   (`background` vs `background-color`, el `<svg>` con `width:auto`, los puntos
   del gráfico fuera del SVG). Volver a caer en ellas es retroceder.
2. **Ningún color literal fuera de `themes/momentum.css`**, salvo capas de luz
   y de velo (`rgba` blancos y negros de scrim y grano). Si un color tiene
   nombre, es un token.
3. **Tipografía:** el tracking es específico del tamaño. La tabla está en
   `DESIGN.md`. No pongas un solo `letter-spacing` para todo.
4. **Movimiento:** nunca `ease-in` en UI, nunca `transition: all`, todo bajo
   300 ms, solo `transform` y `opacity`, `:active` en todo lo pulsable, hover
   detrás de `@media (hover: hover) and (pointer: fine)`.
5. **El acento es el azul del logo** (`#1447e6`, 6.83:1 sobre blanco). Sirve de
   relleno y de texto, y encima lleva blanco. Sobre negro sube a `#4d8bff`.
6. Respetar `prefers-reduced-motion`, `prefers-reduced-transparency` y
   `prefers-contrast`. Ya está resuelto; no lo rompas.
7. Nada de: **texto con degradado**, cards anidadas, gradientes morado→azul,
   icono en cuadrito sobre cada heading, emojis como iconos, sombras difusas sin
   lógica de elevación, retículas decorativas de fondo, borde lateral grueso de
   color en tarjetas, un `border-radius` distinto por componente.
8. **Jerarquía de encabezados sin saltos.** Las tarjetas de rejilla son `h2`.

## Qué quiero ahora

> **Migrar a Next.js (App Router) + TypeScript + Tailwind, sin perder nada de
> lo que ya funciona ni cambiar el diseño.**

Cómo abordarlo:

- Mapea los tokens de `themes/momentum.css` a `tailwind.config` (o a variables
  CSS globales). Ese archivo es la fuente de verdad del diseño.
- `app/core/` **no toca el DOM**: se copia casi tal cual. Empieza por ahí.
- Cada `viewX(main)` es un componente. El shell (`ui/shell.js`) es el layout con
  navegación por rol.
- `core/store.js` es lo único que sabe dónde se guarda: cámbialo por Prisma o
  Drizzle y el resto no se entera.
- El histórico de equipos y jugadores **se deriva**, no se guarda. No lo
  conviertas en columnas acumuladas o se desincronizará al corregir un marcador.
- Las animaciones usan Web Animations API. Al pasar a React, usa `motion`
  manteniendo las mismas curvas y duraciones de `DESIGN.md`.

## Lo que falta y no es código

- Las fotos reales de cada deporte en `assets/deportes/` y de cada cancha en
  `assets/canchas/`. Mientras no estén, la app dibuja el campo del deporte con
  el plano encima — no es un bug. Las de estadio ya están en `assets/fondos/`.
- Backend real: usuarios y sesiones, pagos del adelanto, y conectar Neo AI a la
  API de WhatsApp. Hoy el rol se cambia con un conmutador, sin autenticación.
