# Sportplatz · web pública

Un solo archivo. `index.html` lleva dentro el sistema, la maqueta y el motor:
sin build, sin dependencias de JavaScript y **sin una sola petición a otro
dominio** — las fuentes se sirven desde `assets/fuentes/`.

En producción: **https://sportplatz-web.vercel.app**
(proyecto `sportplatz-web`, enlazado desde esta carpeta; `vercel deploy --prod`).

```
index.html        La página entera
assets/marca/     logo.png y favicon.png, los de ../demo/assets/marca
                  reducidos a 96px: aquí se muestran a 30, y los de 256
                  pesaban 86 KB entre los dos para nada
assets/fondos/    El estadio. Ya no se usa de fondo del hero — el hero es la
                  malla de luz en CSS — pero sigue siendo la imagen de og:image
assets/fuentes/   Archivo e IBM Plex Mono en woff2, subsets latin y latin-ext
dev-server.py     python3 dev-server.py → http://localhost:5180
vercel.json       Cabeceras. Root Directory del proyecto en Vercel: `web`
```

## Lo que hay que saber antes de tocarla

**La piel es la de [`../DESIGN.md`](../DESIGN.md)**: esmeralda `#047857` sobre
noche de estadio `#070b13`, Archivo con eje de ancho para los titulares e IBM
Plex Mono para el dato técnico. Si cambias `--sans` o `--mono`, cambia también
el `<link>` de fuentes o la página renderiza con la del sistema y descarga dos
familias para nada.

**El paralaje es DECLARATIVO: `data-par` en el HTML, un solo suscriptor.**
El valor son los píxeles de recorrido total, repartidos a los dos lados del
centro — `data-par="24"` son 12 arriba y 12 abajo. `data-par-x` mueve en
horizontal, que es lo que pide la cinta de deportes. Nada de un observador
por pieza.

**Ningún `data-par` puede ir sobre un `.rv` ni sobre un `position:sticky`.**
El `.rv` ya anima `transform` en la entrada, así que los dos se pisan y al
terminar la entrada deja el paralaje en `none`; por eso la parrilla de la
semana lleva `.semana-par` envolviéndola. Y un `transform` sobre un `sticky`
lo saca de su contenedor de bloque y el pegado deja de funcionar: por eso el
mockup de la plataforma NO lleva paralaje, ya tiene el suyo.

**Recorridos cortos: 26 px el texto del hero y 58 el fondo.** Con
90 el bloque se despega de su sección y se ve el truco. Y al salir el hero
encoge un 4 % y nada más — oscurecerlo ensucia los tonos y se lee como que la
página se apaga. La curva es `smoothstep` (`p*p*(3-2p)`): pendiente cero al
entrar y al salir, así no se ve dónde empieza ni dónde acaba.

**Nada que se mueva solo sigue moviéndose fuera de pantalla.** Es de donde
salía la lentitud, y no daba ni un error:

- La escena 3D de Spline son ~60 peticiones a `unpkg` y `spline.design` y un
  bucle de render WebGL PROPIO que no para nunca — seguía dibujando a
  pantalla completa con el hero doce mil píxeles más arriba. Ahora la
  importación no se pide hasta que el hero entra en vista, y al salir se
  llama `app.stop()` (`play()` al volver, y `stop()` también con la pestaña
  en segundo plano). Si el hueco de ocio llega con el hero ya fuera, no se
  importa nada y se vuelve a pedir la próxima vez.
- Las siete cintas infinitas —la de deportes y las seis de «Hoy / Con
  Sportplatz»— se paran con `animation-play-state` cuando su sección no se
  ve. Cada una se llevaba su capa de composición.
- El carrusel de las cuatro escenas paraba de arrancar hasta verse, pero una
  vez arrancado seguía girando cada 7 s fuera de pantalla, y cada vuelta
  reinicia las animaciones CSS de la escena entera. Ahora se para al salir.
