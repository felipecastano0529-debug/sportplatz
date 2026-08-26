import Link from 'next/link';
import Image from 'next/image';
import { Backdrop } from '@/components/Backdrop';

/* ==========================================================================
   404

   Sale también cuando alguien pide un complejo que existe pero no es suyo
   (§7.2): «existe pero no es tuyo» ya es información, así que las dos cosas
   contestan lo mismo.
   ========================================================================== */

export default function NoEncontrado() {
  return (
    <>
      <Backdrop />
      <div className="ob">
        <aside className="ob-rail">
          <Link href="/" className="ob-brand">
            <Image className="logo" src="/assets/marca/logo.png" alt="" width={256} height={256} />
            Sportplatz
          </Link>
        </aside>

        <main className="ob-stage">
          <div className="ob-panel">
            <header className="ob-head">
              <p className="kicker">404</p>
              <h1 className="ob-title">Por aquí no hay <em>nada</em></h1>
              <p className="ob-sub">
                Esa dirección no existe, o es de un complejo al que no perteneces.
                Si te mandaron un link, pídelo otra vez: puede estar cortado.
              </p>
            </header>

            <div className="ob-actions">
              <Link className="btn btn-primary" href="/">Ir a lo mío</Link>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
