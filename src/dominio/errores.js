// Error de negocio con un código simbólico. El dominio nunca sabe que existe
// HTTP: la capa de presentación traduce el código a un estado de respuesta.
class ErrorDeNegocio extends Error {
  constructor(codigo, mensaje) {
    super(mensaje);
    this.codigo = codigo;
  }
}

module.exports = { ErrorDeNegocio };
