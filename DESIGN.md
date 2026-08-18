# Sistema de diseño · Sportplatz

Todo vive en `themes/momentum.css` como tokens. `app/base.css` y `app/premium.css`
solo los consumen. Si algo no se puede expresar con un token, falta un token.

---

## 1. Color

**Verde esmeralda sobre noche de estadio, blanco para respirar.**

Da **5.48:1** sobre blanco, así que **el mismo color sirve de relleno y de
texto**, y encima lleva blanco. Un color, un rol.

**El verde también significa "pagado" y "positivo" en esta interfaz.** No es un
descuido: verde es bueno y la marca es verde. Lo que los separa no es el tono
sino la **forma** — la marca siempre es relleno sólido (botón, pastilla), el
estado siempre es tinte de fondo con su etiqueta al lado. Nunca compiten por el
mismo sitio.

| Rol | Token | Valor | Contraste | Uso |
|---|---|---|---|---|
| Acento | `--accent` / `--brand` | `#047857` | 5.48:1 sobre blanco | Botón primario, pill activa, texto de marca |
| Acento sobre negro | `--accent-hi` | `#34d399` | 10.1:1 sobre `#070b13` | Dato titular sobre superficie oscura |
| Texto sobre el acento | `--on-accent` | `#ffffff` | 5.48:1 | Nunca negro |
| Rojo | `--red` | `#e5231f` | — | Del logo. "Sin abonar", deltas negativos, filo del rail |
| Ámbar | `--amber` | `#f5a300` | — | Del logo. "Con adelanto" |
| Verde | `--green` | `#0d9c5f` | — | Pagado, positivo |
| Oro | `--gold` | `#c98a00` | — | Solo el número del campeón |

**Rampa neutra fría con un punto de verde.** Los grises cálidos leen a papel
viejo; estos acompañan al esmeralda sin robarle saturación.

**Regla de superficie oscura:** sobre el negro los estados suben de luminancia
(`--band-ok`, `--band-neg`). El mismo verde que funciona sobre blanco desaparece
sobre `#17233b`. Nunca se reutiliza el token claro sobre fondo oscuro.

**Colores de dato** (`--d1`…`--d6`): separados en **tono**, no en luminancia,
para que las barras del ranking se distingan también en escala de grises y para
un daltónico. **El rojo va al final a propósito**: en esta interfaz significa
"sin abonar" y "cae", así que en el puesto 2 de un ranking se leía como una
alarma que no era.

### Retinte por contexto

Cada deporte trae el color de su superficie real, y la sección entera lo adopta
redefiniendo tokens. Botones, pills, anillos de foco y focos del cursor se
retintan solos, sin una regla nueva por componente.

| Deporte | Color | De dónde sale |
|---|---|---|
| Sintética | `#16a34a` | Verde hierba, más claro y amarillo que la marca |
| Pádel | `#0e9aa7` | Turquesa de la pista de cristal |
| Tenis | `#2f5cbf` | Azul real de la moqueta, como en su foto |
| Voleibol | `#c48633` | Arena |
| Paintball | `#d0392f` | Rojo del campo |

> Dos deportes tuvieron que separarse del acento cuando la marca pasó a
> esmeralda, o su sección se leería como si no estuviera retintada. El pádel ya
> se había movido del azul al turquesa por la misma razón, cuando la marca era
> azul. La regla es siempre la misma: **el color de un deporte tiene que
> distinguirse del color de la interfaz**, o el retinte deja de comunicar.

> La cancha DIBUJADA de tenis sigue a su foto: estuvo en verde mientras la foto
> era una pista de musgo, y volvió al azul al cambiar la foto por una de moqueta
> azul. La regla no cambió —el respaldo se parece a la cancha de la que es
> respaldo—, cambió la foto.

> **Cómo se gradúan las fotos de fondo.** Para OSCURECER una foto clara se
> multiplica linealmente, que es bajar la exposición y conserva la relación
> entre tonos. Para LEVANTAR una oscura se usa gamma, que sube el medio tono
> sin quemar los claros. Hacerlo al revés se nota: la primera versión del
> estadio nuevo se oscureció con gamma y salió con las sombras machacadas y el
> cielo saturado, como un cartel.

---

## 2. Tipografía

