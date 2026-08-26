import { redirect } from 'next/navigation';
import { miPersona, miDestino } from '@/lib/tenant';

/* La raíz no es una pantalla: es un desvío. Quien tiene sesión va a lo suyo
   —el panel si administra, sus reservas si juega— y quien no, a entrar. */
export default async function Inicio() {
  if (!(await miPersona())) redirect('/entrar');
  redirect(await miDestino());
}
