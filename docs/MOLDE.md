# El molde de las demos

Sportplatz no es una demo de canchas. Es una demo de **plataforma**, y la parte
que convence no tiene nada que ver con el fútbol. Este documento separa lo que
se hereda de lo que hay que inventar de nuevo cada vez.

Se lee antes de empezar la siguiente. Si el proyecto nuevo lo hace otra persona
o Claude Code, esto es lo primero que se le pasa.

---

## 1. La pregunta que va antes del código

Una demo no se gana con pantallas: se gana con **un momento**. En Sportplatz es
este:

> Reservas una cancha como jugador, cambias a dueño, y ves tu propia reserva
> caer en la agenda a la hora exacta.

Veinte segundos. Nadie explicó nada y el visitante ya entendió que esto no es
un mockup. Todo lo demás de la plataforma existe para que ese momento sea
posible y creíble.

**Cada vertical tiene el suyo, y hay que encontrarlo antes de escribir una
línea.** Si se empieza por "hazme un dashboard", sale una demo bonita que no
convence.

Cuatro preguntas para encontrarlo:

1. ¿Quién es el **dueño** — el que paga la plataforma y quiere ver plata?
2. ¿Quién es el **cliente** del dueño — el que la usa desde el otro lado?
3. ¿Cuál es el **objeto** que se agenda, se vende o se apunta? (la cancha, la
   silla, el cupo, la mesa, la habitación)
4. ¿Qué hace el cliente en veinte segundos que el dueño ve aparecer al
   instante? **Ese es el momento.**

---

## 2. Las ocho decisiones que se heredan

Ninguna es de canchas. Son la anatomía.

### Un solo estado, y vive en el navegador del visitante

`S` en memoria, IndexedDB detrás (`app/core/store.js`). Sin registro, sin
backend, sin base de datos que administrar. El link se manda por WhatsApp y
funciona. Cada visitante juega con su propia copia y no le ensucia los datos a
nadie.

IndexedDB y no `localStorage`: un negocio de 40 canchas pesa 3,7 MB y
`localStorage` se llena a los ~4 MB — al pasarse, `setItem` lanza y se pierde
todo al recargar.

### Dos roles y un conmutador

Es **la** pieza. Sin ella esto sería una captura de pantalla animada. El
conmutador vive en el pie del rail (`openRoleSwap` en `app/ui/shell.js`) y
cambia la navegación entera, no solo los datos.

El rol no es un filtro de permisos: son dos productos distintos sobre el mismo
estado. El dueño ve plata y ocupación; el jugador ve su próximo partido.

### Semilla viva

`app/core/seed.js` genera 75 días de historia y 14 hacia adelante, **relativos
a `today()`**. La demo nunca se ve caducada: la abres hoy o dentro de seis
meses y siempre tiene tres meses de pasado creíble y dos semanas de futuro
reservable.

Nada de fechas fijas en el código. Nunca.

### Un onboarding que personaliza, no que da la bienvenida

Cuatro preguntas: nombre del negocio y WhatsApp, qué ofrece, cuántos, a qué
precio (`app/views/onboarding.js`). Con eso se genera todo. El visitante deja de
mirar un producto ajeno y se ve a sí mismo adentro — su nombre en el rail, sus
precios en la agenda, su negocio en boca del asistente.

Es la diferencia entre "mira lo que hacemos" y "mira lo tuyo funcionando".

### Sin build

Módulos ES servidos tal cual. Se clona, se despliega en Vercel y anda. Nadie
pelea con un bundler para cambiarle el color a un botón, y la demo no se
rompe en seis meses porque una dependencia cambió de mayor.

El precio: no hay nombres con hash, así que las imágenes se versionan a mano
(`ASSET_V` en `app/core/sports.js`). Vale la pena.

### Los tokens mandan

Todo el aspecto sale de `themes/momentum.css`, y `DESIGN.md` explica por qué
cada valor es el que es. `app/base.css` **solo consume tokens**; no hay un
color suelto en un componente.

