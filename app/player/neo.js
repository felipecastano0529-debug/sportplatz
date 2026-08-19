/* ==========================================================================
   JUGADOR · Neo AI
   El otro lado del mostrador. El dueño ve a Neo trabajando en una pantalla
   de WhatsApp; el jugador habla con él aquí dentro, y por eso NO se disfraza
   de WhatsApp: es una conversación de la app, con la tipografía y el vidrio
   de la app. Imitar otra aplicación dentro de la propia solo confunde sobre
   dónde está uno parado.

   Toda la lógica vive en core/neo.js. Esto pinta, encola y espera: la vista
   no sabe nada de fechas ni de disponibilidad.

   La conversación sobrevive a salir de la sección — es un módulo con memoria
   a propósito. Volver y encontrar el chat vacío obligaría a repetirlo todo.
   ========================================================================== */

import { $, $$, esc, money, fmtDate, fmtDateLong, fmtHour } from '../core/util.js';
import { S } from '../core/store.js';
import { ballSVG } from '../core/sports.js';
import { nuevaSesion, responder, saludoInicial } from '../core/neo.js';
import { icon } from '../ui/icons.js';
import { REDUCED, enter, stagger } from '../ui/motion.js';
import { toast } from '../ui/modal.js';
import { pageHead, renderApp } from '../ui/shell.js';
import { filyLead } from '../core/lead.js';

let ctx = null;
let log = [];        // lo ya dicho: [{ who:'yo'|'neo', msg }]
let cola = [];       // lo que Neo tiene pendiente de decir
let quick = [];      // sugerencias del momento
let timer = null;

export function viewNeo(main) {
  if (!ctx) arrancar();

  main.innerHTML = `
    ${pageHead('Asistente', 'Neo AI',
      `<button class="btn btn-secondary btn-sm" id="neoReset">${icon('spark')}Empezar de nuevo</button>`,
      'Pídele la cancha hablando · mira la agenda en vivo y te la aparta a tu nombre')}

    <section class="neo" data-anim>
      <header class="neo-head">
        <span class="neo-av">${window.SP_LOGO}</span>
        <span class="neo-who">
          <b>Neo AI</b>
          <em><i class="neo-live"></i>en línea · te responde al instante</em>
        </span>
        <span class="neo-tag">${esc(S.business.name)}</span>
      </header>

      <div class="neo-log" id="neoLog" role="log" aria-live="polite"
           aria-label="Conversación con Neo AI"></div>

      <div class="neo-quick" id="neoQuick"></div>

      <form class="neo-form" id="neoForm" autocomplete="off">
        <input class="neo-in" id="neoIn" name="msg" placeholder="Escríbele a Neo…"
               aria-label="Escríbele a Neo" maxlength="140" enterkeyhint="send">
        <button class="neo-send" type="submit" aria-label="Enviar mensaje">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 20l19-8L3 4l4 8-4 8z"/></svg>
        </button>
      </form>
    </section>`;

  const box = $('#neoLog', main);
  box.innerHTML = log.map(m => burbuja(m.who, m.msg)).join('');
  box.scrollTop = box.scrollHeight;

  // Un solo oyente para todo lo tocable de la conversación: los chips y los
  // botones nacen con el tiempo y no existen cuando se cablea la vista.
  box.addEventListener('click', (e) => {
    const say = e.target.closest('[data-say]');
    if (say) return enviar(say.dataset.say);
    const go = e.target.closest('[data-goto]');
    if (go) renderApp(go.dataset.goto);
  });

  $('#neoQuick', main).addEventListener('click', (e) => {
    const b = e.target.closest('[data-say]');
    if (b) enviar(b.dataset.say);
  });

  $('#neoForm', main).addEventListener('submit', (e) => {
    e.preventDefault();
    const inp = $('#neoIn');
    const txt = inp.value.trim();
    if (!txt) return;
    inp.value = '';
    enviar(txt);
  });

  $('#neoReset', main).addEventListener('click', () => {
    arrancar();
    renderApp('neo');
    toast('Conversación nueva');
  });

  pintarQuick();
  stagger($$('[data-anim]', main), { y: 16, step: 70 });
  bombear();
}

