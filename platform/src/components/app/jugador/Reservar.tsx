'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/ui/Modal';
import { toast } from '@/components/ui/Toast';
import { Icon } from '@/components/Icon';
import { reservarComoJugador, type FormaPago, type ResultadoReserva } from '@/lib/actions/jugador';
import { money, fmtDateLong, fmtHour, nextHour, suggestedDeposit } from '@/lib/util';

/* ==========================================================================
   Confirmar la reserva

   Es el momento que vende (§1.3): el jugador toca una hora, confirma, y esa
   misma reserva aparece en la agenda del dueño. No hay dos objetos ni dos
   caminos — la reserva que crea esta pantalla es la misma que crea el
   mostrador. Solo cambia `origen`.

   R47 — tres formas de pago. Se enseñan las tres con su consecuencia a la
   vista, porque "pago en cancha" tiene una: el cupo puede liberarse.
   ========================================================================== */

export function ParrillaHoras({
  slug,
  cancha,
  fecha,
  children
}: {
  slug: string;
  cancha: { id: string; nombre: string; precio: number };
  fecha: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [hora, setHora] = useState<string | null>(null);

  const alClic = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-hora]');
    if (!el || el.hasAttribute('disabled')) return;
    setHora(el.dataset.hora!);
  };

  return (
    <>
      <div onClick={alClic}>{children}</div>

      {hora && (
        <DialogoConfirmar
          slug={slug}
          cancha={cancha}
          fecha={fecha}
          inicio={hora}
          onCambiarHora={setHora}
          onCerrar={() => setHora(null)}
          onHecho={() => { setHora(null); router.refresh(); }}
        />
      )}
    </>
  );
}

function DialogoConfirmar({
  slug, cancha, fecha, inicio, onCambiarHora, onCerrar, onHecho
}: {
  slug: string;
  cancha: { id: string; nombre: string; precio: number };
  fecha: string;
  inicio: string;
  onCambiarHora: (h: string) => void;
  onCerrar: () => void;
  onHecho: () => void;
}) {
  const [pago, setPago] = useState<FormaPago>('adelanto');
  const [fallo, setFallo] = useState<ResultadoReserva | null>(null);
  const [enVuelo, arrancar] = useTransition();

  const adelanto = suggestedDeposit(cancha.precio);

  const opciones: { id: FormaPago; titulo: string; detalle: string }[] = [
    {
      id: 'adelanto',
      titulo: 'Aparto con adelanto',
      detalle: `${money(adelanto)} ahora · ${money(cancha.precio - adelanto)} en cancha`
    },
    {
      id: 'completo',
      titulo: 'Pago completo',
      detalle: `${money(cancha.precio)} ahora · nada en cancha`
    },
    {
      id: 'cancha',
      titulo: 'Pago todo en cancha',
      detalle: 'Sin adelanto · el cupo puede liberarse'
    }
  ];

  const confirmar = () => {
    setFallo(null);
    return new Promise<boolean>(resolver => {
      arrancar(async () => {
        const r = await reservarComoJugador(slug, {
          canchaId: cancha.id, fecha, inicio, pago
        });
        if (r.error) { setFallo(r); resolver(false); return; }
        toast(`Listo · ${cancha.nombre} a las ${fmtHour(inicio)} · ${r.codigo}`);
        onHecho();
        resolver(true);
      });
    });
  };

  return (
    <Modal
      title="Confirmar reserva"
      confirm="Confirmar reserva"
      confirmando={enVuelo}
      onConfirm={confirmar}
      onClose={onCerrar}
    >
      <ul className="kv">
        <li><span>Cancha</span><b>{cancha.nombre}</b></li>
        <li>
          <span>Cuándo</span>
          <b>{fmtDateLong(fecha)} · {fmtHour(inicio)} a {fmtHour(nextHour(inicio))}</b>
        </li>
        <li><span>Total</span><b>{money(cancha.precio)}</b></li>
      </ul>

      <div className="pay-choice" role="radiogroup" aria-label="Cómo pagas">
        {opciones.map(o => (
          <button
            type="button"
            key={o.id}
            className={`pay-opt${pago === o.id ? ' is-on' : ''}`}
            onClick={() => setPago(o.id)}
            role="radio"
            aria-checked={pago === o.id}
          >
            <b>{o.titulo}</b>
            <em>{o.detalle}</em>
          </button>
        ))}
      </div>

      <p className="hint">
        El complejo te cobra al llegar. Cuando conectemos la pasarela, el
        adelanto se pagará aquí mismo.
      </p>

      {fallo?.error && (
        <div className="nota nota--neg choque" role="alert">
          <Icon name="spark" className="ic ic-sm" />
          <span>
            {fallo.error}
            {fallo.libres && (
              <>
                {' '}{fallo.mensaje}
                <span className="choque-horas">
                  {fallo.libres.map(h => (
                    <button
                      key={h}
                      type="button"
                      className="pill"
                      onClick={() => { onCambiarHora(h); setFallo(null); }}
                    >
                      {fmtHour(h)}
                    </button>
                  ))}
                </span>
              </>
            )}
          </span>
        </div>
      )}
    </Modal>
  );
}
