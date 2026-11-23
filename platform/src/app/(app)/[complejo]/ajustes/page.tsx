import type { Metadata } from 'next';
import { exigirDueno } from '@/lib/tenant';
import { canchasDe } from '@/lib/queries/canchas';
import { resumenEntre, facturado, cobrado } from '@/lib/queries/agenda';
import { moneyShort, fmtDate, iso, today, addDays } from '@/lib/util';
import { SPORTS } from '@/lib/sports';
import { PageHead } from '@/components/app/PageHead';
import { Ball } from '@/components/Ball';
import { Icon } from '@/components/Icon';
import { Entra, Foco } from '@/components/ui/Motion';
import { Identidad, Horario } from '@/components/app/ajustes/Identidad';
import { Apariencia } from '@/components/app/ajustes/Apariencia';
import { CanchasAjustes } from '@/components/app/ajustes/Canchas';
import { SalirDeLaCuenta } from '@/components/app/ajustes/Cuenta';

export const metadata: Metadata = { title: 'Ajustes' };

/* ==========================================================================
   VISTA · Ajustes

   Es la única sección sin fondo a sangre, a propósito: después de cinco
   pantallas de escenario el ojo necesita una mesa de trabajo lisa.

   Aquí viven los cuatro huecos de personalización del negocio: el logo, el
   color de marca y el fondo, el horario de atención, y cada cancha con su
   nombre, su precio y su foto.
   ========================================================================== */

export default async function AjustesPage({
  params
}: {
  params: Promise<{ complejo: string }>;
}) {
  const { complejo: slug } = await params;
  const s = await exigirDueno(slug);
  const c = s.complejo;

  const hoy = today();
  const [canchas, historia] = await Promise.all([
    canchasDe(c.id),
    // Un año hacia atrás y dos meses hacia delante: es todo lo que necesitan
    // los totales de abajo. Aquí no se enseña ni una fila —solo se cuentan
    // y se suman—, así que va por `resumenEntre`: cuatro columnas, no
    // dieciséis, y ninguna se tira sin mirar.
    resumenEntre(c.id, iso(addDays(hoy, -365)), iso(addDays(hoy, 60)))
  ]);

  const deportes = [...new Set(canchas.map(x => x.deporte))];
  const totalFacturado = facturado(historia);
  const totalCobrado = cobrado(historia);
  const precioProm = canchas.length
    ? canchas.reduce((a, x) => a + x.precio, 0) / canchas.length
    : 0;

  const datos: [string, string | number, string][] = [
    ['Canchas', canchas.length, 'en total'],
    ['Deportes', deportes.length, deportes.length === 1 ? 'tipo' : 'tipos'],
    ['Precio promedio', moneyShort(precioProm), 'por hora'],
    ['Reservas', historia.length.toLocaleString('es-CO'), 'en el último año'],
    ['Facturado', moneyShort(totalFacturado), 'acumulado'],
    [
      'Cobrado',
      moneyShort(totalCobrado),
      `${totalFacturado ? Math.round((totalCobrado / totalFacturado) * 100) : 0}% del total`
    ]
  ];

  return (
    <Entra>
      <Foco />

      <PageHead
        kicker="Configuración"
        title="Tu negocio"
        sub={`Activo desde ${fmtDate(c.creado_en.slice(0, 10))}`}
        tools={
          <span className="stamp">
            <Icon name="pin" />
            {c.slug}
          </span>
        }
      />

      <div className="grid-2">
        <article className="card" data-anim>
          <header className="card-head">
            <h2>Identidad</h2>
            <p className="card-sub">Lo que ve el jugador y lo que dice Neo AI</p>
          </header>

          <Identidad
            slug={slug}
            complejoId={c.id}
            nombre={c.nombre}
            whatsapp={c.whatsapp}
            logoUrl={c.logo_url}
            esDueno={s.dueno && !s.soloLectura}
          />

          {deportes.length > 0 && (
            <div className="set-sports">
              {deportes.map(id => (
                <span className="pill is-on" key={id}>
                  <Ball sport={id} className="pill-ball" />
                  {SPORTS[id].name}
                </span>
              ))}
            </div>
          )}
        </article>

        <article className="card card-wide" data-anim>
          <header className="card-head">
            <h2>Apariencia</h2>
            <p className="card-sub">
              El color de tu marca y lo que se ve detrás. Se aplica al instante.
            </p>
          </header>

          <Apariencia
            slug={slug}
            complejoId={c.id}
            tema={c.tema}
            esDueno={s.dueno && !s.soloLectura}
          />
        </article>

        <article className="card" data-anim>
          <header className="card-head">
            <h2>Horario de atención</h2>
            <p className="card-sub">
              Define la parrilla de la agenda y lo que puede reservar un jugador
            </p>
          </header>

          <Horario
            slug={slug}
            horaAbre={c.hora_abre}
            horaCierra={c.hora_cierra}
            esDueno={s.dueno && !s.soloLectura}
          />

          <dl className="set-facts">
            {datos.map(([label, val, foot]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{val}</dd>
                <em>{foot}</em>
              </div>
            ))}
          </dl>
        </article>

        <article className="card card-wide" data-anim>
          <header className="card-head">
            <h2>Tus canchas</h2>
            <p className="card-sub">
              Nombre, precio y foto de cada una. El precio nuevo aplica a las
              reservas nuevas: las ya hechas conservan el suyo.
            </p>
          </header>

          <CanchasAjustes slug={slug} complejoId={c.id} canchas={canchas} />
        </article>

        <article className="card" data-anim>
          <header className="card-head">
            <h2>Tu cuenta</h2>
            <p className="card-sub">{s.persona.email}</p>
          </header>

          <p className="hint">
            Tus datos están en el servidor, no en este navegador. Puedes entrar
            desde el celular o desde otro computador y encontrarlo todo igual.
          </p>

          <SalirDeLaCuenta />
        </article>
      </div>
    </Entra>
  );
}
