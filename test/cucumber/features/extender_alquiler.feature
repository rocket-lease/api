# language: es
Característica: Extender alquiler (conductor)
  Como conductor con un alquiler en curso
  quiero solicitar una extensión para quedarme más tiempo con el vehículo
  si lo necesito.

  Escenario: Solicitud de extensión con auto-accept ON
    Dado un rentador con vehículo "EX100AA" en auto-aceptación para extensiones con precio 2400000
    Y el conductor "X" tiene un alquiler en curso del vehículo "EX100AA" del "2026-07-01T10:00:00Z" al "2026-07-03T10:00:00Z"
    Cuando el conductor "X" solicita extender su alquiler hasta "2026-07-04T10:00:00Z"
    Entonces la respuesta de extensión tiene requiresApproval=false
    Y la respuesta de extensión tiene status "pending_payment"
    Y la nueva reserva tiene parentReservationId apuntando a la reserva original del conductor "X"

  Escenario: Solicitud de extensión con auto-accept OFF
    Dado un rentador con vehículo "EX200BB" en aprobación manual para extensiones con precio 2400000
    Y el conductor "Y" tiene un alquiler en curso del vehículo "EX200BB" del "2026-07-10T10:00:00Z" al "2026-07-12T10:00:00Z"
    Cuando el conductor "Y" solicita extender su alquiler hasta "2026-07-13T10:00:00Z"
    Entonces la respuesta de extensión tiene requiresApproval=true
    Y la respuesta de extensión tiene status "pending_approval"

  Escenario: Reserva no in_progress no permite extender
    Dado un rentador con vehículo "EX300CC" en auto-aceptación para extensiones con precio 2400000
    Y el conductor "Z" tiene una reserva confirmada del vehículo "EX300CC" del "2026-08-01T10:00:00Z" al "2026-08-03T10:00:00Z"
    Cuando el conductor "Z" solicita extender su alquiler hasta "2026-08-04T10:00:00Z"
    Entonces la respuesta de extensión es 409 con código "RESERVATION_EXTENSION_NOT_IN_PROGRESS"

  Escenario: newEndAt anterior al endAt actual del chain
    Dado un rentador con vehículo "EX400DD" en auto-aceptación para extensiones con precio 2400000
    Y el conductor "W" tiene un alquiler en curso del vehículo "EX400DD" del "2026-09-01T10:00:00Z" al "2026-09-03T10:00:00Z"
    Cuando el conductor "W" solicita extender su alquiler hasta "2026-09-02T10:00:00Z"
    Entonces la respuesta de extensión es 400 con código "RESERVATION_EXTENSION_INVALID_END_AT"

  Escenario: Conductor ajeno no puede extender un alquiler que no es suyo
    Dado un rentador con vehículo "EX500EE" en auto-aceptación para extensiones con precio 2400000
    Y el conductor "P" tiene un alquiler en curso del vehículo "EX500EE" del "2026-10-01T10:00:00Z" al "2026-10-03T10:00:00Z"
    Cuando el conductor "Q" intenta extender el alquiler del conductor "P" hasta "2026-10-04T10:00:00Z"
    Entonces la respuesta de extensión es 403

  Escenario: Cancelar el alquiler cancela todo el chain
    Dado un rentador con vehículo "EX600FF" en auto-aceptación para extensiones con precio 2400000
    Y el conductor "R" tiene un alquiler en curso del vehículo "EX600FF" del "2026-11-01T10:00:00Z" al "2026-11-03T10:00:00Z"
    Y el conductor "R" extendió su alquiler hasta "2026-11-05T10:00:00Z"
    Cuando el conductor "R" cancela su alquiler
    Entonces la reserva original del conductor "R" queda en estado "cancelled"
    Y la extensión del conductor "R" queda en estado "cancelled"

  Escenario: El detalle de la reserva expone el chain
    Dado un rentador con vehículo "EX700GG" en auto-aceptación para extensiones con precio 2400000
    Y el conductor "S" tiene un alquiler en curso del vehículo "EX700GG" del "2026-12-01T10:00:00Z" al "2026-12-03T10:00:00Z"
    Y el conductor "S" extendió su alquiler hasta "2026-12-05T10:00:00Z"
    Cuando el conductor "S" consulta el detalle de su reserva
    Entonces el detalle incluye un chain con 2 eslabones
