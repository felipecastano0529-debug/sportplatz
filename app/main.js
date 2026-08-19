/* ==========================================================================
   SPORTPLATZ — Arranque

   Módulos ES sin build ni dependencias. Se sirve por HTTP y funciona.
   El orden importa: primero los <defs> globales de los balones, luego el
   estado, y solo entonces se pinta algo.
   ========================================================================== */

import { $ } from './core/util.js';
import { Store, S, setS, save, saveNow, setConflictHandler } from './core/store.js';
import * as nube from './core/nube.js';
import { SP_DEFS } from './core/sports.js';
import { initSpotlight } from './ui/motion.js';
import { setPhotoHandler } from './ui/photo.js';
import { toast } from './ui/modal.js';
import { paintBackdrop } from './ui/backdrop.js';
import { aplicarTema } from './ui/tema.js';
import { renderApp } from './ui/shell.js';
import { initVideoFondo } from './ui/vfondo.js';
import { renderOnboarding, renderStep, OB } from './views/onboarding.js';
import { readPhoto } from './ui/photo.js';
import { courtById } from './core/calc.js';

let booted = false;

async function boot() {
  if (booted) return;
  booted = true;

  // El navegador restaura el scroll al recargar y la app aparece a media página.
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  document.body.insertAdjacentHTML('afterbegin', SP_DEFS);
  initSpotlight();
  wirePhotos();
  wireConflictos();

  // Si hay sesión guardada, se recupera ANTES de leer: así el primer render
  // ya sale de la nube y no parpadea del demo local a la cuenta.
  await nube.recuperarSesion();

  const saved = await Store.read();

  if (saved && saved.courts?.length) {
    setS(migrate(saved));
    // Antes del primer render: si no, la app aparece en esmeralda y salta al
    // color del negocio un cuadro después.
    aplicarTema(S.business, S.photos);
    paintBackdrop();
    renderApp(null, { intro: true });
  } else {
    paintBackdrop();
    renderOnboarding();
  }

  document.body.classList.add('is-ready');

  // Va al final a propósito: el vídeo es un adorno de 5 MB y no puede competir
  // por el ancho de banda con lo que hace falta para que la app se vea.
  initVideoFondo();
}

/**
 * Estados guardados antes de que existieran las piezas nuevas. Se rellenan
 * los huecos en vez de descartar el negocio del usuario: nadie debería perder
 * su demo por haber actualizado.
 */
function migrate(s) {
  s.photos ??= { sports: {} };
  s.photos.sports ??= {};
  s.teams ??= [];
  s.players ??= [];
  s.tournaments ??= [];
  s.business.openHour ??= 6;
  s.business.closeHour ??= 23;
  s.business.logo ??= null;
  s.business.theme ??= { accent: 'esmeralda', fondo: 'estadio' };
  s.business.theme.accent ??= 'esmeralda';
  s.business.theme.fondo ??= 'estadio';
  s.session ??= { role: 'owner', playerId: s.players[0]?.id ?? null };
  s.session.role ??= 'owner';
  // Los torneos viejos guardaban goleadores sin enlace al jugador real.
  s.tournaments.forEach(tn => {
    tn.scorers ??= [];
    tn.scorers.forEach(sc => { sc.playerId ??= null; });
    tn.openSignup ??= false;
    tn.teams.forEach(t => { t.teamId ??= null; });
  });
  s.bookings.forEach(b => { b.playerId ??= null; });
  return s;
}

/* La subida de fotos vive en photo.js, pero dónde se guarda cada una es
   cosa del estado. Se conectan aquí para que photo.js no sepa de `S`. */
function wirePhotos() {
  setPhotoHandler(async (key, file) => {
    const [kind, id] = key.split(':');
    let data;
    try { data = await readPhoto(file); }
    catch { return toast('Esa imagen no se pudo leer', 'warn'); }

    if (kind === 'sport') {
      if (S) S.photos.sports[id] = data;
      else OB.photos[id] = data;
    } else {
      const c = S && courtById(id);
      if (!c) return;
      c.photo = data;
    }
    if (S) save();
    toast('Foto lista');
    S ? renderApp() : renderStep();
  });
}

/* Dos dispositivos con la misma cuenta pueden guardar a la vez. La base
   rechaza el segundo en vez de dejar que pise al primero; aquí se decide qué
   hacer. No se intenta fusionar dos documentos JSON automáticamente: eso
   corrompe en silencio. Se adopta lo que hay en el servidor y se avisa. */
function wireConflictos() {
  setConflictHandler((remoto) => {
    if (!remoto) return;
    setS(migrate(remoto));
    renderApp();
    toast('Tu complejo cambió desde otro dispositivo · se actualizó', 'warn');
  });
}

/* Al cerrar la pestaña se fuerza el guardado: el freno del store podría estar
   esperando justo en ese momento. */
addEventListener('pagehide', () => { if (S) saveNow(); });

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
