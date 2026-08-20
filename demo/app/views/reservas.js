/* ==========================================================================
   VISTA · Reservas
   Agenda por hora × cancha, 14 días navegables.

   La cuadrícula se queda sobre superficie clara a propósito, aunque el fondo
   de la sección sea la cancha a sangre: son 17 filas de datos seguidas y en
   vidrio oscuro se leen mal. El escenario es el marco; la mesa de trabajo es
   la mesa de trabajo.

   Arreglado de la auditoría: la agenda scrollea en horizontal. Antes tenía
   `overflow: hidden` con columnas de mínimo 7.25rem — medido, con 12 canchas
   el grid pedía 1484 px dentro de un contenedor de 1118 px y las columnas de
   la 8 en adelante eran físicamente inalcanzables. En móvil se rompía con 3.
   ========================================================================== */

import { $, $$, esc, money, moneyShort, iso, today, addDays, sameDay, fmtDate, fmtDateLong, fmtHour, hhmm, nextHour, uid, thousands, readNum, DAYS_S, MONTHS_S, firstName } from '../core/util.js';
import { S, save } from '../core/store.js';
import { SPORTS, ballSVG } from '../core/sports.js';
import { bookingsOn, courtById, bookingById, hoursOfDay, openHour, slotTaken } from '../core/calc.js';
import { icon } from '../ui/icons.js';
import { stagger } from '../ui/motion.js';
import { openModal, toast } from '../ui/modal.js';
import { pageHead, renderApp } from '../ui/shell.js';
import { phone as randomPhone } from '../core/seed.js';

let agendaDate = iso(today());
let agendaSport = 'all';

/* De dónde salió cada reserva. 'bot' es Neo por WhatsApp y 'neo' es Neo
   dentro de la app: el mismo asistente por dos puertas, y al dueño le importa
   cuál — no es lo mismo un cliente que escribió al celular del negocio que
   uno que ya estaba adentro. */
const SRC = {
  bot:       { tag: 'WA', title: 'Reservó por WhatsApp con Neo AI', label: 'Neo AI en WhatsApp' },
  neo:       { tag: 'IA', title: 'Reservó hablando con Neo AI en la app', label: 'Neo AI en la app' },
  app:       { tag: '',   title: '', label: 'La app del jugador' },
  mostrador: { tag: '',   title: '', label: 'Mostrador' }
};

