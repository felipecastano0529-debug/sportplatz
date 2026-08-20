/* ==========================================================================
   VISTA · Neo AI
   La conversación de WhatsApp que reserva sola, al lado de las cinco cosas
   que hace por detrás. Se regenera en cada visita: así el "mañana" del bot
   siempre es mañana de verdad.
   ========================================================================== */

import { $, $$, esc, money, iso, today, addDays, fmtDateLong } from '../core/util.js';
import { S } from '../core/store.js';
import { SPORTS } from '../core/sports.js';
import { icon } from '../ui/icons.js';
import { REDUCED, SPRING, stagger } from '../ui/motion.js';
import { pageHead } from '../ui/shell.js';
import { esWhatsapp, waBonito } from '../core/util.js';

let botTimer = null;
let liveBody = null;   // el <div> de mensajes de la sesión viva

function botScript() {
  const c = S.courts[0];
  const code = 'SP-' + Math.random().toString(36).slice(2, 6).toUpperCase();
  const name = S.business.name;
  const dia = fmtDateLong(iso(addDays(today(), 1)));
  const dep = Math.round(c.price * 0.5 / 1000) * 1000;

  return [
    { who: 'in',  text: `Buenas, ¿tienen cancha libre mañana?` },
    { who: 'out', text: `¡Hola! Soy *Neo AI*, el asistente de *${name}*.\nSí señor, mañana tenemos disponibilidad.\n¿Para cuál cancha?`, delay: 900 },
    { who: 'out', kind: 'options', options: S.business.sports.map(s => SPORTS[s].short) },
    { who: 'in',  text: SPORTS[c.sport].short },
    { who: 'out', text: `Perfecto. Para *${SPORTS[c.sport].name}* mañana ${dia} me quedan estas horas`, delay: 800 },
    { who: 'out', kind: 'slots', slots: ['6:00 p.m.', '7:00 p.m.', '9:00 p.m.'] },
    { who: 'in',  text: `Las 7 me sirve` },
    { who: 'out', kind: 'quote', quote: {
        court: c.name, when: `${dia} · 7:00 p.m. a 8:00 p.m.`,
        total: money(c.price), dep: money(dep)
      }, delay: 1000 },
    { who: 'in',  text: `Listo, la aparto` },
    { who: 'out', text: `¿A nombre de quién la dejo?`, delay: 600 },
    { who: 'in',  text: `Andrés Salazar` },
    { who: 'out', kind: 'confirm', confirm: {
        code, court: c.name, when: `${dia} · 7:00 p.m.`,
        total: money(c.price), dep: money(dep), saldo: money(c.price - dep)
      }, delay: 1200 },
    { who: 'out', text: `Te mando el recordatorio mañana a las 4:00 p.m.\nSi te toca cancelar, escríbeme *cancelar ${code}* y te devuelvo el adelanto hasta 4 horas antes.`, delay: 1100 },
    { who: 'in',  text: `Gracias, muy amable` },
    { who: 'sys', text: S.business.whatsapp
        ? `Reserva ${code} creada sola en el panel · a ti te llega el aviso a ${waBonito(S.business.whatsapp)}`
        : `Reserva ${code} creada sola en el panel · el dueño no tocó el celular` }
  ];
}