**Archivo variable**, con eje de ancho (`wdth` 62–125) y de peso (100–900).
**IBM Plex Mono** solo para dato técnico: horas de la agenda, códigos.

De una sola familia salen dos voces que no se parecen: el **titular ancho y muy
pesado** —el de un gráfico de televisión deportiva— y el **texto de ancho
normal**. Esa es la jerarquía real que el sistema pedía, sin cargar una segunda
fuente y sin caer en una grotesca neutra para todo.

| Uso | Eje de ancho | Token |
|---|---|---|
| Display, H1, métricas, nombres | `112` | `--wd-display` |
| H2, títulos de ronda, fechas | `106` | `--wd-title` |
| Cuerpo | `100` | `--wd-body` |
| Rótulo micro | `92` | — |

El principio de Apple: **el tracking es específico del tamaño**. Un solo
`letter-spacing` para toda la app está mal en algún sitio, siempre.

| Paso | Tamaño | Interlínea | Tracking | Peso |
|---|---|---|---|---|
| Display | `clamp(2.375rem, 4.3vw, 3.625rem)` | `0.96` | `-0.038em` | 800 |
| H1 | `clamp(1.625rem, 2.5vw, 2.125rem)` | `1.05` | `-0.03em` | 800 |
| H2 | `1.125rem` | `1.28` | `-0.02em` | 700 |
| H3 | `0.9375rem` | `1.35` | `-0.012em` | 700 |
| Body | `0.9375rem` | `1.6` | `-0.004em` | 450 |
| Small | `0.8125rem` | `1.5` | `0` | 450 |
| Micro | `0.6875rem` | `1.35` | `+0.085em` | 700 |

La interlínea **baja** cuando el cuerpo sube; el tracking pasa de muy negativo a
positivo. Todo en `rem`, así que respeta el tamaño de texto del sistema. Números
siempre `tabular-nums` para que las columnas no bailen al actualizarse.

> **Trampa ya pagada:** durante meses el sistema pedía Plus Jakarta Sans en los
> tokens mientras `index.html` cargaba Anton e Instrument Sans. Ninguna de las
> tres se usaba: la app renderizaba en la fuente del sistema y se descargaban
> dos familias para nada. Si cambias `--font`, cambia también el `<link>`.

---

## 3. Elevación

Cada nivel son **dos sombras**: una de contacto (corta, opaca) y una ambiental
(larga, difusa). Ambas teñidas de verde-azul muy oscuro (`--shadow-rgb`) — una sombra
gris pura sobre este blanco se ve sucia. Nunca una sola sombra gigante.

```
--e1  reposo, tarjetas de lista
--e2  tarjeta base
--e3  tarjeta destacada, agenda, tabla
--e4  banda de tinta, hover de tarjeta
--e5  modal, teléfono, toast
```

A eso se suma `--hi`: el filo de luz de 1 px arriba (`inset 0 1px 0`). Es lo que
separa una superficie *impresa* de una superficie *física*.

Lo que emite luz lleva resplandor de su propio color: `--glow-brand`, `--glow-red`.

### 3b. Relieve

Tres capas independientes, no una sombra grande:

1. **Luz fija.** Un foco cenital horneado en el `background-image` de cada
   superficie. No depende del puntero, así que el relieve existe también en
   táctil, en captura de pantalla y con `reduced-motion`.
2. **Filo de luz.** `--hi`, la línea clara de 1 px en el borde superior.
3. **Foco móvil.** Un radial que sigue al cursor (`--mx/--my`, escritos por
   `initSpotlight()` con un solo listener delegado y estrangulado a un frame).
   Vive en `::before` con `z-index: -1`.

Y **relieve real**: las rejillas llevan `perspective: 1400px` y las piezas se
levantan con `translateY(-4…-6px) rotateX(2…2.6deg)` en hover.

Y **grano**: una capa de `feTurbulence` en `multiply` sobre todo. Sin ella, un
degradado grande sobre fondo claro forma bandas.

> **Trampa de implementación:** los componentes con luz fija declaran
> `background-color`, nunca el atajo `background`. El atajo resetea
> `background-image` y borra la luz.

### 3c. Gráficos

