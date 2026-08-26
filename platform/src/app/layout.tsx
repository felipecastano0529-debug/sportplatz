import type { Metadata, Viewport } from 'next';
import { Archivo, IBM_Plex_Mono } from 'next/font/google';
import { SpDefs } from '@/components/Ball';
import './globals.css';

/* Archivo trae eje de ancho (wdth 62–125). De una sola familia salen dos
   voces que no se parecen: el titular ancho y muy pesado de gráfico
   deportivo, y el texto de ancho normal. Cargar una segunda familia para eso
   sería peso de más por una jerarquía que ya está dentro de esta.

   `next/font` la autoaloja: sin salto a fonts.googleapis.com y sin el
   parpadeo de texto sin estilo que tenía la demo. */
const archivo = Archivo({
  subsets: ['latin'],
  // Variable en peso Y en ancho: `weight` no se enumera, porque enumerarlo
  // instancia estáticas y se pierde el eje `wdth` — que es de donde salen
  // las dos voces del sistema (DESIGN.md §2).
  axes: ['wdth'],
  display: 'swap',
  variable: '--font-archivo'
});

/* Solo para dato técnico: horas de la agenda y códigos de reserva. */
const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
  variable: '--font-plex-mono'
});

export const metadata: Metadata = {
  title: {
    default: 'Sportplatz',
    template: '%s · Sportplatz'
  },
  description:
    'Reservas, torneos, equipos y Neo AI para complejos deportivos. La agenda que no se contradice y la plata separada entre facturado y cobrado.',
  icons: { icon: '/assets/marca/favicon.png', apple: '/assets/marca/favicon.png' },
  // Se abre casi siempre desde un link de WhatsApp: la tarjeta de vista
  // previa es lo primero que ve el jugador, antes incluso de tocar.
  openGraph: {
    type: 'website',
    siteName: 'Sportplatz',
    title: 'Sportplatz',
    description:
      'Reserva tu cancha en veinte segundos. Torneos, equipos y tu histórico, en un solo sitio.',
    images: ['/assets/fondos/estadio-desktop.jpg'],
    locale: 'es_CO'
  },
  twitter: { card: 'summary_large_image' },
  // Nada de esto debe salir en un buscador: son plataformas privadas de cada
  // complejo, no páginas públicas.
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: 'Sportplatz', statusBarStyle: 'black-translucent' }
};

export const viewport: Viewport = {
  themeColor: '#0a0c0b',
  colorScheme: 'light',
  // `viewport-fit=cover` para que la barra inferior del celular se apoye en
  // el área segura en vez de quedar debajo del gesto de inicio.
  viewportFit: 'cover',
  width: 'device-width',
  initialScale: 1
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${archivo.variable} ${plexMono.variable}`}>
      <body data-theme="momentum">
        <SpDefs />
        {children}
      </body>
    </html>
  );
}
