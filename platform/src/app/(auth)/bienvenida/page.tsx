import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { miPersona, misComplejos } from '@/lib/tenant';
import { Onboarding } from './Onboarding';

export const metadata: Metadata = { title: 'Empezar' };

export default async function BienvenidaPage() {
  const persona = await miPersona();
  if (!persona) redirect('/entrar');

  // Si ya pertenece a algún complejo, esta pantalla no tiene nada que
  // preguntarle: se va a lo suyo.
  const mios = await misComplejos();
  if (mios.length) {
    const staff = mios.find(m => m.rol === 'dueno' || m.rol === 'operador');
    redirect(staff ? `/${staff.complejos.slug}/panel` : `/${mios[0].complejos.slug}/j/inicio`);
  }

  return <Onboarding nombrePersona={persona.nombre} />;
}
