# language: es
Característica: Historial de reservas y reseñas del rentador
  Como rentador
  quiero ver el historial completo de mis reservas y reseñas recibidas
  para evaluar mi desempeño en la plataforma

  Antecedentes:
    Dado que existe un vehículo publicado con patente "AB123CD", precio base 1500000 y auto-aceptación activada

  # ==========================================================================
  # AC1: DADO que accedo al historial de reservas CUANDO se carga
  # ENTONCES veo todas las reservas con estado, fechas, vehículo, conductor y
  # monto, con filtros por período y estado.
  # ==========================================================================

  Escenario: Ver historial de reservas con múltiples estados
    Dado que el conductor "A" reservó el vehículo "AB123CD" desde "2026-08-01T10:00:00Z" hasta "2026-08-03T10:00:00Z" firmando el contrato
    Y el conductor "A" confirma el pago con "credit_card"
    Y que el conductor "B" reservó el vehículo "AB123CD" desde "2026-09-01T10:00:00Z" hasta "2026-09-03T10:00:00Z" firmando el contrato
    Cuando el rentador accede al historial de reservas
    Entonces el historial muestra 2 reservas
    Y cada reserva tiene su estado, fechas, vehículo, conductor y monto

  Escenario: Filtrar historial por estado
    Dado que el conductor "A" reservó el vehículo "AB123CD" desde "2026-08-01T10:00:00Z" hasta "2026-08-03T10:00:00Z" firmando el contrato
    Y el conductor "A" confirma el pago con "credit_card"
    Y que el conductor "B" reservó el vehículo "AB123CD" desde "2026-09-01T10:00:00Z" hasta "2026-09-03T10:00:00Z" firmando el contrato
    Cuando el rentador filtra el historial por estado "confirmed"
    Entonces el historial muestra solo las reservas confirmadas

  Escenario: Filtrar historial por período
    Dado que el conductor "A" reservó el vehículo "AB123CD" desde "2026-08-01T10:00:00Z" hasta "2026-08-03T10:00:00Z" firmando el contrato
    Y el conductor "A" confirma el pago con "credit_card"
    Y que el conductor "B" reservó el vehículo "AB123CD" desde "2026-09-01T10:00:00Z" hasta "2026-09-03T10:00:00Z" firmando el contrato
    Cuando el rentador filtra el historial por período desde "2026-08-01T00:00:00Z" hasta "2026-08-31T23:59:59Z"
    Entonces el historial muestra solo las reservas del período indicado

  Escenario: Rentador no autenticado intenta ver historial
    Cuando el rentador accede al historial de reservas sin haber iniciado sesión
    Entonces la aplicación solicita iniciar sesión

  # ==========================================================================
  # AC2: DADO que accedo al historial de reseñas CUANDO se carga
  # ENTONCES veo todas las reseñas recibidas (por vehículo y personales)
  # con fecha, calificación y comentario.
  # ==========================================================================

  Escenario: Ver reseñas recibidas de vehículo y personales
    Dado que el conductor "A" reservó el vehículo "AB123CD" desde "2026-08-01T10:00:00Z" hasta "2026-08-03T10:00:00Z" firmando el contrato
    Y el conductor "A" confirma el pago con "credit_card"
    Y que el conductor "B" reservó el vehículo "AB123CD" desde "2026-09-01T10:00:00Z" hasta "2026-09-03T10:00:00Z" firmando el contrato
    Y el conductor "B" confirma el pago con "credit_card"
    Y que el conductor "A" deja una reseña de 5 estrellas sobre el vehículo con comentario "Excelente vehículo"
    Y que el conductor "B" deja una reseña de 4 estrellas sobre el rentador con comentario "Muy buen trato"
    Cuando el rentador consulta las reseñas que recibió
    Entonces veo 2 reseñas recibidas
    Y la reseña del conductor "A" es sobre el vehículo con calificación 5 y comentario "Excelente vehículo"
    Y la reseña del conductor "B" es sobre el rentador con calificación 4 y comentario "Muy buen trato"

  Escenario: Rentador sin reseñas recibidas
    Cuando el rentador consulta las reseñas que recibió
    Entonces no tiene reseñas recibidas

  # ==========================================================================
  # AC3: DADO que selecciono una reserva del historial CUANDO accedo al detalle
  # ENTONCES puedo ver toda la información del alquiler y la reseña asociada
  # si existe.
  # ==========================================================================

  Escenario: Ver detalle de reserva con reseña asociada
    Dado que el conductor "A" reservó el vehículo "AB123CD" desde "2026-08-01T10:00:00Z" hasta "2026-08-03T10:00:00Z" firmando el contrato
    Y el conductor "A" confirma el pago con "credit_card"
    Y que el conductor "A" deja una reseña de 5 estrellas sobre el vehículo con comentario "Excelente vehículo"
    Cuando el rentador selecciona la reserva del conductor "A"
    Entonces veo el detalle completo del alquiler con fechas, vehículo, rentador, importe y contrato
    Y veo la reseña que dejó el conductor con calificación 5 y comentario "Excelente vehículo"

  Escenario: Ver detalle de reserva sin reseña
    Dado que el conductor "A" reservó el vehículo "AB123CD" desde "2026-08-01T10:00:00Z" hasta "2026-08-03T10:00:00Z" firmando el contrato
    Y el conductor "A" confirma el pago con "credit_card"
    Cuando el rentador selecciona la reserva del conductor "A"
    Entonces veo el detalle completo del alquiler con fechas, vehículo, rentador, importe y contrato
    Y la reserva no tiene ninguna reseña asociada
