'use client';

import { useFormStatus } from 'react-dom';
import { salir } from '@/lib/actions/auth';
import { Icon } from '@/components/Icon';

/* Salir es una acción de servidor: hay que borrar la cookie de sesión, y eso
   no se puede hacer desde el navegador. El formulario es la forma correcta
   de dispararla — funciona incluso si JavaScript no llegó. */
function Boton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-secondary btn-sm" disabled={pending}>
      {pending
        ? <><span className="spin" />Saliendo…</>
        : <><Icon name="logout" />Cerrar sesión</>}
    </button>
  );
}

export function SalirDeLaCuenta() {
  return (
    <form action={salir}>
      <Boton />
    </form>
  );
}
