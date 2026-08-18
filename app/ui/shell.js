/* ==========================================================================
   UI · Shell
   El armazón: rail, navegación por rol, conmutador Dueño/Jugador y el fondo
   a sangre de cada vista.

   El fondo va en una capa propia (`.view-bg`) detrás del área de contenido,
   no en el `background` de la vista: así el rail queda fuera, la foto no se
   arrastra con el scroll y las tarjetas pueden flotar encima en vidrio.
   ========================================================================== */

import { $, $$, esc, initials } from '../core/util.js';
import { S, save } from '../core/store.js';
import { SPORTS, courtSVG, conVersion } from '../core/sports.js';
import { icon } from './icons.js';
import { enter } from './motion.js';
import { openModal, toast } from './modal.js';
import { me } from '../core/teams.js';
import { filaCuentaHTML, wireCuenta } from './cuenta.js';
import { videoFondoVisible } from './vfondo.js';

import { viewPanel }    from '../views/panel.js';
import { viewCanchas, getCanchaSport } from '../views/canchas.js';
import { viewReservas } from '../views/reservas.js';
import { viewTorneos } from '../views/torneos.js';
import { viewEquipos }  from '../views/equipos.js';
import { viewBot, stopChat } from '../views/bot.js';
import { viewAjustes }  from '../views/ajustes.js';

import { viewInicio }    from '../player/inicio.js';
import { viewReservar }  from '../player/reservar.js';
import { viewMiEquipo }  from '../player/equipo.js';
import { viewPlayerTorneos } from '../player/torneos.js';
import { viewHistorial } from '../player/historial.js';

export const OWNER_NAV = [
  { id: 'panel',    label: 'Panel',    hint: 'Cuánto entra',      icon: 'panel' },
  { id: 'canchas',  label: 'Canchas',  hint: 'Precios y estado',  icon: 'canchas' },
  { id: 'reservas', label: 'Reservas', hint: 'Agenda por hora',   icon: 'reservas' },
  { id: 'torneos',  label: 'Torneos',  hint: 'Llaves y tablas',   icon: 'torneos' },
  { id: 'equipos',  label: 'Equipos',  hint: 'Clubes y jugadores',icon: 'users' },
  { id: 'bot',      label: 'Neo AI',   hint: 'WhatsApp',          icon: 'bot' },
  { id: 'ajustes',  label: 'Ajustes',  hint: 'Tu negocio',        icon: 'ajustes' }
];

export const PLAYER_NAV = [
  { id: 'inicio',    label: 'Inicio',      hint: 'Tu próximo partido', icon: 'home' },
  { id: 'reservar',  label: 'Reservar',    hint: 'Cancha y hora',      icon: 'reservas' },
  { id: 'miequipo',  label: 'Mi equipo',   hint: 'Plantilla y escudo',  icon: 'shield' },
  { id: 'ptorneos',  label: 'Torneos',     hint: 'Inscríbete',         icon: 'torneos' },
  { id: 'historial', label: 'Mi histórico',hint: 'Partidos y números',  icon: 'history' }
];

const VIEWS = {
  panel: viewPanel, canchas: viewCanchas, reservas: viewReservas,
  torneos: viewTorneos, equipos: viewEquipos, bot: viewBot, ajustes: viewAjustes,
  inicio: viewInicio, reservar: viewReservar, miequipo: viewMiEquipo,
  ptorneos: viewPlayerTorneos, historial: viewHistorial
};

export let VIEW = 'panel';

export const role = () => S?.session?.role || 'owner';
export const navFor = (r) => (r === 'player' ? PLAYER_NAV : OWNER_NAV);
export const homeOf = (r) => (r === 'player' ? 'inicio' : 'panel');

/* ── Render ──────────────────────────────────────────────────────────────── */

export function renderApp(view = VIEW, { intro = false } = {}) {
  const r = role();
  const nav = navFor(r);
  if (!nav.some(n => n.id === view)) view = homeOf(r);

  // La conversación de Neo AI encadena setTimeout durante ~20 s. Si no se
  // corta al cambiar de vista sigue corriendo sobre un nodo ya desprendido.
  // Hay que leer la vista ANTERIOR, así que va antes de reasignar VIEW.
  if (VIEW === 'bot' && view !== 'bot') stopChat();

  VIEW = view;

  const root = $('#app');
  root.innerHTML = `
    <a class="skip" href="#main">Saltar al contenido</a>
    <div class="shell">
      ${railHTML(nav, view, r)}
      <div class="view-bg" id="viewBg" aria-hidden="true"></div>
      <main class="main" id="main" tabindex="-1">
        <div class="main-inner"></div>
      </main>
    </div>`;

  document.body.dataset.view = view;
  document.body.dataset.role = r;

  $$('[data-go]', root).forEach(b => b.addEventListener('click', (e) => {
    e.preventDefault(); renderApp(b.dataset.go);
  }));
  $('#roleSwap')?.addEventListener('click', openRoleSwap);
  wireCuenta(() => renderApp(homeOf(role()), { intro: true }));

  const main = $('.main-inner', root);
  VIEWS[view](main);
  paintViewBg(view);

  if (intro) enter($('.shell'), { y: 24, dur: 620 });
  $('#main').scrollTop = 0;
  window.scrollTo(0, 0);
}