export function viewReservas(main) {
  const t = today();
  const days = Array.from({ length: 14 }, (_, i) => addDays(t, i - 2));
  const courts = S.courts.filter(c => agendaSport === 'all' || c.sport === agendaSport);
  const hours = hoursOfDay();
  const dayBookings = bookingsOn(agendaDate);
  const ingresoDia = dayBookings.reduce((s, b) => s + b.total, 0);
  const cobradoDia = dayBookings.reduce((s, b) => s + b.deposit, 0);

  main.innerHTML = `
    ${pageHead('Agenda', 'Reservas',
      `<button class="btn btn-primary btn-sm" id="newBooking">${icon('plus')}Nueva reserva</button>`)}

    <div class="daystrip" id="daystrip" role="tablist" aria-label="Elegir día">
      ${days.map(d => {
        const s = iso(d);
        const n = bookingsOn(s).length;
        return `<button class="day ${s === agendaDate ? 'is-on' : ''} ${sameDay(d, t) ? 'is-today' : ''}"
                        data-day="${s}" role="tab" aria-selected="${s === agendaDate}">
          <em>${DAYS_S[d.getDay()]}</em>
          <b>${d.getDate()}</b>
          <span class="day-mes">${MONTHS_S[d.getMonth()]}</span>
          <span class="day-bar"><i style="--w:${Math.min(100, (n / Math.max(1, S.courts.length * 6)) * 100)}%"></i></span>
        </button>`;
      }).join('')}
    </div>

    <div class="agenda-bar">
      <div class="filters">
        <button class="pill ${agendaSport === 'all' ? 'is-on' : ''}" data-sport="all">Todas</button>
        ${S.business.sports.map(id => `
          <button class="pill ${agendaSport === id ? 'is-on' : ''}" data-sport="${id}">
            ${ballSVG(id, 'pill-ball')}${SPORTS[id].short}</button>`).join('')}
      </div>
      <p class="legend legend--inline" title="WA e IA marcan las que entraron solas por Neo AI">
        <span><i class="dot is-paid"></i> pagada</span>
        <span><i class="dot is-part"></i> adelanto</span>
        <span><i class="dot is-due"></i> sin abonar</span>
      </p>
      <p class="agenda-sum" title="${money(ingresoDia)} facturado · ${money(cobradoDia)} recibido · ${money(ingresoDia - cobradoDia)} pendiente">
        <b>${money(ingresoDia)}</b> facturado ·
        <span class="ok">${moneyShort(cobradoDia)}</span> recibido ·
        <span class="neg">${moneyShort(ingresoDia - cobradoDia)}</span> pendiente
      </p>
    </div>

    <div class="agenda-wrap">
      ${enCelular() ? agendaLista(courts, dayBookings, hours) : `
      <div class="agenda" style="--cols:${courts.length}">
        <div class="agenda-head">
          <div class="ag-corner">${fmtDate(agendaDate)}</div>
          ${courts.map(c => `<div class="ag-col-head">
            <span>${ballSVG(c.sport)}</span><b>${esc(c.name)}</b><em>${money(c.price)}</em>
          </div>`).join('')}
        </div>
        <div class="agenda-body">
          ${hours.map(h => {
            const hs = hhmm(h);
            return `<div class="ag-row">
              <div class="ag-hour">${fmtHour(hs)}</div>
              ${courts.map(c => {
                const b = dayBookings.find(x => x.courtId === c.id && x.start === hs);
                if (!b) return `<button class="ag-cell is-free" data-new="${c.id}|${hs}"
                    aria-label="Reservar ${esc(c.name)} a las ${fmtHour(hs)}">
                  <span>${icon('plus', 'ic ic-sm')}reservar</span></button>`;
                const saldo = b.total - b.deposit;
                const cls = saldo === 0 ? 'is-paid' : b.deposit > 0 ? 'is-part' : 'is-due';
                return `<button class="ag-cell ${cls}" data-open="${b.id}">
                  <b>${esc(b.customer.split(' ').slice(0, 2).join(' '))}</b>
                  <em>${saldo > 0 ? `${moneyShort(b.total)} · debe ${moneyShort(saldo)}` : money(b.total)}</em>
                  ${SRC[b.source]?.tag ? `<i class="src" title="${SRC[b.source].title}">${SRC[b.source].tag}</i>` : ''}
                </button>`;
              }).join('')}
            </div>`;
          }).join('')}
        </div>
      </div>`}
    </div>
`;

  $$('[data-day]', main).forEach(b => b.addEventListener('click', () => {
    agendaDate = b.dataset.day; viewReservas(main);
  }));
  $$('[data-sport]', main).forEach(b => b.addEventListener('click', () => {
    agendaSport = b.dataset.sport;
    renderApp('reservas');           // re-render completo: cambia el fondo
  }));
  $('#newBooking').addEventListener('click', () => openBooking({}));
  $$('[data-new]', main).forEach(b => b.addEventListener('click', () => {
    const [courtId, start] = b.dataset.new.split('|');
    openBooking({ courtId, start, date: agendaDate });
  }));
  $$('[data-open]', main).forEach(b => b.addEventListener('click', () => openBookingDetail(b.dataset.open)));

  const strip = $('#daystrip');
  const on = $('.day.is-on', strip);
  if (on) strip.scrollLeft = on.offsetLeft - strip.clientWidth / 2 + on.clientWidth / 2;
  avisarDeMasColumnas(main);
  alaHoraDeAhora(main);
  vigilarAncho(main);
  stagger($$('.ag-row', main).slice(0, 12), { y: 8, step: 18 });
}

/* En un teléfono una cuadrícula de diez canchas por diecisiete horas no es una
   agenda: es un mapa que hay que recorrer con dos dedos. Lo que se mira en el
   celular es el DÍA —qué entra ahora, quién viene, qué queda libre— así que la
   tabla se convierte en la línea de tiempo del día y la cancha pasa de ser un
   eje a ser un dato de cada reserva. Misma información, misma agenda, leída
   como se lee un teléfono: hacia abajo. */
const enCelular = () => matchMedia('(max-width: 62rem)').matches;