function arrancar() {
  clearTimeout(timer); timer = null;
  ctx = nuevaSesion();
  log = [];
  cola = [];
  const s = saludoInicial(ctx);
  cola.push(...s.msgs);
  quick = s.quick;
}

/* La cadena de setTimeout escribe sobre nodos de ESTA vista. Al salir se
   corta, pero lo que Neo tenía pendiente de decir no se tira: se vuelca al
   historial para que al volver la conversación esté completa y no rota. */
export function stopNeo() {
  clearTimeout(timer);
  timer = null;
  $('#neoTyping')?.remove();
  while (cola.length) log.push({ who: 'neo', msg: cola.shift() });
}

/* ── Turno del jugador ───────────────────────────────────────────────────── */

/* Escribir mientras Neo contesta no puede perder el mensaje —era lo que
   pasaba— ni pintarlo en desorden: lo que Neo tenía pendiente se suelta de
   golpe y recién entonces entra el turno del jugador. Adelantar la respuesta
   es lo que hace cualquiera que ve venir la siguiente frase. */
function enviar(texto) {
  if (timer) volcar();
  const msg = { t: 'text', text: texto };
  log.push({ who: 'yo', msg });
  soltar(burbuja('yo', msg));

  quick = [];
  pintarQuick();

  filyLead.senal('uso_asistente');
  const r = responder(ctx, texto);
  quick = r.quick || [];
  cola.push(...r.msgs);

  // La reserva ya está en el estado cuando llega esta burbuja: el aviso va
  // aquí y no dentro del cerebro, que no sabe de pantallas.
  const hecha = r.msgs.find(m => m.t === 'ok');
  if (hecha) filyLead.senal('reservo');
  if (hecha) toast(`Reserva confirmada · ${hecha.b.courtName} ${fmtDate(hecha.b.date)} ${fmtHour(hecha.b.start)}`);

  bombear();
}

function volcar() {
  clearTimeout(timer);
  timer = null;
  $('#neoTyping')?.remove();
  while (cola.length) {
    const m = cola.shift();
    log.push({ who: 'neo', msg: m });
    const box = $('#neoLog');
    if (box) { box.insertAdjacentHTML('beforeend', burbuja('neo', m)); alFondo(box); }
  }
}

/* ── Turno de Neo ────────────────────────────────────────────────────────── */

function bombear() {
  if (timer || !cola.length) { pintarQuick(); return; }
  const box = $('#neoLog');
  if (!box) return;

  const msg = cola[0];
  const espera = Math.min(1300, 420 + (msg.text?.length || 40) * 11);

  if (REDUCED) {
    timer = setTimeout(() => {
      timer = null;
      if (!$('#neoLog')) return;
      log.push({ who: 'neo', msg: cola.shift() });
      soltar(burbuja('neo', msg));
      bombear();
    }, 260);
    return;
  }

  box.insertAdjacentHTML('beforeend',
    `<div class="neo-msg is-neo" id="neoTyping" aria-hidden="true"><div class="neo-b neo-typing"><i></i><i></i><i></i></div></div>`);
  alFondo(box);

  timer = setTimeout(() => {
    timer = null;
    if (!$('#neoLog')) return;             // la vista cambió mientras escribía
    $('#neoTyping')?.remove();
    log.push({ who: 'neo', msg: cola.shift() });
    soltar(burbuja('neo', msg));
    bombear();
  }, espera);
}

/* El scroll va al fondo de un salto, no suave: cada burbuja nace mientras la
   anterior todavía se está deslizando, y dos scrolls suaves encadenados se
   cancelan entre ellos — el chat se quedaba mirando mensajes viejos. El
   movimiento lo pone la burbuja al entrar; el scroll solo tiene que llegar. */
function alFondo(box) { box.scrollTop = box.scrollHeight; }

function soltar(html) {
  const box = $('#neoLog');
  if (!box) return;
  box.insertAdjacentHTML('beforeend', html);
  const el = box.lastElementChild;
  enter(el, { y: 10, dur: 360 });
  alFondo(box);
}

