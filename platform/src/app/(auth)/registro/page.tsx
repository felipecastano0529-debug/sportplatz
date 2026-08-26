import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { miPersona, miDestino } from '@/lib/tenant';
import { RegistroForm } from './RegistroForm';

export const metadata: Metadata = { title: 'Crear cuenta' };

export default async function RegistroPage() {
  if (await miPersona()) redirect(await miDestino());

  return (
    <div className="ob-panel">
      <header className="ob-head">
        <p className="kicker">Empezar</p>
        <h1 className="ob-title">
          Crea tu <em>cuenta</em>
        </h1>
        <p className="ob-sub">
          Una sola cuenta para las dos cosas. En el paso siguiente eliges si
          administras un complejo o si vienes a reservar y jugar.
        </p>
      </header>

      <RegistroForm />
    </div>
  );
}