function agendaLista(courts, dayBookings, hours) {
  return `<ol class="agl">
    ${hours.map(h => {
      const hs = hhmm(h);
      const tomadas = courts.map(c => ({ c, b: dayBookings.find(x => x.courtId === c.id && x.start === hs) }))
                            .filter(x => x.b);
      const libre = courts.find(c => !dayBookings.some(x => x.courtId === c.id && x.start === hs));
      const nLibres = courts.length - tomadas.length;
      return `<li class="agl-row ${tomadas.length ? '' : 'is-quiet'}">
        <span class="agl-h">${fmtHour(hs)}</span>
        <div class="agl-slots">
          ${tomadas.map(({ c, b }) => {
            const saldo = b.total - b.deposit;
            const cls = saldo === 0 ? 'is-paid' : b.deposit > 0 ? 'is-part' : 'is-due';
            return `<button class="agl-slot ${cls}" data-open="${b.id}">
              <b>${esc(b.customer)}</b>
              <em>${esc(c.name)} · ${saldo > 0 ? `${moneyShort(b.total)} · debe ${moneyShort(saldo)}` : money(b.total)}</em>
              ${SRC[b.source]?.tag ? `<i class="src" title="${SRC[b.source].title}">${SRC[b.source].tag}</i>` : ''}
            </button>`;
          }).join('')}
          ${nLibres && libre ? `<button class="agl-free" data-new="${libre.id}|${hs}">
            ${icon('plus', 'ic ic-sm')}${nLibres} ${nLibres === 1 ? 'cancha libre' : 'canchas libres'}</button>` : ''}
        </div>
      </li>`;
    }).join('')}
  </ol>`;
}

/* Con más de ocho canchas la tabla no cabe en ninguna pantalla, y una columna
   cortada limpia contra el borde no se lee como "sigue": se lee como el
   final. El velo de la derecha solo se enciende cuando queda algo por ver.
   Va aquí y no en CSS porque depende de cuánto se haya scrolleado. */
/* Un día empieza a las 6 de la mañana y la primera reserva rara vez es antes
   de las 4 de la tarde: abrir la agenda mirando fijamente tres filas vacías
   es empezar a media página. Si el día es hoy, la tabla arranca una hora
   antes de la actual, que es donde está la información. */
function alaHoraDeAhora(main) {
  const ag = $('.agenda', main);
  if (!ag || agendaDate !== iso(today())) return;
  const fila = $$('.ag-row', ag)[Math.max(0, new Date().getHours() - openHour() - 1)];
  if (fila) ag.scrollTop = fila.offsetTop - $('.agenda-head', ag).offsetHeight;
}

/* Girar el teléfono o abrir la ventana cruza el punto donde la agenda cambia
   de forma, y quedarse con la anterior deja media vista rota. */
let anchoVivo = null;
function vigilarAncho(main) {
  anchoVivo?.abort();
  const ctrl = new AbortController();
  anchoVivo = ctrl;
  const mq = matchMedia('(max-width: 62rem)');
  mq.addEventListener('change', () => { if (main.isConnected) viewReservas(main); }, { signal: ctrl.signal });
}

let avisoVivo = null;   // el oyente de `resize` de la agenda anterior

function avisarDeMasColumnas(main) {
  const wrap = $('.agenda-wrap', main);
  const ag = $('.agenda', main);   // en celular no hay tabla: no hay nada que avisar
  avisoVivo?.abort();     // la vista se repinta en cada día y filtro
  avisoVivo = null;
  if (!wrap || !ag) return;

  const ctrl = new AbortController();
  avisoVivo = ctrl;
  const sync = () => wrap.classList.toggle('has-more',
    ag.scrollWidth - ag.clientWidth - ag.scrollLeft > 8);
  ag.addEventListener('scroll', sync, { passive: true, signal: ctrl.signal });
  addEventListener('resize', sync, { passive: true, signal: ctrl.signal });
  sync();
}

/* ── Alta ────────────────────────────────────────────────────────────────── */

