# language: es
Característica: Cancelación en cascada de reservas al deshabilitar un vehículo
  Como rentador quiero que al deshabilitar o eliminar mi vehículo
  se cancelen las reservas pendientes de pago para no afectar a las ya confirmadas.

  Antecedentes:
    Dado que estoy autenticado
    Y un vehículo con los siguientes datos:
      | patente | marca | modelo | año  | pasajeros | baul | transmisión | accesible | color | kilometraje | precio base | descripción     | fotos                |
      | AE987CC | Ford  | Ranger | 2023 | 5         | 800  | Manual      | No        | Gris  | 45000       | 2400000     | Pick-up         | https://i.com/1.jpg  |
    Y el vehículo ya está publicado con auto-aceptación activada

  Escenario: Cancelación de holds al deshabilitar el vehículo
    Dado el vehículo tiene las siguientes reservas:
      | alias | estado          | desde                | hasta                |
      | A     | pending_payment | 2026-07-01T10:00:00Z | 2026-07-03T10:00:00Z |
      | B     | confirmed       | 2026-08-01T10:00:00Z | 2026-08-03T10:00:00Z |
    Cuando deshabilito el vehículo
    Entonces el vehículo se deshabilita
    Y el sistema cancela las reservas
    Y no afecta reservas ya confirmadas