- La barra dejó de llevar `backdrop-filter`. Era el filtro más caro de la
  página —repinta todo el ancho de la ventana en cada fotograma que esté
  vivo— y la cápsula que lo sustituye es opaca, así que no hay nada que
  desenfocar.

**La barra no es una barra: es una cápsula que flota.** Dos estados —ancha
con los enlaces, corta con la marca y el menú— y una sola pieza que pasa de
uno al otro. La foto y el nombre NO se tocan en la transición: son lo que
persiste, y por eso se lee como que la cápsula se encoge alrededor de ellos y
no como dos barras cruzándose. Se encoge pasados los 64 px y no vuelve a
estirarse hasta por debajo de 24: con un solo umbral, parada justo encima, el
rebote del trackpad la hace latir.

**El ancho se anima, que en esta casa está prohibido, y aquí es lo correcto
con dos condiciones que no son opcionales.** `contain:layout` encierra el
recálculo dentro de la cápsula — sin él un ancho animado invalida la maqueta
de la página entera 60 veces por segundo, que es exactamente por lo que la
regla existe. Y `overflow:hidden` recorta los enlaces contra la propia
cápsula mientras encoge, así que dentro no se reordena ni se parte nada. La
alternativa —recortar con `clip-path`— deja fuera la sombra Y el filete del
canto derecho, que son justo lo que hace que la pieza flote.

**Los enlaces se van ANTES de que el canto los alcance**: 140 ms de
desvanecido contra 460 de encogido. Al revés se ven cortados por el borde, que
se lee como un fallo de recorte y no como una salida. Y `visibility:hidden` al
final del desvanecido, o el tabulador sigue entrando en enlaces invisibles.

**Los tres puntos van fuera del flujo, anclados al canto derecho.** Así
viajan solos con el borde mientras la cápsula encoge, sin una línea de JS
calculando desplazamientos. El centrado vertical va con `margin` y no con
`translate`, para dejarle el `transform` libre a la animación de entrada.

**Los dos anchos se miden, no se calculan.** El texto cambia de ancho con la
fuente cargada, con el zoom y con el idioma. Se miden con una clase que quita
los enlaces, en carga, resize y `fonts.ready` — dos lecturas forzadas ahí
valen infinitamente menos que una por fotograma. Van a `:root` y no a `.nav`:
el menú es HERMANO de la barra, y una variable puesta en `.nav` no le llega.

**El menú sale del sitio al que vuelve.** Pegado al canto derecho de la
cápsula, que es donde están los puntos que lo abren; centrado bajo una
cápsula ancha se leería como que lo abrió otra cosa. En pantalla estrecha se
queda centrado —alineado al canto se saldría por el borde, y un menú cortado
es peor que uno que no señala su origen— y si la cápsula cambia de ancho con
el menú abierto, el menú se cierra: si no, se queda señalando un sitio donde
ya no hay nada.

**La curva es un muelle críticamente amortiguado, sin rebote**
(`cubic-bezier(.32,.72,0,1)`, equivalente a damping 1.0 y respuesta ~0.4 s).
El rebote se reserva para lo que el dedo ha lanzado, y una cápsula que se
encoge sola no la ha lanzado nadie.

**El hero tiene la escena 3D viva Y la página va fluida.** Las dos cosas, y
no fue gratis. Medido con Chrome sin cabeza a dpr 2, haciendo scroll de
verdad por toda la página:

| | script durante el scroll | fotogramas lentos | p95 |
|---|---|---|---|
| escena viva, sin más | 3 868 ms | 170 de 186 | 34 ms |
| sin escena | 11 ms | 4 de 308 | 17,5 ms |
| **escena viva, como está hoy** | **202 ms** | **7 de 337** | **17,6 ms** |

Con la escena en pantalla y corriendo se come **992 ms de script por
segundo** — el hilo principal entero. Con `app.stop()`, **0,7**. De ahí sale
todo lo demás:

