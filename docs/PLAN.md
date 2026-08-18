# Plan · Sportplatz demo público

Decisiones cerradas con el cliente:
- Doble rol en un mismo demo (Dueño / Jugador) con conmutador.
- Acento de marca: azul eléctrico del logo (#1447e6 / #4d8bff). Sustituye a la lima.
- Fondo del Panel: noche de estadio con fotos reales del cliente.
- Histórico de equipo Y de jugador.
- Arquitectura: módulos ES (opción B).
- Ajustes y el cuerpo de la agenda quedan sobrios; el resto a sangre.

## Etapas (cada una deja la app funcionando)

1. Assets de fondo (hecho) — `assets/fondos/estadio-{desktop,mobile}.jpg`
2. Tipografía: una decisión real, cargada de verdad.
3. Sistema de color: acento azul, rampa neutra fría, superficies de noche.
4. Bloqueantes de auditoría: seedBookings O(n), agenda con scroll, Store a IndexedDB.
5. Split de `engine.js` en módulos ES.
6. Fondo a sangre por sección + retinte.
7. Modelo de datos: players, teams, session.
8. Shell y vistas del jugador.
9. Histórico de equipo y de jugador.
10. Personalización: horario, renombrar canchas, logo del negocio.
11. Auditoría final: contraste, foco, responsive, movimiento.
