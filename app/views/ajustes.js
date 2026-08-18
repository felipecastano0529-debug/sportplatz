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
import { openCourtForm } from './canchas.js';

export function viewAjustes(main) {
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
