/* ==========================================================================
   VISTA · Onboarding
   Cuatro preguntas y la plataforma existe: nombre, deportes con su foto,
   cuántas canchas y a cuánto la hora. Al terminar se genera el negocio con
   tres meses de historia, equipos, jugadores y un torneo en curso.
   ========================================================================== */

import { $, $$, esc, iso, today, thousands, readNum, hhmm, fmtHour } from '../core/util.js';
import { S, setS, save } from '../core/store.js';
import { SPORTS, SPORT_LIST, ballSVG, conVersion } from '../core/sports.js';
import {
  makeCourts, seedBookings, seedPlayers, seedTeams, demoTournament, openTournament
} from '../core/seed.js';
import { icon } from '../ui/icons.js';
import { enter, stagger, REDUCED, SPRING } from '../ui/motion.js';
import { mediaBlock, wireDrops } from '../ui/photo.js';
import { toast } from '../ui/modal.js';
import { renderApp } from '../ui/shell.js';
import { paintBackdrop } from '../ui/backdrop.js';
import { filyLead } from '../core/lead.js';

/* $120.000 → $120k. El resumen del lead se lee en una tabla, no en la app. */
const moneyCorto = (n) => '$' + Math.round((n || 0) / 1000) + 'k';

export const OB = { step: 0, name: '', whatsapp: '', sports: [], counts: {}, prices: {}, photos: {} };

export function renderOnboarding() {
  $('#app').innerHTML = `
    <div class="ob">
      <div class="ob-rail">
        <div class="ob-brand">${window.SP_LOGO}<span>Sportplatz</span></div>
        <ol class="ob-steps">
          ${['Tu negocio', 'Tus canchas', 'Cuántas', 'Precios'].map((s, i) => `
            <li class="ob-step ${i === OB.step ? 'is-now' : i < OB.step ? 'is-done' : ''}">
              <span class="ob-step-n"><span>${i + 1}</span></span>
              <span class="ob-step-t">${s}</span>
            </li>`).join('')}
        </ol>
        <p class="ob-foot">Demo interactiva · todo se guarda en tu navegador</p>
      </div>
      <div class="ob-stage" id="obStage"></div>
    </div>`;
  renderStep();
}

export function renderStep() {
  const stage = $('#obStage');
  window.scrollTo(0, 0);

  /* El rail vive fuera del escenario, así que hay que sincronizarlo a mano.
     Antes se quedaba marcando el paso 1 mientras el usuario iba por el 4. */
  $$('.ob-step').forEach((li, i) => {
    li.classList.toggle('is-now', i === OB.step);
    li.classList.toggle('is-done', i < OB.step);
  });

  stage.innerHTML = [step0, step1, step2, step3][OB.step]();
  wireStep();
  enter(stage.firstElementChild, { y: 18, dur: 520 });
  stagger($$('[data-anim]', stage), { y: 14, step: 50, delay: 60 });
}

const obHead = (kicker, title, sub) => `
  <header class="ob-head" data-anim>
    <p class="kicker">${kicker}</p>
    <h1 class="ob-title">${title}</h1>
    ${sub ? `<p class="ob-sub">${sub}</p>` : ''}
  </header>`;

/* El WhatsApp se pide aquí y no al final, y no es un peaje: es el número al
   que Neo le mandaría las reservas, y la demo se lo ENSEÑA funcionando con
   su propio número. Pedirlo con su para qué a la vista es lo que separa un
   dato que el prospecto entrega de uno que le sacan. */
