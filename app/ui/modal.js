/* ==========================================================================
   UI · Modal y toast

   El foco: al abrir se mueve dentro del diálogo, se queda atrapado mientras
   está abierto y vuelve al botón que lo disparó al cerrar. Antes el foco se
   quedaba en <body> y el tabulador paseaba por los 13 controles de detrás,
   invisibles bajo el scrim.
   ========================================================================== */

import { $, $$, esc } from '../core/util.js';
import { REDUCED, SPRING } from './motion.js';
import { icon } from './icons.js';

let modalEl = null;
let lastFocus = null;

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function openModal({ title, body, confirm, danger, extra, wide, onConfirm, onDanger, onClose }) {
  closeModal();
  lastFocus = document.activeElement;

  modalEl = document.createElement('div');
  modalEl.className = 'scrim';
  modalEl.innerHTML = `
    <div class="modal ${wide ? 'modal-wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <header class="modal-head">
        <h2>${esc(title)}</h2>
        <button class="modal-x" aria-label="Cerrar">${icon('close', 'ic ic-sm')}</button>
      </header>
      <div class="modal-body">${body}</div>
      <footer class="modal-foot">
        ${danger ? `<button class="btn btn-danger btn-sm" data-danger>${esc(danger)}</button>` : ''}
        ${extra ? `<button class="btn btn-ghost btn-sm" data-extra>${esc(extra.label)}</button>` : ''}
        <span class="spacer"></span>
        <button class="btn btn-secondary" data-cancel>Cancelar</button>
        ${confirm ? `<button class="btn btn-primary" data-ok>${esc(confirm)}</button>` : ''}
      </footer>
    </div>`;
  document.body.appendChild(modalEl);
  document.body.classList.add('is-locked');
  // Lo de detrás deja de existir para el teclado y para los lectores.
  $('#app')?.setAttribute('inert', '');
  $('#backdrop')?.setAttribute('inert', '');

  const card = $('.modal', modalEl);
  if (!REDUCED) {
    modalEl.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, fill: 'both' });
    card.animate([{ opacity: 0, transform: 'translateY(16px) scale(.98)' }, { opacity: 1, transform: 'none' }],
      { duration: 420, easing: SPRING.soft, fill: 'both' });
  }

  const close = () => { onClose?.(); closeModal(); };
  $('.modal-x', modalEl).addEventListener('click', close);
  $('[data-cancel]', modalEl).addEventListener('click', close);
  modalEl.addEventListener('mousedown', e => { if (e.target === modalEl) close(); });
  document.addEventListener('keydown', onKey);

  const ok = $('[data-ok]', modalEl);
  ok && ok.addEventListener('click', () => { if (onConfirm && onConfirm() === false) return; close(); });
  const dg = $('[data-danger]', modalEl);
  dg && dg.addEventListener('click', () => { onDanger && onDanger(); close(); });
  const ex = $('[data-extra]', modalEl);
  ex && ex.addEventListener('click', () => { extra.run(); close(); });

  /* El primer campo del formulario si lo hay; si no, el botón principal.
     Nunca el botón de cerrar: enfocar "Cancelar" al abrir invita a cancelar. */
  /* Con setTimeout y no con requestAnimationFrame: si la pestaña está en
     segundo plano el navegador deja de entregar frames, el rAF no llega y el
     diálogo se abre sin foco — con el fondo ya inerte, el teclado queda
     atrapado en ningún sitio. */
  const first = $('input:not([type=hidden]), select, textarea', modalEl) || ok || $('.modal-x', modalEl);
  setTimeout(() => first?.focus(), 0);
}

function onKey(e) {
  if (!modalEl) return;
  if (e.key === 'Escape') { e.preventDefault(); closeModal(); return; }
  if (e.key !== 'Tab') return;
  const items = $$(FOCUSABLE, modalEl).filter(el => el.offsetParent !== null);
  if (!items.length) return;
  const first = items[0], last = items[items.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

export function closeModal() {
  if (!modalEl) return;
  const node = modalEl; modalEl = null;
  document.removeEventListener('keydown', onKey);
  document.body.classList.remove('is-locked');
  $('#app')?.removeAttribute('inert');
  $('#backdrop')?.removeAttribute('inert');

  // El foco vuelve de donde salió. Sin esto el teclado reaparece en el body.
  if (lastFocus?.isConnected) lastFocus.focus();
  lastFocus = null;

  if (REDUCED) { node.remove(); return; }
  const a = node.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: 'both' });
  a.onfinish = () => node.remove();
}

/* ── Toast ───────────────────────────────────────────────────────────────── */

let toastTimer = null;

export function toast(text, kind = 'ok') {
  let t = $('#toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.setAttribute('role', 'status');
    t.setAttribute('aria-live', 'polite');
    document.body.appendChild(t);
  }
  t.className = 'toast is-' + kind;
  t.innerHTML = icon(kind === 'warn' ? 'spark' : kind === 'info' ? 'spark' : 'check') + '<span></span>';
  $('span', t).textContent = text;
  /* El navegador tiene que registrar el estado inicial antes de cambiarlo o la
     transición salta al final. Se fuerza un reflujo leyendo `offsetWidth`: es
     síncrono y no depende de que la pestaña esté pintando, a diferencia de un
     requestAnimationFrame. Un aviso que no aparece es peor que uno sin animar. */
  void t.offsetWidth;
  t.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('is-on'), 3400);
}