- **No corre mientras te mueves.** Un suscriptor del motor la para en cuanto
  la altura cambia y la revive 180 ms después del último movimiento. Bajando
  a novecientos píxeles por segundo no hay ojo que vea animarse un cubo, así
  que el scroll se queda con el hilo entero y la escena con toda tu atención
  cuando por fin la miras quieta.
- **No existe fuera del hero.** Al salir se llama `dispose()`, no `stop()`:
  parada sigue ocupando memoria y contexto. Al volver se reconstruye, y el
  módulo se guarda para que el segundo montaje no vuelva a pedir sesenta
  archivos.
- **Dibuja a 1×.** `app._getPixelRatio = () => 1` ANTES de `load()`, que es
  cuando el runtime dimensiona el lienzo. En una pantalla retina dibujaba al
  doble en cada eje: cuatro veces los píxeles por fotograma, para un fondo
  que está detrás de un velo y de un grano. Comprobado: con dpr 2 el lienzo
  sale de 1440×913 y no de 2880×1826.
- **Debajo hay SIEMPRE un render fijo de los mismos cuadros** (`.webp` de
  43 KB, capturado de la propia escena en Chrome sin cabeza). La escena viva
  se funde encima cuando llega. Como son los mismos cuadros, el relevo no se
  ve — ni al entrar, ni cuando se destruye al salir. Y si no carga, si es un
  móvil, o si hay movimiento reducido, la primera pantalla se ve igual.

Probé antes a meter el runtime en un Web Worker con OffscreenCanvas: **carga
y dibuja** —con remedos de `window`, `document`, `NodeList` y compañía— y el
hilo principal baja a 0 ms/s. Pero las texturas de entorno no llegan y los
cuadros salen negros, con las aristas encendidas y las caras a oscuras. Ni
con un `<img>` falso hecho de `OffscreenCanvas` volvió la luz. Queda anotado
por si alguien lo retoma; el laboratorio está en el historial.

**`overflow-x: clip` y no `hidden` en el body.** `hidden` convierte al body en
un contenedor desplazable —con su caja de scroll, su capa y su hit-testing—
para algo que solo tiene que recortar.

**La escena 3D no sigue al puntero.** El seguimiento vive DENTRO del
`.splinecode` y escucha en su propio lienzo: `pointer-events:none` sobre el
canvas lo deja sin eventos que oír, y los cuadros se quedan quietos en su
composición. Como cinturón, `app.setGlobalEvents(false)` por si la escena se
exportó escuchando en `window`. De paso el hero deja de tener una capa de
hit-testing a pantalla completa.

**El revelado dispara ANTES de que la pieza entre en pantalla.** El margen
del observador era negativo (`-6%`): la sección tenía que estar bien dentro
para empezar a aparecer, y con el viaje encima llegabas antes que ella. Ahora
mira un 22 % por debajo del canto inferior, así que la entrada arranca
mientras la sección todavía sube. El umbral pasa de `.08` a `0`: con `.08`,
una sección más alta que la ventana pedía un 8 % de SU alto — cientos de
píxeles de espera de más. Y el viaje baja de 0,72 s a 0,5 con la cascada en
pasos de 45 ms: el último de una sección llegaba a 1,08 s desde que asomaba,
y bajando deprisa eso no se lee como una entrada sino como que la página no
ha cargado. Ahora cierra en 0,72 total.

**El panel de la agenda se precarga desde el `<head>`.** El escáner de
precarga no lo ve —está a mitad del documento— y para cuando el parser llega
ya vas bajando. Con `rel=preload` está descargado y descodificado antes de
que la sección aparezca. `imagesrcset`/`imagesizes` tienen que ser LOS MISMOS
del `<img>`, o el navegador descarga dos archivos en vez de uno; medido: una
sola petición, `initiatorType: "link"`, cerrada a los 73 ms.

**Un solo motor de scroll.** Hay exactamente un `addEventListener('scroll')` y
un `requestAnimationFrame` en todo el archivo, y los suscriptores primero leen
y después escriben. Si añades un efecto de scroll, súscríbelo al motor; no
montes otro bucle.

