import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/* ==========================================================================
   Routing Middleware · refresco de sesión y portero

   Hace dos cosas, y ninguna de las dos es autorización de verdad:

     1. Refresca el token de Supabase antes de que la página lo use. Sin
        esto, un Server Component recibe una sesión caducada y el usuario
        "se desloguea solo" cada hora.

     2. Manda a `/entrar` a quien no tiene sesión. Es comodidad, no
        seguridad: quien de verdad separa los datos es RLS en la base. Si
        este archivo desapareciera, nadie vería una fila de más.

   `getUser()` va antes que cualquier otra cosa, y entre él y el `return` no
   se mete nada: es lo que obliga a que la cookie viaje ya renovada.
   ========================================================================== */

const PUBLICAS = [
  '/entrar', '/registro', '/auth', '/api',
  // El manifiesto lo pide el navegador ANTES de que haya sesión, cuando el
  // jugador guarda la app en su pantalla de inicio. Redirigirlo a /entrar lo
  // deja sin nombre y sin icono.
  '/manifest.webmanifest'
];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookies) {
          cookies.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookies.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options));
        }
      }
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const ruta = request.nextUrl.pathname;
  const publica = ruta === '/' || PUBLICAS.some(p => ruta.startsWith(p));

  if (!user && !publica) {
    const url = request.nextUrl.clone();
    url.pathname = '/entrar';
    // Para devolverlo a donde iba en cuanto entre.
    url.searchParams.set('volver', ruta);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /* Todo menos los archivos estáticos y las imágenes: pedirle la sesión a
       Supabase para servir un .webp es una llamada de red por cada foto. */
    '/((?!_next/static|_next/image|assets|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|avif|gif|mp4|ico)$).*)'
  ]
};
