import Image from 'next/image';
import Link from 'next/link';
import { Backdrop } from '@/components/Backdrop';

/* ==========================================================================
   La escena de entrada

   Es la misma piel del onboarding de la demo: rail de metal negro a la
   izquierda con la marca y la promesa, escenario a la derecha con el
   formulario. No se inventa una pantalla de login aparte porque no hace
   falta: quien entra ya está dentro del mundo del producto.
   ========================================================================== */

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Backdrop />
      <div className="ob">
        <aside className="ob-rail">
          <Link href="/" className="ob-brand">
            <Image
              className="logo"
              src="/assets/marca/logo.png"
              alt=""
              width={256}
              height={256}
              priority
            />
            Sportplatz
          </Link>

          {/* Tres frases, no una lista de funciones: lo que cambia en el
            negocio el lunes por la mañana. */}
          <ul className="ob-steps" aria-hidden="true">
            <li className="ob-step is-now">
              <span className="ob-step-n">
                <span>1</span>
              </span>
              <span className="ob-step-t">Una agenda que no se contradice</span>
            </li>
            <li className="ob-step is-now">
              <span className="ob-step-n">
                <span>2</span>
              </span>
              <span className="ob-step-t">
                Lo facturado y lo cobrado, separados
              </span>
            </li>
            <li className="ob-step is-now">
              <span className="ob-step-n">
                <span>3</span>
              </span>
              <span className="ob-step-t">Neo atiende mientras tú juegas</span>
            </li>
          </ul>

          <p className="ob-foot">
            Lo que el jugador hace, el dueño lo ve al instante.
          </p>
        </aside>

        <main className="ob-stage">{children}</main>
      </div>
    </>
  );
}