**`offsetTop`, nunca `getBoundingClientRect()`** sobre algo que se anima. El
rect incluye el transform: medir cambia la medida, repinta, y vuelve a medir.
La pestaña se congela sin un solo error en consola.

**Dos transforms nunca comparten elemento.** Por eso la foto del hero vive en
`.hero-photo` dentro de `.hero-bg`, y la franja que se llena sola tiene dos
filas superpuestas en vez de una que cambia.

**El fondo del hero es luz DETRÁS y cuadros DELANTE.** La luz vive en `.lux`
y los cuadros en `.malla`, que es una superficie del color de la noche con
una máscara de dos tramas cruzadas en `mask-composite:intersect`: opaca solo
donde las dos coinciden —el interior del cuadro— y transparente en CUALQUIER
junta, que es por donde sale la luz y se dibujan las aristas. Con el modo por
defecto (`add`) las juntas se tapan entre sí y solo quedan puntos en los
cruces. La perspectiva y la deriva van en nodos DISTINTOS: dos transforms en
el mismo elemento se pisan sin dar ningún error.

**El fondo del hero son los cuadros 3D de la escena, y nada más encima.**
Sin luces, sin focos, sin nada difuminado. El relieve lo trae la escena.

**La escena se llena y se vacía sola.** No es un fallo de carga: su animación
hace entrar y salir los cuadros, y hay tramos de varios segundos en que el
hero se queda casi liso. Comprobado capturando con 7 s de diferencia — vacío
y lleno. Si molesta, hay que cambiar la escena, no el CSS.

**La escena va con `@splinetool/runtime`, NO con el web component.** Con
`@splinetool/viewer` no carga nunca: el elemento se registra, crea su lienzo
y jamás pide el `.splinecode` — 49 s sin una sola petición y sin un error,
igual desde unpkg que desde jsdelivr.

**En móvil NO se carga.** Son 60 peticiones más WebGL para un fondo
decorativo, y este producto se reparte por WhatsApp: el móvil es el caso
principal. Allí queda una rejilla de líneas finas en CSS, con una máscara
radial que la desvanece hacia los bordes. Cero peticiones externas.

**El velo se calibra CONTRA lo que hay debajo.** Es lo que más veces ha hecho
parecer que el fondo no cargaba cuando sí: un radial de 72%×76% tapaba el
hero entero. Si cambias el fondo, apágalo un momento para saber si lo que no
ves es el fondo o el velo.

**Aquí se probaron y se quitaron cuatro cosas:** una luz difuminada siguiendo
al ratón por encima de todo; otra con muelle crítico por detrás de los
cuadros; una malla de tres planos apilados (cada plano es opaco salvo en sus
juntas, así que el de delante tapa las del de atrás y el hero se queda
negro); y dos luces derivando con `mix-blend-mode:screen`, que a plena
potencia LAVAN los cuadros y dejan el fondo en un borrón verde sin relieve.
Ninguna gustó. El fondo va limpio. No es que quedara fea: no
cargaba. Probado con el web component desde unpkg y desde jsdelivr, y con
`@splinetool/runtime` directo. Por la tercera vía se ve lo que pasa: **60
peticiones** a dominios externos, todo descargado a los 8,3 s, y a los 100 s
la promesa de `load()` seguía sin resolver con el lienzo en 300×150 y sin un
solo error en consola. Si alguien vuelve a proponerlo, que traiga una escena
propia y recién exportada, y que la mida antes.

**La barra sabe qué banda tiene debajo.** El motor mide de una vez el
`offsetTop` y el alto de cada `.b-night` y del pie, y le pone `.night` a la
barra cuando su canto inferior cae dentro de una. Una barra blanca fija
encima de una banda de noche no se lee como una capa que flota: se lee como
un corte horizontal en mitad de la sección. Si añades una banda oscura,
ponle `b-night` y no toques nada más; si la maquetas con un fondo suelto, la
barra no se va a enterar.