El área de ingresos es SVG con `preserveAspectRatio="none"` para llenar la
tarjeta, y `vector-effect: non-scaling-stroke` para que el estirado horizontal no
engorde la línea. **Los puntos no van dentro del SVG** — el mismo estirado los
convertiría en elipses. Se dibujan en una capa HTML encima, con la geometría del
SVG expresada en porcentaje (`CH_GEO`).

Esa capa también posiciona cada columna en `i / (n-1) * 100%`, igual que el SVG.
Con columnas flex de ancho igual, cada punto quedaría medio paso corrido respecto
a la curva — un error que solo se ve cuando ya está publicado.

La curva es Catmull-Rom convertida a béziers: una polilínea recta parece un
electrocardiograma, la curva parece una tendencia.

### 3c-bis. El rail es negro mate

Negro mate con toques metalizados, **dibujado con gradientes, no con una foto**.
El contenido es el escenario; el rail es el chasis que lo sostiene.

Se probaron tres caminos antes:

| Intento | Por qué se descartó |
|---|---|
| **Blanco hueso** | Una superficie clara y maciza a la izquierda robaba protagonismo a la foto en vez de dárselo |
| **Vidrio** | Dejaba pasar la foto de la vista, que detrás de un menú llega desenfocada y no aporta |
| **Acero cepillado (foto)** | Se veía, pero traía líneas y un especular a blanco puro: el texto secundario caía a **2.13:1** |

Dibujarlo resuelve las tres cosas a la vez: el reflejo va exactamente donde
conviene, el fondo se mantiene siempre oscuro y no hay archivo que descargar.
**En el punto más claro del rail —base más el destello más fuerte— el texto
secundario da 8.34:1.** Antes había que pelear por llegar a 4.9.

**Mate no es negro plano.** Lleva grano finísimo en la textura de fondo. Sin
él, una superficie oscura grande forma bandas en el degradado y se lee a
plástico; con él, a metal anodizado.

**Cinco capas modelan la placa**, en orden de arriba abajo en `--g-rail`. La
primera versión llevaba dos y el resultado se leía a negro plano: una superficie
sin sombra no tiene volumen, por muy metálico que sea el color.

| Capa | Qué hace |
|---|---|
| Radial en la esquina superior izquierda | La luz ambiente que entra por arriba. Es lo que le da un **origen** al reflejo |
| Diagonal principal a 156° | El especular largo del metal. Ancho y tenue: 8,5 % de blanco cayendo a 2,6 % |
| Diagonal secundaria a 198° | El rebote de la parte baja, casi imperceptible (5 %) — sin él la mitad inferior se muere |
| Sombra del filo derecho | 26 % → 40 % de negro en el último 7 %. Le da **espesor de placa**, no de papel |
| Caída vertical | Filo de luz de 1 px arriba, negro asentado abajo (46 %) |

**Los reflejos son anchos y muy tenues.** Un reflejo estrecho y marcado es
brillo de plástico; el metal mate devuelve la luz difusa. El tono base sigue
siendo `--rail-base: #06080a` y el texto secundario mantiene sus 8.34:1: las
capas nuevas suman luz por debajo del 9 %, muy lejos de tocar el contraste.

**Sin `opacity` en el texto secundario**, aquí y en cualquier superficie con
algo variable detrás: el tono se fija y no depende de qué caiga debajo.

### 3d. Superficies de énfasis

Primera métrica, cabeceras de tabla y agenda, chip de día activo y toast son
**verde-negro de noche**, nunca gris. (El rail ya no: ver 3c-bis.) Cada uno monta tres capas: `--g-ink`
(o `--g-rail`), `--g-sheen`, y `--hi-dark`. Sobre ellas el esmeralda claro es el
color del dato titular; el rojo del logo entra como **acento estructural**, nunca como
relleno.

### 3e. Filo con degradado

Todas las superficies llevan un anillo de 1 px con degradado, dibujado con dos
máscaras que se restan (`mask-composite: exclude`). Sobre superficie oscura el
anillo cambia a luz blanca (`--edge-lit`) — el acento sobre su propio tono no se
ve.

> El anillo **no** puede vivir dentro de un contenedor que scrollea: se iría con
> el contenido. Por eso `.agenda` no lo lleva.

---

## 4. Fondo a sangre: tres tratamientos, no uno por sección

El fondo va en una capa propia (`.view-bg`) detrás del área de contenido — el
rail queda fuera —, no en el `background` de la vista. Así la foto no se arrastra
con el scroll y las tarjetas flotan encima.

