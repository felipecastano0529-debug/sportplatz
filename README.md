# Sportplatz — reservas, torneos, equipos y Neo AI para canchas

**En vivo: https://sportplatz-eight.vercel.app**

Demo pública, interactiva y funcional. Sin dependencias y sin build: se sirve y anda.

El visitante configura su complejo en cuatro preguntas y entra a una plataforma
con tres meses de historia ya generada. Y la ve **desde los dos lados**: como
dueño del negocio y como jugador que reserva, arma su equipo y se inscribe a
torneos.

```
index.html            La página
DESIGN.md             El sistema de diseño — léelo antes de tocar CSS
docs/MOLDE.md         Qué se hereda de esta demo a la siguiente, y qué no
docs/PLAN.md          Las decisiones de esta reconstrucción

app/main.js           Arranque
app/core/             Estado, cálculos y reglas — nada toca el DOM
  store.js              Persistencia (IndexedDB, con respaldos)
  util.js               Selección, escape, dinero, fechas
  sports.js             Deportes: balones, planos, colores
  calc.js               Ingresos, ocupación, series, horarios
  tournament.js         Llaves, tabla, valla, podio
  teams.js              Equipos, jugadores e histórico derivado
  seed.js               Generación del negocio de arranque
app/ui/               Piezas compartidas
  shell.js              Router, navegación por rol, fondos de escenario
  motion.js  icons.js  chart.js  photo.js  modal.js  fichas.js  backdrop.js
app/views/            Las seis vistas del dueño + onboarding
app/player/           Las cinco vistas del jugador
app/base.css          Componentes
app/premium.css       Escenario, vidrio oscuro y comunidad
themes/momentum.css   Los tokens: color, tipografía, forma, elevación, motion
assets/fondos/        Las fotos de estadio (escritorio y móvil)
```

## Abrirlo

Son módulos ES, así que **necesita servirse por HTTP** — un doble clic en
`index.html` ya no basta:

```bash
cd ~/Desktop/Sportplatz && python3 dev-server.py
```

Luego `http://localhost:5173`.

`dev-server.py` manda `no-store`. Con el `http.server` normal el navegador se
queda con el JS de antes después de cada edición y parece que los cambios no
entraron.

## Qué hace

### Lado del dueño

**Panel** — facturado de hoy y de la semana, **cobrado** del mes (que no es lo
mismo que facturado, y ahora se distingue), saldos por cobrar, ingresos diarios,
ranking de qué cancha deja más plata, próximas reservas y quién debe cuánto.

**Canchas** — la cancha del deporte ocupa todo el fondo y las tarjetas flotan
encima en vidrio oscuro. El selector salta entre deportes y **cambia el color de
toda la sección**. Cada cancha con su nombre y precio editables, estado en vivo y
la tira de horas del día.

**Reservas** — agenda por hora × cancha, 14 días navegables, filtro por deporte,
crear reserva con adelanto, registrar abonos y cancelar. Verde = pagada, ámbar =
con adelanto, rojo = sin abonar. `WA` marca las que entraron por Neo AI.
Scrollea en horizontal con la columna de horas y la cabecera fijas, así que
aguanta 40 canchas.

**Torneos** — crear, editar, sortear cruces y eliminar. 4, 8 o 16 equipos.
Llaves donde los ganadores avanzan solos, calendario, posiciones, anotadores,
valla menos vencida y podio. Se pueden abrir a inscripción.

**Equipos** — el directorio del complejo: clubes con su escudo y su récord,
jugadores con su ficha, y un salón de la fama con los máximos anotadores y los
clubes más ganadores.

**Neo AI** — conversación de WhatsApp animada donde el bot cotiza, explica el
adelanto, aparta y confirma con código, mientras al lado se encienden las cinco
cosas que hace por detrás.

**Ajustes** — nombre y logo del negocio, **horario de atención**, renombrar y
tarifar cada cancha, fotos, y reiniciar.

### Lado del jugador

**Inicio** — su próximo partido, sus reservas, cómo va su equipo y qué canchas
están libres en este momento.

**Reservar** — deporte, día, cancha y hora en una sola pantalla, con la parrilla
de horas libres. Elige si aparta con adelanto, paga completo o paga en cancha.

