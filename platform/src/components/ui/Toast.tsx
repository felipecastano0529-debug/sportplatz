'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@/components/Icon';

/* ==========================================================================
   UI · Toast

   Portado de `demo/app/ui/modal.js`. Sigue siendo `role="status"` con
   `aria-live="polite"` (§10.6): confirma algo que ya pasó, así que no
   interrumpe.

   Es un store minúsculo fuera de React a propósito: `toast()` se llama desde
   Server Actions envueltas, desde manejadores sueltos y desde efectos, y
   pasar un contexto hasta cada uno de esos sitios sería más cañería que
   función.
   ========================================================================== */

export type TipoToast = 'ok' | 'warn' | 'info';

interface Aviso { id: number; texto: string; tipo: TipoToast }

let actual: Aviso | null = null;
let n = 0;
const oyentes = new Set<() => void>();

const avisar = () => oyentes.forEach(f => f());

export function toast(texto: string, tipo: TipoToast = 'ok') {
  actual = { id: ++n, texto, tipo };
  avisar();
}

const suscribir = (f: () => void) => {
  oyentes.add(f);
  return () => { oyentes.delete(f); };
};

export function Toaster() {
  const aviso = useSyncExternalStore(suscribir, () => actual, () => null);
  const [visible, setVisible] = useState(false);
  const [montado, setMontado] = useState(false);

  useEffect(() => setMontado(true), []);

  useEffect(() => {
    if (!aviso) return;
    /* Un fotograma de margen para que el navegador registre el estado
       inicial: sin él la transición salta directa al final y el aviso
       aparece sin entrar. */
    const alta = setTimeout(() => setVisible(true), 16);
    const baja = setTimeout(() => setVisible(false), 3400);
    return () => { clearTimeout(alta); clearTimeout(baja); };
  }, [aviso]);

  if (!montado) return null;

  return createPortal(
    <div
      id="toast"
      role="status"
      aria-live="polite"
      className={`toast is-${aviso?.tipo ?? 'ok'}${visible ? ' is-on' : ''}`}
    >
      {aviso && (
        <>
          <Icon name={aviso.tipo === 'ok' ? 'check' : 'spark'} />
          <span>{aviso.texto}</span>
        </>
      )}
    </div>,
    document.body
  );
}
