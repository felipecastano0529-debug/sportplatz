'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { guardarNegocio, guardarLogo, quitarLogo } from '@/lib/actions/negocio';
import { toast } from '@/components/ui/Toast';
import { SubirFoto } from '@/components/app/SubirFoto';
import { Icon } from '@/components/Icon';
import { fmtHour, hhmm, waBonito } from '@/lib/util';

/* ==========================================================================
   Ajustes · Identidad y horario

   Lo que ve el jugador y lo que dice Neo AI. El logo se sube desde aquí y
   sustituye a la marca de la casa en el rail: la plataforma es del negocio y
   lleva su nombre, no el nuestro (§1.4).
   ========================================================================== */

export function Identidad({
  slug,
  complejoId,
  nombre: nombreInicial,
  whatsapp: whatsappInicial,
  logoUrl,
  esDueno
}: {
  slug: string;
  complejoId: string;
  nombre: string;
  whatsapp: string | null;
  logoUrl: string | null;
  esDueno: boolean;
}) {
  const router = useRouter();
  const [nombre, setNombre] = useState(nombreInicial);
  const [whatsapp, setWhatsapp] = useState(waBonito(whatsappInicial));
  const [error, setError] = useState<string | null>(null);
  const [enVuelo, arrancar] = useTransition();

  const guardar = () => {
    setError(null);
    arrancar(async () => {
      const r = await guardarNegocio(slug, { nombre, whatsapp });
      if (r.error) { setError(r.error); return; }
      toast('Datos del negocio guardados');
      router.refresh();
    });
  };

  return (
    <>
      <div className="logo-editor">
        <span className="logo-prev">
          {logoUrl
            ? <img src={logoUrl} alt="" />
            : <img className="logo" src="/assets/marca/logo.png" alt="" width={256} height={256} />}
        </span>
        {esDueno && (
          <div className="crest-tools">
            <SubirFoto
              complejoId={complejoId}
              tipo="logo"
              id="marca"
              tieneFoto={!!logoUrl}
              etiqueta="tu negocio"
              variante="bar"
              onGuardar={(url: string) => guardarLogo(slug, url)}
            />
            {logoUrl && (
              <button
                type="button"
                className="mini"
                onClick={() => arrancar(async () => {
                  await quitarLogo(slug);
                  toast('Logo quitado');
                  router.refresh();
                })}
              >
                Quitar
              </button>
            )}
          </div>
        )}
      </div>

      <div className="form-grid">
        <label className="field field-full">
          <span className="field-label">Nombre del negocio</span>
          <input
            className="input"
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            maxLength={42}
            disabled={!esDueno}
          />
        </label>

        {/* No es un dato de formulario: es el número al que Neo mandaría las
            reservas. Se pide con su para qué a la vista. */}
        <label className="field field-full">
          <span className="field-label">WhatsApp del negocio</span>
          <input
            className="input"
            value={whatsapp}
            onChange={e => setWhatsapp(e.target.value)}
            placeholder="300 123 4567"
            inputMode="tel"
            disabled={!esDueno}
          />
        </label>
      </div>

      <p className="hint">Es el número al que Neo AI le manda las reservas que atiende.</p>

      {error && <p className="auth-error" role="alert">{error}</p>}

      {esDueno && (
        <button className="btn btn-primary btn-sm" onClick={guardar} disabled={enVuelo}>
          {enVuelo ? <><span className="spin" />Guardando…</> : <><Icon name="check" />Guardar</>}
        </button>
      )}
    </>
  );
}

/* ── Horario ─────────────────────────────────────────────────────────────── */

export function Horario({
  slug,
  horaAbre,
  horaCierra,
  esDueno
}: {
  slug: string;
  horaAbre: number;
  horaCierra: number;
  esDueno: boolean;
}) {
  const router = useRouter();
  const [abre, setAbre] = useState(horaAbre);
  const [cierra, setCierra] = useState(horaCierra);
  const [mensaje, setMensaje] = useState<{ texto: string; malo: boolean } | null>(null);
  const [enVuelo, arrancar] = useTransition();

  const franjas = Math.max(0, cierra - abre);

  const guardar = () => {
    setMensaje(null);
    arrancar(async () => {
      const r = await guardarNegocio(slug, { horaAbre: abre, horaCierra: cierra });
      if (r.error) { setMensaje({ texto: r.error, malo: true }); return; }
      // R3: cambiar el horario NO borra reservas que queden fuera. Si las
      // hay, se dice aquí mismo en vez de dejar que las descubra.
      if (r.aviso) setMensaje({ texto: r.aviso, malo: false });
      else toast(`Horario de ${fmtHour(hhmm(abre))} a ${fmtHour(hhmm(cierra))}`);
      router.refresh();
    });
  };

  return (
    <>
      <div className="form-grid">
        <label className="field">
          <span className="field-label">Abre</span>
          <select
            className="input"
            value={abre}
            onChange={e => setAbre(+e.target.value)}
            disabled={!esDueno}
          >
            {Array.from({ length: 18 }, (_, i) => i).map(h => (
              <option key={h} value={h}>{fmtHour(hhmm(h))}</option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field-label">Cierra</span>
          <select
            className="input"
            value={cierra}
            onChange={e => setCierra(+e.target.value)}
            disabled={!esDueno}
          >
            {Array.from({ length: 18 }, (_, i) => i + 7).map(h => (
              <option key={h} value={h}>{fmtHour(hhmm(h))}</option>
            ))}
          </select>
        </label>
      </div>

      <p className="hint">
        {franjas > 0
          ? `${franjas} franjas de una hora por cancha y por día.`
          : 'La hora de cierre tiene que ir después de la de apertura.'}
      </p>

      {mensaje && (
        <p className={mensaje.malo ? 'auth-error' : 'nota'} role={mensaje.malo ? 'alert' : 'status'}>
          {!mensaje.malo && <Icon name="spark" className="ic ic-sm" />}
          {mensaje.texto}
        </p>
      )}

      {esDueno && (
        <button
          className="btn btn-primary btn-sm"
          onClick={guardar}
          disabled={enVuelo || franjas <= 0}
        >
          {enVuelo ? <><span className="spin" />Guardando…</> : <><Icon name="check" />Guardar horario</>}
        </button>
      )}
    </>
  );
}
