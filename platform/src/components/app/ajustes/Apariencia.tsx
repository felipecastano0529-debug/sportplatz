'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { PALETAS, FONDOS, derivar, paletaDe, type FondoId } from '@/lib/tema';
import { guardarTema } from '@/lib/actions/negocio';
import { toast } from '@/components/ui/Toast';
import { SubirFoto } from '@/components/app/SubirFoto';
import { Icon } from '@/components/Icon';
import type { Tema } from '@/lib/types';

/* ==========================================================================
   Ajustes · Apariencia

   El color de la marca y lo que se ve detrás. Se aplica al instante y sin
   recargar: la vista previa escribe las cuatro variables en `:root` mientras
   se elige, así que el dueño ve su plataforma retiñéndose entera —rail,
   botones, pastillas, anillos de foco— antes de confirmar.

   El contraste no se defiende prohibiendo colores: se conserva el tono y la
   saturación que eligió y se busca la luminosidad que hace falta para pasar
   AA sobre blanco y AAA sobre la placa.
   ========================================================================== */

export function Apariencia({
  slug,
  complejoId,
  tema,
  esDueno
}: {
  slug: string;
  complejoId: string;
  tema: Tema;
  esDueno: boolean;
}) {
  const router = useRouter();
  const [acento, setAcento] = useState(tema.accent ?? 'esmeralda');
  const [propio, setPropio] = useState(tema.custom ?? '#7c3aed');
  const [fondo, setFondo] = useState<FondoId>((tema.fondo as FondoId) ?? 'estadio');
  const [aviso, setAviso] = useState<string | null>(null);
  const [, arrancar] = useTransition();

  const vistaPrevia = paletaDe({ accent: acento, custom: propio });
  const dePropio = derivar(propio);

  /* Se pinta en caliente y se guarda a la vez. Un color que hay que
     confirmar en un diálogo se elige a ciegas: aquí se ve encima de la
     plataforma de verdad mientras se decide. */
  const pintar = (p: { accent: string; hi: string; deep: string; rgb: string }) => {
    const raiz = document.documentElement.style;
    raiz.setProperty('--accent', p.accent);
    raiz.setProperty('--accent-hi', p.hi);
    raiz.setProperty('--accent-deep', p.deep);
    raiz.setProperty('--accent-rgb', p.rgb);
  };

  const elegirAcento = (id: string, hex?: string) => {
    setAcento(id);
    if (hex) setPropio(hex);
    pintar(id === 'custom' ? derivar(hex ?? propio) : PALETAS.find(p => p.id === id)!);

    arrancar(async () => {
      const r = await guardarTema(slug, { accent: id === 'custom' ? (hex ?? propio) : id });
      if (r.error) { toast(r.error, 'warn'); return; }
      setAviso(r.aviso ?? null);
      router.refresh();
    });
  };

  const elegirFondo = (id: FondoId) => {
    setFondo(id);
    arrancar(async () => {
      const r = await guardarTema(slug, { fondo: id });
      if (r.error) { toast(r.error, 'warn'); return; }
      toast(id === 'sobrio' ? 'Fondo sobrio · sin foto' : 'Fondo actualizado');
      router.refresh();
    });
  };

  return (
    <>
      <span className="field-label">Color</span>
      <div className="swatches" role="radiogroup" aria-label="Color de marca">
        {PALETAS.map(p => (
          <button
            type="button"
            key={p.id}
            className={`swatch${p.id === acento ? ' is-on' : ''}`}
            onClick={() => elegirAcento(p.id)}
            role="radio"
            aria-checked={p.id === acento}
            disabled={!esDueno}
            style={{ '--sw': p.accent, '--sw-hi': p.hi } as React.CSSProperties}
          >
            <i />
            <span>{p.name}</span>
          </button>
        ))}

        <label
          className={`swatch swatch--pick${acento === 'custom' ? ' is-on' : ''}`}
          style={{ '--sw': dePropio.accent, '--sw-hi': dePropio.hi } as React.CSSProperties}
        >
          <i />
          <span>El tuyo</span>
          <input
            type="color"
            value={propio}
            disabled={!esDueno}
            onChange={e => { setPropio(e.target.value); pintar(derivar(e.target.value)); }}
            onBlur={e => elegirAcento('custom', e.target.value)}
            aria-label="Elegir el color de tu marca"
          />
        </label>
      </div>

      <p className="hint">
        Elige el que quieras: del color que pongas se calculan las dos versiones que
        usa la interfaz —una para leerse sobre blanco y otra sobre la placa oscura—
        sin cambiarle el tono. Evita el rojo: aquí significa «sin abonar».
      </p>

      {aviso && (
        <p className="nota" role="status">
          <Icon name="spark" className="ic ic-sm" />
          {aviso}
        </p>
      )}

      <span className="field-label">Fondo</span>
      <div className="bg-picks" role="radiogroup" aria-label="Fondo de la aplicación">
        {FONDOS.map(f => (
          <button
            type="button"
            key={f.id}
            className={`bg-pick${f.id === fondo ? ' is-on' : ''}`}
            onClick={() => elegirFondo(f.id)}
            role="radio"
            aria-checked={f.id === fondo}
            disabled={!esDueno}
          >
            <span
              className={`bg-prev bg-prev--${f.id}`}
              style={
                f.id === 'propio' && tema.fondoUrl
                  ? { backgroundImage: `url("${tema.fondoUrl}")` }
                  : undefined
              }
            />
            <b>{f.name}</b>
            <em>{f.hint}</em>
          </button>
        ))}
      </div>

      {esDueno && (
        <div className="crest-tools">
          <SubirFoto
            complejoId={complejoId}
            tipo="logo"
            id="fondo"
            tieneFoto={!!tema.fondoUrl}
            etiqueta="fondo del complejo"
            variante="bar"
            onGuardar={async (url: string) => {
              // Subir una foto de fondo ya dice qué fondo quiere: elegirla y
              // luego tener que marcar "Tu foto" es un paso de más.
              const r = await guardarTema(slug, { fondo: 'propio', fondoUrl: url });
              if (!r.error) setFondo('propio');
              return r;
            }}
          />
          {tema.fondoUrl && (
            <button
              type="button"
              className="mini"
              onClick={() => arrancar(async () => {
                await guardarTema(slug, { fondo: 'estadio', fondoUrl: '' });
                setFondo('estadio');
                toast('Volvimos a la noche de estadio');
                router.refresh();
              })}
            >
              Quitar la foto
            </button>
          )}
        </div>
      )}

      <p className="hint">
        La vista previa que estás viendo ya es la de verdad: el acento{' '}
        <b style={{ color: vistaPrevia.accent }}>{vistaPrevia.name}</b> está aplicado
        en toda la plataforma.
      </p>
    </>
  );
}