function railHTML(nav, view, r) {
  const player = me();
  const name = r === 'player' && player ? player.name : S.business.name;
  const sub   = r === 'player' ? 'Jugador' : 'Sportplatz';
  const av    = r === 'player' && player?.avatar
    ? `<span class="avatar avatar--img"><img src="${esc(player.avatar)}" alt=""></span>`
    : `<span class="avatar">${esc(initials(name))}</span>`;

  return `<aside class="nav">
    <a class="nav-brand" href="#" data-go="${homeOf(r)}">
      ${S.business.logo
        ? `<span class="brand-logo"><img src="${esc(S.business.logo)}" alt=""></span>`
        : window.SP_LOGO}
      <span class="nav-brand-txt"><b>${esc(S.business.name)}</b><em>${sub}</em></span>
    </a>
    <nav class="nav-list" aria-label="Secciones">
      ${nav.map(n => `
        <button class="nav-item ${n.id === view ? 'is-on' : ''}" data-go="${n.id}"
                ${n.id === view ? 'aria-current="page"' : ''}>
          <span class="nav-ic">${icon(n.icon)}</span>
          <span class="nav-txt"><b>${n.label}</b><em>${n.hint}</em></span>
        </button>`).join('')}
    </nav>
    <div class="nav-foot">
      ${filaCuentaHTML()}
      <button class="nav-user" id="roleSwap" title="Cambiar de rol">
        ${av}
        <span class="nav-user-txt"><b>${esc(name)}</b><em>${r === 'player' ? 'Viendo como jugador' : 'Viendo como dueño'}</em></span>
        ${icon('swap', 'ic ic-sm nav-user-swap')}
      </button>
    </div>
  </aside>`;
}

/* ── Fondo de escenario ──────────────────────────────────────────────────── */

/**
 * Tres tratamientos, no uno por sección:
 *  · `is-court`   — la cancha del deporte a sangre. Lleva la foto del deporte
 *                   si existe y, si no, el campo de color con el plano.
 *  · `is-stadium` — la foto de estadio del cliente. Horizontal en escritorio,
 *                   vertical en móvil (lo resuelve el CSS, no este módulo).
 *  · sin clase    — superficie sobria. Queda como reserva para vistas
 *                   futuras de trabajo puro; hoy no la usa ninguna.
 */
export function paintViewBg(view) {
  const host = $('#viewBg');
  if (!host) return;

  const sport = bgSportFor(view);

  if (sport) {
    // La foto propia del dueño es un data: URL y no se versiona; la del
    // proyecto sí, para saltar cachés envenenadas.
    const propia = S.photos.sports[sport];
    const src = propia || conVersion(SPORTS[sport].photo);
    host.className = `view-bg is-court media--${sport}`;
    host.innerHTML = `
      <span class="media-wash"></span>
      ${courtSVG(sport)}
      <img class="media-img" src="${esc(src)}" alt=""
           loading="eager" fetchpriority="high" decoding="async"
           onload="this.classList.add('ok')" onerror="this.remove()">
      <span class="vb-grain"></span>
      <span class="vb-scrim"></span>`;
  /* `loading="eager"` a propósito. Esta imagen es el fondo a sangre: es el
     elemento más grande de la vista y está sobre el pliegue por definición.
     Con `lazy` el navegador la difería —a veces indefinidamente si la pestaña
     no estaba visible— y la sección se quedaba con el campo dibujado. El
     `lazy` sigue siendo correcto en las miniaturas de cada cancha, que sí
     están más abajo. */
    document.body.dataset.sport = sport;
    document.body.dataset.bleed = 'court';
    videoFondoVisible(false);
    return;
  }

  if (STADIUM_VIEWS.has(view)) {
    host.className = 'view-bg is-stadium';
    host.innerHTML = `
      <span class="vb-photo"></span>
      <span class="vb-beams"></span>
      <span class="vb-grain"></span>
      <span class="vb-scrim"></span>`;
    delete document.body.dataset.sport;
    document.body.dataset.bleed = 'stadium';
    videoFondoVisible(true);
    return;
  }

  host.className = 'view-bg';
  host.innerHTML = '';
  delete document.body.dataset.sport;
  // Sin fondo a sangre: superficie sobria. Es lo que le da respiro al ojo
  // entre una sección de escenario y la siguiente.
  delete document.body.dataset.bleed;
  videoFondoVisible(false);
}