function step0() {
  return `<section class="ob-panel">
    ${obHead('Paso 01', '¿Cómo se llama tu <em>negocio</em>?',
      'Va a aparecer en el panel, en las reservas, en la cuenta de cada jugador y en cada respuesta de Neo AI por WhatsApp.')}
    <div class="ob-field" data-anim>
      <input id="obName" class="input input-xl" type="text" autocomplete="off" spellcheck="false"
        placeholder="Ej. Complejo Deportivo La 70" value="${esc(OB.name)}" maxlength="42">
      <p class="hint" id="obNameHint">Escribe el nombre para continuar</p>
    </div>

    <div class="ob-field" data-anim>
      <label class="field-label" for="obWa">¿A qué WhatsApp te llegarían las reservas?</label>
      <input id="obWa" class="input input-xl" type="tel" inputmode="tel" autocomplete="tel"
        placeholder="300 123 4567" value="${esc(OB.whatsapp)}" maxlength="20">
      <p class="hint" id="obWaHint">Neo AI te va a mostrar cómo le llegan los pedidos a ese número.</p>
    </div>

    <p class="ob-aviso" data-anim>
      Guardamos lo que configures aquí y tu WhatsApp para armar tu demo y, si te sirve,
      escribirte por este mismo medio. Nada más. Escríbenos a ese chat y lo borramos.
    </p>

    <div class="ob-actions" data-anim>
      <button class="btn btn-primary" id="obNext" disabled>Continuar</button>
    </div>
  </section>`;
}

function step1() {
  return `<section class="ob-panel ob-panel-wide">
    ${obHead('Paso 02', '¿Qué <em>canchas</em> tienes?',
      'Elige todas las que apliquen. Súbele la foto a cada una y así te ves tú, no una plantilla.')}
    <div class="sport-grid" data-anim>
      ${SPORT_LIST.map(s => {
        const on = OB.sports.includes(s.id);
        const src = OB.photos[s.id] || conVersion(s.photo);
        return `<div class="sport-card ${on ? 'is-on' : ''}" data-sport="${s.id}"
                     role="checkbox" aria-checked="${on}" tabindex="0">
          ${mediaBlock(s.id, src, { drop: `sport:${s.id}`, label: s.name })}
          <span class="sport-check" aria-hidden="true">${icon('check')}</span>
          <span class="sport-body">
            <span class="sport-name">${s.name}</span>
            <span class="sport-blurb">${s.blurb}</span>
          </span>
        </div>`;
      }).join('')}
    </div>
    <div class="ob-actions" data-anim>
      <button class="btn btn-secondary" id="obBack">${icon('left', 'ic ic-sm')}Atrás</button>
      <button class="btn btn-primary" id="obNext" ${OB.sports.length ? '' : 'disabled'}>
        Continuar <span class="btn-count" id="obCount">${OB.sports.length || ''}</span>
      </button>
    </div>
  </section>`;
}

function step2() {
  return `<section class="ob-panel">
    ${obHead('Paso 03', '¿<em>Cuántas</em> tienes de cada una?',
      'Después les puedes cambiar el nombre, el precio y la foto una por una.')}
    <div class="count-list" data-anim>
      ${OB.sports.map(id => {
        const s = SPORTS[id], n = OB.counts[id] ?? 1;
        return `<div class="count-row">
          <span class="count-icon">${ballSVG(id)}</span>
          <span class="count-label"><b>${s.name}</b><em>${s.blurb}</em></span>
          <span class="stepper">
            <button type="button" class="stepper-btn" data-step="-1" data-sport="${id}" aria-label="Quitar una">−</button>
            <output class="stepper-val" id="cnt-${id}">${n}</output>
            <button type="button" class="stepper-btn" data-step="1" data-sport="${id}" aria-label="Agregar una">+</button>
          </span>
        </div>`;
      }).join('')}
    </div>
    <div class="ob-actions" data-anim>
      <button class="btn btn-secondary" id="obBack">${icon('left', 'ic ic-sm')}Atrás</button>
      <button class="btn btn-primary" id="obNext">Continuar</button>
    </div>
  </section>`;
}

