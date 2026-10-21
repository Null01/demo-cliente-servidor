// Caché en memoria con vencimiento, pensada para una sola instancia.
// Guarda la promesa (no el resultado): las peticiones simultáneas a la misma
// clave comparten una única carga, y los fallos nunca quedan cacheados.
function crearCacheTTL({ ttlMs, maxEntradas = 100 }) {
  const entradas = new Map();

  return {
    obtener(clave, cargar) {
      if (ttlMs <= 0) return cargar(); // TTL 0 = caché desactivada

      const ahora = Date.now();
      const existente = entradas.get(clave);
      if (existente && ahora < existente.expira) return existente.promesa;

      // Las claves salen de parámetros del usuario: se acota la memoria
      // descartando la entrada más antigua cuando se llega al tope.
      if (!existente && entradas.size >= maxEntradas) {
        entradas.delete(entradas.keys().next().value);
      }

      const entrada = {
        expira: ahora + ttlMs,
        promesa: cargar().catch((error) => {
          if (entradas.get(clave) === entrada) entradas.delete(clave);
          throw error;
        }),
      };
      entradas.set(clave, entrada);
      return entrada.promesa;
    },

    invalidar() {
      entradas.clear();
    },
  };
}

module.exports = { crearCacheTTL };
