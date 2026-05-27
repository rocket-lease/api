#language: es
Característica: Gestión de medios de pago
  Como conductor
  quiero agregar, modificar y eliminar mis medios de pago
  para gestionar cómo pago mis reservas

  Antecedentes:
    Dado que estoy autenticado

  Escenario: Agregar un medio de pago
    Cuando agrego una tarjeta con los siguientes datos:
      | marca | ultimos4 |
      | Visa  | 1234     |
    Entonces la tarjeta queda guardada en mi lista de medios de pago

  Escenario: Editar un medio de pago
    Dado que tengo una tarjeta guardada
    Cuando edito la tarjeta para cambiar el titular a "Nuevo Titular"
    Entonces los cambios se guardan correctamente
    Y mi lista de medios de pago refleja la modificación

  Escenario: Eliminar un medio de pago
    Dado que tengo una tarjeta guardada
    Cuando elimino la tarjeta
    Entonces desaparece de mi lista de medios de pago

  Escenario: Eliminar el único medio de pago
    Dado que solo tengo un medio de pago
    Cuando elimino el medio de pago
    Entonces desaparece de mi lista de medios de pago
    Y mi lista de medios de pago queda vacía
