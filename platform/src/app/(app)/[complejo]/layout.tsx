import { Suspense } from 'react';
import type { Metadata } from 'next';
import { resolverTenant } from '@/lib/tenant';
import { canchasDe } from '@/lib/queries/canchas';
import { NavRail } from '@/components/app/NavRail';
import { ViewChrome } from '@/components/app/ViewChrome';
import { Backdrop } from '@/components/Backdrop';
import { Toaster } from '@/components/ui/Toast';
import { Icon } from '@/components/Icon';
import { aplicarTema, modoFondo } from '@/lib/tema';
import type { SportId } from '@/lib/sports';

export async function generateMetadata(
  { params }: { params: Promise<{ complejo: string }> }
): Promise<Metadata> {
  const { complejo } = await params;
  const { complejo: c } = await resolverTenant(complejo);
  // El nombre del negocio en la pestaña, no el nuestro: la plataforma es
  // suya y lleva su nombre (§1.4).
  return { title: { default: c.nombre, template: `%s · ${c.nombre}` } };
}

export default async function ComplejoLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ complejo: string }>;
}) {
  const { complejo: slug } = await params;
  const s = await resolverTenant(slug);
  const canchas = await canchasDe(s.complejo.id);

  const deportes = [...new Set(canchas.map(c => c.deporte))] as SportId[];
  const fotos: Partial<Record<SportId, string>> = {};
  for (const c of canchas) {
    if (c.foto_url && !fotos[c.deporte]) fotos[c.deporte] = c.foto_url;
  }

  return (
    <>
      {/* El acento del negocio, inyectado antes de pintar. Va como estilo y
          no como clase porque es un valor libre: el dueño elige el color en
          Ajustes y de él cuelgan rellenos, focos y tintes por token. */}
      <style dangerouslySetInnerHTML={{ __html: aplicarTema(s.complejo.tema) }} />

      <Backdrop sports={deportes} />
      <a className="skip" href="#main">Saltar al contenido</a>

      <div className="shell">
        <NavRail
          slug={slug}
          rol={s.rol}
          nombreComplejo={s.complejo.nombre}
          logoUrl={s.complejo.logo_url}
          nombrePersona={s.persona.nombre}
          avatarUrl={s.persona.avatar_url}
          email={s.persona.email}
        />

        {/* `useSearchParams` obliga a un límite de suspenso, y aquí es el
            correcto: el fondo puede llegar un instante después del rail sin
            que se note, porque debajo ya está el color de la banda. */}
        <Suspense fallback={<div className="view-bg is-stadium" aria-hidden="true" />}>
          <ViewChrome
            slug={slug}
            rol={s.rol}
            fondo={modoFondo(s.complejo.tema)}
            fotosCancha={fotos}
          />
        </Suspense>

        <main className="main" id="main" tabIndex={-1}>
          {s.soloLectura && (
            <p className="solo-lectura" role="status">
              <Icon name="clock" className="ic ic-sm" />
              Tu plan venció. Puedes consultarlo todo, pero no crear ni cobrar
              hasta que se renueve. No se ha borrado nada.
            </p>
          )}
          <div className="main-inner">{children}</div>
        </main>
      </div>

      <Toaster />
    </>
  );
}
