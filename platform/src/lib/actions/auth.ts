'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';
import { miDestino } from '@/lib/tenant';
import { telE164 } from '@/lib/util';

/* ==========================================================================
   Cuentas

   Correo y contraseña para las dos puertas. El documento maestro proponía
   OTP por teléfono para el jugador (§7.1) y sigue siendo lo correcto el día
   que haya WhatsApp Business; hasta entonces el jugador entra con correo,
   que es lo que se pidió y lo que se puede sostener hoy sin depender de un
   proveedor de mensajería.

   El rol NO se elige en el formulario: sale de `membresias`. Un correo que
   es dueño entra al panel; un correo que es jugador entra a su inicio. Por
   eso el mismo formulario sirve para los dos y no hay pestañas.
   ========================================================================== */

export interface EstadoAuth {
  error?: string;
}

const CORREO = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;

/** Traduce el error de Supabase a algo que se pueda leer sin saber inglés. */
function enCristiano(mensaje: string): string {
  const m = mensaje.toLowerCase();
  if (m.includes('invalid login credentials')) return 'Ese correo y esa contraseña no coinciden.';
  if (m.includes('email not confirmed')) return 'Confirma tu correo antes de entrar. Te mandamos un enlace.';
  if (m.includes('already registered') || m.includes('already been registered'))
    return 'Ese correo ya tiene cuenta. Entra en vez de crearla.';
  if (m.includes('rate limit') || m.includes('too many'))
    return 'Demasiados intentos seguidos. Espera un minuto.';
  if (m.includes('password')) return 'La contraseña necesita al menos 6 caracteres.';
  return 'No se pudo completar. Inténtalo otra vez.';
}

export async function entrar(_prev: EstadoAuth, form: FormData): Promise<EstadoAuth> {
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  const password = String(form.get('password') ?? '');
  const volver = String(form.get('volver') ?? '');

  if (!CORREO.test(email)) return { error: 'Escribe un correo válido.' };
  if (!password) return { error: 'Escribe tu contraseña.' };

  const sb = await supabaseServer();
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) return { error: enCristiano(error.message) };

  revalidatePath('/', 'layout');
  // `volver` solo puede ser una ruta de esta app: un destino absoluto
  // convertiría el login en un trampolín a cualquier sitio.
  const destino = volver.startsWith('/') && !volver.startsWith('//')
    ? volver
    : await miDestino();
  redirect(destino);
}

export async function registrar(_prev: EstadoAuth, form: FormData): Promise<EstadoAuth> {
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  const password = String(form.get('password') ?? '');
  const nombre = String(form.get('nombre') ?? '').trim();
  const telefono = String(form.get('telefono') ?? '').trim();

  if (!nombre) return { error: 'Dinos cómo te llamas.' };
  if (!CORREO.test(email)) return { error: 'Escribe un correo válido.' };
  if (password.length < 6) return { error: 'La contraseña necesita al menos 6 caracteres.' };

  const sb = await supabaseServer();
  const { data, error } = await sb.auth.signUp({
    email,
    password,
    // El trigger `persona_al_registrarse` lee esto para dejar la fila de
    // `personas` completa desde el primer segundo.
    options: { data: { nombre, telefono: telE164(telefono) ?? '' } }
  });

  if (error) return { error: enCristiano(error.message) };

  // Con confirmación de correo activada no hay sesión todavía. Decirlo, en
  // vez de mandarlo a una pantalla que le va a pedir entrar otra vez.
  if (!data.session) {
    redirect('/entrar?confirmar=1');
  }

  revalidatePath('/', 'layout');
  redirect('/bienvenida');
}

export async function salir() {
  const sb = await supabaseServer();
  await sb.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/entrar');
}
