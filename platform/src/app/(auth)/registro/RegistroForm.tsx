'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { registrar, type EstadoAuth } from '@/lib/actions/auth';

function Enviar() {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-primary" type="submit" disabled={pending}>
      {pending ? <><span className="spin" />Creando…</> : 'Crear cuenta'}
    </button>
  );
}

export function RegistroForm() {
  const [estado, accion] = useActionState<EstadoAuth, FormData>(registrar, {});

  return (
    <form action={accion} noValidate>
      <div className="form-grid">
        <label className="field field-full">
          <span className="field-label">Tu nombre</span>
          <input
            className="input"
            name="nombre"
            type="text"
            autoComplete="name"
            placeholder="Juan Restrepo"
            autoFocus
            required
          />
        </label>

        <label className="field field-full">
          <span className="field-label">Correo</span>
          <input
            className="input"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="tu@correo.com"
            required
          />
        </label>

        <label className="field field-full">
          <span className="field-label">Contraseña</span>
          <input
            className="input"
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="Mínimo 6 caracteres"
            minLength={6}
            required
          />
        </label>

        {/* El teléfono no es un campo de formulario cualquiera: es la llave
            que une a esta persona con las reservas que el mostrador ya creó
            a su nombre (§7.1). Por eso se pide aquí y se explica. */}
        <label className="field field-full">
          <span className="field-label">WhatsApp <em>opcional</em></span>
          <input
            className="input"
            name="telefono"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="300 123 4567"
          />
        </label>
      </div>

      <p className="ob-aviso">
        Si el complejo ya te tiene apuntado con ese número, tus reservas
        anteriores aparecen solas en tu histórico.
      </p>

      {estado.error && <p className="auth-error" role="alert">{estado.error}</p>}

      <div className="ob-actions auth-actions">
        <Enviar />
        <Link className="mini" href="/entrar">Ya tengo cuenta</Link>
      </div>
    </form>
  );
}
