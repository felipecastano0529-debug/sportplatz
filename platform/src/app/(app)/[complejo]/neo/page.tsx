import type { Metadata } from 'next';
import { exigirStaff } from '@/lib/tenant';
import { abrirConversacion, resumenDeNeo, ejemploDeReserva } from '@/lib/actions/neo';
import { iso, today, addDays, waBonito, moneyShort } from '@/lib/util';
import { PageHead } from '@/components/app/PageHead';
import { Chat } from '@/components/app/neo/Chat';
import { Icon, type IconName } from '@/components/Icon';
import { Entra, Foco } from '@/components/ui/Motion';

export const metadata: Metadata = { title: 'Neo AI' };

/* ==========================================================================
   VISTA · Neo AI (lado del dueño)

   La conversación a la izquierda y, al lado, las cinco cosas que Neo hace
   por detrás. No es una demostración: es la MISMA conversación que tiene un
   jugador, contra la agenda real de este complejo. Lo que se aparte aquí cae
   en Reservas.

   Lo que falta para que esto atienda de verdad por WhatsApp está en §9.2:
   número de WhatsApp Business, webhook con firma de Meta y tres plantillas
   aprobadas. Se dice, no se insinúa.
   ========================================================================== */

const LO_QUE_HACE: { ic: IconName; titulo: string; detalle: string }[] = [
  {
    ic: 'clock',
    titulo: 'Lee la agenda de verdad',
    detalle: 'Nunca ofrece una hora que ya está tomada, y revalida otra vez antes de cerrar.'
  },
  {
    ic: 'spark',
    titulo: 'Entiende cómo se habla aquí',
    detalle: '«mañana a las 7» es de noche, «el sábado» es el que viene, «la sintética» es fútbol.'
  },
  {
    ic: 'wallet',
    titulo: 'Explica el adelanto',
    detalle: 'La mitad para apartar, completo, o pagar en cancha. Sin regatear precios.'
  },
  {
    ic: 'check',
    titulo: 'Escribe en tu agenda',
    detalle: 'La reserva que crea es la misma que crea tu mostrador. Solo cambia de dónde vino.'
  },
  {
    ic: 'reservas',
    titulo: 'Entrega un código',
    detalle: 'Cada reserva sale con su SP-XXXX. Con eso el cliente la cancela escribiendo.'
  }
];

export default async function NeoDuenoPage({
  params
}: {
  params: Promise<{ complejo: string }>;
}) {
  const { complejo: slug } = await params;
  const s = await exigirStaff(slug);
  const c = s.complejo;

  const hoy = today();
  const [inicial, resumen, ejemplo] = await Promise.all([
    abrirConversacion(slug),
    resumenDeNeo(slug, iso(addDays(hoy, -29)), iso(addDays(hoy, 30))),
    ejemploDeReserva(slug)
  ]);

  return (
    <Entra>
      <Foco />

      <PageHead
        kicker="Automatización"
        title="Neo AI"
        sub={
          c.whatsapp
            ? <>Atiende y aparta por ti. Tu número: <b>{waBonito(c.whatsapp)}</b></>
            : 'Atiende y aparta por ti. Pon tu WhatsApp en Ajustes para conectarlo.'
        }
      />

      <div className="grid-2">
        <Chat
          slug={slug}
          negocio={c.nombre}
          logoUrl={c.logo_url}
          inicial={inicial}
        />

        <div>
          <article className="card" data-anim>
            <header className="card-head">
              <h2>Qué hace por detrás</h2>
              <p className="card-sub">Cinco cosas, todas contra tu agenda real</p>
            </header>

            <ul className="list">
              {LO_QUE_HACE.map(x => (
                <li className="list-row" key={x.titulo}>
                  <span className="nav-ic"><Icon name={x.ic} /></span>
                  <span className="list-main">
                    <b>{x.titulo}</b>
                    <em>{x.detalle}</em>
                  </span>
                </li>
              ))}
            </ul>
          </article>

          <article className="card" data-anim>
            <header className="card-head">
              <h2>Cuánto te está atendiendo</h2>
              <p className="card-sub">Últimos 30 días y los 30 que vienen</p>
            </header>

            <dl className="set-facts">
              <div>
                <dt>Reservas</dt>
                <dd>{resumen.total}</dd>
                <em>en total</em>
              </div>
              <div>
                <dt>Las atendió Neo</dt>
                <dd className="strong">{resumen.atendidas}</dd>
                <em>{(resumen.porcentaje * 100).toFixed(0)}% del total</em>
              </div>
              <div>
                <dt>Facturado por Neo</dt>
                <dd>{moneyShort(resumen.facturadoPorNeo)}</dd>
                <em>sin que nadie contestara</em>
              </div>
            </dl>

            {ejemplo ? (
              <p className="hint">
                La última: {ejemplo.texto} · <b className="mono">{ejemplo.codigo}</b>
              </p>
            ) : (
              <p className="hint">
                Todavía ninguna reserva ha entrado por Neo. Escríbele aquí al lado
                y verás cómo cae en tu agenda.
              </p>
            )}
          </article>

          {/* Lo que falta se dice, no se insinúa: prometer WhatsApp antes de
              tenerlo aprobado por Meta es prometer lo que la base no cumple. */}
          <article className="card" data-anim>
            <header className="card-head">
              <h2>Conectarlo a WhatsApp</h2>
              <p className="card-sub">Lo que falta para que atienda solo</p>
            </header>

            <ul className="kv">
              <li><span>Número de WhatsApp Business</span><b>Pendiente</b></li>
              <li><span>Webhook verificado con Meta</span><b>Pendiente</b></li>
              <li><span>Plantillas aprobadas</span><b>0 de 3</b></li>
            </ul>

            <p className="hint">
              Hacen falta tres plantillas antes del lanzamiento: recordatorio tres
              horas antes, aviso de saldo el día del partido, y cupo liberado
              cuando se cae una hora pico. Fuera de la ventana de 24 horas, Meta
              solo deja escribir con plantillas aprobadas.
            </p>
          </article>
        </div>
      </div>
    </Entra>
  );
}
