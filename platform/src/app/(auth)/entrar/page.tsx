import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { miPersona, miDestino } from '@/lib/tenant';
import { EntrarForm } from './EntrarForm';

export const metadata: Metadata = { title: 'Entrar' };

export default async function EntrarPage({
  searchParams
}: {
  searchParams: Promise<{ volver?: string; confirmar?: string }>;
}) {
  // Quien ya tiene sesión no ve un formulario de login: se le manda a lo
  // suyo. Un login que te pide entrar cuando ya estás dentro es un callejón.
  if (await miPersona()) redirect(await miDestino());

  const { volver = '', confirmar } = await searchParams;

  return (
    <div className="ob-panel">
      <header className="ob-head">
        <p className="kicker">Tu complejo</p>
        <h1 className="ob-title">
          Entra a <em>Sportplatz</em>
        </h1>
        <p className="ob-sub">
          El mismo correo abre la puerta que te toca: si administras el complejo
          entras al panel, y si vienes a jugar entras a tus reservas.
        </p>
      </header>

      {confirmar && (
        <p className="nota" role="status">
          Te mandamos un correo para confirmar la cuenta. Ábrelo y vuelve aquí.
        </p>
      )}

      <EntrarForm volver={volver} />
    </div>
  );
}
