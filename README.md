# Sportplatz

Reservas, torneos, equipos y Neo AI para complejos deportivos.

```
demo/         La demo pública. HTML/CSS/JS plano, sin build. Es la herramienta
              de venta y la especificación viva: cuando este repo y la demo no
              coincidan, gana la demo.
platform/     La plataforma real. Next.js, multi-tenant, con cuentas y dinero.
web/          La página web pública de Sportplatz.
docs/         Compartido por los tres.
DESIGN.md     El sistema de diseño. La fuente de verdad de la piel.
```

## Por dónde se empieza

| Quiero… | Voy a |
|---|---|
| Ver la demo | `cd demo && python3 dev-server.py` → http://localhost:5173 |
| Construir la plataforma | **[docs/PLATAFORMA.md](docs/PLATAFORMA.md)** — el documento maestro |
| Tocar CSS de lo que sea | **[DESIGN.md](DESIGN.md)** antes de escribir una regla |
| Arrancar otra demo de otro rubro | [docs/MOLDE.md](docs/MOLDE.md) |

## Los tres despliegues

Un repositorio, tres proyectos de Vercel, cada uno con su **Root Directory**:

| Proyecto | Root Directory | Qué sirve |
|---|---|---|
| `sportplatz` | `demo` | La demo pública |
| `sportplatz-platform` | `platform` | La plataforma |
| `sportplatz-web` | `web` | La web pública |

> **Pendiente:** el proyecto `sportplatz` todavía apunta a la raíz del
> repositorio. Hay que cambiarlo a `demo` en Vercel → Settings → Build and
> Deployment → Root Directory, o el próximo despliegue no encuentra la página.