function step3() {
  return `<section class="ob-panel">
    ${obHead('Paso 04', '¿A cuánto cobras la <em>hora</em>?',
      'Precio por hora de cada tipo de cancha. Lo puedes ajustar cancha por cancha más adelante.')}
    <div class="price-list" data-anim>
      ${OB.sports.map(id => {
        const s = SPORTS[id], v = OB.prices[id] ?? s.price;
        const n = OB.counts[id] ?? 1;
        return `<label class="price-row">
          <span class="count-icon">${ballSVG(id)}</span>
          <span class="count-label"><b>${s.name}</b><em>${n} cancha${n > 1 ? 's' : ''}</em></span>
          <span class="price-input">
            <i>$</i>
            <input type="text" inputmode="numeric" data-price="${id}" value="${thousands(v)}">
            <em>/ hora</em>
          </span>
        </label>`;
      }).join('')}
    </div>
    <div class="ob-actions" data-anim>
      <button class="btn btn-secondary" id="obBack">${icon('left', 'ic ic-sm')}Atrás</button>
      <button class="btn btn-primary" id="obNext">Crear mi plataforma</button>
    </div>
  </section>`;
}

function wireStep() {
  const next = $('#obNext'), back = $('#obBack');
  back && back.addEventListener('click', () => { OB.step--; renderStep(); });

  if (OB.step === 0) {
    const input = $('#obName');
    const wa = $('#obWa');
    /* Diez dígitos es un celular colombiano; se aceptan más por si escriben
       el 57 o el +57 delante. No se valida más que eso: rechazar un número
       raro de alguien que sí quiere probar cuesta más que un dato imperfecto. */
    const digitos = () => wa.value.replace(/\D/g, '');
    const sync = () => {
      OB.name = input.value.trim();
      OB.whatsapp = wa.value.trim();
      const okNombre = OB.name.length >= 2;
      const okWa = digitos().length >= 10;
      next.disabled = !okNombre || !okWa;
      $('#obNameHint').textContent = okNombre ? '¡Listo!' : 'Escribe el nombre para continuar';
      $('#obWaHint').textContent = okWa
        ? 'Perfecto. Ahí es donde te va a escribir Neo AI.'
        : 'Neo AI te va a mostrar cómo le llegan los pedidos a ese número.';
    };
    [input, wa].forEach(el => {
      el.addEventListener('input', sync);
      el.addEventListener('keydown', e => { if (e.key === 'Enter' && !next.disabled) next.click(); });
    });
    sync(); setTimeout(() => input.focus(), 260);
    next.addEventListener('click', () => { OB.step = 1; renderStep(); });
  }

  if (OB.step === 1) {
    $$('.sport-card').forEach(card => {
      const toggle = () => {
        const id = card.dataset.sport;
        const on = OB.sports.includes(id);
        if (on) OB.sports = OB.sports.filter(x => x !== id);
        else { OB.sports.push(id); OB.counts[id] ??= 1; OB.prices[id] ??= SPORTS[id].price; }
        card.classList.toggle('is-on', !on);
        card.setAttribute('aria-checked', String(!on));
        if (!REDUCED) card.animate(
          [{ transform: 'scale(.975)' }, { transform: 'scale(1)' }],
          { duration: 340, easing: SPRING.snap });
        next.disabled = !OB.sports.length;
        $('#obCount').textContent = OB.sports.length || '';
      };
      card.addEventListener('click', toggle);
      card.addEventListener('keydown', e => {
        if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle(); }
      });
    });
    wireDrops($('#obStage'));
    next.addEventListener('click', () => { OB.step = 2; renderStep(); });
  }

  if (OB.step === 2) {
    $$('.stepper-btn').forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.sport, d = +b.dataset.step;
      OB.counts[id] = Math.max(1, Math.min(12, (OB.counts[id] ?? 1) + d));
      const out = $('#cnt-' + id);
      out.textContent = OB.counts[id];
      if (!REDUCED) out.animate(
        [{ transform: `translateY(${-d * 8}px)`, opacity: .4 }, { transform: 'none', opacity: 1 }],
        { duration: 260, easing: SPRING.soft });
    }));
    next.addEventListener('click', () => { OB.step = 3; renderStep(); });
  }

  if (OB.step === 3) {
    $$('[data-price]').forEach(inp => {
      inp.addEventListener('input', () => {
        const n = readNum(inp.value);
        OB.prices[inp.dataset.price] = n;
        inp.value = n ? thousands(n) : '';
      });
    });
    next.addEventListener('click', () => build(next));
  }
}