**El ritmo de tonos hace el recorrido, y `bone`, `mist` y `paper` NO son tres
tonos.** Se diferencian entre un 2 % y un 6 % de luminancia: encadenar tres
seguidas da un solo rollo blanco. Por eso las trece vistas van sobre noche
aunque sean texto: sin esa banda, la mitad de atrás de la página eran 4.900 px
de claro sin un solo respiro. Antes de meter una sección nueva, mira dónde
cae en la alternancia claro / oscuro.

**Las costuras entre claro y oscuro son curvas SVG, no degradados.**
Interpolar entre blanco y casi negro pasa por un gris que no pertenece a
ninguna de las dos superficies y se lee como suciedad. Van con `bottom:-1px`
para que no asome una hebra de la banda de abajo.

**El panel de la agenda es una IMAGEN, ya no HTML vivo.** Antes la franja de
las 19:00 se llenaba sola y el total salía de sumar `RESERVAS` en código.
Ahora es un render fijo, así que lo que decía el panel va en el `alt` —
incluido el total: si no, el dato se queda encerrado en un píxel y no lo lee
nadie.

**El panel salió del hero y bajó a su propia banda.** Dentro del hero quedaba
al aire: sin nada al lado que dijera qué se está viendo, y compartiendo fondo
con la escena 3D — dos piezas oscuras peleando por la misma pantalla. Ahora
vive en `#agenda`, la banda más clara de la página, que es contra la que mejor
recorta un vidrio oscuro, y con el texto que lo explica AL LADO y no debajo,
donde un pie de foto se lee como nota al margen. La costura del hero pasó a
rellenarse con `#fcfdfe`: el relleno de una costura es siempre el color de la
banda de ABAJO.

**El panel entra inclinado y se endereza: tres nodos, tres transforms.**
`.ag-stage` pone la perspectiva y lleva el revelado, `.ag-tilt` el
`rotateX(10.5°→0) scale(.93→1)` que escribe el motor, y `.ag-float` el
paralaje declarativo. Juntos en un solo elemento se pisarían sin dar un error.
El recorrido acaba cuando el centro de la pieza llega al centro de la ventana
y ahí se QUEDA quieto: un efecto que sigue moviéndose cuando la pieza ya se
está leyendo distrae en vez de ayudar.

**El render se exporta CONSERVANDO el alfa.** Aplastado a RGB, el fondo gris
del render aparece como un rectángulo pegado sobre el hero, que es
exactamente la trampa de «el fondo del render y el de la tarjeta no
coinciden». El PNG trae los bordes transparentes; hay que recortar con
`getbbox()` sobre el RGBA y guardar WebP con alfa.

**Y no lleva sombra propia.** El halo viene dibujado en el render: pegarle una
sombra CSS encima deja un doble contorno que se ve sucio.

**De 1,7 MB a 150 KB (2x) y 60 KB (1x).** El original pesaba más que toda la
página junta. Se sirve con `srcset` y con `width`/`height` en el `<img>`, para
que el navegador reserve el hueco antes de descargarla y la página no pegue
el salto.

**Ojo al verificar una imagen: una captura puede salir vacía porque aún no ha
decodificado.** Pasó aquí y parecía que la imagen no cargaba. Lo que lo
resuelve es dibujarla en un canvas y contar píxeles opacos, no mirar la
captura.

**El nombre manda en el hero, y va FUERA de `.hero-copy`.** Ahí lo limita un
`max-width` pensado para texto y diez mayúsculas anchas no caben: se partía
en «SPORTPL / ATZ». Lleva `white-space:nowrap`, porque cada letra es un
`inline-block` y sin eso el navegador corta entre letras.

