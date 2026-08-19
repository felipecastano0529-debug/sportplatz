/* ==========================================================================
   JUGADOR · Reservar
   Cuatro pasos en una sola pantalla: deporte → día → cancha → hora. Sin
   modales y sin formulario: el jugador ve la parrilla de horas libres y toca
   la que quiere.

   Es el momento que hace el demo: al confirmar, la reserva aparece en la
   agenda del dueño sin que nadie más haga nada.
   ========================================================================== */

import { $, $$, esc, money, iso, today, addDays, sameDay, fmtDate, fmtDateLong, fmtHour, hhmm, nextHour, uid, DAYS_S, MONTHS_S } from '../core/util.js';
import { S, save } from '../core/store.js';
import { SPORTS, ballSVG } from '../core/sports.js';
import { bookingsOn, courtById, hoursOfDay, slotTaken } from '../core/calc.js';
import { me } from '../core/teams.js';
import { icon } from '../ui/icons.js';
import { stagger, enter } from '../ui/motion.js';
import { openModal, toast } from '../ui/modal.js';
import { pageHead, renderApp } from '../ui/shell.js';
import { filyLead } from '../core/lead.js';

let sel = { sport: null, date: iso(today()), courtId: null };

export function viewReservar(main) {
  const yo = me();
  const sports = S.business.sports;

  // Si vino de "libre ahora mismo", arranca en esa cancha.
  const quick = sessionStorage.getItem('sp.quickCourt');
  if (quick) {
    const c = courtById(quick);
    if (c) { sel.sport = c.sport; sel.courtId = c.id; }
    sessionStorage.removeItem('sp.quickCourt');
  }
  if (!sel.sport || !sports.includes(sel.sport)) sel.sport = sports[0];

  const courts = S.courts.filter(c => c.sport === sel.sport);
  if (!sel.courtId || !courts.some(c => c.id === sel.courtId)) sel.courtId = courts[0]?.id;
  const court = courtById(sel.courtId);
  const sp = SPORTS[sel.sport];

  const t = today();
  const days = Array.from({ length: 14 }, (_, i) => addDays(t, i));
  const ocupadas = new Set(bookingsOn(sel.date, sel.courtId).map(b => b.start));
  const nowH = new Date().getHours();
  const esHoy = sel.date === iso(t);

  main.innerHTML = `
    ${pageHead('Reserva tu cancha', 'Reservar', '',
      `${sp.name} · ${money(court?.price || 0)} la hora`)}

    ${sports.length > 1 ? `
      <nav class="hero-switch" aria-label="Elegir deporte" data-anim>
        ${sports.map(id => `
          <button class="hswitch ${id === sel.sport ? 'is-on' : ''}" data-rsport="${id}"
                  ${id === sel.sport ? 'aria-current="true"' : ''}>
            ${ballSVG(id, 'pill-ball')}<span>${SPORTS[id].short}</span>
          </button>`).join('')}
      </nav>` : ''}

    <div class="daystrip" id="daystrip" data-anim role="tablist" aria-label="Elegir día">
      ${days.map(d => {
        const s = iso(d);
        return `<button class="day ${s === sel.date ? 'is-on' : ''} ${sameDay(d, t) ? 'is-today' : ''}"
                        data-rday="${s}" role="tab" aria-selected="${s === sel.date}">
          <em>${DAYS_S[d.getDay()]}</em><b>${d.getDate()}</b>
          <span class="day-mes">${MONTHS_S[d.getMonth()]}</span>
        </button>`;
      }).join('')}
    </div>

    ${courts.length > 1 ? `
      <div class="filters filters--wide" data-anim>
        ${courts.map(c => `<button class="pill ${c.id === sel.courtId ? 'is-on' : ''}" data-rcourt="${c.id}">
          ${esc(c.name)} <em>${money(c.price)}</em></button>`).join('')}
      </div>` : ''}

    <section class="slots-card" data-anim>
      <header class="slots-head">
        <div>
          <h2>${esc(court?.name || '')}</h2>
          <p>${fmtDateLong(sel.date)}</p>
        </div>
        <span class="slots-legend"><i class="dot is-free"></i>libre <i class="dot is-due"></i>ocupada</span>
      </header>
      <div class="slot-grid">
        ${hoursOfDay().map(h => {
          const hs = hhmm(h);
          const taken = ocupadas.has(hs);
          const pasado = esHoy && h <= nowH;
          const off = taken || pasado;
          return `<button class="hslot ${off ? 'is-off' : ''}" ${off ? 'disabled' : ''} data-hour="${hs}"
            aria-label="${fmtHour(hs)}${off ? ', no disponible' : ', reservar'}">
            <b>${fmtHour(hs).replace(':00', '')}</b>
            <em>${taken ? 'ocupada' : pasado ? 'pasó' : money(court?.price || 0)}</em>
          </button>`;
        }).join('')}
      </div>
    </section>`;

  $$('[data-rsport]', main).forEach(b => b.addEventListener('click', () => {
    sel.sport = b.dataset.rsport; sel.courtId = null; renderApp('reservar');
  }));
  $$('[data-rday]', main).forEach(b => b.addEventListener('click', () => {
    sel.date = b.dataset.rday; viewReservar(main);
  }));
  $$('[data-rcourt]', main).forEach(b => b.addEventListener('click', () => {
    sel.courtId = b.dataset.rcourt; viewReservar(main);
  }));
  $$('[data-hour]:not([disabled])', main).forEach(b =>
    b.addEventListener('click', () => confirmar(court, sel.date, b.dataset.hour, yo)));

  const strip = $('#daystrip');
  const on = $('.day.is-on', strip);
  if (on) strip.scrollLeft = on.offsetLeft - strip.clientWidth / 2 + on.clientWidth / 2;
  stagger($$('[data-anim]', main), { y: 14, step: 45 });
  stagger($$('.hslot', main).slice(0, 18), { y: 8, step: 14, delay: 160 });
}

