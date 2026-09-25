// Capa HTTP: extrae los datos de la petición, delega en la capa de
// aplicación y traduce los resultados (o los errores de negocio) a
// códigos de estado. Los códigos HTTP se deciden aquí, no en el dominio.
const express = require('express');
const citaService = require('../aplicacion/citaService');
const { ErrorDeNegocio } = require('../dominio/reglasDeAgenda');

const router = express.Router();

const CODIGO_HTTP = {
  DATOS_FALTANTES: 400,
  FECHA_INVALIDA: 400,
  FECHA_PASADA: 400,
  AGENDA_OCUPADA: 409,
};

// Respuestas que no deben guardarse: cambian en cada petición o al reservar.
const sinCache = (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
};

// Errores de negocio → su código HTTP; cualquier otro → 500 genérico.
function manejarError(res, error, contexto, mensaje500) {
  if (error instanceof ErrorDeNegocio) {
    return res.status(CODIGO_HTTP[error.codigo] || 400).json({ error: error.message });
  }
  console.error(`${contexto}:`, error.message);
  res.status(500).json({ error: mensaje500 });
}

router.get('/salud', sinCache, (req, res) => {
  res.json({ estado: 'ok', servidor: 'activo', hora: new Date().toISOString() });
});

// GET /api/citas?limite=50&pagina=1&desde=<ISO>
// El cuerpo sigue siendo un arreglo (mismo contrato); la paginación viaja
// en cabeceras para no romper a los clientes existentes.
router.get('/citas', sinCache, async (req, res) => {
  try {
    const { citas, pagina, limite, hayMas } = await citaService.consultarCitas(req.query);
    res.set({
      'X-Pagina': pagina,
      'X-Limite': limite,
      'X-Hay-Mas': hayMas,
    });
    res.json(citas);
  } catch (error) {
    manejarError(res, error, 'Error consultando citas', 'No se pudo consultar la base de datos');
  }
});

// El catálogo casi no cambia: el navegador también puede reutilizarlo 60 s.
router.get('/profesionales', async (req, res) => {
  try {
    const profesionales = await citaService.consultarProfesionales();
    res.set('Cache-Control', 'public, max-age=60');
    res.json(profesionales);
  } catch (error) {
    manejarError(res, error, 'Error consultando profesionales', 'No se pudo consultar la base de datos');
  }
});

router.post('/citas', async (req, res) => {
  try {
    const resultado = await citaService.reservarCita(req.body);
    res.status(201).json(resultado);
  } catch (error) {
    manejarError(res, error, 'Error creando cita', 'No se pudo guardar en la base de datos');
  }
});

module.exports = router;