**Su tamaño sale de medir el TEXTO, no la caja.** Con `max-width` la caja se
queda en el ancho del contenedor y el texto se sale por debajo sin que el
rect lo diga — dos veces di por bueno un tamaño que se salía porque medí la
caja. Lo que hay que mirar es el `scrollWidth`, o el rect de las letras.
Medido: a 244,8 px de fuente el texto ocupa 2038 px, así que para llenar
~1050 px hacen falta 126 px ≈ 8,75vw.

**Es un `<p>` y no un encabezado.** El `h1` sigue siendo la promesa, que es lo
que describe la página. Y lleva `aria-label` porque el JS lo parte en letras
y un lector lo deletrearía.

**El eje de ancho se ABRE mientras entra** (`wdth` 62 → 125). Es un movimiento
que solo permite una fuente variable y no hay forma de fingirlo con
`transform`. La animación del hero NO se puede medir por JS: el
`IntersectionObserver` que la dispara no corre durante una evaluación
remota, así que hay que forzar el estado final a mano para medir.

**Los botones son una pieza con material, no un rectángulo de color.** Cinco
sombras (luz arriba, sombra abajo, contacto, proyección y halo), degradado
vertical, y dos capas más en pseudo-elementos: `::before` es el brillo
especular —una lámina de luz en la mitad de arriba, recortada por el radio,
que es lo que hace que la superficie parezca curva— y `::after` es el barrido
que cruza UNA vez al pasar por encima, con `transform` y nunca con
`background-position`, que repinta la capa entera cada fotograma.

**Se levanta un píxel al pasar por encima y la sombra CRECE con él.** Si sube
y la sombra no crece, se lee como que flota sin peso. Al pulsar se hunde: se
va la luz interior y entra una sombra interior. Los dos valores van en un
solo `transform`; en dos declaraciones se pisarían.

**Los secundarios (`btn-ghost`, `btn-line`) no llevan ninguna de las dos
capas:** son superficie clara o transparente, ahí una lámina de luz blanca no
se ve y el barrido solo ensucia.

**No se pueden traer componentes de 21st.dev, shadcn ni similares.** Todos son
React + Tailwind, y esta página es un solo HTML sin build. Se porta el
criterio, no el código.

**Las tarjetas de precios llevan tarjeta dentro de tarjeta, y es a propósito.**
Separa las dos preguntas de quien compra en su orden: lo que CUESTA sobre la
superficie de la tarjeta, y lo que TRAE en un panel hundido con su cabecera.
La marca es un check en círculo relleno, no un palito. Y cada plan dice
también lo que NO trae, con cruces grises: callar lo que falta solo aplaza la
llamada de «pensé que esto venía», y esa llega enfadada. El panel crece con
`flex:1` para que los tres planes queden a la misma altura.

**Las cabeceras de sección alternan.** Las pares llevan `head--rule` y cuelgan
de una regla a todo el ancho de la caja; las impares van sueltas. Siete
cabeceras con la misma forma se leen como plantilla por muy bien que esté
cada una. Titular y bajada siguen JUNTOS y debajo: separarlos a lados
opuestos deja un vacío en medio y deja de leerse como una unidad.

**Los mockups llevan datos, no rectángulos de color.** La parrilla de la
escena 01 trae el nombre de quien reservó en cada franja. Una parrilla de
colores sin un nombre dentro se lee como un maquetado sin terminar, no como
el producto.

**Las fuentes son locales, y el formato importa.** Están en
`assets/fuentes/` con `format('woff2')`. Nunca `format('woff2-variations')`:
con eso el navegador descarta la `@font-face` ENTERA, en silencio y sin
error, y la página cae al fallback como si el archivo no existiera. Los
`unicode-range` están puestos, así que `latin-ext` vive en disco pero no se
descarga. El `crossorigin` del `<link rel=preload>` es obligatorio aunque sea
el mismo origen, o la fuente se pide dos veces.

**El interlineado SUBE sobre las bandas de noche** (0.05–0.1). La letra clara
sobre oscuro se percibe más fina de lo que es, y con el mismo valor que en
claro se lee apretada. Si mueves una sección a `b-night`, súbele el
interlineado en el mismo commit.

