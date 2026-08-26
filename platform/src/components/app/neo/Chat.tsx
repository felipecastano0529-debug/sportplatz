'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Ball } from '@/components/Ball';
import { Icon } from '@/components/Icon';
import { hablarConNeo } from '@/lib/actions/neo';
import { nuevaSesion, type Sesion, type Mensaje, type Respuesta } from '@/lib/neo/motor';
import { money, fmtDateLong, fmtHour } from '@/lib/util';

/* ==========================================================================
   NEO · La conversación

   `role="log"` con `aria-live="polite"` (§10.6): lo que Neo va diciendo se
   anuncia solo, sin interrumpir lo que el lector de pantalla esté leyendo.

   Las sugerencias desaparecen mientras Neo escribe. Ofrecer un atajo que no
   se puede tomar es peor que no ofrecerlo.

   Los `setTimeout` que encadenaban la conversación de la demo durante ~20 s
   (trampa 8) aquí no existen: cada turno es una ida y vuelta al servidor, y
   el efecto se limpia al desmontar.
   ========================================================================== */

interface Burbuja { de: 'neo' | 'yo'; msg: Mensaje }

export function Chat({
  slug,
  negocio,
  logoUrl,
  inicial
}: {
  slug: string;
  negocio: string;
  logoUrl: string | null;
  inicial: Respuesta;
}) {
  const router = useRouter();
  const [ctx, setCtx] = useState<Sesion>(() => ({ ...nuevaSesion(), saludado: true }));
  const [burbujas, setBurbujas] = useState<Burbuja[]>(
    () => inicial.msgs.map(msg => ({ de: 'neo' as const, msg }))
  );
  const [quick, setQuick] = useState(inicial.quick);
  const [texto, setTexto] = useState('');
  const [pensando, arrancar] = useTransition();

  const log = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLInputElement>(null);

  // El log se queda abajo, que es donde está lo último que se dijo.
  useEffect(() => {
    const el = log.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [burbujas, pensando]);

  const enviar = (entrada: string) => {
    const limpio = entrada.trim();
    if (!limpio || pensando) return;

    setBurbujas(b => [...b, { de: 'yo', msg: { t: 'text', text: limpio } }]);
    setTexto('');
    setQuick([]);

    arrancar(async () => {
      const { ctx: nuevo, respuesta } = await hablarConNeo(slug, ctx, limpio);
      setCtx(nuevo);
      setBurbujas(b => [...b, ...respuesta.msgs.map(msg => ({ de: 'neo' as const, msg }))]);
      setQuick(respuesta.quick);
      // Si Neo escribió en la agenda, el resto de la app tiene que enterarse.
      if (respuesta.msgs.some(x => x.t === 'ok')) router.refresh();
      campo.current?.focus();
    });
  };

  return (
    <section className="neo">
      <header className="neo-head">
        <span className="neo-av">
          {logoUrl
            ? <img src={logoUrl} alt="" />
            : <img className="logo" src="/assets/marca/logo.png" alt="" width={256} height={256} />}
        </span>
        <span className="neo-who">
          <b>Neo AI</b>
          <em><i className="neo-live" />en línea · lee la agenda real</em>
        </span>
        <span className="neo-tag">{negocio}</span>
      </header>

      <div className="neo-log" ref={log} role="log" aria-live="polite" aria-label="Conversación con Neo AI">
        {burbujas.map((b, i) => (
          <div className={`neo-msg is-${b.de}`} key={i}>
            <div className="neo-b">
              <Contenido msg={b.msg} onTocar={enviar} />
            </div>
          </div>
        ))}

        {pensando && (
          <div className="neo-msg is-neo">
            <div className="neo-b">
              <span className="neo-typing" aria-label="Neo está escribiendo">
                <i /><i /><i />
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="neo-quick" hidden={pensando || !quick.length}>
        {quick.map(q => (
          <button className="neo-chip" key={q} onClick={() => enviar(q)}>{q}</button>
        ))}
      </div>

      <form
        className="neo-form"
        onSubmit={e => { e.preventDefault(); enviar(texto); }}
      >
        <input
          className="neo-in"
          ref={campo}
          value={texto}
          onChange={e => setTexto(e.target.value)}
          placeholder="Escríbele como le escribirías a alguien…"
          aria-label="Mensaje para Neo AI"
          autoComplete="off"
          disabled={pensando}
        />
        <button className="neo-send" type="submit" aria-label="Enviar" disabled={pensando}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3.4 20.4 21 12 3.4 3.6 3.39 10.1 15.5 12 3.39 13.9z" />
          </svg>
        </button>
      </form>
    </section>
  );
}

/* ── Las cinco formas de burbuja ─────────────────────────────────────────── */

function Contenido({ msg, onTocar }: { msg: Mensaje; onTocar: (s: string) => void }) {
  if (msg.t === 'text') return <p className="neo-p">{msg.text}</p>;

  if (msg.t === 'courts') {
    return (
      <ul className="neo-courts">
        {msg.items.map(it => (
          <li key={it.sport}>
            <span className="neo-ball"><Ball sport={it.sport} /></span>
            <span className="neo-court-t">
              <b>{it.name}</b>
              <em>{it.cuantas} {it.cuantas === 1 ? 'cancha' : 'canchas'} · {it.blurb}</em>
            </span>
            <span className="neo-price">{it.precio}<em>por hora</em></span>
          </li>
        ))}
      </ul>
    );
  }

  if (msg.t === 'hours') {
    return (
      <div className="neo-hours">
        {msg.horas.map(h => (
          // Tocar una hora manda el MISMO texto que escribirla: hablar y
          // tocar recorren exactamente el mismo camino dentro del motor.
          <button className="neo-hour" key={h} onClick={() => onTocar(fmtHour(h))}>
            {fmtHour(h)}
          </button>
        ))}
      </div>
    );
  }

  if (msg.t === 'quote') {
    const q = msg.q;
    const cobra = q.pago === 'completo' ? q.total : q.pago === 'cancha' ? 0 : q.adelanto;
    return (
      <div className="neo-card">
        <p className="neo-card-t"><Icon name="cal" className="ic ic-sm" />Así quedaría</p>
        <ul className="neo-kv">
          <li><span>Cancha</span><b>{q.cancha}</b></li>
          <li><span>Cuándo</span><b>{fmtDateLong(q.fecha)} · {fmtHour(q.inicio)}</b></li>
          <li><span>Total</span><b>{money(q.total)}</b></li>
          <li>
            <span>{q.pago === 'cancha' ? 'Pagas en cancha' : 'Ahora'}</span>
            <b>{money(cobra)}</b>
          </li>
        </ul>
        {q.nota && <p className="neo-nota">{q.nota}</p>}
        <div className="neo-acts">
          <button className="btn btn-primary btn-sm" onClick={() => onTocar('dale')}>
            Confirmar
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => onTocar('otra hora')}>
            Otra hora
          </button>
        </div>
      </div>
    );
  }

  if (msg.t === 'ok') {
    const b = msg.b;
    return (
      <div className="neo-card is-ok">
        <p className="neo-card-t"><Icon name="check" className="ic ic-sm" />Reservada</p>
        <ul className="neo-kv">
          <li><span>Cancha</span><b>{b.cancha}</b></li>
          <li><span>Cuándo</span><b>{fmtDateLong(b.fecha)} · {fmtHour(b.inicio)}</b></li>
          <li><span>Total</span><b>{money(b.total)}</b></li>
          <li><span>Código</span><b>{b.codigo}</b></li>
        </ul>
      </div>
    );
  }

  return (
    <ul className="neo-list">
      {msg.items.map((it, i) => (
        <li key={i}>
          <span>
            <b>{it.cancha}</b>
            <em>{it.cuando}</em>
          </span>
          <i>{it.saldo > 0 ? `debes ${money(it.saldo)}` : 'pagada'}</i>
        </li>
      ))}
    </ul>
  );
}
