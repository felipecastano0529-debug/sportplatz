# Fotos

**Lo normal es no usar esta carpeta.** Las fotos se suben desde la propia app: cada
cancha tiene un botón *Subir foto* sobre la imagen, y también acepta que le arrastres el
archivo encima. Se reducen, se comprimen y se guardan con el resto del estado.

Se suben en cinco sitios:

| Dónde | Qué foto | Dónde se ve |
|---|---|---|
| Onboarding, paso 2 | La de cada deporte | Tarjeta de selección **y fondo a sangre de Canchas** |
| Canchas → *Subir fondo* | La del deporte visible | El fondo completo de esa sección |
| Canchas / Ajustes | La de cada cancha | Tarjeta de la cancha |
| Ajustes → Identidad | El logo del negocio | El rail, en lugar de la marca Sportplatz |
| Mi equipo → *Subir escudo* | El escudo del club | Ficha del equipo, llaves y tablas |

## Los fondos de estadio

`assets/fondos/` ya trae las dos que se usan detrás del Panel, Equipos y las
vistas del jugador:

```
estadio-desktop.jpg   horizontal, para escritorio
estadio-mobile.jpg    vertical, para móvil
```

Van cruzadas a propósito: la horizontal a escritorio y la vertical a móvil. Al
revés, en escritorio el estadio se recorta a una franja y se pierden las gradas
y los reflectores, que es justo lo que hace la foto. Para cambiarlas, reemplaza
los archivos conservando el nombre.

> **La foto del deporte es la que manda el hero.** Es la imagen grande que se
> ve arriba en Canchas: si estás viendo Sintética, se ve tu cancha sintética;
> si cambias a Pádel con el selector de arriba, cambia a la de pádel. Súbela
> desde el botón del propio hero o suéltala como `assets/deportes/<deporte>.jpg`.

Ninguna imagen está generada con IA. Mientras no haya foto se dibuja el campo del
deporte con el plano de la cancha encima — se ve intencional, no es un placeholder.

## Si prefieres tenerlas como archivos

Útil cuando quieres versionar las fotos con el proyecto en vez de dejarlas en el
navegador. La app las carga si existen; una foto subida desde la app siempre manda sobre
el archivo.

**Deportes** — `assets/deportes/`, proporción 16:10, mínimo 800×500:

```
futbol.jpg   ← ya está
padel.jpg   tenis.jpg   voleibol.jpg   paintball.jpg   ← faltan
```

`futbol.jpg` sale de recortar el césped de la misma foto de estadio que usa el
Panel. Se recortó a propósito la franja inferior: con el cielo dentro, el Panel
y la sección de Sintética enseñarían la misma imagen y el ojo lo nota. Así son
dos lugares distintos sacados de una sola foto.

**Canchas** — `assets/canchas/`, proporción 16:10, mínimo 960×600. El nombre se arma
solo: `<deporte>-<número>.jpg`. Con 3 sintéticas y 2 de pádel busca:

```
futbol-1.jpg   futbol-2.jpg   futbol-3.jpg   padel-1.jpg   padel-2.jpg
```

La lista exacta según tu configuración aparece en **Ajustes → Fotos de las canchas**.

> Los 404 en la consola de esos archivos son esperados: cada imagen lleva un `onerror`
> que la retira y deja ver el campo dibujado.
