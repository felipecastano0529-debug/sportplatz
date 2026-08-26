'use client';

import { createContext, useContext, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/ui/Modal';
import { toast } from '@/components/ui/Toast';
import { Icon } from '@/components/Icon';
import {
  crearReserva, registrarAbono, cancelarReserva, type ResultadoReserva
} from '@/lib/actions/reservas';
import {
  money, thousands, readNum, fmtHour, fmtDateLong, suggestedDeposit, shortTime
} from '@/lib/util';
import { ETIQUETA_ORIGEN, type Reserva } from '@/lib/types';

/* ==========================================================================
   La agenda, por dentro

   La cuadrícula la pinta el servidor: son hasta cuarenta columnas por
   diecisiete filas y no tiene sentido hidratar setecientos botones. Este
   componente escucha UN clic delegado en el contenedor y abre el diálogo que
   toque, leyendo `data-new` o `data-open` de la celda.

   Es la misma delegación que hacía la demo, y por la misma razón: la agenda
   se repinta entera en cada cambio de día y de filtro.
   ========================================================================== */

export interface CanchaLigera { id: string; nombre: string; precio: number }

/* El botón de alta vive en la cabecera de la página, que la pinta el
   servidor dentro de `children`. Un contexto lo cruza sin tener que subir el
   estado ni duplicar el diálogo: el proveedor es este componente y el
   consumidor es `<BotonNuevaReserva/>`, más abajo en el mismo árbol. */
const AbrirAlta = createContext<(() => void) | null>(null);

export function BotonNuevaReserva() {
  const abrir = useContext(AbrirAlta);
  return (
    <button type="button" className="btn btn-primary btn-sm" onClick={() => abrir?.()} disabled={!abrir}>
      <Icon name="plus" />Nueva reserva
    </button>
  );
}

export function AgendaShell({
  slug,
  fecha,
  canchas,
  horas,
  reservas,
  children
}: {
  slug: string;
  fecha: string;
  canchas: CanchaLigera[];
  horas: string[];
  reservas: Reserva[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [nueva, setNueva] = useState<{ canchaId: string; inicio: string } | null>(null);
  const [detalle, setDetalle] = useState<Reserva | null>(null);

  const alClic = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-new], [data-open]');
    if (!el) return;

    if (el.dataset.new) {
      const [canchaId, inicio] = el.dataset.new.split('|');
      setNueva({ canchaId, inicio });
      return;
    }
    const r = reservas.find(x => x.id === el.dataset.open);
    if (r) setDetalle(r);
  };

  const abrirAlta = () => {
    if (!canchas.length) return;
    // Las seis de la tarde: la hora que más se reserva, así que es la que
    // menos veces hay que cambiar.
    setNueva({ canchaId: canchas[0].id, inicio: '18:00' });
  };

  return (
    <AbrirAlta.Provider value={canchas.length ? abrirAlta : null}>
      <div onClick={alClic}>{children}</div>

      {nueva && (
        <DialogoNueva
          slug={slug}
          fecha={fecha}
          canchas={canchas}
          horas={horas}
          inicial={nueva}
          onCerrar={() => setNueva(null)}
          onHecho={() => { setNueva(null); router.refresh(); }}
        />
      )}

      {detalle && (
        <DialogoDetalle
          slug={slug}
          reserva={detalle}
          cancha={canchas.find(c => c.id === detalle.cancha_id)}
          onCerrar={() => setDetalle(null)}
          onHecho={() => { setDetalle(null); router.refresh(); }}
        />
      )}
    </AbrirAlta.Provider>
  );
}

/* ── Alta ────────────────────────────────────────────────────────────────── */

function DialogoNueva({
  slug, fecha, canchas, horas, inicial, onCerrar, onHecho
}: {
  slug: string;
  fecha: string;
  canchas: CanchaLigera[];
  horas: string[];
  inicial: { canchaId: string; inicio: string };
  onCerrar: () => void;
  onHecho: () => void;
}) {
  const [canchaId, setCanchaId] = useState(inicial.canchaId);
  const [dia, setDia] = useState(fecha);
  const [inicio, setInicio] = useState(inicial.inicio);
  const [cliente, setCliente] = useState('');
  const [telefono, setTelefono] = useState('');
  const cancha = canchas.find(c => c.id === canchaId) ?? canchas[0];

  // R10: el adelanto sugerido es la mitad redondeada al millar más cercano.
  const [adelanto, setAdelanto] = useState(() => suggestedDeposit(cancha?.precio ?? 0));
  const [fallo, setFallo] = useState<ResultadoReserva | null>(null);
  const [enVuelo, arrancar] = useTransition();

  const total = cancha?.precio ?? 0;
  const cobra = Math.min(total, adelanto);

  const cambiarCancha = (id: string) => {
    setCanchaId(id);
    const c = canchas.find(x => x.id === id);
    if (c) setAdelanto(suggestedDeposit(c.precio));
  };

  const guardar = () => {
    setFallo(null);
    return new Promise<boolean>(resolver => {
      arrancar(async () => {
        const r = await crearReserva(slug, {
          canchaId, fecha: dia, inicio, cliente, telefono, adelanto: cobra
        });
        if (r.error) { setFallo(r); resolver(false); return; }
        toast(`Reserva de ${cliente.trim()} guardada · ${fmtHour(inicio)}`);
        onHecho();
        resolver(true);
      });
    });
  };

  return (
    <Modal
      title="Nueva reserva"
      confirm="Guardar reserva"
      confirmando={enVuelo}
      onConfirm={guardar}
      onClose={onCerrar}
    >
      <div className="form-grid">
        <label className="field">
          <span className="field-label">Cliente</span>
          <input
            className="input"
            value={cliente}
            onChange={e => setCliente(e.target.value)}
            placeholder="Nombre y apellido"
            autoComplete="off"
          />
        </label>

        <label className="field">
          <span className="field-label">Celular</span>
          <input
            className="input"
            value={telefono}
            onChange={e => setTelefono(e.target.value)}
            placeholder="300 123 4567"
            inputMode="tel"
            autoComplete="off"
          />
        </label>

        <label className="field">
          <span className="field-label">Cancha</span>
          <select className="input" value={canchaId} onChange={e => cambiarCancha(e.target.value)}>
            {canchas.map(c => (
              <option key={c.id} value={c.id}>{c.nombre} — {money(c.precio)}/h</option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field-label">Día</span>
          <input className="input" type="date" value={dia} onChange={e => setDia(e.target.value)} />
        </label>

        <label className="field">
          <span className="field-label">Hora</span>
          <select className="input" value={inicio} onChange={e => setInicio(e.target.value)}>
            {horas.map(h => <option key={h} value={h}>{fmtHour(h)}</option>)}
          </select>
        </label>

        <label className="field">
          <span className="field-label">Adelanto</span>
          <span className="price-input">
            <i>$</i>
            <input
              type="text"
              inputMode="numeric"
              value={thousands(adelanto)}
              onChange={e => setAdelanto(Math.min(total, readNum(e.target.value)))}
            />
          </span>
        </label>
      </div>

      <div className="form-note">
        <span>Total <b>{money(total)}</b></span>
        <span>Adelanto <b className="ok">{money(cobra)}</b></span>
        <span>Queda debiendo <b className="neg">{money(total - cobra)}</b></span>
      </div>

      {/* R5: cuando la franja se la lleva otro no se dice "error". Se dice
          qué pasó y con qué horas se puede seguir, en un clic. */}
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
                      onClick={() => { setInicio(h); setFallo(null); }}
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

/* ── Detalle ─────────────────────────────────────────────────────────────── */

function DialogoDetalle({
  slug, reserva, cancha, onCerrar, onHecho
}: {
  slug: string;
  reserva: Reserva;
  cancha?: CanchaLigera;
  onCerrar: () => void;
  onHecho: () => void;
}) {
  const debe = Math.max(0, reserva.total - reserva.abonado);
  const [abono, setAbono] = useState(debe);
  const [enVuelo, arrancar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const cobrar = () => {
    if (!debe) return;
    setError(null);
    return new Promise<boolean>(resolver => {
      arrancar(async () => {
        const r = await registrarAbono(slug, reserva.id, abono);
        if (r.error) { setError(r.error); resolver(false); return; }
        toast(`Abono de ${money(Math.min(debe, abono))} registrado`);
        onHecho();
        resolver(true);
      });
    });
  };

  const cancelar = () => {
    arrancar(async () => {
      const r = await cancelarReserva(slug, reserva.id);
      if (r.error) { toast(r.error, 'warn'); return; }
      toast('Reserva cancelada · la hora queda libre', 'warn');
      onHecho();
    });
  };

  return (
    <Modal
      title={reserva.cliente}
      confirm={debe ? 'Registrar abono' : null}
      confirmando={enVuelo}
      onConfirm={cobrar}
      danger="Cancelar reserva"
      onDanger={cancelar}
      onClose={onCerrar}
    >
      <ul className="kv">
        <li><span>Cancha</span><b>{cancha?.nombre ?? '—'}</b></li>
        <li>
          <span>Cuándo</span>
          <b>
            {fmtDateLong(reserva.fecha)} · {fmtHour(shortTime(reserva.inicio))} a{' '}
            {fmtHour(shortTime(reserva.fin))}
          </b>
        </li>
        <li><span>Celular</span><b>{reserva.telefono ?? '—'}</b></li>
        <li><span>Reservó por</span><b>{ETIQUETA_ORIGEN[reserva.origen]}</b></li>
        <li><span>Código</span><b className="mono">{reserva.codigo}</b></li>
        <li><span>Total</span><b>{money(reserva.total)}</b></li>
        <li><span>Abonado</span><b className="ok">{money(reserva.abonado)}</b></li>
        <li className="kv-strong">
          <span>Saldo</span>
          <b className={debe ? 'neg' : 'ok'}>{debe ? money(debe) : 'Pagada'}</b>
        </li>
      </ul>

      {debe > 0 && (
        <label className="field">
          <span className="field-label">Registrar abono</span>
          <span className="price-input">
            <i>$</i>
            <input
              type="text"
              inputMode="numeric"
              value={thousands(abono)}
              onChange={e => setAbono(Math.min(debe, readNum(e.target.value)))}
            />
          </span>
        </label>
      )}

      {error && <p className="auth-error" role="alert">{error}</p>}
    </Modal>
  );
}
