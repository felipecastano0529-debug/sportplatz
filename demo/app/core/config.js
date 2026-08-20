/* ==========================================================================
   Configuración de la nube

   Estas dos cadenas NO son un secreto y por eso están en el repo. La clave
   `anon` viaja al navegador de cualquier visitante — es su propósito. Lo que
   separa los datos de un negocio de los de otro no es esconder esta clave,
   son las políticas de seguridad por fila (RLS) que están en
   `supabase/migrations/0001_espacios.sql`.

   La clave que SÍ es un secreto es la `service_role`, y no aparece por ningún
   lado en este proyecto ni debe hacerlo: salta RLS por completo.

   Si estos campos están vacíos, la app funciona igual en modo demo, guardando
   en el navegador. Es a propósito: nunca se rompe por falta de configuración.
   ========================================================================== */

export const SUPABASE_URL  = '';
export const SUPABASE_ANON = '';

export const nubeConfigurada = () =>
  SUPABASE_URL.startsWith('https://') && SUPABASE_ANON.length > 40;