Por eso pasar de tarjetas de vidrio a placa negra mate fueron dos tokens y no
cincuenta reglas. Un sistema donde retematizar cuesta caro es un sistema que
no se va a retematizar.

### Cada prueba deja constancia

Una demo que nadie registra es una demo que solo sirvió para el que la vio.
Lo que el prospecto configura —qué tiene, cuánto cobra, cuántos— es su perfil
comercial entero, entregado sin llenar un formulario, y lo que hace dentro
dice si le gustó: minutos, secciones, si habló con el asistente, si volvió.

Va a la base común de `Fily Demos` con tres llamadas (`fily-lead.js`), y el
contacto se pide DENTRO de la demo con su para qué a la vista: en Sportplatz
es el WhatsApp al que Neo le mandaría las reservas, y la demo se lo enseña
funcionando con su propio número. Un dato que se entrega porque sirve, no uno
que se saca.

### Un asistente que trabaja sobre el mismo estado

Neo no simula: lee la agenda real y escribe en ella (`app/core/neo.js`). La
reserva que crea hablando es **el mismo objeto** que crea el formulario, así
que cae en la agenda del dueño sin que nada más se entere.

No hace falta un modelo de lenguaje. La conversación tiene un solo objetivo, y
el trabajo real no es entender cualquier frase: es llenar cuatro huecos y leer
la disponibilidad de verdad para no prometer una hora ocupada.

---

## 3. El mapeo: lo único que cambia

La estructura se conserva y cambian los sustantivos.

```
negocio  →  recurso   →  agenda    →  comunidad   →  asistente
```

| Vertical  | Negocio  | Recurso        | Agenda   | Comunidad        |
|-----------|----------|----------------|----------|------------------|
| Canchas   | Complejo | Cancha         | Reserva  | Equipos, torneos |
| Barbería  | Local    | Silla / barbero| Cita     | Clientes fieles  |
| Gimnasio  | Sede     | Clase / salón  | Cupo     | Retos            |
| Consultorio | Clínica| Consultorio    | Turno    | Historia         |
| Restaurante | Local  | Mesa           | Reserva  | Fidelidad        |

La columna "comunidad" es la que más cambia y la que más se puede recortar: es
lo que le da vida a la demo cuando el negocio es aburrido, pero no todas las
verticales la necesitan.

---

## 4. Lo que NO se hereda

**La piel.** El estadio de noche, el rail negro mate, Archivo con eje de ancho,
los balones dibujados a mano — eso es de Sportplatz. Una barbería con fondo de
estadio se ve a plantilla, y a plantilla es exactamente lo que no queremos.

Cada demo vuelve a decidir:

- La tipografía y su jerarquía.
- El material de las superficies (aquí: placa mate sobre foto de estadio).
- El fondo a sangre, si lo hay, y de qué.
- El acento y su significado.

Se hereda **cómo** se organiza el color (tokens, un archivo, documentado), no
**qué** color.

**Y la lógica de dominio.** Llaves de torneo que avanzan solas, valla menos
vencida, podio — eso es fútbol. La siguiente demo tendrá su propia lógica de
verdad, y tiene que funcionar igual de en serio: si la agenda miente, la demo
no vende.

---

## 5. Orden de trabajo

1. Responder las cuatro preguntas y escribir el momento "ajá" en una frase.
2. Mapear el dominio a la tabla de arriba.
3. `PRODUCT.md` y `DESIGN.md` — decidir la piel antes de escribir CSS.
4. Núcleo: estado, roles, semilla viva, onboarding.
5. Las dos mitades: el lado del dueño y el lado del cliente.
6. El momento "ajá", y probarlo con alguien que no sepa nada del proyecto.
7. El registro de leads: tres llamadas a `fily-lead.js`.
8. El asistente, si suma.

Los pasos 1 y 2 cuestan media hora y deciden si la demo convence.