/* ── Construir el negocio ────────────────────────────────────────────────── */

function build(btn) {
  // La generación es rápida ahora que seedBookings es lineal, pero sigue
  // siendo el único punto donde el hilo trabaja de verdad: se avisa.
  btn.disabled = true;
  btn.innerHTML = '<span class="spin" aria-hidden="true"></span>Armando tu plataforma…';

  /* Un respiro para que el botón pinte su estado antes de que el hilo se
     ponga a generar. Va con setTimeout y no con requestAnimationFrame: si la
     pestaña está en segundo plano el navegador deja de entregar frames y el
     rAF no llega nunca — el botón se quedaría en "Armando…" para siempre. */
  setTimeout(() => {
    const config = OB.sports.map(id => ({
      sport: id, count: OB.counts[id] ?? 1, price: OB.prices[id] || SPORTS[id].price
    }));
    const courts = makeCourts(config);
    const sportPrincipal = OB.sports.includes('futbol') ? 'futbol' : OB.sports[0];

    const players = seedPlayers(OB.sports);
    const teams = seedTeams(players, sportPrincipal, 8);

    const business = {
      name: OB.name,
      sports: OB.sports.slice(),
      created: iso(today()),
      whatsapp: OB.whatsapp,
      openHour: 6,
      closeHour: 23,
      logo: null,
      theme: { accent: 'esmeralda', fondo: 'estadio' }
    };

    const next = {
      business,
      courts,
      bookings: seedBookings(courts, players, { open: 6, close: 23 }),
      tournaments: [],
      teams,
      players,
      session: { role: 'owner', playerId: players[0]?.id ?? null },
      photos: { sports: { ...OB.photos } }
    };
    setS(next);

    // La foto que subió del deporte arranca como foto de su primera cancha.
    next.courts.forEach(c => { if (c.n === 1 && OB.photos[c.sport]) c.photo = OB.photos[c.sport]; });

    next.tournaments.push(demoTournament({ business, courts, teams, players }));
    next.tournaments.push(openTournament(business, teams));

    save();

    /* El prospecto acaba de decirnos su negocio entero sin llenar un
       formulario: qué deporte, cuántas canchas y a cuánto la hora. Eso viaja
       con su nombre y su WhatsApp, y es lo que nos deja llegar a la
       conversación sabiendo de qué hablamos. */
    const precios = Object.values(OB.prices).filter(Boolean);
    /* El perfil primero y el contacto después, no al revés: `contacto()`
       dispara el envío inmediato —es el dato que no se puede perder— y si va
       delante, se lleva la cola vacía y el perfil sale en una segunda
       petición. Así viajan juntos. */
    filyLead
      .perfil({
        resumen: `${courts.length} ${courts.length === 1 ? 'cancha' : 'canchas'} · ` +
                 `${business.sports.map(id => SPORTS[id].short).join(', ')} · ` +
                 (precios.length
                    ? `${moneyCorto(Math.min(...precios))}–${moneyCorto(Math.max(...precios))}/h`
                    : 'sin precios'),
        datos: {
          negocio: business.name,
          deportes: business.sports,
          canchas: courts.length,
          por_deporte: { ...OB.counts },
          precios: { ...OB.prices }
        }
      })
      .contacto({ nombre: business.name, whatsapp: OB.whatsapp });

    document.body.dataset.sports = business.sports.join(' ');
    paintBackdrop();
    renderApp('panel', { intro: true });
    toast(`${business.name} está lista · ${next.bookings.length.toLocaleString('es-CO')} reservas de historia`);
  }, 32);
}
