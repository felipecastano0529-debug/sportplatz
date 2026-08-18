/* ==========================================================================
   UI · Cuenta

   El embudo: cualquiera abre el link y usa la plataforma sin registrarse. Si
   le sirve, crea cuenta y lo que ya armó se sube tal cual — no empieza de
   cero, que es lo que hace abandonar en ese punto.

   Si la nube no está configurada, nada de esto se muestra. Un botón que no
   lleva a ningún sitio es peor que no tener botón.
   ========================================================================== */

import { $, $$, esc } from '../core/util.js';
import { S, setS, Store, saveNow } from '../core/store.js';
import * as nube from '../core/nube.js';
import { icon } from './icons.js';
import { openModal, closeModal, toast } from './modal.js';

export const nubeLista = () => nube.hayNube();
export const conCuenta = () => nube.haySesion();
export const correo = () => nube.usuario()?.email ?? null;

/* ── La fila del rail ────────────────────────────────────────────────────── */

export function filaCuentaHTML() {
  if (!nube.hayNube()) return '';

  if (nube.haySesion()) {
    return `<button class="cuenta cuenta--dentro" id="cuentaBtn" title="Tu cuenta">
      ${icon('check', 'ic ic-sm')}
      <span class="cuenta-txt"><b>Datos guardados</b><em>${esc(correo())}</em></span>
    </button>`;
  }
  return `<button class="cuenta cuenta--demo" id="cuentaBtn">
    ${icon('spark', 'ic ic-sm')}
    <span class="cuenta-txt"><b>Modo demo</b><em>Guarda tu complejo →</em></span>
  </button>`;
}

export function wireCuenta(alCambiar) {
  $('#cuentaBtn')?.addEventListener('click', () =>
    nube.haySesion() ? abrirCuenta(alCambiar) : abrirRegistro(alCambiar));
}

/* ── Registro y acceso ───────────────────────────────────────────────────── */

export function abrirRegistro(alCambiar = () => {}, modo = 'crear') {
  const hayTrabajo = !!S?.courts?.length;

  const pinta = (m) => `
    <div class="seg seg--wide" id="authTabs">
      <button type="button" class="seg-b ${m === 'crear' ? 'is-on' : ''}" data-modo="crear">Crear cuenta</button>
      <button type="button" class="seg-b ${m === 'entrar' ? 'is-on' : ''}" data-modo="entrar">Ya tengo cuenta</button>
    </div>
    <p class="hint" id="authNota">${m === 'crear'
      ? (hayTrabajo
          ? `Se guarda <b>${esc(S.business.name)}</b> tal como lo tienes ahora, con sus
             ${S.bookings.length.toLocaleString('es-CO')} reservas. No empiezas de cero.`
          : 'Tu complejo quedará guardado y lo verás desde cualquier dispositivo.')
      : 'Entra y recupera tu complejo en este dispositivo.'}</p>
    <div class="form-grid">
      <label class="field field-full"><span class="field-label">Correo</span>
        <input id="authMail" class="input" type="email" autocomplete="email"
               inputmode="email" placeholder="tu@correo.com"></label>
      <label class="field field-full"><span class="field-label">Contraseña</span>
        <input id="authPass" class="input" type="password"
               autocomplete="${m === 'crear' ? 'new-password' : 'current-password'}"
               placeholder="Mínimo 6 caracteres"></label>
    </div>
    <p class="auth-error" id="authError" hidden></p>`;

  openModal({
    title: modo === 'crear' ? 'Guardar mi complejo' : 'Entrar',
    body: pinta(modo),
    confirm: modo === 'crear' ? 'Crear cuenta' : 'Entrar',
    onConfirm() {
      // Se devuelve false siempre: el modal lo cierra el flujo asíncrono.
      enviar(alCambiar);
      return false;
    }
  });

  const repinta = (m) => {
    $('.modal-body').innerHTML = pinta(m);
    $('.modal-head h2').textContent = m === 'crear' ? 'Guardar mi complejo' : 'Entrar';
    $('[data-ok]').textContent = m === 'crear' ? 'Crear cuenta' : 'Entrar';
    engancha();
    $('#authMail').focus();
  };

  function engancha() {
    $$('#authTabs .seg-b').forEach(b =>
      b.addEventListener('click', () => repinta(b.dataset.modo)));
    ['#authMail', '#authPass'].forEach(sel =>
      $(sel).addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); enviar(alCambiar); }
      }));
  }
  engancha();
}

async function enviar(alCambiar) {
  const modo = $('#authTabs .seg-b.is-on')?.dataset.modo || 'crear';
  const mail = $('#authMail').value.trim();
  const pass = $('#authPass').value;
  const err  = $('#authError');
  const ok   = $('[data-ok]');

  const falla = (msg) => { err.textContent = msg; err.hidden = false; };
  err.hidden = true;

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(mail)) return falla('Escribe un correo válido');
  if (pass.length < 6) return falla('La contraseña necesita al menos 6 caracteres');

  ok.disabled = true;
  const textoOriginal = ok.textContent;
  ok.innerHTML = '<span class="spin"></span>' + (modo === 'crear' ? 'Creando…' : 'Entrando…');

  try {
    // Antes de cambiar de sesión se conserva lo que hay: si el usuario venía
    // del demo, esto es todo su trabajo y no puede evaporarse.
    const local = S ? structuredClone(S) : null;

    if (modo === 'crear') {
      const r = await nube.registrarse(mail, pass);
      if (r.necesitaConfirmar) {
        closeModal();
        toast('Te mandamos un correo para confirmar la cuenta', 'info');
        return;
      }
    } else {
      await nube.entrar(mail, pass);
    }

    const remoto = await nube.leerEspacio();

    if (remoto) {
      // Ya tenía un complejo en su cuenta: manda el de la nube.
      setS(remoto);
      closeModal();
      alCambiar();
      toast('Recuperamos tu complejo');
    } else if (local?.courts?.length) {
      await nube.crearEspacio(local);
      setS(local);
      closeModal();
      alCambiar();
      toast('Listo · tu complejo quedó guardado en tu cuenta');
    } else {
      closeModal();
      alCambiar();
      toast('Cuenta creada');
    }
  } catch (e) {
    falla(e.message);
    ok.disabled = false;
    ok.textContent = textoOriginal;
  }
}

/* ── Ya dentro ───────────────────────────────────────────────────────────── */

export function abrirCuenta(alCambiar = () => {}) {
  const n = S?.bookings?.length ?? 0;
  openModal({
    title: 'Tu cuenta',
    body: `
      <ul class="kv">
        <li><span>Correo</span><b>${esc(correo() || '')}</b></li>
        <li><span>Complejo</span><b>${esc(S?.business?.name || '—')}</b></li>
        <li><span>Reservas guardadas</span><b>${n.toLocaleString('es-CO')}</b></li>
      </ul>
      <p class="hint">Tus datos están en el servidor, no en este navegador. Puedes
        entrar desde el celular o desde otro computador y encontrarlo todo igual.</p>`,
    confirm: null,
    danger: 'Cerrar sesión',
    async onDanger() {
      await saveNow();
      await nube.salir();
      // Al salir se vuelve al demo local, no a una pantalla vacía.
      const local = await Store.leerLocal();
      setS(local?.courts?.length ? local : null);
      alCambiar();
      toast('Sesión cerrada · vuelves al modo demo');
    }
  });
}
