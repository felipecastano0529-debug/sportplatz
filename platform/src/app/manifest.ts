import type { MetadataRoute } from 'next';

/* ==========================================================================
   El manifiesto

   El jugador abre esto desde un link de WhatsApp, en el celular. Con el
   manifiesto puede dejarlo en su pantalla de inicio y usarlo como una app:
   sin barra del navegador, con el color de la marca en la barra de estado.

   No hay service worker a propósito. Una agenda que sirve datos viejos desde
   una caché es peor que una agenda que no carga: aquí lo que importa es que
   la hora que se ve sea la hora que hay.
   ========================================================================== */

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Sportplatz',
    short_name: 'Sportplatz',
    description: 'Reservas, torneos y equipos de tu complejo deportivo.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0a0c0b',
    theme_color: '#0a0c0b',
    lang: 'es',
    orientation: 'portrait',
    icons: [
      { src: '/assets/marca/favicon.png', sizes: '512x512', type: 'image/png', purpose: 'any' }
    ]
  };
}