| Tratamiento | `data-bleed` | Dónde | Qué es |
|---|---|---|---|
| **Cancha** | `court` | **Solo Canchas** | La foto del deporte a sangre, el campo de color debajo y el plano encima |
| **Estadio** | `stadium` | Todo lo demás, en los dos roles | La foto de noche del complejo, con haces y grano |
| **Sobrio** | *(sin atributo)* | Ninguna vista hoy; queda de reserva | Superficie lisa |

**La noche de estadio es el fondo por defecto de toda la app, y Canchas es la
única excepción. Por eso funciona:** cuando el fondo cambia, cambia porque estás
mirando otro deporte, no porque cambiaste de pestaña. Un fondo que cambia en
cada sección deja de significar algo.

Dentro del escenario sigue habiendo una excepción: **la cuadrícula de la agenda
se re-aclara**. Son 17 filas de datos seguidas y en vidrio oscuro se leen mal.
El escenario es el marco; la mesa de trabajo se queda siendo mesa de trabajo.

### El retinte va por tokens, no por componente

```css
body[data-bleed] {
  --surface: var(--glass-dark);
  --ink: #fff;  --ink-3: rgba(255,255,255,.72);
  --ok: var(--band-ok);  --neg: var(--band-neg);
  --edge: var(--edge-lit);
}
```

Un solo bloque y las tarjetas, listas, tablas, chips y campos se adaptan. Cero
reglas nuevas por componente. La agenda se **re-aclara** localmente con el mismo
mecanismo.

**Contraste sobre vidrio, calibrado contra el peor caso.** Detrás de una tarjeta
puede haber una zona blanca de la foto. Compuesta con el velo y el vidrio, el
fondo efectivo queda en L≈0.06. Ahí, un rótulo micro a `.50` de blanco daba
**3.85:1** y no pasa AA para texto pequeño; a `.62` sube a **4.86:1**. Por eso
`--ink-4` es `.62` y no menos.

### El velo cae donde hay texto suelto, no en todas partes

Sobre la foto del estadio hay exactamente **tres** textos sin superficie propia
debajo, y los tres viven en los 130 px de arriba: el rótulo, el titular y la
línea de resumen. Todo lo demás llega con su vidrio oscuro puesto.

Por eso el velo es un escalón y no una lámina: **72 % en la cabecera, 24 % en el
cuenco, 62 % al pie.** El perfil anterior hacía justo lo contrario —46 % arriba
y 88 % abajo— porque estaba calibrado contra un encuadre que terminaba en
césped quemado. Con el actual apagaba la grada entera y dejaba el titular a
`3.21:1`.

**Móvil lleva su propio perfil: 78 % / 24 % / 62 %.** No es capricho. Ahí la
cabecera va de y=109 a y=195 —el doble de proporción de pantalla que en
escritorio— y el recorte vertical le pone los reflectores justo detrás. Con el
perfil de escritorio el rótulo caía a `3.12:1`.

Medido en el punto más claro de cada banda, sobre la composición completa
(foto → haces en `screen` → velo):

| Texto | Escritorio | Móvil | Mínimo |
|---|---|---|---|
| Rótulo `#34d399` 11 px | 7.88:1 | 8.26:1 | 4.5 |
| Titular blanco | 14.56:1 | 16.18:1 | 3.0 |
| Resumen 13 px al `.74` | 5.58:1 | — | 4.5 |
| Cualquier texto al `.74`, en **cualquier** punto de la franja | 4.67:1 | 8.93:1 | 4.5 |

> La última fila es la que de verdad protege: las tres primeras miden cada
> texto donde está hoy, y un titular más largo o una vista con otra línea de
> resumen se mueve. La franja entera aguanta. De hecho es la que mandó: con el
> velo al 64 % los tres textos pasaban y la franja se quedaba en `4.09:1`.

**El fondo se mueve, así que el peor caso ya no es una imagen.** Se midió el
pico de luminancia de la franja de cabecera en los 25 s del vídeo y se comparó
con el mismo pico del póster: vídeo 188, póster 191,7. El póster es el peor
caso, y por eso verificarlo a él cubre también al vídeo.

