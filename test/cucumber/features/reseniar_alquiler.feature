# language: es
Característica: Reseñar alquiler
  Como conductor o rentador que completó un alquiler
  quiero dejar una reseña a la contraparte y al vehículo
  para que otros usuarios conozcan mi experiencia

  Antecedentes:
    Dado que existe un vehículo publicado con patente "AE987CC", precio base 2400000 y auto-aceptación activada

  # ==========================================================================
  # AC1: DADO que la reserva está 'Completada' CUANDO accedo al historial
  # ENTONCES la opción 'Dejar reseña' está habilitada.
  # ==========================================================================

  Escenario: Conductor ve opción "Dejar reseña" en historial para reserva completada
    Dado que el conductor "A" reservó el vehículo "AE987CC" desde "2026-07-01T10:00:00Z" hasta "2026-07-03T10:00:00Z" firmando el contrato
    Y el conductor "A" confirma el pago con "credit_card"
    Y el rentador confirma el retiro del vehículo del conductor "A"
    Y el conductor "A" confirma la devolución
    Cuando el conductor "A" accede al historial de reservas
    Entonces el conductor "A" ve la opción "Dejar reseña" para la reserva completada

  Escenario: Rentador no ve opción "Dejar reseña" para reserva no completada
    Dado que el conductor "A" reservó el vehículo "AE987CC" desde "2026-07-01T10:00:00Z" hasta "2026-07-03T10:00:00Z" firmando el contrato
    Y el conductor "A" confirma el pago con "credit_card"
    Cuando el rentador accede al historial de reservas
    Entonces no hay opción "Dejar reseña" para la reserva

  # ==========================================================================
  # AC2: DADO que completo la reseña con 1 a 5 estrellas y comentario CUANDO
  # la envío ENTONCES se publica en el perfil del vehículo y de la contraparte.
  # ==========================================================================

  Escenario: Conductor deja reseña del vehículo en reserva completada
    Dado que el conductor "A" reservó el vehículo "AE987CC" desde "2026-07-01T10:00:00Z" hasta "2026-07-03T10:00:00Z" firmando el contrato
    Y el conductor "A" confirma el pago con "credit_card"
    Y el rentador confirma el retiro del vehículo del conductor "A"
    Y el conductor "A" confirma la devolución
    Cuando el conductor "A" deja una reseña de 4 estrellas sobre el vehículo con comentario "Muy buen vehículo"
    Entonces la reseña fue guardada exitosamente
    Y la reseña del conductor "A" es visible en el perfil del vehículo

  Escenario: Conductor deja reseña del rentador en reserva completada
    Dado que el conductor "A" reservó el vehículo "AE987CC" desde "2026-07-01T10:00:00Z" hasta "2026-07-03T10:00:00Z" firmando el contrato
    Y el conductor "A" confirma el pago con "credit_card"
    Y el rentador confirma el retiro del vehículo del conductor "A"
    Y el conductor "A" confirma la devolución
    Cuando el conductor "A" deja una reseña de 5 estrellas sobre el rentador con comentario "Excelente trato"
    Entonces la reseña fue guardada exitosamente
    Y la reseña del conductor "A" es visible en el perfil del rentador

  Escenario: Rentador deja reseña del conductor en reserva completada
    Dado que el conductor "A" reservó el vehículo "AE987CC" desde "2026-07-01T10:00:00Z" hasta "2026-07-03T10:00:00Z" firmando el contrato
    Y el conductor "A" confirma el pago con "credit_card"
    Y el rentador confirma el retiro del vehículo del conductor "A"
    Y el conductor "A" confirma la devolución
    Cuando el rentador deja una reseña de 3 estrellas sobre el conductor con comentario "Conductor puntual"
    Entonces la reseña fue guardada exitosamente
    Y la reseña del rentador es visible en el perfil del conductor

  # ==========================================================================
  # AC3 (simplificado): La reseña se publica inmediatamente al crearla.
  # No hay período de doble ciego.
  # ==========================================================================

  Escenario: Reseña visible inmediatamente después de crearla
    Dado que el conductor "A" completó un alquiler del vehículo "AE987CC"
    Cuando el conductor "A" deja una reseña de 5 estrellas sobre el vehículo con comentario "Impecable"
    Entonces la reseña es visible inmediatamente en el perfil del vehículo

  # ==========================================================================
  # AC4: DADO que accedo al historial de reservas CUANDO presiono 'Ver reseña'
  # ENTONCES puedo obtener la información de la reseña generada anteriormente.
  # ==========================================================================

  Escenario: Conductor ve su reseña existente en el detalle de la reserva completada
    Dado que el conductor "A" completó un alquiler del vehículo "AE987CC"
    Y el conductor "A" dejó una reseña de 4 estrellas sobre el vehículo con comentario "Muy buen vehículo"
    Cuando el conductor "A" accede al detalle de la reserva
    Entonces ve la reseña con puntuación 4 y comentario "Muy buen vehículo"
    Y la reseña fue generada para el vehículo

  Escenario: Rentador ve su reseña existente en el detalle de la reserva completada
    Dado que el conductor "A" completó un alquiler del vehículo "AE987CC"
    Y el rentador dejó una reseña de 5 estrellas sobre el conductor con comentario "Muy buen conductor"
    Cuando el rentador accede al detalle de la reserva
    Entonces ve la reseña con puntuación 5 y comentario "Muy buen conductor"
    Y la reseña fue generada para el conductor

  # ==========================================================================
  # Edge cases
  # ==========================================================================

  Escenario: No se puede reseñar una reserva no completada
    Dado que el conductor "A" reservó el vehículo "AE987CC" desde "2026-07-01T10:00:00Z" hasta "2026-07-03T10:00:00Z" firmando el contrato
    Y el conductor "A" confirma el pago con "credit_card"
    Cuando el conductor "A" deja una reseña de 4 estrellas sobre el vehículo con comentario "Muy buen vehículo"
    Entonces recibo un error indicando que la reserva no está completada

  Escenario: No se puede reseñar dos veces la misma reserva
    Dado que el conductor "A" completó un alquiler del vehículo "AE987CC"
    Y el conductor "A" dejó una reseña de 5 estrellas sobre el vehículo con comentario "Impecable"
    Cuando el conductor "A" deja una reseña de 3 estrellas sobre el vehículo con comentario "Regular"
    Entonces recibo un error indicando que la reserva ya fue reseñada

  Escenario: Conductor no autenticado no puede dejar reseña
    Dado que el conductor "A" completó un alquiler del vehículo "AE987CC"
    Y que no estoy autenticado
    Cuando dejo una reseña de 4 estrellas sobre el vehículo con comentario "Bueno"
    Entonces recibo un error de autenticación