function confirmar(court, date, start, yo) {
  const adelanto = Math.round(court.price * 0.5 / 1000) * 1000;

  openModal({
    title: 'Confirmar reserva',
    body: `
      <ul class="kv">
        <li><span>Cancha</span><b>${esc(court.name)}</b></li>
        <li><span>Cuándo</span><b>${fmtDateLong(date)} · ${fmtHour(start)} a ${fmtHour(nextHour(start))}</b></li>
        <li><span>A nombre de</span><b>${esc(yo?.name || 'Invitado')}</b></li>
        <li><span>Total</span><b>${money(court.price)}</b></li>
      </ul>
      <div class="pay-choice" id="payChoice" role="radiogroup" aria-label="Cómo pagas">
        <button type="button" class="pay-opt is-on" data-pay="${adelanto}" role="radio" aria-checked="true">
          <b>Aparto con adelanto</b><em>${money(adelanto)} ahora · ${money(court.price - adelanto)} en cancha</em>
        </button>
        <button type="button" class="pay-opt" data-pay="${court.price}" role="radio" aria-checked="false">
          <b>Pago completo</b><em>${money(court.price)} ahora · nada en cancha</em>
        </button>
        <button type="button" class="pay-opt" data-pay="0" role="radio" aria-checked="false">
          <b>Pago todo en cancha</b><em>Sin adelanto · el cupo puede liberarse</em>
        </button>
      </div>`,
    confirm: 'Confirmar reserva',
    onConfirm() {
      if (slotTaken(court.id, date, start)) {
        toast('Alguien acaba de tomar esa hora', 'warn');
        return false;
      }
      const dep = +($('.pay-opt.is-on')?.dataset.pay ?? 0);
      S.bookings.push({
        id: uid('b'), courtId: court.id, date, start, end: nextHour(start),
        playerId: yo?.id ?? null,
        customer: yo?.name || 'Invitado',
        phone: yo?.phone || '',
        total: court.price, deposit: dep, source: 'app',
        status: 'confirmada', note: ''
      });
      save();
      filyLead.senal('reservo');
      renderApp('inicio');
      toast(`Listo · ${court.name} el ${fmtDate(date)} a las ${fmtHour(start)}`);
    }
  });

  $$('.pay-opt').forEach(b => b.addEventListener('click', () => {
    $$('.pay-opt').forEach(x => { x.classList.remove('is-on'); x.setAttribute('aria-checked', 'false'); });
    b.classList.add('is-on'); b.setAttribute('aria-checked', 'true');
  }));
}