**Mi equipo** — crearlo, ponerle escudo y color, y armar la plantilla.

**Torneos** — ver los que hay, meter su equipo en un cupo libre y seguir la llave.

**Mi histórico** — partidos, anotaciones, títulos, equipos y en qué canchas juega
más. Nada de esto está guardado: se deriva de los partidos y las reservas.

### El conmutador

Abajo a la izquierda: *Viendo como dueño / jugador*. Es lo que convierte esto en
un demo y no en una captura — el visitante reserva como jugador, cambia de lado y
ve su propia reserva ya en la agenda del dueño.

## Las fotos

**No hace falta tocar carpetas.** Cada cancha tiene un botón *Subir foto* sobre
la imagen: se puede tocar o arrastrarle el archivo encima. La foto se reduce, se
comprime y se guarda con el resto del estado.

Se suben en: **Onboarding paso 2** (la de cada deporte), **Canchas → Subir
fondo** (el fondo del deporte visible), **Canchas y Ajustes** (la de cada cancha),
**Ajustes** (el logo del negocio) y **Mi equipo** (el escudo).

Mientras no haya foto no se ve un rectángulo gris: se dibuja el **campo del
deporte** con el **plano de la cancha** encima. Si prefieres versionarlas con el
proyecto, también sirven como archivos en `assets/` — ver `assets/LEEME.md`.

## Dónde se guarda

En **IndexedDB**, no en `localStorage`. Medido: el estado de un complejo de 40
canchas pesa 3,7 MB solo en datos, y `localStorage` se llena a los ~4 MB — con
un par de fotos, `setItem` lanza, no persiste nada y al recargar se pierde el
negocio entero. `Store` está aislado en su propio módulo justo para poder cambiar
esto por una base de datos real sin tocar el resto.

Quedan dos respaldos por si IndexedDB está bloqueado (Safari en privado): una
copia sin fotos en `localStorage`, y memoria para que la sesión funcione igual.

## Criterio de diseño

El detalle está en **[DESIGN.md](DESIGN.md)**. El resumen:

**Color** — verde esmeralda sobre noche de estadio. Da 5.48:1 sobre blanco, así
que el mismo color sirve de relleno y de texto, y encima lleva blanco. Canchas
es la única sección que se retinta, con el color real de cada deporte.

**Tipografía** — Archivo variable con eje de ancho: de una sola familia salen el
titular ancho de gráfico deportivo y el texto normal. IBM Plex Mono solo para
dato técnico. Cada paso trae su propio tracking e interlínea.

**Fondo** — la noche de estadio en toda la app, y la cancha a sangre solo en
Canchas. Por eso funciona: cuando el fondo cambia, cambia porque estás mirando
otro deporte, no porque cambiaste de pestaña.

**Movimiento** — curvas fuertes, nunca `ease-in`, nunca `transition: all`, todo
bajo 300 ms, solo `transform` y `opacity`, presión en todo lo pulsable.
`prefers-reduced-motion`, `prefers-reduced-transparency` y `prefers-contrast`
respetados.

## Para pasarlo a Next.js

El código ya está partido por las costuras correctas. `core/` no toca el DOM: se
copia tal cual. Cada `viewX(main)` es un componente en potencia.
`themes/momentum.css` es el único archivo que hay que tocar para retematizar:
mapea esos tokens a `tailwind.config` y el resto viaja.

## Desplegar

Ver **[docs/DESPLIEGUE.md](docs/DESPLIEGUE.md)**. En corto: `vercel deploy --prod`.

## Lo que falta y no es código

- **Fotos de cada cancha concreta.** Las de los cinco deportes y las de estadio
  ya están. Las de cada cancha se suben desde la propia app en segundos,
  arrastrándolas encima; mientras tanto se dibuja el campo del deporte con el
  plano encima, que se lee como una decisión y no como un hueco.
- **Backend real**: usuarios y sesiones de verdad, pagos del adelanto, y conectar
  Neo AI a la API de WhatsApp. Hoy el rol se cambia con un conmutador, sin
  autenticación — que para un demo es una ventaja, no una carencia.
