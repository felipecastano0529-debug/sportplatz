'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';

/* ==========================================================================
   Abrir una ficha

   Las tarjetas y las filas del ranking las pinta el servidor —son decenas y
   no hay nada que hidratar en ellas—; este contenedor escucha UN clic
   delegado y abre la ficha que corresponda, que también viene ya renderizada
   desde el servidor dentro de `fichas`.

   Es el mismo patrón de la agenda, por la misma razón.
   ========================================================================== */

export function AbridorDeFichas({
  children,
  fichas
}: {
  children: React.ReactNode;
  /** Ficha ya renderizada por el servidor, indexada por id. */
  fichas: Record<string, { titulo: string; contenido: React.ReactNode }>;
}) {
  const [abierta, setAbierta] = useState<string | null>(null);

  const alClic = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-team], [data-player]');
    const id = el?.dataset.team ?? el?.dataset.player;
    if (id && fichas[id]) setAbierta(id);
  };

  const alTeclado = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-team], [data-player]');
    const id = el?.dataset.team ?? el?.dataset.player;
    if (id && fichas[id]) { e.preventDefault(); setAbierta(id); }
  };

  const ficha = abierta ? fichas[abierta] : null;

  return (
    <>
      <div onClick={alClic} onKeyDown={alTeclado}>{children}</div>

      {ficha && (
        <Modal title={ficha.titulo} confirm={null} wide onClose={() => setAbierta(null)}>
          {ficha.contenido}
        </Modal>
      )}
    </>
  );
}
