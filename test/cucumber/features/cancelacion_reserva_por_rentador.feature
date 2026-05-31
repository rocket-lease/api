# language: es
Característica: Cancelación de reserva por rentador
  Como rentador
  quiero poder cancelar una reserva confirmada
  asumiendo las consecuencias correspondientes cuando sea necesario

  Antecedentes:
    Dado que estoy autenticado
    Y un vehículo con los siguientes datos:
      | patente | marca | modelo | año  | pasajeros | baul | transmisión | accesible | color | kilometraje | precio base | descripción     | fotos                |
      | AE987CC | Ford  | Ranger | 2023 | 5         | 800  | Manual      | No        | Gris  | 45000       | 2400000     | Pick-up         | https://i.com/1.jpg  |
    Y el vehículo ya está publicado con auto-aceptación activada

  Escenario: Cancelar reserva por el rentador aplica reembolso y penalizaciones
    Dado que el conductor "A" reservó el vehículo "AE987CC" desde "2026-07-01T10:00:00Z" hasta "2026-07-03T10:00:00Z" firmando el contrato
    Y el conductor "A" confirma el pago con "credit_card"
    Cuando el rentador cancela la reserva del conductor "A"
    Entonces el conductor "A" recibe reembolso total
    Y se aplica una penalización de 50 puntos a la reputación del rentador
    Y la reserva del conductor "A" queda en estado "cancelled"
