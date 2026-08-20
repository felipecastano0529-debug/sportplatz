/* ==========================================================================
   VISTA · Canchas
   La cancha ES el fondo. Un `.view-bg` fijo detrás de todo el contenido con
   la foto del deporte, el campo de color debajo y el plano dibujado encima.
   Las tarjetas flotan sobre él en vidrio oscuro — blancas macizas taparían la
   foto; en vidrio se leen como fichas apoyadas sobre el campo.

   El retinte va por tokens, no por componente: la vista redefine `--accent` y
   `--accent-rgb` con el color real del deporte y botones, pills, anillos de
   foco y focos del cursor se retintan solos.
   ========================================================================== */

import { $, $$, esc, money, moneyShort, iso, today, hourNum, hhmm, fmtHour, thousands, readNum, firstName } from '../core/util.js';
import { S, save } from '../core/store.js';
import { SPORTS, ballSVG } from '../core/sports.js';
import { bookingsOn, courtById, openHour, closeHour, hoursOfDay } from '../core/calc.js';
import { icon } from '../ui/icons.js';
import { stagger } from '../ui/motion.js';
import { openModal, toast } from '../ui/modal.js';
import { mediaBlock, wireDrops } from '../ui/photo.js';
import { renderApp, paintViewBg } from '../ui/shell.js';
import { openBooking } from './reservas.js';

let canchaSport = null;
export const getCanchaSport = () => canchaSport;
export const setCanchaSport = (s) => { canchaSport = s; };

export function viewCanchas(main) {
  const t = today();
  const nowH = new Date().getHours();

  const sports = S.business.sports;
  if (!canchaSport || !sports.includes(canchaSport)) canchaSport = sports[0];
  const sp = SPORTS[canchaSport];
  const courts = S.courts.filter(c => c.sport === canchaSport);
  const heroSrc = S.photos.sports[canchaSport] || sp.photo;

  const ocupadas = courts.filter(c => bookingsOn(iso(t), c.id).some(b => hourNum(b.start) === nowH)).length;
  const precioProm = courts.length ? courts.reduce((a, c) => a + c.price, 0) / courts.length : 0;
  const reservasHoy = courts.reduce((a, c) => a + bookingsOn(iso(t), c.id).length, 0);

  document.body.dataset.sport = canchaSport;

  main.innerHTML = `
    <header class="page-head">
      <div>
        <p class="kicker">Inventario</p>
        <h1 class="page-title">${esc(sp.name)}</h1>
        <p class="page-sub">${courts.length} ${courts.length === 1 ? 'cancha' : 'canchas'} · ${sp.blurb}</p>
      </div>
      <div class="page-tools">
        <span class="stamp">${icon('canchas')}${S.courts.length} canchas · ${sports.length} ${sports.length === 1 ? 'deporte' : 'deportes'}</span>
      </div>
    </header>

    <div class="court-bar" data-anim>
      ${sports.length > 1 ? `
        <nav class="hero-switch" aria-label="Elegir deporte">
          ${sports.map(id => `
            <button class="hswitch ${id === canchaSport ? 'is-on' : ''}" data-csport="${id}"
                    ${id === canchaSport ? 'aria-current="true"' : ''}>
              ${ballSVG(id, 'pill-ball')}<span>${SPORTS[id].short}</span>
            </button>`).join('')}
        </nav>` : ''}
      <dl class="hero-facts">
        <div><dt>Libres ahora</dt><dd>${courts.length - ocupadas}<em>de ${courts.length}</em></dd></div>
        <div><dt>Precio hora</dt><dd>${moneyShort(precioProm)}</dd></div>
        <div><dt>Reservas hoy</dt><dd>${reservasHoy}</dd></div>
      </dl>
      <button type="button" class="bar-drop" data-drop="sport:${canchaSport}"
              title="Cambiar la foto de fondo de ${esc(sp.name)} — o arrástrala aquí">
        ${icon('upload')}<b>${heroSrc && heroSrc.startsWith('data:') ? 'Cambiar fondo' : 'Subir fondo'}</b>
      </button>
    </div>

    <div class="court-grid">
      ${courts.map((c, i) => courtCard(c, t, nowH, i)).join('')}
    </div>

    <p class="legend">
      <span><i class="dot is-free"></i> libre</span>
      <span><i class="dot is-paid"></i> pagada completa</span>
      <span><i class="dot is-part"></i> con adelanto</span>
      <span><i class="dot is-due"></i> sin abonar</span>
      <span class="legend-note">Cada barra es una hora, de ${fmtHour(hhmm(openHour()))} a ${fmtHour(hhmm(closeHour()))} de hoy</span>
    </p>`;

  $$('[data-book]', main).forEach(b => b.addEventListener('click', () => openBooking({ courtId: b.dataset.book })));
  $$('[data-edit]', main).forEach(b => b.addEventListener('click', () => openCourtForm(b.dataset.edit)));
  $$('[data-csport]', main).forEach(b => b.addEventListener('click', () => {
    canchaSport = b.dataset.csport;
    viewCanchas(main);
    paintViewBg('canchas');
  }));
  wireDrops(main);
  stagger($$('[data-anim]', main), { y: 18, step: 40 });
}

