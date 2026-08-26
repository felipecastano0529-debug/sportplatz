'use client';

import { useEffect } from 'react';
import { Icon } from '@/components/Icon';

/* ==========================================================================
   Cuando algo se rompe

   Se dice QUÉ pasó y se ofrece reintentar, que casi siempre basta: la mayor
   parte de los fallos aquí son de red y se arreglan solos al segundo
   intento. Lo que no se hace es tragárselo y dejar la pantalla en blanco.
   ========================================================================== */

export default function Error({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Al servidor, para poder mirarlo después. El `digest` es lo que enlaza
    // este fallo con el registro de Vercel.
    console.error('[sportplatz]', error.digest ?? '', error.message);
  }, [error]);

  return (
    <div className="ob-panel" style={{ margin: 'auto', padding: 'var(--s7)' }}>
      <header className="ob-head">
        <p className="kicker">Algo se rompió</p>
        <h1 className="ob-title">No pudimos <em>cargar</em> esto</h1>
        <p className="ob-sub">
          Suele ser la conexión. Vuelve a intentarlo; si sigue igual, avísanos
          con este código.
        </p>
      </header>

      {error.digest && (
        <p className="nota">
          <Icon name="spark" className="ic ic-sm" />
          Código del fallo: <b className="mono">{error.digest}</b>
        </p>
      )}

      <div className="ob-actions">
        <button className="btn btn-primary" onClick={reset}>Volver a intentar</button>
      </div>
    </div>
  );
}
