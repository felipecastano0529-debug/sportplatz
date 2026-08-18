/* ==========================================================================
   NÚCLEO · Deportes
   Balones con volumen, planos de cancha vistos desde arriba, y el color real
   de cada superficie. La vista de Canchas y las del jugador se retintan
   enteras con estos colores, por tokens, sin una regla nueva por componente.
   ========================================================================== */

/* Los degradados viven una sola vez en un <defs> global — así se pueden
   repetir cien veces sin duplicar nada. */
export const SP_DEFS = `
<svg id="spDefs" aria-hidden="true" focusable="false"
     style="position:absolute;width:0;height:0;overflow:hidden"><defs>
  <radialGradient id="gWhite" cx="34%" cy="26%" r="82%">
    <stop offset="0" stop-color="#ffffff"/><stop offset="52%" stop-color="#eceff3"/>
    <stop offset="100%" stop-color="#9aa3ae"/></radialGradient>
  <!-- Pádel y tenis se separan a propósito: turquesa contra ámbar. Con dos
       amarillos parecidos el fondo entero se leía como una cancha de tenis. -->
  <radialGradient id="gTurq" cx="34%" cy="26%" r="82%">
    <stop offset="0" stop-color="#9df4fb"/><stop offset="50%" stop-color="#18c2d4"/>
    <stop offset="100%" stop-color="#0a5b66"/></radialGradient>
  <radialGradient id="gYellow" cx="34%" cy="26%" r="82%">
    <stop offset="0" stop-color="#ffeb96"/><stop offset="50%" stop-color="#ffc21c"/>
    <stop offset="100%" stop-color="#a05e00"/></radialGradient>
  <radialGradient id="gRed" cx="34%" cy="26%" r="82%">
    <stop offset="0" stop-color="#ff9b84"/><stop offset="48%" stop-color="#e8402f"/>
    <stop offset="100%" stop-color="#7d150f"/></radialGradient>
  <radialGradient id="gBlue" cx="34%" cy="26%" r="82%">
    <stop offset="0" stop-color="#a8c6ff"/><stop offset="48%" stop-color="#2f6ce5"/>
    <stop offset="100%" stop-color="#0f2f75"/></radialGradient>
</defs></svg>`;

export const BALLS = {
  /* Fútbol: pentágono central y cinco costuras hacia el borde. */
  futbol: `<circle cx="50" cy="50" r="46" fill="url(#gWhite)"/>
    <path d="M50 33l16.2 11.8-6.2 19h-20L33.8 44.8z" fill="#15181d"/>
    <g stroke="#15181d" stroke-width="4.6" stroke-linecap="round" fill="none">
      <path d="M50 33V6M66.2 44.8L92 36M60 63.8l16 24M40 63.8l-16 24M33.8 44.8L8 36"/>
    </g>
    <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(0,0,0,.16)" stroke-width="2.5"/>`,

  /* Pádel: esfera de fieltro con las dos costuras clásicas. */
  padel: `<circle cx="50" cy="50" r="46" fill="url(#gTurq)"/>
    <g stroke="#f0ffff" stroke-width="4.4" stroke-linecap="round" fill="none" opacity=".92">
      <path d="M13 23c17 13 17 41 0 54M87 23c-17 13-17 41 0 54"/></g>
    <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(0,0,0,.14)" stroke-width="2.5"/>`,

  tenis: `<circle cx="50" cy="50" r="46" fill="url(#gYellow)"/>
    <g stroke="#fffdf0" stroke-width="4.4" stroke-linecap="round" fill="none" opacity=".95">
      <path d="M13 23c17 13 17 41 0 54M87 23c-17 13-17 41 0 54"/></g>
    <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(0,0,0,.16)" stroke-width="2.5"/>`,

  /* Voleibol: tres paneles curvos, el gesto que lo hace reconocible. */
  voleibol: `<circle cx="50" cy="50" r="46" fill="url(#gWhite)"/>
    <g stroke="#2f6ce5" stroke-width="4.6" stroke-linecap="round" fill="none">
      <path d="M50 5c-13 17-15 39-7 60M50 5c13 17 15 39 7 60M7 61c25-11 61-11 86 0"/></g>
    <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(0,0,0,.16)" stroke-width="2.5"/>`,

  /* Paintball: la mancha al reventar, no el marcador. */
  paintball: `<g fill="url(#gRed)">
      <circle cx="50" cy="52" r="27"/><circle cx="82" cy="28" r="7.5"/>
      <circle cx="21" cy="74" r="5.5"/><circle cx="79" cy="77" r="4.5"/>
      <circle cx="23" cy="24" r="7"/><circle cx="52" cy="11" r="4"/>
      <circle cx="11" cy="47" r="3.2"/><circle cx="92" cy="58" r="3.4"/>
    </g>
    <ellipse cx="41" cy="42" rx="8" ry="5.4" fill="rgba(255,255,255,.38)" transform="rotate(-28 41 42)"/>`
};