function courtCard(c, t, nowH, i) {
  const s = SPORTS[c.sport];
  const hoy = bookingsOn(iso(t), c.id);
  const ahora = hoy.find(b => hourNum(b.start) === nowH);
  const ingresoMes = S.bookings
    .filter(b => b.courtId === c.id && b.date >= iso(new Date(t.getFullYear(), t.getMonth(), t.getDate() - 29)) && b.date <= iso(t))
    .reduce((a, b) => a + b.total, 0);

  const siguiente = hoy.filter(b => hourNum(b.start) > nowH)
    .sort((a, b) => a.start.localeCompare(b.start))[0];

  return `<article class="court" data-anim style="--i:${i}">
    <div class="court-media">
      ${mediaBlock(c.sport, c.photo || c.image, { drop: `court:${c.id}`, label: c.name })}
      <span class="court-badge ${ahora ? 'is-busy' : 'is-free'}"><i></i>${ahora ? 'Ocupada ahora' : 'Libre ahora'}</span>
    </div>
    <div class="court-body">
      <header class="court-top">
        <span class="court-ball">${ballSVG(c.sport)}</span>
        <div>
          <h2 class="court-name">${esc(c.name)}</h2>
          <p class="court-sport">${s.name}</p>
        </div>
        <p class="court-price"><b>${money(c.price)}</b><em>/ hora</em></p>
      </header>
      <dl class="court-stats">
        <div><dt>Hoy</dt><dd>${hoy.length} reserva${hoy.length === 1 ? '' : 's'}</dd></div>
        <div><dt>30 días</dt><dd>${moneyShort(ingresoMes)}</dd></div>
        <div><dt>${ahora ? 'Jugando' : 'Siguiente'}</dt>
          <dd>${ahora ? esc(firstName(ahora.customer)) : (siguiente ? fmtHour(siguiente.start) : 'libre el resto')}</dd></div>
      </dl>
      <div class="court-day" role="img" aria-label="Ocupación de hoy, hora por hora">
        ${hoursOfDay().map(h => {
          const b = hoy.find(x => hourNum(x.start) === h);
          const cls = !b ? 'free' : b.deposit >= b.total ? 'paid' : b.deposit > 0 ? 'part' : 'due';
          const title = b
            ? `${fmtHour(b.start)} · ${b.customer} · ${b.deposit >= b.total ? 'pagada' : 'debe ' + money(b.total - b.deposit)}`
            : `${fmtHour(hhmm(h))} · libre`;
          return `<span class="slot is-${cls}" title="${esc(title)}"></span>`;
        }).join('')}
      </div>
      <div class="court-actions">
        <button class="btn btn-sm btn-primary" data-book="${c.id}">${icon('plus')}Reservar</button>
        <button class="btn btn-sm btn-secondary" data-edit="${c.id}">${icon('pencil')}Editar</button>
      </div>
    </div>
  </article>`;
}

/* Renombrar la cancha era un hueco de personalización: el negocio se llamaba
   como quisiera, pero sus canchas eran siempre "Sintética 1". */
export function openCourtForm(courtId) {
  const c = courtById(courtId);
  if (!c) return;

  openModal({
    title: 'Editar ' + c.name,
    body: `
      <div class="form-grid">
        <label class="field field-full"><span class="field-label">Nombre de la cancha</span>
          <input id="cName" class="input" value="${esc(c.name)}" maxlength="28"
                 placeholder="Ej. Cancha Norte"></label>
        <label class="field field-full"><span class="field-label">Precio por hora</span>
          <span class="price-input price-input-lg"><i>$</i>
            <input id="cPrice" type="text" inputmode="numeric" value="${thousands(c.price)}"><em>/ hora</em></span>
        </label>
      </div>
      <p class="hint">El precio aplica a las reservas nuevas. Las ya hechas conservan el suyo.</p>`,
    confirm: 'Guardar',
    onConfirm() {
      const nombre = $('#cName').value.trim();
      const precio = readNum($('#cPrice').value) || c.price;
      c.name = nombre || c.name;
      c.price = precio;
      save();
      renderApp('canchas');
      toast(`${c.name} · ${money(precio)} la hora`);
    }
  });

  const inp = $('#cPrice');
  inp.addEventListener('input', () => {
    const n = readNum(inp.value);
    inp.value = n ? thousands(n) : '';
  });
}
