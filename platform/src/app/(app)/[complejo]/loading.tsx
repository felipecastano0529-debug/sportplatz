/* ==========================================================================
   Mientras carga

   Esqueletos con la forma de lo que viene, no un giro en el centro: la
   pantalla no salta cuando llegan los datos, porque ya estaba ocupando el
   mismo sitio.
   ========================================================================== */

export default function Cargando() {
  return (
    <div className="cargando" aria-busy="true" aria-label="Cargando">
      <div className="sk sk-head" />
      <div className="stat-row">
        {[0, 1, 2, 3].map(i => <div className="sk sk-stat" key={i} />)}
      </div>
      <div className="grid-2">
        <div className="sk sk-card" />
        <div className="sk sk-card" />
      </div>
    </div>
  );
}