function pintarQuick() {
  const host = $('#neoQuick');
  if (!host) return;
  const activo = !timer && !cola.length && quick.length;
  host.innerHTML = activo
    ? quick.map(q => `<button type="button" class="neo-chip" data-say="${esc(q)}">${esc(q)}</button>`).join('')
    : '';
  host.hidden = !activo;
  if (activo) stagger($$('.neo-chip', host), { y: 6, step: 26, dur: 260 });
  // Los chips le quitan alto al registro: si el scroll se hizo antes, la
  // última burbuja queda medio tapada justo cuando hay que actuar sobre ella.
  const box = $('#neoLog');
  if (box) alFondo(box);
}

/* ── Burbujas ────────────────────────────────────────────────────────────── */

function burbuja(who, msg) {
  const cuerpo = pinta(msg);
  return `<div class="neo-msg ${who === 'yo' ? 'is-yo' : 'is-neo'}"><div class="neo-b">${cuerpo}</div></div>`;
}

function pinta(m) {
  switch (m.t) {
    case 'courts': return `
      <ul class="neo-courts">
        ${m.items.map(c => `<li>
          ${ballSVG(c.sport, 'neo-ball')}
          <span class="neo-court-t"><b>${esc(c.name)}</b><em>${esc(c.blurb)}</em></span>
          <span class="neo-price">${esc(c.precio)}<em>la hora</em></span>
        </li>`).join('')}
      </ul>`;

    case 'hours': return `
      <div class="neo-hours">
        ${m.hours.map(h => `<button type="button" class="neo-hour" data-say="${esc(fmtHour(h))}">
          ${esc(fmtHour(h).replace(':00', ''))}</button>`).join('')}
      </div>`;

    case 'quote': return `
      <div class="neo-card">
        <p class="neo-card-t">${icon('cal', 'ic ic-sm')}Resumen de tu reserva</p>
        <ul class="neo-kv">
          <li><span>Cancha</span><b>${esc(m.q.court)}</b></li>
          <li><span>Cuándo</span><b>${esc(fmtDateLong(m.q.date))} · ${esc(fmtHour(m.q.start))}</b></li>
          <li><span>Total</span><b>${money(m.q.total)}</b></li>
          <li><span>${m.q.pago === 'completo' ? 'Pagas ahora' : m.q.pago === 'cancha' ? 'Pagas en cancha' : 'Adelanto para apartar'}</span>
              <b>${money(m.q.pago === 'completo' ? m.q.total : m.q.pago === 'cancha' ? 0 : m.q.dep)}</b></li>
        </ul>
        ${m.q.nota ? `<p class="neo-nota">${esc(m.q.nota)}</p>` : ''}
        <div class="neo-acts">
          <button type="button" class="btn btn-primary btn-sm" data-say="Sí, apártala">
            ${icon('check')}Confirmar</button>
          <button type="button" class="btn btn-secondary btn-sm" data-say="Mejor otra hora">Otra hora</button>
        </div>
      </div>`;

    case 'ok': return `
      <div class="neo-card is-ok">
        <p class="neo-card-t">${icon('check', 'ic ic-sm')}Reserva confirmada · ${esc(m.b.code)}</p>
        <ul class="neo-kv">
          <li><span>Cancha</span><b>${esc(m.b.courtName)}</b></li>
          <li><span>Cuándo</span><b>${esc(fmtDateLong(m.b.date))} · ${esc(fmtHour(m.b.start))}</b></li>
          <li><span>Abonado</span><b>${money(m.b.deposit)}</b></li>
          <li><span>Saldo en cancha</span><b>${money(m.b.saldo)}</b></li>
        </ul>
        <div class="neo-acts">
          <button type="button" class="btn btn-primary btn-sm" data-goto="inicio">Ver mis reservas</button>
        </div>
      </div>`;

    case 'list': return `
      <ul class="neo-list">
        ${m.items.map(b => `<li>
          <span><b>${esc(b.court)}</b><em>${esc(b.when)}</em></span>
          <i>${b.saldo ? `faltan ${money(b.saldo)}` : 'pagada'}</i>
        </li>`).join('')}
      </ul>`;

    default:
      return `<p class="neo-p">${esc(m.text).replace(/\n/g, '<br>')}</p>`;
  }
}