**Los haces sintéticos bajaron a la mitad.** Existían porque el encuadre viejo
era casi todo cielo y no había luz propia arriba que dibujara volumen. El
actual entra por los reflectores de verdad, y un haz inventado encima de una
luz real no suma volumen: suma neblina. Se quedan solo para teñir de esmeralda
las esquinas superiores y casar la foto con la marca.

### Las fotos de fondo

La horizontal va a escritorio y la vertical a móvil: al revés, en escritorio el
estadio se recorta a una franja y se pierden las gradas y los reflectores, que
es lo que hace la foto.

| Archivo | Tamaño | Peso | Para |
|---|---|---|---|
| `estadio-desktop.jpg` | 1800×1013 | 223 KB | Respaldo: navegador sin WebP o sin `image-set` |
| `estadio-desktop.webp` | 1800×1013 | 123 KB | Escritorio 1x |
| `estadio-desktop@2x.webp` | 2560×1440 | 201 KB | Escritorio retina |
| `estadio-mobile.jpg` | 900×1440 | 116 KB | Respaldo móvil |
| `estadio-mobile.webp` | 900×1440 | 57 KB | Móvil |
| `estadio.mp4` | 1280×720, 25 s | 5,2 MB | El escenario en movimiento (§4b) |

Se descarga **una sola**: la precarga de `index.html` lleva `imagesrcset` con
las mismas dos densidades y el mismo `?v=`, así que pide exactamente lo que
después pedirá la hoja de estilos.

Las dos se llevan a **luminancia media ~67** antes de entrar al repo. Es el
número donde el vidrio oscuro de las tarjetas todavía se despega del fondo y la
foto no se ha convertido en una mancha negra. Siempre por multiplicación
lineal, nunca por gamma (ver §1).

**El encuadre entra por el borde del techo, no por el cielo.** El original es
vertical y dedica el 36 % de su alto a nubes; centrado ahí, lo único que se ve
del fondo es cielo, porque el contenido tapa el resto y la franja que queda
libre es justo la de arriba. Las dos versiones arrancan en el mismo punto —el
techo con los reflectores— y bajan hacia el césped:

El origen ya no es una foto de móvil: es el **fotograma 0 del vídeo, a
1920×1080**. Eso cambia el signo del problema. La versión de escritorio se
**reduce** desde 1920 —que es lo que uno quiere— y solo la retina agranda, y
apenas ×1,33. La vertical sale de una ventana `622,0 → 1297,1080` centrada.

| | Recorte del original (1920×1080) | Sale a | Factor |
|---|---|---|---|
| Horizontal 1x | completo | 1800×1013 | ×0,94 (reduce) |
| Horizontal 2x | completo | 2560×1440 | ×1,33 |
| Vertical | `622,0 → 1297,1080` | 900×1440 | ×1,33 |

## 4b. El estadio se mueve

El fondo por defecto es un vídeo de 25 s en bucle: 1280×720, H.264, 5,2 MB.
La foto fija no se retira — es el póster, y hace tres trabajos.

**Vive fuera de `#app`.** `renderApp` reasigna el `innerHTML` de `#app` entero
en cada navegación. Un `<video>` ahí dentro sería un nodo nuevo en cada clic
del menú: vuelta a pedir 5 MB y vuelta a empezar el clip. Fuera, atraviesa las
doce vistas sin una sola petición nueva.

**Se cuela entre el fondo y la app.** `#backdrop` va en z-index 0 y `.shell`
en 1, así que un fijo en z-index 0 colocado después en el DOM queda justo en
medio. Importa: los haces, el grano y el velo viven dentro de `.shell` y
tienen que seguir cayendo encima del vídeo igual que caían encima de la foto.

**Cuándo NO corre**, y la foto se queda:

| Condición | Por qué |
|---|---|
| `prefers-reduced-motion: reduce` | Regla de la casa, sin excepciones |
| Ancho < 48rem | El clip es horizontal: en vertical `cover` se queda con la franja central, ~22 % del ancho. Y son 5 MB por datos |
| `navigator.connection.saveData` | Lo ha pedido el usuario |
| Autoplay bloqueado | No se insiste; la foto ya es un fondo completo |
| Vista de Canchas | Tiene su propio fondo y tapa el vídeo entero: decodificar 720p para nadie es gastar batería |