export function viewBot(main) {
  const script = botScript();
  const entran = S.bookings.filter(b => b.source === 'bot' || b.source === 'neo').length;
  const pct = S.bookings.length ? Math.round(entran / S.bookings.length * 100) : 0;

  main.innerHTML = `
    ${pageHead('Automatización', 'Neo AI en WhatsApp',
      `<button class="btn btn-secondary btn-sm" id="botReplay">${icon('spark')}Reproducir</button>`,
      S.business.whatsapp
        ? `Contesta, cotiza, aparta y confirma en ${waBonito(S.business.whatsapp)} sin que toques el celular`
        : 'Contesta, cotiza, aparta y confirma sin que nadie del negocio toque el celular')}

    <div class="bot-wrap">
      <div class="phone" data-anim>
        <div class="phone-frame">
          <header class="wa-head">
            <span class="wa-back">‹</span>
            <span class="wa-av">${window.SP_LOGO}</span>
            <span class="wa-who"><b>Neo AI · ${esc(S.business.name)}</b>
              <em><i class="wa-live"></i>${S.business.whatsapp
                ? `contestando por ti en ${esc(waBonito(S.business.whatsapp))}`
                : 'en línea · responde al instante'}</em></span>
            <span class="wa-icons"><i></i><i></i></span>
          </header>
          <div class="wa-body" id="waBody" role="log" aria-live="polite" aria-label="Conversación de ejemplo"></div>
          <footer class="wa-input">
            <span class="wa-box">Escribe un mensaje</span>
            <span class="wa-send" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M3 20l19-8L3 4l4 8-4 8z"/></svg></span>
          </footer>
        </div>
      </div>

      <aside class="bot-side">
        <article class="card" data-anim>
          <header class="card-head"><h2>Qué hace por detrás</h2>
          <p class="card-sub">No solo contesta: escribe en tu agenda.</p></header>
          <ol class="steps" id="botSteps">
            ${[
              ['Lee la intención', 'Entiende "mañana", "las 7", "sintética" sin menús rígidos.'],
              ['Consulta disponibilidad', 'Cruza la hora contra las reservas reales de esa cancha.'],
              ['Cotiza y explica', 'Muestra precio, adelanto y saldo antes de comprometer.'],
              ['Aparta y confirma', 'Crea la reserva con código y bloquea el horario.'],
              ['Recuerda y libera', 'Recordatorio 4 h antes; si cancela, libera el cupo solo.']
            ].map(([t, d], i) => `<li class="step" data-step="${i}">
              <span class="step-n">${i + 1}</span>
              <span class="step-t"><b>${t}</b><em>${d}</em></span></li>`).join('')}
          </ol>
        </article>

        <article class="card card-quiet" data-anim>
          <header class="card-head"><h2>Lo que te ahorra</h2></header>
          <ul class="mini-stats">
            <li><b>${pct}%</b><em>de tus reservas ya entran por Neo AI</em></li>
            <li><b>0</b><em>llamadas para preguntar horarios</em></li>
            <li><b>24/7</b><em>contesta a las 2 de la mañana también</em></li>
          </ul>
        </article>
      </aside>
    </div>`;

  $('#botReplay').addEventListener('click', () => playChat(script, true));
  stagger($$('[data-anim]', main), { y: 18, step: 90 });
  playChat(script);
}