/* La noche de estadio es el fondo por defecto de TODA la app. Canchas es la
   única excepción, y por eso funciona: cuando el fondo cambia, cambia porque
   estás mirando otro deporte, no porque cambiaste de pestaña. Un fondo que
   cambia en cada sección deja de significar algo. */
const STADIUM_VIEWS = new Set([
  'panel', 'reservas', 'torneos', 'equipos', 'bot', 'ajustes',
  'inicio', 'reservar', 'miequipo', 'ptorneos', 'historial'
]);

/** Qué deporte manda el fondo. Solo Canchas retinta la sección entera. */
function bgSportFor(view) {
  return view === 'canchas' ? getCanchaSport() : null;
}

/* ── Cabecera de página ──────────────────────────────────────────────────── */

export const pageHead = (kicker, title, right = '', sub = '') => `
  <header class="page-head">
    <div>
      <p class="kicker">${kicker}</p>
      <h1 class="page-title">${title}</h1>
      ${sub ? `<p class="page-sub">${sub}</p>` : ''}
    </div>
    <div class="page-tools">${right}</div>
  </header>`;

/* ── Conmutador de rol ───────────────────────────────────────────────────── */

/* Es la pieza que hace de esto un demo y no una captura de pantalla: el
   visitante reserva como jugador, cambia a dueño y ve su propia reserva ya
   en la agenda. */
export function openRoleSwap() {
  const player = me();
  const players = S.players || [];
  const actual = role();

  openModal({
    title: 'Cambiar de rol',
    body: `
      <p class="hint">Es el mismo negocio visto desde los dos lados. Lo que hagas
        en uno aparece en el otro al instante — reserva como jugador y míralo caer
        en la agenda del dueño.</p>
      <div class="role-pick">
        <button type="button" class="role-card ${actual === 'owner' ? 'is-on' : ''}" data-role="owner">
          ${icon('panel', 'ic')}
          <b>Dueño del complejo</b>
          <em>Panel, agenda, canchas, torneos y Neo AI</em>
        </button>
        <button type="button" class="role-card ${actual === 'player' ? 'is-on' : ''}" data-role="player">
          ${icon('user', 'ic')}
          <b>Jugador</b>
          <em>Reservar, armar equipo, inscribirse y ver tu histórico</em>
        </button>
      </div>
      <div id="whoBox" class="who-box" hidden>
        <span class="field-label">¿Quién eres?</span>
        <div class="who-list">
          ${players.slice(0, 8).map(p => `
            <button type="button" class="who ${p.id === player?.id ? 'is-on' : ''}" data-who="${p.id}">
              <span class="avatar avatar--sm" style="--tc:${p.color}">${esc(initials(p.name))}</span>
              <b>${esc(p.name)}</b><em>${esc(p.position || 'Jugador')}</em>
            </button>`).join('')}
          <button type="button" class="who who--new" data-who="new">
            ${icon('plus', 'ic ic-sm')}<b>Soy nuevo</b><em>Crear mi jugador</em>
          </button>
        </div>
      </div>`,
    confirm: 'Entrar',
    onConfirm() {
      const chosen = $('.role-card.is-on')?.dataset.role || 'owner';
      if (chosen === 'player') {
        const who = $('.who.is-on')?.dataset.who;
        if (who === 'new' || (!who && !player)) { askNewPlayer(); return false; }
        if (who && who !== 'new') S.session.playerId = who;
        if (!S.session.playerId) { toast('Elige quién eres', 'warn'); return false; }
      }
      S.session.role = chosen;
      save();
      renderApp(homeOf(chosen), { intro: true });
      toast(chosen === 'player' ? `Entraste como ${me()?.name}` : 'Estás viendo el panel del dueño');
    }
  });

  const box = $('#whoBox');
  const sync = () => { box.hidden = $('.role-card.is-on')?.dataset.role !== 'player'; };
  $$('.role-card').forEach(b => b.addEventListener('click', () => {
    $$('.role-card').forEach(x => x.classList.remove('is-on'));
    b.classList.add('is-on'); sync();
  }));
  $$('.who').forEach(b => b.addEventListener('click', () => {
    $$('.who').forEach(x => x.classList.remove('is-on'));
    b.classList.add('is-on');
  }));
  sync();
}

/* Se importa perezosamente para no atar el shell al formulario de alta. */
async function askNewPlayer() {
  const { openPlayerForm } = await import('../player/equipo.js');
  openPlayerForm(null, (p) => {
    S.session.role = 'player';
    S.session.playerId = p.id;
    save();
    renderApp('inicio', { intro: true });
    toast(`Bienvenido, ${p.name.split(' ')[0]}`);
  });
}