**El fundido entra con `playing`, no con `canplay`.** `canplay` significa que
el navegador *cree* que podría reproducir; con él la foto se apartaba antes de
que hubiera imagen y se veía el parpadeo.

### La costura del bucle

El clip no cierra sobre sí mismo. Entre el último fotograma y el primero hay
una distancia media de **30** sobre 255, tanto como entre el principio y la
mitad del clip, y unas tres veces lo que cambia la imagen en un tercio de
segundo. Se buscó un par de puntos que enlazara limpio recorriendo las 50
combinaciones útiles del clip: el mejor daba **27,3**, o sea que no lo hay —
la cámara se mueve durante los 25 s enteros.

La salida fue disolver la costura, y **el puente ya estaba puesto: la foto fija
es el fotograma 0**. Está por encima del vídeo, así que subirla lo tapa. Justo
antes del final sube a opacidad 1, el vídeo vuelve a empezar por detrás, y
cuando la foto se retira lo que aparece es la misma imagen que ella.

> Solo se cruza la ida. La vuelta es exacta, porque las dos son el mismo
> fotograma. Y están igualadas en luminancia —el vídeo llega a 87 y aterriza
> en ~56 por CSS, la foto sale a 67 del repo y aterriza en ~58—, así que no
> hay escalón de brillo: se lee como un cambio de plano, no como un fallo.

La vigilancia va con `requestVideoFrameCallback`, no con `timeupdate`:
`timeupdate` llega cada ~250 ms y la ventana entera son 600, así que a veces
la disolvencia habría empezado tarde y no le habría dado tiempo a llegar.
Firefox, que no lo tiene, cae a `timeupdate`.

---

### Cómo se escala sin perder nitidez

La regla salió de una tanda de fondos anteriores que se veían blandos, y sigue
valiendo aunque el origen actual sea grande:

1. **Reducir es Lanczos directo.** Cuando el destino cabe en el origen no hay
   nada que inventar, y enfocar encima solo mete halos.
2. **Agrandar va por pasos de ×1,5 con máscara de enfoque en cada uno**
   (`radius 1.1, percent 50, threshold 2`). De una sola zancada Lanczos
   disuelve el detalle; por pasos sobreviven la estructura del techo y el
   grano de la grada. Hoy solo lo necesita el `@2x`, y por ×1,33.
3. **Entregar 1800 px a una pantalla retina** obliga al navegador a escalar
   otra vez encima con un filtro bilineal tonto. Por eso existe el `@2x`. La
   mitad de la sensación de "poco HD" era esto, no el archivo.
4. **El desenfoque del CSS es `.35px`, no `1.2px`.** El grande estaba para
   tapar un escalado duro; arreglado el escalado, solo borraba trabajo.

> WebP y no JPEG a partir de 1800 px: a 2560 el mismo fotograma pesa 413 KB en
> JPEG y 201 KB en WebP. El JPEG de 1800 se queda como respaldo para quien no
> entienda `image-set`.

> Reemplazar una foto **conservando el nombre** obliga a subir `ASSET_V` en
> `app/core/sports.js`. Sin build no hay hash en el nombre, y sin versión
> el navegador de quien ya la tenía sigue mostrando la vieja.

---

## 5. Materiales

| Material | Dónde | Cómo |
|---|---|---|
| **Verde-negro de noche** | Rail, primera métrica, cabeceras, día activo, toast | `--g-ink`/`--g-rail` + `--g-sheen` + `--hi-dark` + `--edge-lit` |
| **Vidrio claro** | Selector del hero, chips de dato, subir foto | `backdrop-filter` sobre translúcido, borde claro |
| **Vidrio oscuro** | Toda tarjeta sobre fondo a sangre | `--glass-dark` + `--glass-blur` + `--glass-dark-line` |
| **Degradado de marca** | Botón primario, barra de hoy, progreso | `--g-brand` + filo interior + glow |
| **Pista hundida** | Segmented controls, tracks de barra | `inset 0 1px 2px` |

---

## 6. Movimiento

Curvas fuertes: las de CSS por defecto no tienen carácter.

```
--ease-out     cubic-bezier(.23, 1, .32, 1)      entradas, hover, la mayoría
--ease-in-out  cubic-bezier(.77, 0, .175, 1)     movimiento en pantalla
--ease-drawer  cubic-bezier(.32, .72, 0, 1)      toast, hojas
--ease-pop     cubic-bezier(.34, 1.12, .48, 1)   marcas de confirmación y podio
```

