/* ==========================================================================
   NÚCLEO · Persistencia
   El estado vivo es `S`, un objeto plano en memoria. Todo lo demás lo lee
   síncrono. Este módulo es lo único que sabe DÓNDE se guarda.

   Va a IndexedDB, no a localStorage. Medido en el navegador: el estado de un
   negocio de 2 canchas ya pesa 721 KB y localStorage se llena a los ~4 MB.
   Un complejo de 12 canchas genera ~5.600 reservas de semilla y se pasa del
   cupo: `setItem` lanza, no persiste nada, y al recargar se pierde el
   negocio entero. IndexedDB no tiene ese techo.

   localStorage queda de respaldo por si IndexedDB está bloqueado (Safari en
   navegación privada), y la memoria de respaldo del respaldo para que la
   sesión funcione aunque no se pueda escribir en ningún sitio.
   ========================================================================== */

const THEME = document.body.dataset.theme || 'momentum';
export const KEY = 'sportplatz.v2.' + THEME;
const LEGACY_KEY = 'sportplatz.v1.' + THEME;

const DB_NAME = 'sportplatz';
const DB_VER = 1;
const SHELF = 'estado';

let db = null;
let memory = null;      // respaldo del respaldo: la sesión siempre funciona
let idbBroken = false;

function openDB() {
  return new Promise((resolve) => {
    if (db) return resolve(db);
    if (idbBroken || !self.indexedDB) return resolve(null);
    let req;
    try { req = indexedDB.open(DB_NAME, DB_VER); }
    catch { idbBroken = true; return resolve(null); }
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains(SHELF)) d.createObjectStore(SHELF);
    };
    req.onsuccess = () => { db = req.result; resolve(db); };
    req.onerror   = () => { idbBroken = true; resolve(null); };
    req.onblocked = () => { idbBroken = true; resolve(null); };
  });
}

function idbGet(key) {
  return openDB().then(d => d && new Promise((resolve) => {
    try {
      const tx = d.transaction(SHELF, 'readonly');
      const rq = tx.objectStore(SHELF).get(key);
      rq.onsuccess = () => resolve(rq.result ?? null);
      rq.onerror   = () => resolve(null);
    } catch { resolve(null); }
  }));
}

function idbPut(key, value) {
  return openDB().then(d => d && new Promise((resolve) => {
    try {
      const tx = d.transaction(SHELF, 'readwrite');
      tx.objectStore(SHELF).put(value, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror    = () => resolve(false);
      tx.onabort    = () => resolve(false);
    } catch { resolve(false); }
  }));
}

function idbDel(key) {
  return openDB().then(d => d && new Promise((resolve) => {
    try {
      const tx = d.transaction(SHELF, 'readwrite');
      tx.objectStore(SHELF).delete(key);
      tx.oncomplete = () => resolve(true);
      tx.onerror    = () => resolve(false);
    } catch { resolve(false); }
  }));
}

/* localStorage solo como respaldo. Se guarda una versión SIN fotos para que
   quepa: el estado con fotos pesa megas, el estado pelado ronda el mega. */
function lite(data) {
  if (!data) return data;
  const out = structuredClone(data);
  out.photos = { sports: {} };
  out.courts = out.courts.map(c => ({ ...c, photo: undefined }));
  if (out.business) out.business.logo = undefined;
  out.__lite = true;
  return out;
}

export const Store = {
  async read() {
    const fromIdb = await idbGet(KEY);
    if (fromIdb) return fromIdb;
    // migración desde la versión que guardaba en localStorage
    for (const k of [KEY, LEGACY_KEY]) {
      try {
        const raw = localStorage.getItem(k);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.courts?.length) { await idbPut(KEY, parsed); return parsed; }
        }
      } catch { /* sin permiso o JSON roto */ }
    }
    return memory;
  },

  /** Devuelve una promesa, pero nadie tiene que esperarla: `S` ya cambió. */
  async write(data) {
    memory = data;
    const ok = await idbPut(KEY, data);
    if (ok) return true;
    try { localStorage.setItem(KEY, JSON.stringify(lite(data))); return 'lite'; }
    catch { return false; }
  },

  async clear() {
    memory = null;
    await idbDel(KEY);
    try { localStorage.removeItem(KEY); localStorage.removeItem(LEGACY_KEY); } catch { /* sin permiso */ }
  }
};

/* ── El estado vivo ──────────────────────────────────────────────────────── */

export let S = null;
export const setS = (next) => { S = next; };

/* Guardado con freno: la app llama a save() en cada tecla del formulario de
   precio. Sin esto, cada pulsación abre una transacción de IndexedDB. */
let pending = null;
export function save() {
  if (!S) return;
  clearTimeout(pending);
  pending = setTimeout(() => Store.write(S), 120);
  return true;
}

/** Para lo que no puede esperar al freno: reiniciar, cerrar la pestaña. */
export const saveNow = () => Store.write(S);
