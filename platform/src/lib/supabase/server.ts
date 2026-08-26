import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/* ==========================================================================
   Supabase · cliente de servidor

   El que usan Server Components, Server Actions y rutas de API. Lee la
   sesión de las cookies y, con ella, TODA consulta pasa por RLS. Es la
   diferencia entre "el dueño ve su agenda" y "cualquiera ve la de todos".

   Regla que no se rompe (§7.2.4): la clave `service_role` no aparece aquí ni
   en nada que pueda llegar al navegador. Salta RLS por completo y vive solo
   en webhooks, cron y migraciones.
   ========================================================================== */

export async function supabaseServer() {
  const store = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll(cookies) {
          try {
            cookies.forEach(({ name, value, options }) => store.set(name, value, options));
          } catch {
            /* Un Server Component no puede escribir cookies. No es un error:
               el refresco de sesión ya lo hizo el middleware antes de llegar
               aquí, y tragárselo es lo correcto. */
          }
        }
      }
    }
  );
}

/** La sesión, o `null`. No lanza: quien llama decide si redirige. */
export async function usuarioActual() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  return user ?? null;
}
