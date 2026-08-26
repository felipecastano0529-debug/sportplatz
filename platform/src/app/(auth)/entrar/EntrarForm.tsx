'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { entrar, type EstadoAuth } from '@/lib/actions/auth';

/* El botón sabe solo si el envío está en vuelo. Se separa del formulario
   porque `useFormStatus` lee el `<form>` padre: dentro del mismo componente
   siempre devolvería `pending: false`. */
function Enviar() {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-primary" type="submit" disabled={pending}>
      {pending ? <><span className="spin" />Entrando…</> : 'Entrar'}
    </button>
  );
}

export function EntrarForm({ volver }: { volver: string }) {
  const [estado, accion] = useActionState<EstadoAuth, FormData>(entrar, {});

  return (
    <form action={accion} noValidate>
      <input type="hidden" name="volver" value={volver} />

      <div className="form-grid">
        <label className="field field-full">
          <span className="field-label">Correo</span>
          <input
            className="input"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="tu@correo.com"
            autoFocus
            required
          />
        </label>

        <label className="field field-full">
          <span className="field-label">Contraseña</span>
          <input
            className="input"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="Tu contraseña"
            required
          />
        </label>
      </div>

      {/* `role="alert"` y no un `hidden` que se quita: el error tiene que
          anunciarse solo, o quien usa lector de pantalla no se entera de
          que el envío falló. */}
      {estado.error && (
        <p className="auth-error" role="alert">{estado.error}</p>
      )}

      <div className="ob-actions auth-actions">
        <Enviar />
        <Link className="mini" href="/registro">Crear una cuenta</Link>
      </div>
    </form>
  );
}
