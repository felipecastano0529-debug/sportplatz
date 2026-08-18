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

### 3c-bis. El rail es vidrio, no una superficie

El fondo de la vista ocupa **toda la pantalla, también por debajo del rail**, y
el rail es una lámina translúcida encima. El estadio ya no queda partido en dos
por una barra opaca: sigue de lado a lado y el menú flota sobre él.

Se probó antes en blanco hueso. Se descartó: una superficie clara y maciza a la
izquierda robaba protagonismo a la foto en vez de dárselo, que era justo lo
contrario de lo que la sección tenía que hacer.

**La opacidad del vidrio no es libre.** Compuesto el peor caso —el cielo claro
de la foto de voleibol, en la banda alta donde el velo es más flojo— la pista
secundaria del menú da:

| Opacidad del vidrio | Contraste de la pista |
|---|---|
| `.55` | 4.25:1 ✗ |
| `.62` | 4.89:1 ✓ |
| `.64` (elegida) | ~5.0:1 ✓ |
| `.74` | 6.02:1 ✓ pero apenas deja ver la foto |

Se queda en `.64`: con margen sobre AA y dejando pasar bastante más fondo. Es
un cálculo analítico sobre las capas (foto → velo → vidrio), no una medición
del píxel compuesto: `backdrop-filter` no es inspeccionable desde el DOM.

**La pista secundaria no lleva `opacity`.** Con un fondo variable detrás, una
opacidad hace que el contraste dependa de la foto. El tono se fija en
`--rail-dim` y así es predecible pase lo que pase por detrás.

**El onboarding es la excepción:** ahí no hay fondo de vista, así que su rail es
sólido. Un vidrio sin nada que dejar ver es solo un gris.

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

### Las fotos de fondo

`assets/fondos/estadio-desktop.jpg` (horizontal) y `estadio-mobile.jpg`
(vertical). La horizontal va a escritorio y la vertical a móvil: al revés, en
escritorio el estadio se recorta a una franja y se pierden las gradas y los
reflectores, que es lo que hace la foto.

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
