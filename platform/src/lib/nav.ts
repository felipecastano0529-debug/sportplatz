import type { IconName } from '@/components/Icon';
import type { Rol } from './types';

/* ==========================================================================
   La navegación

   Dos productos distintos sobre el mismo estado (§2). El dueño ve plata y
   ocupación; el jugador ve su próximo partido. Cambia la navegación entera,
   no los datos que se ocultan — por eso son dos listas y no una lista con
   permisos.
   ========================================================================== */

export interface Destino {
  id: string;
  /** El trozo de ruta bajo `/[complejo]`. */
  href: string;
  label: string;
  hint: string;
  icon: IconName;
  /** ¿Cabe en la barra inferior del celular? */
  tab?: boolean;
  /** Solo el dueño: el operador atiende el mostrador, no toca el negocio. */
  soloDueno?: boolean;
}

export const NAV_DUENO: Destino[] = [
  { id: 'panel',    href: 'panel',    label: 'Panel',    hint: 'Cuánto entra',       icon: 'panel',    tab: true, soloDueno: true },
  { id: 'canchas',  href: 'canchas',  label: 'Canchas',  hint: 'Precios y estado',   icon: 'canchas',  tab: true },
  { id: 'reservas', href: 'reservas', label: 'Reservas', hint: 'Agenda por hora',    icon: 'reservas', tab: true },
  { id: 'torneos',  href: 'torneos',  label: 'Torneos',  hint: 'Llaves y tablas',    icon: 'torneos' },
  { id: 'equipos',  href: 'equipos',  label: 'Equipos',  hint: 'Clubes y jugadores', icon: 'users' },
  { id: 'neo',      href: 'neo',      label: 'Neo AI',   hint: 'WhatsApp',           icon: 'bot',      tab: true },
  { id: 'ajustes',  href: 'ajustes',  label: 'Ajustes',  hint: 'Tu negocio',         icon: 'ajustes',  soloDueno: true }
];

export const NAV_JUGADOR: Destino[] = [
  { id: 'inicio',    href: 'j/inicio',    label: 'Inicio',       hint: 'Tu próximo partido', icon: 'home',     tab: true },
  { id: 'reservar',  href: 'j/reservar',  label: 'Reservar',     hint: 'Cancha y hora',      icon: 'reservas', tab: true },
  { id: 'equipo',    href: 'j/equipo',    label: 'Mi equipo',    hint: 'Plantilla y escudo', icon: 'shield',   tab: true },
  { id: 'torneos',   href: 'j/torneos',   label: 'Torneos',      hint: 'Inscríbete',         icon: 'torneos' },
  { id: 'historial', href: 'j/historial', label: 'Mi histórico', hint: 'Partidos y números', icon: 'history' },
  { id: 'neo',       href: 'j/neo',       label: 'Neo AI',       hint: 'Pídela hablando',    icon: 'bot',      tab: true }
];

export function navDe(rol: Rol): Destino[] {
  if (rol === 'jugador') return NAV_JUGADOR;
  // El operador ve la agenda, no el Panel financiero ni los Ajustes (§7.2.3).
  if (rol === 'operador') return NAV_DUENO.filter(d => !d.soloDueno);
  return NAV_DUENO;
}

export const inicioDe = (rol: Rol) => (rol === 'jugador' ? 'j/inicio' : 'panel');

/* La noche de estadio es el fondo por defecto de TODA la app. Canchas es la
   única excepción, y por eso funciona: cuando el fondo cambia, cambia porque
   estás mirando otro deporte, no porque cambiaste de pestaña. */
export const VISTA_CANCHAS = 'canchas';