function bubble(msg) {
  if (msg.kind === 'options') {
    return `<div class="wa-msg out"><div class="wa-b">
      <div class="wa-opts">${msg.options.map(o => `<span>${esc(o)}</span>`).join('')}</div>
      <i class="wa-t">${waTime()}</i></div></div>`;
  }
  if (msg.kind === 'slots') {
    return `<div class="wa-msg out"><div class="wa-b">
      <p class="wa-p">Horarios libres:</p>
      <div class="wa-slots">${msg.slots.map(s => `<span>${esc(s)}</span>`).join('')}</div>
      <i class="wa-t">${waTime()}</i></div></div>`;
  }
  if (msg.kind === 'quote') {
    const q = msg.quote;
    return `<div class="wa-msg out"><div class="wa-b wa-card">
      <p class="wa-card-t">Resumen de tu reserva</p>
      <ul class="wa-kv">
        <li><span>Cancha</span><b>${esc(q.court)}</b></li>
        <li><span>Cuándo</span><b>${esc(q.when)}</b></li>
        <li><span>Total</span><b>${esc(q.total)}</b></li>
        <li><span>Adelanto para apartar</span><b>${esc(q.dep)}</b></li>
      </ul>
      <p class="wa-p">Con el adelanto te la dejo bloqueada. ¿La aparto?</p>
      <i class="wa-t">${waTime()}</i></div></div>`;
  }
  if (msg.kind === 'confirm') {
    const q = msg.confirm;
    return `<div class="wa-msg out"><div class="wa-b wa-card wa-ok">
      <p class="wa-card-t">${icon('check', 'ic ic-sm')}Reserva confirmada · ${esc(q.code)}</p>
      <ul class="wa-kv">
        <li><span>Cancha</span><b>${esc(q.court)}</b></li>
        <li><span>Cuándo</span><b>${esc(q.when)}</b></li>
        <li><span>Abonado</span><b>${esc(q.dep)}</b></li>
        <li><span>Saldo en cancha</span><b>${esc(q.saldo)}</b></li>
      </ul>
      <i class="wa-t">${waTime()}</i></div></div>`;
  }
  if (msg.who === 'sys') return `<div class="wa-sys">${esc(msg.text)}</div>`;

  return `<div class="wa-msg ${msg.who}"><div class="wa-b">
    <p class="wa-p">${esc(msg.text).replace(/\n/g, '<br>').replace(/\*(.+?)\*/g, '<b>$1</b>')}</p>
    <i class="wa-t">${waTime()}${msg.who === 'in' ? '' : ' <s>✓✓</s>'}</i></div></div>`;
}

function waTime() {
  const d = new Date();
  const h = d.getHours() % 12 || 12;
  return `${h}:${String(d.getMinutes()).padStart(2, '0')} ${d.getHours() >= 12 ? 'p.m.' : 'a.m.'}`;
}

/* La cadena de setTimeout escribía sobre el nodo capturado aunque la vista ya
   hubiera cambiado: al salir de Neo AI seguía corriendo ~20 s sobre un nodo
   desprendido. Ahora cada paso comprueba que el cuerpo siga en el documento. */
export function stopChat() {
  clearTimeout(botTimer);
  botTimer = null;
  liveBody = null;
}

function playChat(script, restart = false) {
  const body = $('#waBody');
  if (!body) return;
  stopChat();
  liveBody = body;
  body.innerHTML = '';

  let i = 0;
  const stepEls = $$('#botSteps .step');
  const stepAt = [1, 4, 7, 11, 13];

  const alive = () => liveBody === body && body.isConnected;

  const pop = (el) => {
    body.scrollTop = body.scrollHeight;
    if (REDUCED) return;
    el.animate([{ opacity: 0, transform: 'translateY(8px) scale(.97)' }, { opacity: 1, transform: 'none' }],
      { duration: 340, easing: SPRING.soft, fill: 'both' });
    body.scrollTo({ top: body.scrollHeight, behavior: 'smooth' });
  };

  const push = () => {
    if (!alive() || i >= script.length) return;
    const msg = script[i];
    const mark = stepAt.indexOf(i);
    if (mark > -1 && stepEls[mark]) {
      stepEls.forEach((e, k) => e.classList.toggle('is-on', k <= mark));
    }
    if (msg.who === 'out' && !REDUCED) {
      body.insertAdjacentHTML('beforeend',
        `<div class="wa-msg out wa-typing" id="typing"><div class="wa-b"><i></i><i></i><i></i></div></div>`);
      body.scrollTop = body.scrollHeight;
      botTimer = setTimeout(() => {
        if (!alive()) return;
        $('#typing')?.remove();
        body.insertAdjacentHTML('beforeend', bubble(msg));
        pop(body.lastElementChild);
        i++; botTimer = setTimeout(push, 520);
      }, msg.delay || 700);
    } else {
      body.insertAdjacentHTML('beforeend', bubble(msg));
      pop(body.lastElementChild);
      i++; botTimer = setTimeout(push, msg.who === 'in' ? 780 : 420);
    }
  };
  botTimer = setTimeout(push, restart ? 200 : 600);
}
