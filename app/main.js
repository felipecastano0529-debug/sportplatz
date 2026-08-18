/* ==========================================================================
   SPORTPLATZ — Arranque

   Módulos ES sin build ni dependencias. Se sirve por HTTP y funciona.
   El orden importa: primero los <defs> globales de los balones, luego el
   estado, y solo entonces se pinta algo.
   ========================================================================== */

import { $ } from './core/util.js';
import { Store, S, setS, save, saveNow } from './core/store.js';
import { SP_DEFS } from './core/sports.js';
import { initSpotlight } from './ui/motion.js';
import { setPhotoHandler } from './ui/photo.js';
import { toast } from './ui/modal.js';
import { paintBackdrop } from './ui/backdrop.js';
import { renderApp } from './ui/shell.js';
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

  const saved = await Store.read();

  if (saved && saved.courts?.length) {
    setS(migrate(saved));
    paintBackdrop();
    renderApp(null, { intro: true });
  } else {
    paintBackdrop();
    renderOnboarding();
  }

  document.body.classList.add('is-ready');
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

/* Al cerrar la pestaña se fuerza el guardado: el freno de 120 ms del store
   podría estar esperando justo en ese momento. */
addEventListener('pagehide', () => { if (S) saveNow(); });

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
