'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { prepararFoto, rutaFoto } from '@/lib/imagen';
import { toast } from '@/components/ui/Toast';
import { Icon } from '@/components/Icon';

/* ==========================================================================
   Subir una foto

   Pastilla de vidrio, discreta hasta que se acerca el puntero. Acepta clic y
   también que se suelte el archivo encima, porque arrastrar una foto desde
   el escritorio es lo que la mano quiere hacer.

   El archivo NO pasa por el servidor de Next: se comprime aquí y va directo
   al bucket con la clave pública. Quién puede escribir en qué carpeta lo
   decide la política de Storage, no este componente — y por eso da igual que
   este código viva en el navegador.
   ========================================================================== */

export function SubirFoto({
  complejoId,
  tipo,
  id,
  tieneFoto,
  etiqueta,
  variante = 'media',
  onGuardar
}: {
  complejoId: string;
  tipo: 'logo' | 'cancha' | 'escudo' | 'avatar';
  /** Qué se está fotografiando: la cancha, el negocio, el equipo. */
  id: string;
  tieneFoto: boolean;
  etiqueta: string;
  /** `media` es la pastilla sobre la foto; `bar` es el botón de la barra. */
  variante?: 'media' | 'bar';
  /** Guarda la URL donde corresponda. Es una Server Action. */
  onGuardar: (url: string) => Promise<{ error?: string }>;
}) {
  const router = useRouter();
  const entrada = useRef<HTMLInputElement>(null);
  const [encima, setEncima] = useState(false);
  const [subiendo, arrancar] = useTransition();

  const procesar = (file?: File | null) => {
    if (!file) return;
    arrancar(async () => {
      try {
        const foto = await prepararFoto(file);
        const ruta = rutaFoto(complejoId, tipo, id, foto.extension);

        const sb = supabaseBrowser();
        const { error } = await sb.storage
          .from('publico')
          .upload(ruta, foto.blob, { contentType: foto.tipo, upsert: false });

        if (error) throw new Error(error.message);

        const { data } = sb.storage.from('publico').getPublicUrl(ruta);
        const r = await onGuardar(data.publicUrl);
        if (r.error) throw new Error(r.error);

        toast(`Foto de ${etiqueta} actualizada`);
        router.refresh();
      } catch (e) {
        toast(e instanceof Error ? e.message : 'No se pudo subir la foto', 'warn');
      }
    });
  };

  const clase = variante === 'bar' ? 'bar-drop' : 'media-drop';

  return (
    <>
      <button
        type="button"
        className={`${clase}${encima ? ' is-over' : ''}`}
        title={`${tieneFoto ? 'Cambiar' : 'Subir'} la foto de ${etiqueta} — o arrástrala aquí`}
        onClick={() => entrada.current?.click()}
        onDragEnter={e => { e.preventDefault(); setEncima(true); }}
        onDragOver={e => { e.preventDefault(); setEncima(true); }}
        onDragLeave={() => setEncima(false)}
        onDrop={e => {
          e.preventDefault();
          setEncima(false);
          const f = e.dataTransfer.files[0];
          if (f) procesar(f);
          else toast('Suelta un archivo de imagen', 'warn');
        }}
        disabled={subiendo}
      >
        {subiendo
          ? <><span className="spin" /><b>Subiendo…</b></>
          : <><Icon name="upload" /><b>{tieneFoto ? 'Cambiar foto' : 'Subir foto'}</b></>}
      </button>

      <input
        ref={entrada}
        type="file"
        accept="image/*"
        hidden
        onChange={e => { procesar(e.target.files?.[0]); e.target.value = ''; }}
      />
    </>
  );
}
