# language: es
Característica: Gestión de reservas del conductor
  Como conductor
  quiero ver el detalle y estado de mis reservas activas y pasadas
  para hacer seguimiento de mis alquileres

  Antecedentes:
    Dado que estoy autenticado
    Y un vehículo con los siguientes datos:
      | patente | marca | modelo | año  | pasajeros | baul | transmisión | accesible | color | kilometraje | precio base | descripción | fotos                          |
      | AE987CC | Ford  | Ranger | 2023 | 5         | 800  | Manual      | No        | Gris  | 45000       | 2400000     |             | https://example.com/photo1.jpg |
    Y el vehículo ya está publicado
    Y que soy un conductor "A" autenticado

  # AC1: Listado de reservas
  # DADO que accedo a 'Mis reservas' CUANDO se carga la pantalla
  # ENTONCES veo reservas listadas con estado, fechas, vehículo, importe y acciones disponibles.

  Escenario: Listar reservas del conductor con múltiples estados
    Dado que el conductor "A" reservó el vehículo "AE987CC" desde "2026-07-01T10:00:00Z" hasta "2026-07-03T10:00:00Z" firmando el contrato
    Y el conductor "A" confirma el pago con "credit_card"
    Y que el conductor "A" reservó el vehículo "AE987CC" desde "2026-08-01T10:00:00Z" hasta "2026-08-03T10:00:00Z" firmando el contrato
    Cuando accedo a "Mis reservas"
    Entonces veo 2 reservas listadas
    Y la primera reserva muestra el estado "confirmed"
    Y la primera reserva incluye fechas, vehículo e importe

  Escenario: Listar reservas sin reservas previas
    Cuando accedo a "Mis reservas"
    Entonces la lista de reservas está vacía

  # @BLOCKED: requiere agregar query param ?status= a GET /reservations/mine
  # Escenario: Listar reservas filtrando por estado
  #   Dado que el conductor "A" reservó el vehículo "AE987CC" desde "2026-07-01T10:00:00Z" hasta "2026-07-03T10:00:00Z" firmando el contrato
  #   Y el conductor "A" confirma el pago con "credit_card"
  #   Y que el conductor "A" reservó el vehículo "AE987CC" desde "2026-08-01T10:00:00Z" hasta "2026-08-03T10:00:00Z" firmando el contrato
  #   Cuando accedo a "Mis reservas" con estado "confirmed"
  #   Entonces veo 1 reserva listada

  Escenario: Conductor no autenticado no puede listar reservas
    Dado que no estoy autenticado
    Cuando accedo a "Mis reservas"
    Entonces recibo un error de autenticación

  # AC2: Detalle de reserva activa
  # DADO que toco una reserva activa CUANDO se abre el detalle
  # ENTONCES puedo ver el contrato, descargar el comprobante y acceder a acciones (cancelar, reportar).

  Escenario: Ver detalle de reserva confirmada
    Dado que el conductor "A" reservó el vehículo "AE987CC" desde "2026-07-01T10:00:00Z" hasta "2026-07-03T10:00:00Z" firmando el contrato
    Y el conductor "A" confirma el pago con "credit_card"
    Cuando accedo al detalle de la reserva del conductor "A"
    Entonces la reserva del conductor "A" queda en estado "confirmed"
    Y veo la fecha de inicio "2026-07-01T10:00:00Z" y fin "2026-07-03T10:00:00Z"
    Y veo los datos del vehículo
    Y veo los datos del rentador
    Y veo el importe total
    Y veo que el contrato fue aceptado

  Escenario: Cancelar reserva en estado pending_payment
    Dado que el conductor "A" reservó el vehículo "AE987CC" desde "2026-07-01T10:00:00Z" hasta "2026-07-03T10:00:00Z" firmando el contrato
    Cuando cancelo la reserva del conductor "A"
    Entonces la reserva del conductor "A" queda en estado "cancelled"

  Escenario: Cancelar reserva ya expirada devuelve error
    Dado que el conductor "A" reservó el vehículo "AE987CC" desde "2026-07-01T10:00:00Z" hasta "2026-07-03T10:00:00Z" firmando el contrato
    Y transcurren 11 minutos sin completar el pago
    Y el sistema ejecuta el job de expiración de reservas
    Cuando cancelo la reserva del conductor "A"
    Entonces el conductor "A" recibe el código de error "RESERVATION_INVALID_TRANSITION"

  Escenario: Conductor no puede cancelar reserva de otro conductor
    Dado que el conductor "A" reservó el vehículo "AE987CC" desde "2026-07-01T10:00:00Z" hasta "2026-07-03T10:00:00Z" firmando el contrato
    Y que soy un conductor "B" autenticado
    Cuando cancelo la reserva del conductor "A"
    Entonces el conductor "B" recibe el código de error "RESERVATION_FORBIDDEN"

  # AC3: Detalle de reserva completada
  # DADO que toco una reserva completada CUANDO se abre el detalle
  # ENTONCES puedo ver el resumen y, si aplica, dejar o ver la reseña.
  #
  # @BLOCKED: requiere implementar el ciclo de vida (confirmed → in_progress → completed)
  # más el módulo de reviews (modelo, entity, service, controller, contracts).
  #
  # Escenario: Ver resumen de reserva completada
  #   Dado que soy un conductor "A" autenticado
  #   Y el conductor "A" tiene una reserva completada del vehículo "AE987CC"
  #   Cuando accedo al detalle de la reserva del conductor "A"
  #   Entonces veo el estado "completed"
  #   Y veo el resumen con fechas, vehículo e importe final
  #
  # Escenario: Dejar reseña en reserva completada
  #   Dado que soy un conductor "A" autenticado
  #   Y el conductor "A" tiene una reserva completada del vehículo "AE987CC"
  #   Cuando dejo una reseña de 4 estrellas con comentario "Muy buen vehículo"
  #   Entonces la reseña fue guardada exitosamente
  #
  # Escenario: Ver reseña existente en reserva completada
  #   Dado que soy un conductor "A" autenticado
  #   Y el conductor "A" tiene una reserva completada del vehículo "AE987CC"
  #   Y ya existe una reseña del conductor "A" para esa reserva
  #   Cuando accedo al detalle de la reserva del conductor "A"
  #   Entonces veo la reseña con puntuación 4 y comentario "Muy buen vehículo"
  #
  # Escenario: No se puede reseñar una reserva no completada
  #   Dado que soy un conductor "A" autenticado
  #   Y el conductor "A" reservó el vehículo "AE987CC" desde "2026-07-01T10:00:00Z" hasta "2026-07-03T10:00:00Z" firmando el contrato
  #   Y el conductor "A" confirma el pago con "credit_card"
  #   Cuando dejo una reseña de 4 estrellas con comentario "Muy buen vehículo"
  #   Entonces recibo un error indicando que la reserva no está completada
  #
  # Escenario: No se puede reseñar dos veces la misma reserva
  #   Dado que soy un conductor "A" autenticado
  #   Y el conductor "A" tiene una reserva completada del vehículo "AE987CC"
  #   Y ya existe una reseña del conductor "A" para esa reserva
  #   Cuando dejo una reseña de 3 estrellas con comentario "Regular"
  #   Entonces recibo un error indicando que la reserva ya fue reseñada
