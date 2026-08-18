# Dependencia incluida

`supabase.umd.js` es el cliente oficial de Supabase, versión **2.58.0**, en su
compilación UMD para navegador, **guardado aquí a propósito** en vez de
cargarse desde un CDN.

La razón es simple: si el CDN se cae, el login se cae. Para un demo daba igual;
para algo que va a usar gente de verdad, no. Aquí se sirve del mismo sitio que
el resto de la app y no hay una tercera parte en el camino crítico.

Se eligió la compilación **UMD** y no la ESM porque la ESM de esm.sh arrastra
polyfills de Node (`process`, `buffer`, y de ahí `events`, `tty`…) en una
cadena que no termina. La UMD es autónoma: cero imports, cero rutas externas.

## Actualizarlo

```bash
VER=2.58.0   # cambia la versión
curl -sL "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@$VER/dist/umd/supabase.js" \
  -o app/vendor/supabase.umd.js
```

Después comprueba que sigue siendo autónomo:

```bash
grep -cE '^import |from "/' app/vendor/supabase.umd.js   # debe dar 0
```
