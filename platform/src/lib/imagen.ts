/* ==========================================================================
   Fotos

   Las fotos se suben desde la propia app: nadie tiene que abrir el Finder ni
   redimensionar nada. Se comprimen EN EL NAVEGADOR antes de salir, por dos
   razones que no son la misma:

     · una foto de celular son 4–8 MB y la de una cancha se ve a 1400 px de
       ancho como mucho — subir el original es pagar ancho de banda del
       cliente para tirarlo;
     · el bucket tiene tope de 8 MB, y una foto moderna lo pasa.

   Mientras no haya foto NO se ve un rectángulo gris: se dibuja el campo del
   deporte con el plano encima. Se lee como una decisión, no como un hueco.
   ========================================================================== */

export const FOTO_MAX = 1600;
export const FOTO_CALIDAD = 0.78;

export interface FotoLista {
  blob: Blob;
  extension: string;
  tipo: string;
  ancho: number;
  alto: number;
}

/**
 * Lee un archivo, lo escala al ancho máximo y lo devuelve como WebP.
 *
 * WebP y no JPEG: a 1600 px la misma foto pesa cerca de un tercio menos, y
 * lo entiende todo lo que puede correr esta aplicación. El respaldo a JPEG
 * está por si el `toBlob` devuelve nulo, que es lo que hace Safari viejo con
 * un tipo que no soporta.
 */
export async function prepararFoto(
  file: File,
  { max = FOTO_MAX, calidad = FOTO_CALIDAD } = {}
): Promise<FotoLista> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Ese archivo no es una imagen.');
  }

  const bitmap = await crearBitmap(file);
  const k = Math.min(1, max / bitmap.width);
  const ancho = Math.round(bitmap.width * k);
  const alto = Math.round(bitmap.height * k);

  const lienzo = document.createElement('canvas');
  lienzo.width = ancho;
  lienzo.height = alto;

  const ctx = lienzo.getContext('2d');
  if (!ctx) throw new Error('El navegador no pudo procesar la imagen.');
  ctx.drawImage(bitmap, 0, 0, ancho, alto);
  if ('close' in bitmap) bitmap.close();

  const webp = await aBlob(lienzo, 'image/webp', calidad);
  if (webp) return { blob: webp, extension: 'webp', tipo: 'image/webp', ancho, alto };

  const jpeg = await aBlob(lienzo, 'image/jpeg', calidad);
  if (jpeg) return { blob: jpeg, extension: 'jpg', tipo: 'image/jpeg', ancho, alto };

  throw new Error('No se pudo convertir la imagen.');
}

function aBlob(lienzo: HTMLCanvasElement, tipo: string, calidad: number): Promise<Blob | null> {
  return new Promise(resolver => lienzo.toBlob(resolver, tipo, calidad));
}

async function crearBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) {
    try { return await createImageBitmap(file); } catch { /* al respaldo */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((ok, mal) => {
      img.onload = () => ok();
      img.onerror = () => mal(new Error('No se pudo leer la imagen.'));
      img.src = url;
    });
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * La ruta dentro del bucket. La SEGUNDA carpeta es el complejo, y de eso
 * depende la política de Storage: nadie puede escribir en la carpeta de otro
 * negocio. Cambiar este formato sin cambiar la política abre el bucket.
 */
export function rutaFoto(complejoId: string, tipo: 'logo' | 'cancha' | 'escudo' | 'avatar', id: string, ext: string) {
  // Marca de tiempo en el nombre: reemplazar una foto con el mismo nombre la
  // deja en caché y el dueño ve la vieja (trampa 6 del documento maestro).
  return `complejos/${complejoId}/${tipo}/${id}-${Date.now()}.${ext}`;
}
