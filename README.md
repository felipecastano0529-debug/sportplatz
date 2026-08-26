# Sportplatz

Reservas, torneos, equipos y Neo AI para complejos deportivos.

```
demo/         La demo pública. HTML/CSS/JS plano, sin build. Es la herramienta
              de venta y la especificación viva: cuando este repo y la demo no
              coincidan, gana la demo.
platform/     La plataforma real. Next.js, multi-tenant, con cuentas y dinero.
web/          La página web pública. Un solo HTML, sin build. Vende la
              plataforma y lleva a la demo.
docs/         Compartido por los tres.
DESIGN.md     El sistema de diseño. La fuente de verdad de la piel.
```

## Por dónde se empieza

| Quiero… | Voy a |
|---|---|
| Ver la demo | `cd demo && python3 dev-server.py` → http://localhost:5173 |
| Construir la plataforma | **[docs/PLATAFORMA.md](docs/PLATAFORMA.md)** — el documento maestro |
| Tocar la base de datos | **[docs/BASE.md](docs/BASE.md)** — el proyecto de Supabase, las claves y cómo se comprueba |
| Tocar CSS de lo que sea | **[DESIGN.md](DESIGN.md)** antes de escribir una regla |
| Arrancar otra demo de otro rubro | [docs/MOLDE.md](docs/MOLDE.md) |
| Ver la web pública | `python3 web/dev-server.py` → http://localhost:5180 |

## Los tres despliegues

Un repositorio, tres proyectos de Vercel, cada uno con su **Root Directory**:

| Proyecto | Root Directory | Qué sirve |
|---|---|---|
| `sportplatz` | `demo` | La demo pública |
| `sportplatz-platform` | `platform` | La plataforma |
| `sportplatz-web` | `web` | La web pública |

`sportplatz-web` ya existe y sirve https://sportplatz-web.vercel.app.

`sportplatz-platform` ya existe, con sus variables de entorno puestas en los
tres entornos, pero **no se ha desplegado nunca**.

## La base

Dos proyectos de Supabase, uno por cada lado del negocio: `sportplatz` para
la plataforma y la web, `sportplatz-demo` para la demo pública. Separados
porque la demo la puede registrar y llenar cualquier visitante, y eso no
tiene por qué pesarle a la base con clientes reales. Todo —claves,
migraciones, cuentas de prueba, lo que quedó pendiente— está en
**[docs/BASE.md](docs/BASE.md)**.

> **Pendiente:** el proyecto `sportplatz` de Vercel todavía apunta a la raíz
> del repositorio. Hay que cambiarlo a `demo` en Vercel → Settings → Build and
> Deployment → Root Directory, o el próximo despliegue no encuentra la página.
