# language: es
Característica: Reservar vehículo
  Como conductor quiero reservar un vehículo
  para asegurar su disponibilidad en las fechas que necesito

  Antecedentes:
    Dado que existe un vehículo publicado con patente "AE987CC" y precio base 2400000

  Escenario: El sistema retiene la disponibilidad al continuar al pago
    Dado que soy un conductor "A" autenticado
    Y firmo el contrato digital
    Cuando creo una reserva del vehículo "AE987CC" desde "2026-07-01T10:00:00Z" hasta "2026-07-03T10:00:00Z"
    Entonces la reserva queda en estado "pending_payment"
    Y la reserva tiene una fecha de expiración a 10 minutos

  Escenario: Dos conductores compiten por las mismas fechas
    Dado que el conductor "A" reservó el vehículo "AE987CC" desde "2026-07-01T10:00:00Z" hasta "2026-07-03T10:00:00Z" firmando el contrato
    Y el conductor "A" confirma el pago con "credit_card"
    Cuando el conductor "B" intenta reservar el vehículo "AE987CC" desde "2026-07-01T10:00:00Z" hasta "2026-07-03T10:00:00Z" firmando el contrato
    Entonces el conductor "B" recibe el código de error "RESERVATION_VEHICLE_NOT_AVAILABLE"

  Escenario: Solape parcial también bloquea
    Dado que el conductor "A" reservó el vehículo "AE987CC" desde "2026-07-01T10:00:00Z" hasta "2026-07-05T10:00:00Z" firmando el contrato
    Cuando el conductor "B" intenta reservar el vehículo "AE987CC" desde "2026-07-04T10:00:00Z" hasta "2026-07-07T10:00:00Z" firmando el contrato
    Entonces el conductor "B" recibe el código de error "RESERVATION_VEHICLE_NOT_AVAILABLE"

  Escenario: Vence la retención y se cancela la reserva
    Dado que el conductor "A" reservó el vehículo "AE987CC" desde "2026-07-01T10:00:00Z" hasta "2026-07-03T10:00:00Z" firmando el contrato
    Cuando transcurren 11 minutos sin completar el pago
    Y el sistema ejecuta el job de expiración de reservas
    Entonces la reserva del conductor "A" queda en estado "expired"
    Y el conductor "B" puede reservar el vehículo "AE987CC" desde "2026-07-01T10:00:00Z" hasta "2026-07-03T10:00:00Z" firmando el contrato

  Escenario: Pago exitoso confirma la reserva
    Dado que el conductor "A" reservó el vehículo "AE987CC" desde "2026-07-01T10:00:00Z" hasta "2026-07-03T10:00:00Z" firmando el contrato
    Cuando el conductor "A" confirma el pago con "debit_card"
    Entonces la reserva del conductor "A" queda en estado "confirmed"

  Escenario: No se permite pagar después del hold vencido
    Dado que el conductor "A" reservó el vehículo "AE987CC" desde "2026-07-01T10:00:00Z" hasta "2026-07-03T10:00:00Z" firmando el contrato
    Y transcurren 11 minutos sin completar el pago
    Cuando el conductor "A" confirma el pago con "credit_card"
    Entonces el conductor "A" recibe el código de error "RESERVATION_HOLD_EXPIRED"

  Escenario: Sin aceptar el contrato no se puede reservar
    Dado que soy un conductor "A" autenticado
    Cuando creo una reserva del vehículo "AE987CC" desde "2026-07-01T10:00:00Z" hasta "2026-07-03T10:00:00Z" sin firmar el contrato
    Entonces el conductor "A" recibe el código de error "RESERVATION_CONTRACT_NOT_ACCEPTED"