export function openBooking({ courtId = S.courts[0]?.id, start = '18:00', date = agendaDate, playerId = null } = {}) {
  if (!S.courts.length) return;
  const opts = S.courts.map(c =>
    `<option value="${c.id}" ${c.id === courtId ? 'selected' : ''}>${esc(c.name)} — ${money(c.price)}/h</option>`).join('');
  const hours = hoursOfDay().map(h => {
    const hh = hhmm(h);
    return `<option value="${hh}" ${hh === start ? 'selected' : ''}>${fmtHour(hh)}</option>`;
  }).join('');

  openModal({
    title: 'Nueva reserva',
    body: `
      <div class="form-grid">
        <label class="field"><span class="field-label">Cliente</span>
          <input id="fName" class="input" placeholder="Nombre y apellido" autocomplete="off"></label>
        <label class="field"><span class="field-label">Celular</span>
          <input id="fPhone" class="input" placeholder="+57 300 000 0000" autocomplete="off"></label>
        <label class="field"><span class="field-label">Cancha</span>
          <select id="fCourt" class="input">${opts}</select></label>
        <label class="field"><span class="field-label">Día</span>
          <input id="fDate" class="input" type="date" value="${date}"></label>
        <label class="field"><span class="field-label">Hora</span>
          <select id="fStart" class="input">${hours}</select></label>
        <label class="field"><span class="field-label">Adelanto</span>
          <span class="price-input"><i>$</i><input id="fDep" type="text" inputmode="numeric" value="0"></span></label>
      </div>
      <div class="form-note" id="fSummary"></div>`,
    confirm: 'Guardar reserva',
    onConfirm() {
      const c = courtById($('#fCourt').value);
      const s = $('#fStart').value;
      const d = $('#fDate').value;
      const name = $('#fName').value.trim() || 'Cliente sin nombre';
      const dep = Math.min(c.price, readNum($('#fDep').value));
      if (slotTaken(c.id, d, s)) {
        toast('Esa hora ya está reservada en ' + c.name, 'warn');
        return false;
      }
      S.bookings.push({
        id: uid('b'), courtId: c.id, date: d, start: s, end: nextHour(s),
        playerId,
        customer: name, phone: $('#fPhone').value.trim() || randomPhone(),
        total: c.price, deposit: dep, source: 'mostrador',
        status: 'confirmada', note: ''
      });
      save();
      agendaDate = d;
      renderApp('reservas');
      toast(`Reserva de ${name} guardada · ${fmtDate(d)} ${fmtHour(s)}`);
    }
  });

  const sync = () => {
    const c = courtById($('#fCourt').value);
    const dep = Math.min(c.price, readNum($('#fDep').value));
    $('#fSummary').innerHTML = `
      <span>Total <b>${money(c.price)}</b></span>
      <span>Adelanto <b class="ok">${money(dep)}</b></span>
      <span>Queda debiendo <b class="neg">${money(c.price - dep)}</b></span>`;
  };
  ['#fCourt', '#fDep'].forEach(sel => $(sel).addEventListener('input', sync));
  $('#fDep').addEventListener('input', (e) => {
    const n = readNum(e.target.value);
    e.target.value = n ? thousands(n) : '0';
  });
  sync();
}

/* ── Detalle ─────────────────────────────────────────────────────────────── */

export function openBookingDetail(id) {
  const b = bookingById(id);
  if (!b) return;
  const c = courtById(b.courtId);
  const saldo = b.total - b.deposit;

  openModal({
    title: b.customer,
    body: `
      <ul class="kv">
        <li><span>Cancha</span><b>${esc(c?.name || '—')}</b></li>
        <li><span>Cuándo</span><b>${fmtDateLong(b.date)} · ${fmtHour(b.start)} a ${fmtHour(b.end)}</b></li>
        <li><span>Celular</span><b>${esc(b.phone)}</b></li>
        <li><span>Reservó por</span><b>${SRC[b.source]?.label || SRC.mostrador.label}</b></li>
        <li><span>Total</span><b>${money(b.total)}</b></li>
        <li><span>Adelanto</span><b class="ok">${money(b.deposit)}</b></li>
        <li class="kv-strong"><span>Saldo</span><b class="${saldo ? 'neg' : 'ok'}">${saldo ? money(saldo) : 'Pagada'}</b></li>
      </ul>
      ${saldo ? `<label class="field"><span class="field-label">Registrar abono</span>
        <span class="price-input"><i>$</i><input id="fAdd" type="text" inputmode="numeric" value="${thousands(saldo)}"></span></label>` : ''}`,
    confirm: saldo ? 'Registrar abono' : null,
    danger: 'Cancelar reserva',
    onDanger() {
      S.bookings = S.bookings.filter(x => x.id !== id);
      save(); renderApp('reservas'); toast('Reserva cancelada', 'warn');
    },
    onConfirm() {
      if (!saldo) return;
      const add = Math.min(saldo, readNum($('#fAdd').value));
      b.deposit += add; save(); renderApp('reservas');
      toast(`Abono de ${money(add)} registrado`);
    }
  });
}
