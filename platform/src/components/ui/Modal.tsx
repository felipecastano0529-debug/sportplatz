'use client';

import { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@/components/Icon';

/* ==========================================================================
   UI · Modal

   Portado de `demo/app/ui/modal.js`. Lo que hay que conservar sin negociar
   es el comportamiento de foco (§10.6):

     · al abrir, el foco entra en el diálogo — al primer campo si hay
       formulario, y si no al botón principal; nunca a "Cerrar", que invita
       a cancelar;
     · mientras está abierto se queda atrapado dentro;
     · lo de detrás queda `inert`, así que el tabulador no pasea por los
       controles invisibles bajo el velo;
     · al cerrar, el foco vuelve al botón que lo disparó.
   ========================================================================== */

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), ' +
  'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface ModalProps {
  title: string;
  children: React.ReactNode;
  /** Etiqueta del botón principal. `null` = diálogo de solo lectura. */
  confirm?: string | null;
  onConfirm?: () => void | boolean | Promise<void | boolean>;
  danger?: string;
  onDanger?: () => void;
  onClose: () => void;
  wide?: boolean;
  confirmando?: boolean;
}

export function Modal({
  title,
  children,
  confirm,
  onConfirm,
  danger,
  onDanger,
  onClose,
  wide,
  confirmando
}: ModalProps) {
  const scrim = useRef<HTMLDivElement>(null);
  const dialogo = useRef<HTMLDivElement>(null);
  const okRef = useRef<HTMLButtonElement>(null);
  const disparador = useRef<Element | null>(null);

  const cerrar = useCallback(() => onClose(), [onClose]);

  useEffect(() => {
    disparador.current = document.activeElement;
    document.body.classList.add('is-locked');

    // Lo de detrás deja de existir para el teclado y para los lectores.
    const fondo = [document.querySelector('.shell'), document.querySelector('#backdrop')]
      .filter(Boolean) as HTMLElement[];
    fondo.forEach(el => el.setAttribute('inert', ''));

    /* Con `setTimeout` y no con `requestAnimationFrame`: si la pestaña está
       en segundo plano el navegador deja de entregar frames, el rAF no llega
       y el diálogo se abre sin foco — con el fondo ya inerte, el teclado
       queda atrapado en ningún sitio. */
    const t = setTimeout(() => {
      const primero = dialogo.current?.querySelector<HTMLElement>(
        'input:not([type=hidden]), select, textarea'
      );
      (primero ?? okRef.current ?? dialogo.current)?.focus();
    }, 0);

    const alTeclado = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); cerrar(); return; }
      if (e.key !== 'Tab' || !dialogo.current) return;

      const items = [...dialogo.current.querySelectorAll<HTMLElement>(FOCUSABLE)]
        .filter(el => el.offsetParent !== null);
      if (!items.length) return;

      const primero = items[0];
      const ultimo = items[items.length - 1];
      if (e.shiftKey && document.activeElement === primero) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero.focus(); }
    };

    document.addEventListener('keydown', alTeclado);

    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', alTeclado);
      document.body.classList.remove('is-locked');
      fondo.forEach(el => el.removeAttribute('inert'));
      // El foco vuelve de donde salió. Sin esto reaparece en el `<body>`.
      const vuelve = disparador.current;
      if (vuelve instanceof HTMLElement && vuelve.isConnected) vuelve.focus();
    };
  }, [cerrar]);

  const alConfirmar = async () => {
    // Devolver `false` deja el diálogo abierto: lo usa la validación.
    if (onConfirm && (await onConfirm()) === false) return;
    cerrar();
  };

  return createPortal(
    <div
      className="scrim"
      ref={scrim}
      onMouseDown={e => { if (e.target === scrim.current) cerrar(); }}
    >
      <div
        className={`modal${wide ? ' modal-wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={dialogo}
        tabIndex={-1}
      >
        <header className="modal-head">
          <h2>{title}</h2>
          <button className="modal-x" onClick={cerrar} aria-label="Cerrar">
            <Icon name="close" className="ic ic-sm" />
          </button>
        </header>

        <div className="modal-body">{children}</div>

        <footer className="modal-foot">
          {danger && (
            <button
              className="btn btn-danger btn-sm"
              onClick={() => { onDanger?.(); cerrar(); }}
            >
              {danger}
            </button>
          )}
          <span className="spacer" />
          <button className="btn btn-secondary" onClick={cerrar}>Cancelar</button>
          {confirm && (
            <button
              className="btn btn-primary"
              ref={okRef}
              onClick={alConfirmar}
              disabled={confirmando}
            >
              {confirmando ? <><span className="spin" />Guardando…</> : confirm}
            </button>
          )}
        </footer>
      </div>
    </div>,
    document.body
  );
}
