/* ==========================================================================
   NÚCLEO · Lead (fily-lead)

   Copia del SDK compartido de Fily & Co: vive igual en cada demo, así que
   se actualiza en `Fily Demos/sdk/fily-lead.js` y se copia, no se edita
   aquí. Registra quién probó la demo y cuánto se enganchó. Dos llamadas y ya está:

     filyLead.perfil({ resumen: '10 canchas · $60k–$120k', datos: {...} })
     filyLead.senal('uso_asistente')

   Reglas que se respetan aquí y no hace falta repetir en cada demo:

   · Nunca bloquea ni rompe. Si la red falla, si el endpoint no existe o si
     alguien navega a mitad del envío, la demo sigue como si nada. Un CRM
     caído no puede costar una prueba.
   · Una persona, un lead. El identificador vive en el navegador, así que
     quien vuelve mañana suma a su ficha en vez de crear otra.
   · Se envía agrupado. Las señales se acumulan en memoria y salen juntas
     cada pocos segundos y al salir de la página, no una petición por clic.
   ========================================================================== */

const ENDPOINT = 'https://filyandco.com/api/lead';
const LLAVE = 'fily.visitante';
const ESPERA = 4000;          // agrupa lo que pase en estos segundos

let plataforma = 'demo';
let pendiente = null;
let temporizador = null;
let entro = Date.now();
let enviadoAlgunaVez = false;
const vistas = new Set();   // secciones distintas que ha abierto

/* El identificador del visitante. `crypto.randomUUID` no existe en navegadores
   viejos y en contextos sin HTTPS; el respaldo no tiene que ser criptográfico,
   solo distinto para cada quien. */
function visitante() {
  try {
    let v = localStorage.getItem(LLAVE);
    if (!v) {
      v = (crypto.randomUUID?.() || `v_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`);
      localStorage.setItem(LLAVE, v);
    }
    return v;
  } catch {
    // Navegación privada con el almacenamiento cerrado: se manda un id de
    // sesión y esa visita cuenta como alguien nuevo. Es lo correcto: sin
    // almacenamiento no hay forma honesta de reconocer a nadie.
    return `s_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  }
}

const campana = () => {
  try {
    const p = new URLSearchParams(location.search);
    return p.get('utm_campaign') || p.get('utm_source') || '';
  } catch { return ''; }
};

function acumular(parche) {
  pendiente = pendiente || { perfil: {}, senales: {}, contacto: {} };
  for (const clave of ['perfil', 'senales', 'contacto']) {
    if (parche[clave]) Object.assign(pendiente[clave], parche[clave]);
  }
  if (parche.resumen) pendiente.resumen = parche.resumen;

  clearTimeout(temporizador);
  temporizador = setTimeout(enviar, ESPERA);
}

function cuerpo() {
  const minutos = Math.round((Date.now() - entro) / 6000) / 10;
  return JSON.stringify({
    plataforma,
    visitante: visitante(),
    resumen: pendiente?.resumen,
    perfil: pendiente?.perfil || {},
    senales: { ...(pendiente?.senales || {}), minutos, nueva_visita: !enviadoAlgunaVez },
    contacto: pendiente?.contacto || {},
    referente: document.referrer || '',
    campana: campana()
  });
}

function enviar({ alSalir = false } = {}) {
  if (!pendiente) return;
  const datos = cuerpo();
  pendiente = null;
  enviadoAlgunaVez = true;
  entro = Date.now();          // los minutos ya contados no se cuentan dos veces
  clearTimeout(temporizador);

  /* Al salir, `sendBeacon`: es lo único que el navegador garantiza entregar
     cuando la pestaña se está cerrando. Un fetch normal ahí se cancela. */
  if (alSalir && navigator.sendBeacon) {
    try { navigator.sendBeacon(ENDPOINT, new Blob([datos], { type: 'application/json' })); } catch {}
    return;
  }
  fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: datos,
    keepalive: true
  }).catch(() => {});
}

export const filyLead = {
  /** Se llama una vez, al arrancar la demo. */
  init(nombrePlataforma) {
    plataforma = nombrePlataforma;
    addEventListener('pagehide', () => enviar({ alSalir: true }));
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') enviar({ alSalir: true });
    });
    return this;
  },

  /** El negocio que configuró: `resumen` es la línea que se lee en el panel. */
  perfil({ resumen, datos = {} } = {}) {
    acumular({ resumen, perfil: datos });
    return this;
  },

  /** Quién es y por dónde se le escribe. */
  contacto({ nombre, whatsapp, correo } = {}) {
    acumular({ contacto: { nombre, whatsapp, correo } });
    // El contacto es el dato que no se puede perder: sale de inmediato.
    enviar();
    return this;
  },

  /** Un hito: 'uso_asistente', 'reservo', 'cambio_color'… */
  senal(nombre, valor = true) {
    acumular({ senales: { [nombre]: valor } });
    return this;
  },

  /** Cuántas secciones distintas ha visto. Se llama en cada navegación. */
  seccion(id) {
    vistas.add(id);
    acumular({ senales: { secciones: vistas.size } });
    return this;
  }
};
