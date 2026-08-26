import type { Metadata } from 'next';
import { resolverTenant } from '@/lib/tenant';
import { abrirConversacion } from '@/lib/actions/neo';
import { PageHead } from '@/components/app/PageHead';
import { Chat } from '@/components/app/neo/Chat';

export const metadata: Metadata = { title: 'Neo AI' };

/* ==========================================================================
   JUGADOR · Neo AI

   El mismo asistente que atiende por WhatsApp, dentro de la app. Lee la
   agenda real y escribe en ella: la reserva que sale de esta conversación es
   el mismo registro que crea el mostrador (R43).
   ========================================================================== */

export default async function NeoJugadorPage({
  params
}: {
  params: Promise<{ complejo: string }>;
}) {
  const { complejo: slug } = await params;
  const s = await resolverTenant(slug);
  const inicial = await abrirConversacion(slug);

  return (
    <>
      <PageHead
        kicker="Asistente"
        title="Neo AI"
        sub="Dile qué quieres jugar y cuándo. Mira la agenda y te la aparta."
      />

      <Chat
        slug={slug}
        negocio={s.complejo.nombre}
        logoUrl={s.complejo.logo_url}
        inicial={inicial}
      />
    </>
  );
}
