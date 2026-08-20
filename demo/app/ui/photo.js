/* ==========================================================================
   UI · Fotos
   Las fotos se suben desde la propia app y se guardan comprimidas junto al
   resto del estado. Nadie tiene que abrir el Finder ni renombrar archivos.

   Mientras no haya foto NO se ve un rectángulo gris: se dibuja el campo del
   deporte con el plano de la cancha encima y el balón de fondo. Se lee como
   una decisión, no como un hueco esperando contenido.
   ========================================================================== */

import { $$, esc } from '../core/util.js';
import { courtSVG, ballSVG } from '../core/sports.js';
import { toast } from './modal.js';

export const PHOTO_MAX = 1400, PHOTO_Q = 0.74;

export function readPhoto(file, { max = PHOTO_MAX, q = PHOTO_Q } = {}) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\//.test(file.type)) return reject(new Error('no es una imagen'));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / img.naturalWidth);
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * k);
      c.height = Math.round(img.naturalHeight * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', q));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('no se pudo leer')); };
    img.src = url;
  });
}

/** Bloque visual de cancha: la foto si existe y, si no, el campo dibujado. */
export function mediaBlock(sport, src, { drop = '', label = '' } = {}) {
  const own = !!src && src.startsWith('data:');
  return `<span class="media media--${sport}">
    <span class="media-wash" aria-hidden="true"></span>
    ${courtSVG(sport)}
    <span class="media-ball" aria-hidden="true">${ballSVG(sport)}</span>
    ${src ? `<img class="media-img" src="${esc(src)}" alt="" loading="lazy"
       onload="this.classList.add('ok')" onerror="this.remove()">` : ''}
    ${drop ? `<button type="button" class="media-drop" data-drop="${esc(drop)}"
        title="${own ? 'Cambiar' : 'Subir'} la foto${label ? ' de ' + esc(label) : ''} — o arrástrala aquí">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4m0 0L7 9m5-5l5 5M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></svg>
        <b>${own ? 'Cambiar foto' : 'Subir foto'}</b>
      </button>` : ''}
  </span>`;
}

/* El handler de subida se inyecta desde fuera para no atar este módulo al
   estado ni al render: photo.js sabe leer una imagen, no dónde guardarla. */
let onPhoto = async () => {};
export const setPhotoHandler = (fn) => { onPhoto = fn; };

export function wireDrops(root) {
  $$('[data-drop]', root).forEach(zone => {
    const key = zone.dataset.drop;
    const pick = (e) => {
      e.preventDefault(); e.stopPropagation();
      const inp = document.createElement('input');
      inp.type = 'file'; inp.accept = 'image/*';
      inp.addEventListener('change', () => inp.files[0] && onPhoto(key, inp.files[0]));
      inp.click();
    };
    zone.addEventListener('click', pick);
    ['dragenter', 'dragover'].forEach(t => zone.addEventListener(t, e => {
      e.preventDefault(); e.stopPropagation(); zone.classList.add('is-over');
    }));
    ['dragleave', 'dragend'].forEach(t => zone.addEventListener(t, () => zone.classList.remove('is-over')));
    zone.addEventListener('drop', e => {
      e.preventDefault(); e.stopPropagation(); zone.classList.remove('is-over');
      const f = e.dataTransfer.files[0];
      f ? onPhoto(key, f) : toast('Suelta un archivo de imagen', 'warn');
    });
  });
}
