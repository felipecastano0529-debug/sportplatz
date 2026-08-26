import type { SportId } from './sports';

/* ==========================================================================
   Las formas que devuelve la base

   Escritas a mano contra `supabase/migrations/0001_plataforma.sql` y en
   snake_case porque es lo que devuelve Postgres: renombrar en el borde
   obligaría a mapear cada consulta y a mantener dos vocabularios.

   Lo que sí se traduce es lo derivado: `saldo`, `estadoPago`, `codigo`. Eso
   no vive en la base — se calcula al leer (R11, R21, R31).
   ========================================================================== */

export type Rol = 'dueno' | 'operador' | 'jugador';
export type Origen = 'mostrador' | 'app' | 'neo' | 'bot';
export type EstadoReserva = 'confirmada' | 'jugada' | 'cancelada' | 'no_show';
export type MedioPago = 'efectivo' | 'transferencia' | 'pasarela' | 'cortesia';
export type Plan = 'trial' | 'activo' | 'vencido' | 'solo_lectura';

/**
 * El acento y el fondo que el dueño elige en Ajustes. Es piel, no negocio:
 * nada lo consulta ni lo agrega, por eso vive en un `jsonb` y no en columnas.
 *
 * `accent` guarda el ID de la paleta ('esmeralda') o el literal 'custom'; en
 * ese caso el color va en `custom`. Se guarda lo que ELIGIÓ, no lo derivado:
 * las cuatro variables se recalculan al leer, así que afinar la derivación
 * arregla los temas ya guardados en vez de dejarlos con el cálculo viejo.
 */
export interface Tema {
  accent?: string;
  custom?: string;
  fondo?: 'estadio' | 'sobrio' | 'propio';
  fondoUrl?: string;
}

export interface Complejo {
  id: string;
  slug: string;
  nombre: string;
  whatsapp: string | null;
  logo_url: string | null;
  hora_abre: number;
  hora_cierra: number;
  moneda: string;
  zona_horaria: string;
  tema: Tema;
  plan: Plan;
  creado_en: string;
}

export interface Persona {
  id: string;
  nombre: string;
  telefono: string | null;
  email: string | null;
  avatar_url: string | null;
  color: string;
  creado_en: string;
}

export interface Cancha {
  id: string;
  complejo_id: string;
  deporte: SportId;
  numero: number;
  nombre: string;
  precio: number;
  foto_url: string | null;
  activa: boolean;
  orden: number;
}

export interface Reserva {
  id: string;
  complejo_id: string;
  cancha_id: string;
  fecha: string;          // 'YYYY-MM-DD'
  inicio: string;         // '18:00:00' tal como lo devuelve Postgres
  fin: string;
  persona_id: string | null;
  cliente: string;
  telefono: string | null;
  total: number;
  abonado: number;
  origen: Origen;
  estado: EstadoReserva;
  nota: string;
  codigo: string;         // generado: 'SP-3F9A' (R48)
  cancelada_en: string | null;
  cancelada_por: string | null;
  creado_en: string;
}

export interface Pago {
  id: string;
  complejo_id: string;
  reserva_id: string;
  monto: number;
  medio: MedioPago;
  referencia: string | null;
  registrado_por: string | null;
  creado_en: string;
}

export interface Equipo {
  id: string;
  complejo_id: string;
  nombre: string;
  deporte: SportId;
  color: string;
  escudo_url: string | null;
  capitan_id: string | null;
  creado_en: string;
}

/* ── Derivados ─────────────────────────────────────────────────────────── */

/** El semáforo de la agenda (R21). El color NUNCA va solo: lleva etiqueta. */
export type EstadoPago = 'pagada' | 'adelanto' | 'sin_abonar';

export function estadoPago(r: Pick<Reserva, 'total' | 'abonado'>): EstadoPago {
  if (r.abonado >= r.total) return 'pagada';   // R11: saldo cero es pagada
  if (r.abonado > 0) return 'adelanto';
  return 'sin_abonar';
}

export const ETIQUETA_PAGO: Record<EstadoPago, string> = {
  pagada: 'Pagada',
  adelanto: 'Con adelanto',
  sin_abonar: 'Sin abonar'
};

/** R11. */
export const saldo = (r: Pick<Reserva, 'total' | 'abonado'>) =>
  Math.max(0, r.total - r.abonado);

export const ETIQUETA_ORIGEN: Record<Origen, string> = {
  mostrador: 'Mostrador',
  app: 'App',
  neo: 'Neo AI',
  bot: 'WhatsApp'
};