**Todo número animado necesita red de seguridad.** Chrome CONGELA el `rAF`
cuando la pestaña pasa a segundo plano o el marco sale de vista, y el
odómetro se queda enseñando el número por el que iba: un `1` donde dice `13`,
o una cifra de dinero por cobrar que no es la que suma la agenda. Los dos
contadores (`.impact` y el total del hero) llevan un `setTimeout` que fija el
valor final pase lo que pase — se ralentiza en segundo plano, pero se
ejecuta, que es justo lo que el `rAF` no hace. Salió al probar en móvil: los
contadores mostraban `0` y `1` en vez de `5` y `13`.

**En la web pública NO hay cifras de marketing.** Ni contadores, ni «01 ·»
delante de las secciones, ni numeración en las listas, ni rangos del tipo
«entre 40 y 90 reservas». Los únicos números que quedan son los que salen
DENTRO de los mockups del producto —las horas de la agenda, el hilo de Neo,
el marcador del torneo, el panel—, porque ahí no son adorno: son la pantalla
real. Si vas a añadir un número, pregúntate si está dentro de un mockup; si
no lo está, cuéntalo con palabras.

**La franja de la semana sustituyó a la calculadora.** Antes había una
calculadora de capacidad con controles y totales en pesos. Ahora la misma
idea —la hora parada que no vuelve— se cuenta con una parrilla de siete días
donde se ven los huecos y unos cuantos se llenan solos al entrar en vista.
Cero cifras.

**Las celdas de esa parrilla se ven SIN JavaScript.** Nacen visibles y solo
se esconden bajo `html.js` mientras no les llega el revelado, igual que
`.rv`. Con `opacity:0` de serie, la primera versión dejó la sección
completamente vacía cuando el observador no disparó. Y la cascada cuelga del
observador de `.rv`, que ya existe y ya funciona, en vez de montar uno propio
compitiendo.

**El hero va centrado y en una sola columna.** Al pasar de dos columnas
quedaron dos restos que descuadraban: la agenda llevaba `margin-right`
negativo para sangrar por el canto derecho de la ventana (descentraba la caja
justo la mitad de ese margen, medido: 28px) y dos esquinas rectas de ese
lado. Centrada es una pieza exenta, con las cuatro esquinas iguales y
`text-align:left` propio, porque dentro es una tabla de datos.

**Solo se promete lo que la plataforma cumple.** La calculadora suma en
código, el total de la agenda del hero se deriva de `RESERVAS`, y las
funciones que todavía no existen llevan la etiqueta *por fases*. Si cambias
una cifra, cámbiala en el dato, no en el texto.

## Pendiente

- **El WhatsApp real.** La constante `WA` al principio del `<script>` está
  vacía y los enlaces marcados con `data-wa` conservan el marcador
  `57XXXXXXXXXX` del HTML. Pon los dígitos ahí y se reescriben los cuatro.
- Términos y privacidad: el pie apunta a `#`.
- El móvil se prueba con un `<iframe>` de 390px, no redimensionando la
  ventana: las media queries responden al ancho del marco, y las herramientas
  de automatización no siempre consiguen cambiar el viewport de verdad.
- **El dominio propio.** `sportplatz.com` NO está disponible: registrado en
  1999, en GoDaddy, aparcado por un tercero (`ns01.cashparking.com`). Libres
  a 21-08-2026: `sportplatz.co`, `sportplatz.com.co`, `sportplatz.io`,
  `getsportplatz.com`. Mientras tanto `og:url`, `og:image` y `canonical` van
  contra `https://sportplatz-web.vercel.app/`, que es lo que sirve la página
  de verdad — apuntarlas a un dominio ajeno dejaba la imagen de la tarjeta en
  el servidor de otro. El día que haya dominio se cambian esas tres y se
  añade en Vercel → Settings → Domains, con `www` como principal y el apex
  redirigiendo, igual que `pidapues.com`.