**Nunca `ease-in` en UI**: empieza lento justo en el instante que el ojo está
mirando, y hace que 200 ms se sientan como 400.

`--ease-pop` estuvo en `1.4` —un 40 % de sobreimpulso— y a esa altura el
movimiento se lee a juguete. A `1.12` insinúa inercia sin rebotar, y **JS y CSS
usan por fin la misma curva** (`SPRING.snap` en `ui/motion.js`). Se reserva para
la marca de check al elegir un deporte, el punto del día en el gráfico, y la
entrada del podio. Una burbuja de chat que llega **se posa, no rebota**.

| Duración | Token | Para |
|---|---|---|
| 140 ms | `--t-press` | Feedback de presión |
| 180 ms | `--t-hover` | Hover, color |
| 220 ms | `--t-pop` | Elevación, tarjetas |
| 320 ms | `--t-modal` | Modal, scrim |

Reglas sin excepción:

- **Nada de `transition: all`.** Siempre propiedades explícitas.
- **Solo `transform` y `opacity`.** Nunca layout.
- **Todo lo pulsable baja a `scale(.97)`** en `:active`.
- **Nada entra desde `scale(0)`.** Mínimo `.4` + opacidad.
- **Hover detrás de `@media (hover: hover) and (pointer: fine)`**, porque en
  táctil el hover se dispara al tocar y deja el estado pegado.
- **Stagger de 38–55 ms** entre elementos de una lista.
- **El barrido de luz del rail** (`railBrillo`, 640 ms) es una *animación*, no
  una transición: una transición sobre `:hover` volvería atrás al salir el
  cursor y el destello se leería como un yo-yo. La animación recorre la placa
  una vez y termina. Va sobre un `::after` con `overflow: hidden` en el
  contenedor, mueve solo `transform` y `opacity`, y el texto va en `z-index: 1`
  para que la luz pase **por debajo**, no por encima.
- `prefers-reduced-motion` corta la animación pero **conserva** los cambios de
  opacidad y color, que ayudan a entender.

---

## 7. Accesibilidad, resuelta

- **Modal:** el foco entra al abrir, queda atrapado mientras está abierto y
  **vuelve al disparador** al cerrar. El fondo lleva `inert`, así que el
  tabulador no pasea por los controles de detrás. `Escape` y clic en el scrim
  cierran.
- **Jerarquía de encabezados:** las tarjetas de rejilla son `h2`, no `h3`. Un
  salto `h1 → h3` deja huecos en el índice de un lector de pantalla.
- **Salto al contenido:** `.skip` como primer elemento enfocable.
- **Objetivos táctiles:** mínimo 34 px de alto en pills y controles de fila.
- **`role="log"` + `aria-live`** en la conversación de Neo AI; `role="status"`
  en el toast.
- `prefers-reduced-transparency` quita los `backdrop-filter` y opaca el vidrio.
- `prefers-contrast: more` sube bordes, texto y la densidad del velo.

---

## 8. Anti-patrones que este sistema rechaza

- Texto con degradado. Es decorativo, pierde contraste real y es un tell. El oro
  del campeón es un color sólido con sombra de color: **la luz la pone la
  sombra, no el relleno.**
- Una sola tipografía sin jerarquía real de peso y ancho.
- Gradientes morado→azul como decoración de marca.
- Cards anidadas dentro de cards.
- Texto gris de bajo contraste sobre color.
- Icono en cuadrito redondeado encima de cada heading — los iconos aquí son
  funcionales: navegación, botones, estados. Nunca decorativos sobre un título.
- Emojis como sustituto de iconografía.
- Sombras difusas gigantes en todo sin lógica de elevación.
- `border-radius` distinto en cada componente.
- **Retículas decorativas de fondo.** Se retiró la que había: una rejilla de
  hairlines sin superficie que medir es una firma de interfaz generada.
- **Borde lateral grueso de color en tarjetas.** El histórico ya codifica el
  resultado con letra y color de fondo; un tercer canal para lo mismo sobra.
  (La franja de las celdas de la agenda **sí** se queda: en una cuadrícula
  horaria es la convención de calendario, no un adorno.)
