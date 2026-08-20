# Sportplatz · plataforma

Todavía sin código. Lo que va aquí está especificado en
**[../docs/PLATAFORMA.md](../docs/PLATAFORMA.md)**: el modelo de datos, las
reglas de negocio numeradas, la arquitectura y el plan por fases.

Antes de escribir la primera línea:

1. Las reglas de negocio son §4 del documento maestro. Se implementan exactas.
2. La piel sale de [`../DESIGN.md`](../DESIGN.md) y de los tokens de
   `../demo/themes/momentum.css`. Se mapean a `tailwind.config`, no se
   reinventan.
3. `../demo/app/core/` no toca el DOM: es lo primero que se copia.