/* Esquemas de cancha vistos desde arriba. Se usan como respaldo elegante
   cuando todavía no hay foto — no son un placeholder gris, son un plano. */
export const COURTS_SVG = {
  futbol: `<rect x="4" y="4" width="152" height="92" rx="2"/>
    <line x1="80" y1="4" x2="80" y2="96"/><circle cx="80" cy="50" r="16"/>
    <rect x="4" y="26" width="24" height="48"/><rect x="132" y="26" width="24" height="48"/>
    <rect x="4" y="38" width="9" height="24"/><rect x="147" y="38" width="9" height="24"/>`,
  padel: `<rect x="10" y="4" width="140" height="92" rx="2"/>
    <line x1="80" y1="4" x2="80" y2="96" class="net"/>
    <line x1="38" y1="4" x2="38" y2="96"/><line x1="122" y1="4" x2="122" y2="96"/>
    <line x1="38" y1="50" x2="122" y2="50"/>`,
  tenis: `<rect x="8" y="8" width="144" height="84" rx="1"/>
    <rect x="8" y="18" width="144" height="64"/>
    <line x1="80" y1="8" x2="80" y2="92" class="net"/>
    <line x1="44" y1="18" x2="44" y2="82"/><line x1="116" y1="18" x2="116" y2="82"/>
    <line x1="44" y1="50" x2="116" y2="50"/>`,
  voleibol: `<rect x="16" y="8" width="128" height="84" rx="1"/>
    <line x1="80" y1="8" x2="80" y2="92" class="net"/>
    <line x1="58" y1="8" x2="58" y2="92"/><line x1="102" y1="8" x2="102" y2="92"/>`,
  paintball: `<rect x="4" y="6" width="152" height="88" rx="2"/>
    <line x1="80" y1="6" x2="80" y2="94" class="net"/>
    <path d="M28 34h14v10H28zM28 56h14v10H28zM118 34h14v10h-14zM118 56h14v10h-14z"/>
    <path d="M62 22l8 12h-16zM62 66l8 12h-16zM98 22l8 12H90zM98 66l8 12H90z"/>
    <circle cx="80" cy="50" r="7"/>`
};

/* Cada deporte trae su propio color, tomado de la superficie real. El pádel
   se movió del azul al turquesa de la pista de cristal: con el acento de
   marca ya en azul eléctrico, un pádel azul dejaba esa sección sin retinte
   visible. */
export const SPORTS = {
  futbol: {
    id: 'futbol', name: 'Cancha sintética', short: 'Sintética', unit: 'goles',
    scorerWord: 'goleadores', price: 120000, photo: 'assets/deportes/futbol.jpg',
    blurb: 'Fútbol 5, 6 y 7 · grama sintética', squad: 7
  },
  padel: {
    id: 'padel', name: 'Pádel', short: 'Pádel', unit: 'puntos',
    scorerWord: 'anotadores', price: 90000, photo: 'assets/deportes/padel.jpg',
    blurb: 'Panorámica en vidrio · dobles', squad: 2
  },
  tenis: {
    id: 'tenis', name: 'Tenis', short: 'Tenis', unit: 'puntos',
    scorerWord: 'anotadores', price: 70000, photo: 'assets/deportes/tenis.jpg',
    blurb: 'Superficie dura · singles y dobles', squad: 2
  },
  voleibol: {
    id: 'voleibol', name: 'Voleibol playa', short: 'Voleibol', unit: 'puntos',
    scorerWord: 'anotadores', price: 60000, photo: 'assets/deportes/voleibol.jpg',
    blurb: 'Arena · 2v2 y 4v4', squad: 4
  },
  paintball: {
    id: 'paintball', name: 'Paintball', short: 'Paintball', unit: 'eliminaciones',
    scorerWord: 'eliminadores', price: 25000, photo: 'assets/deportes/paintball.jpg',
    blurb: 'Campo inflable · por persona', squad: 5
  }
};

export const SPORT_LIST = Object.values(SPORTS);

/* Versión de los assets empaquetados. Sin build no hay nombres con hash, así
   que esto hace de hash a mano: cambiar la foto y NO cambiar la URL deja a
   quien ya la tenía en caché mirando la vieja. Peor aún, una respuesta 404 de
   cuando el archivo no existía se queda igual de pegada — que es exactamente
   lo que pasó con la de tenis.
   SUBE ESTE NÚMERO cada vez que reemplaces una imagen conservando el nombre. */
export const ASSET_V = '6';
export const conVersion = (ruta) => ruta ? `${ruta}?v=${ASSET_V}` : ruta;

export const ballSVG = (sport, cls = '') =>
  `<svg class="ball ball--${sport} ${cls}" viewBox="0 0 100 100" aria-hidden="true">${BALLS[sport] || BALLS.futbol}</svg>`;

export const courtSVG = (sport) =>
  `<svg class="plan" viewBox="0 0 160 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
     <g class="plan-g">${COURTS_SVG[sport] || COURTS_SVG.futbol}</g></svg>`;
