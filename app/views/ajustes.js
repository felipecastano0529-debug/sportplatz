/* ==========================================================================
   VISTA · Ajustes
   Es la única sección sin fondo a sangre, a propósito: después de cinco
   pantallas de escenario el ojo necesita una mesa de trabajo lisa.

   Aquí viven los tres huecos de personalización que faltaban: el horario de
   atención (estaba clavado en el código), el logo del negocio, y el acceso
   directo a renombrar cada cancha.
   ========================================================================== */

import { $, $$, esc, money, moneyShort, fmtDate, fmtHour, hhmm } from '../core/util.js';
import { S, save, Store } from '../core/store.js';
import { SPORTS, ballSVG } from '../core/sports.js';
import { openHour, closeHour } from '../core/calc.js';
import { icon } from '../ui/icons.js';
import { stagger } from '../ui/motion.js';
import { openModal, toast } from '../ui/modal.js';
import { mediaBlock, wireDrops, readPhoto } from '../ui/photo.js';
import { pageHead, renderApp } from '../ui/shell.js';
import { PALETAS, FONDOS, aplicarTema, derivar } from '../ui/tema.js';
import { openCourtForm } from './canchas.js';

export function viewAjustes(main) {
  const tema = { accent: 'esmeralda', fondo: 'estadio', ...(S.business.theme || {}) };
  const propio = derivar(tema.custom || '#7c3aed');
  const facturado = S.bookings.reduce((a, b) => a + b.total, 0);
  const cobrado = S.bookings.reduce((a, b) => a + b.deposit, 0);

  main.innerHTML = `
    ${pageHead('Configuración', 'Tu negocio', '', `Activo desde ${fmtDate(S.business.created)}`)}

    <div class="grid-2">
      <article class="card" data-anim>
        <header class="card-head"><h2>Identidad</h2>
          <p class="card-sub">Lo que ve el jugador y lo que dice Neo AI</p></header>

        <div class="logo-editor">
          <span class="logo-prev" id="logoPrev">
            ${S.business.logo ? `<img src="${esc(S.business.logo)}" alt="">` : window.SP_LOGO}
          </span>
          <div class="crest-tools">
            <button type="button" class="btn btn-sm btn-secondary" id="logoUp">${icon('upload')}Subir logo</button>
            ${S.business.logo ? '<button type="button" class="mini" id="logoDel">Quitar</button>' : ''}
          </div>
        </div>

        <label class="field"><span class="field-label">Nombre del negocio</span>
          <input id="setName" class="input" value="${esc(S.business.name)}" maxlength="42"></label>

        <div class="set-sports">
          ${S.business.sports.map(id => `<span class="pill is-on">${ballSVG(id, 'pill-ball')}${SPORTS[id].name}</span>`).join('')}
        </div>
        <button class="btn btn-primary btn-sm" id="setSave">${icon('check')}Guardar</button>
      </article>

      <article class="card card-wide" data-anim>
        <header class="card-head"><h2>Apariencia</h2>
          <p class="card-sub">El color de tu marca y lo que se ve detrás. Se aplica al instante.</p></header>

        <span class="field-label">Color</span>
        <div class="swatches" role="radiogroup" aria-label="Color de marca">
          ${PALETAS.map(p => `
            <button type="button" class="swatch ${p.id === tema.accent ? 'is-on' : ''}"
                    data-accent="${p.id}" role="radio" aria-checked="${p.id === tema.accent}"
                    style="--sw:${p.accent}; --sw-hi:${p.hi}">
              <i></i><span>${p.name}</span>
            </button>`).join('')}

          <label class="swatch swatch--pick ${tema.accent === 'custom' ? 'is-on' : ''}"
                 style="--sw:${esc(propio.accent)}; --sw-hi:${esc(propio.hi)}">
            <i id="pickDot"></i><span>El tuyo</span>
            <input type="color" id="pickColor" value="${esc(tema.custom || propio.accent)}"
                   aria-label="Elegir el color de tu marca">
          </label>
        </div>
        <p class="hint">Elige el que quieras: del color que pongas se calculan las dos versiones
          que usa la interfaz —una para leerse sobre blanco y otra sobre la placa oscura— sin
          cambiarle el tono. Evita el rojo: aquí significa "sin abonar".</p>

        <span class="field-label">Fondo</span>
        <div class="bg-picks" role="radiogroup" aria-label="Fondo de la aplicación">
          ${FONDOS.map(f => `
            <button type="button" class="bg-pick ${f.id === tema.fondo ? 'is-on' : ''}"
                    data-fondo="${f.id}" role="radio" aria-checked="${f.id === tema.fondo}">
              <span class="bg-prev bg-prev--${f.id}"
                    ${f.id === 'propio' && S.photos.fondo ? `style="background-image:url('${esc(S.photos.fondo)}')"` : ''}></span>
              <b>${f.name}</b><em>${f.hint}</em>
            </button>`).join('')}
        </div>
        <div class="crest-tools">
          <button type="button" class="btn btn-sm btn-secondary" id="bgUp">${icon('upload')}Subir foto de fondo</button>
          ${S.photos.fondo ? '<button type="button" class="mini" id="bgDel">Quitar la foto</button>' : ''}
        </div>
      </article>

      <article class="card" data-anim>
        <header class="card-head"><h2>Horario de atención</h2>
          <p class="card-sub">Define la parrilla de la agenda y lo que puede reservar un jugador</p></header>
        <div class="form-grid">
          <label class="field"><span class="field-label">Abre</span>
            <select id="setOpen" class="input">
              ${Array.from({ length: 18 }, (_, i) => i).map(h =>
                `<option value="${h}" ${h === openHour() ? 'selected' : ''}>${fmtHour(hhmm(h))}</option>`).join('')}
            </select></label>
          <label class="field"><span class="field-label">Cierra</span>
            <select id="setClose" class="input">
              ${Array.from({ length: 18 }, (_, i) => i + 7).map(h =>
                `<option value="${h}" ${h === closeHour() ? 'selected' : ''}>${fmtHour(hhmm(h))}</option>`).join('')}
            </select></label>
        </div>
        <p class="hint" id="hoursHint"></p>
        <button class="btn btn-primary btn-sm" id="saveHours">${icon('check')}Guardar horario</button>

        <dl class="set-facts">
          ${[
            ['Canchas', S.courts.length, 'en total'],
            ['Deportes', S.business.sports.length, 'tipos'],
            ['Precio promedio', moneyShort(S.courts.reduce((a, c) => a + c.price, 0) / Math.max(1, S.courts.length)), 'por hora'],
            ['Reservas', S.bookings.length.toLocaleString('es-CO'), 'en el histórico'],
            ['Facturado', moneyShort(facturado), 'acumulado'],
            ['Cobrado', moneyShort(cobrado), `${facturado ? Math.round(cobrado / facturado * 100) : 0}% del total`],
            ['Equipos', (S.teams || []).length, 'registrados'],
            ['Jugadores', (S.players || []).length, 'con cuenta']
          ].map(([label, val, foot]) => `
            <div><dt>${label}</dt><dd>${val}</dd><em>${foot}</em></div>`).join('')}
        </dl>
      </article>

      <article class="card card-wide" data-anim>
        <header class="card-head"><h2>Tus canchas</h2>
          <p class="card-sub">Cámbiales el nombre, el precio y la foto. Arrástrale una imagen encima o tócala.</p></header>
        <div class="photo-grid">
          ${S.courts.map(c => `<figure class="photo-cell">
            ${mediaBlock(c.sport, c.photo || c.image, { drop: `court:${c.id}`, label: c.name })}
            <figcaption>
              <b>${esc(c.name)}</b>
              <i>${money(c.price)}/h · ${c.photo ? 'foto propia' : 'sin foto'}</i>
              <button class="mini" data-edit="${c.id}">${icon('pencil', 'ic ic-sm')}Editar</button>
            </figcaption>
          </figure>`).join('')}
        </div>
        <p class="hint">También puedes dejarlas como archivos en <code>assets/canchas/</code>
          (<code>${esc(S.courts[0]?.image.split('/').pop() || 'futbol-1.jpg')}</code> y así)
          si prefieres versionarlas con el proyecto.</p>
      </article>

      <article class="card card-danger" data-anim>
        <header class="card-head"><h2>Empezar de cero</h2>
          <p class="card-sub">Borra el negocio, las reservas, los equipos y los torneos. No se puede deshacer.</p></header>
        <button class="btn btn-danger btn-sm" id="setReset">Reiniciar la demo</button>
      </article>
    </div>`;

  wireDrops(main);

  $('#setSave').addEventListener('click', () => {
    S.business.name = $('#setName').value.trim() || S.business.name;
    save(); renderApp('ajustes'); toast('Datos guardados');
  });

  const syncHours = () => {
    const a = +$('#setOpen').value, b = +$('#setClose').value;
    $('#hoursHint').textContent = b <= a
      ? 'La hora de cierre tiene que ser posterior a la de apertura.'
      : `${b - a} horas reservables al día, de ${fmtHour(hhmm(a))} a ${fmtHour(hhmm(b))}.`;
  };
  ['#setOpen', '#setClose'].forEach(s => $(s).addEventListener('change', syncHours));
  syncHours();

  $('#saveHours').addEventListener('click', () => {
    const a = +$('#setOpen').value, b = +$('#setClose').value;
    if (b <= a) { toast('El cierre tiene que ir después de la apertura', 'warn'); return; }
    S.business.openHour = a;
    S.business.closeHour = b;
    save(); renderApp('ajustes');
    toast(`Horario: de ${fmtHour(hhmm(a))} a ${fmtHour(hhmm(b))}`);
  });

  $('#logoUp').addEventListener('click', () => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*';
    inp.addEventListener('change', async () => {
      if (!inp.files[0]) return;
      try {
        S.business.logo = await readPhoto(inp.files[0], { max: 240, q: 0.85 });
        save(); renderApp('ajustes'); toast('Logo actualizado');
      } catch { toast('Esa imagen no se pudo leer', 'warn'); }
    });
    inp.click();
  });
  $('#logoDel')?.addEventListener('click', () => {
    S.business.logo = null; save(); renderApp('ajustes'); toast('Logo quitado', 'warn');
  });

  /* El color y el fondo se aplican en vivo y se guardan solos: obligar a
     pulsar "Guardar" para ver un color es pedirle al ojo que recuerde. */
  $$('[data-accent]', main).forEach(b => b.addEventListener('click', () => {
    S.business.theme = { ...tema, accent: b.dataset.accent };   // `custom` se conserva por si vuelve
    save();
    aplicarTema(S.business, S.photos);
    renderApp('ajustes');
  }));

  $$('[data-fondo]', main).forEach(b => b.addEventListener('click', () => {
    const elegido = b.dataset.fondo;
    if (elegido === 'propio' && !S.photos.fondo) { subirFondo(); return; }
    S.business.theme = { ...tema, fondo: elegido };
    save();
    aplicarTema(S.business, S.photos);
    renderApp('ajustes');
  }));

  /* El selector libre pinta mientras se arrastra por la rueda —`input`— y
     solo guarda al soltar —`change`—. Guardar en cada cuadro sería escribir
     el estado entero cien veces por gesto, y re-renderizar cerraría la rueda
     del sistema en la primera. */
  const pick = $('#pickColor');
  pick.addEventListener('input', () => {
    const d = derivar(pick.value);
    const dot = $('#pickDot').parentElement;
    dot.style.setProperty('--sw', d.accent);
    dot.style.setProperty('--sw-hi', d.hi);
    aplicarTema({ ...S.business, theme: { ...tema, accent: 'custom', custom: pick.value } }, S.photos);
  });
  pick.addEventListener('change', () => {
    S.business.theme = { ...tema, accent: 'custom', custom: pick.value };
    save();
    aplicarTema(S.business, S.photos);
    renderApp('ajustes');
    toast('Ese es tu color');
  });

  $('#bgUp').addEventListener('click', subirFondo);
  $('#bgDel')?.addEventListener('click', () => {
    delete S.photos.fondo;
    S.business.theme = { ...tema, fondo: 'estadio' };
    save();
    aplicarTema(S.business, S.photos);
    renderApp('ajustes');
    toast('Volvimos al estadio', 'warn');
  });

  $$('[data-edit]', main).forEach(b => b.addEventListener('click', () => openCourtForm(b.dataset.edit)));

  $('#setReset').addEventListener('click', () => {
    openModal({
      title: '¿Reiniciar la demo?',
      body: `<p class="hint">Se borran el negocio, las ${S.bookings.length.toLocaleString('es-CO')} reservas,
        los ${(S.teams || []).length} equipos y los ${S.tournaments.length} torneos. No se puede deshacer.</p>`,
      confirm: 'Sí, borrar todo',
      danger: null,
      async onConfirm() { await Store.clear(); location.reload(); }
    });
  });

  stagger($$('[data-anim]', main), { y: 16, step: 60 });
}

/* 1920 de ancho y calidad .82: es una imagen a sangre y a pantalla completa,
   así que aguanta menos compresión que un logo — pero sigue viviendo dentro
   del estado, y el estado se guarda entero en cada `save()`. */
function subirFondo() {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'image/*';
  inp.addEventListener('change', async () => {
    if (!inp.files[0]) return;
    try {
      S.photos.fondo = await readPhoto(inp.files[0], { max: 1920, q: 0.82 });
      S.business.theme = { ...(S.business.theme || {}), fondo: 'propio' };
      save();
      aplicarTema(S.business, S.photos);
      renderApp('ajustes');
      toast('Ese es tu fondo');
    } catch { toast('Esa imagen no se pudo leer', 'warn'); }
  });
  inp.click();
}
