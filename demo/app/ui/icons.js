/* ==========================================================================
   UI · Iconografía
   Set propio, trazo de 1.75 y remates redondos. Sin librerías y sin emoji:
   un icono suelto de otra familia rompe la coherencia más que cualquier
   color. Aquí los iconos son funcionales —navegación, botones, estados—,
   nunca decoración encima de un título.
   ========================================================================== */

export const ICONS = {
  panel:    '<path d="M3 20h18M7 20v-7M12 20V6M17 20v-4"/>',
  canchas:  '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M12 5v14"/><circle cx="12" cy="12" r="2.6"/><path d="M2.5 9h3v6h-3M21.5 9h-3v6h3"/>',
  reservas: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/>',
  torneos:  '<path d="M8 4h8v5a4 4 0 0 1-8 0V4Z"/><path d="M8 5H5.6a2.6 2.6 0 0 0 2.6 5.2M16 5h2.4a2.6 2.6 0 0 1-2.6 5.2"/><path d="M12 13.2V17M9 20h6M10 17h4"/>',
  bot:      '<path d="M20 15a3 3 0 0 1-3 3H8l-4 3V6a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v9Z"/><path d="m12 8 .85 2.15L15 11l-2.15.85L12 14l-.85-2.15L9 11l2.15-.85L12 8Z"/>',
  ajustes:  '<path d="M4 6h9M19 6h1M4 12h3M13 12h7M4 18h9M19 18h1"/><circle cx="16" cy="6" r="2.2"/><circle cx="10" cy="12" r="2.2"/><circle cx="16" cy="18" r="2.2"/>',
  check:    '<path d="M4.5 12.5 9.5 17.5 19.5 7"/>',
  close:    '<path d="M6 6l12 12M18 6 6 18"/>',
  plus:     '<path d="M12 5v14M5 12h14"/>',
  minus:    '<path d="M5 12h14"/>',
  upload:   '<path d="M12 16V4m0 0L7 9m5-5 5 5M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
  up:       '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  down:     '<path d="M3 7l6 6 4-4 8 8"/><path d="M15 17h6v-6"/>',
  clock:    '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  wallet:   '<path d="M3 8a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V8Z"/><path d="M3 9.5h18M17.2 13.8h.01"/>',
  cal:      '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/>',
  left:     '<path d="M15 5l-7 7 7 7"/>',
  right:    '<path d="M9 5l7 7-7 7"/>',
  pencil:   '<path d="M4 20h4L20 8a2.83 2.83 0 0 0-4-4L4 16v4Z"/><path d="m14.5 5.5 4 4"/>',
  trophy:   '<path d="M8 4h8v5a4 4 0 0 1-8 0V4Z"/><path d="M12 13.2V17M9 20h6"/>',
  spark:    '<path d="m12 3 1.9 4.8L19 10l-5.1 2.2L12 17l-1.9-4.8L5 10l5.1-2.2L12 3Z"/>',
  shield:   '<path d="M12 3l7.5 3v5.4c0 4.3-3 8.2-7.5 9.6-4.5-1.4-7.5-5.3-7.5-9.6V6L12 3Z"/>',
  user:     '<circle cx="12" cy="8.5" r="3.75"/><path d="M4.5 20.2a7.5 7.5 0 0 1 15 0"/>',
  users:    '<circle cx="9.5" cy="8.5" r="3.4"/><path d="M2.8 20a6.8 6.8 0 0 1 13.4 0"/><path d="M16.4 5.4a3.4 3.4 0 0 1 0 6.4M18 20a6.8 6.8 0 0 0-2.3-5"/>',
  home:     '<path d="M4 10.6 12 4l8 6.6V19a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8.4Z"/><path d="M9.5 21v-6h5v6"/>',
  history:  '<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1"/><path d="M3 4v5h5"/><path d="M12 7.5V12l3 2"/>',
  logout:   '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 8l-4 4 4 4M6 12h9"/>',
  swap:     '<path d="M4 8h13l-3.5-3.5M20 16H7l3.5 3.5"/>',
  whistle:  '<path d="M14.5 7.5a5.5 5.5 0 1 0 0 9h4a3 3 0 0 0 0-6h-4"/><path d="M9 9.5 4 4"/>',
  pin:      '<path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z"/><circle cx="12" cy="10" r="2.6"/>',
  flame:    '<path d="M12 3c.6 3.4-2.2 4.4-2.2 7a4.4 4.4 0 0 0 8.8.3c0-3.6-3.6-5.6-6.6-7.3Z"/><path d="M9 13.6c-1.4.9-2.2 2.2-2.2 3.6a5.2 5.2 0 0 0 10.4 0"/>'
};

export const icon = (name, cls = 'ic') =>
  `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;
