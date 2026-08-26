/* ==========================================================================
   La cabecera de página

   Copiada de `pageHead()` en `demo/app/ui/shell.js`. Sobre fondo a sangre se
   invierte sola: el CSS lo engancha a `body[data-bleed]`, no a una clase que
   haya que acordarse de poner.
   ========================================================================== */

export function PageHead({
  kicker,
  title,
  sub,
  tools
}: {
  kicker: string;
  title: React.ReactNode;
  sub?: React.ReactNode;
  tools?: React.ReactNode;
}) {
  return (
    <header className="page-head">
      <div>
        <p className="kicker">{kicker}</p>
        <h1 className="page-title">{title}</h1>
        {sub && <p className="page-sub">{sub}</p>}
      </div>
      {tools && <div className="page-tools">{tools}</div>}
    </header>
  );
}
