# language: es
Característica: Recibir solicitud de reserva (rentador)
  Como rentador quiero recibir y ver las solicitudes de reserva que me hacen
  para decidir si las acepto o rechazo, controlando quién usa mi flota.

  Antecedentes:
    Dado un rentador con vehículo "AP100AA" en modo aprobación manual

  Escenario: Solicitud nueva queda esperando aprobación
    Cuando el conductor "A" crea una reserva del vehículo "AP100AA" desde "2026-07-01T10:00:00Z" hasta "2026-07-03T10:00:00Z"
    Entonces la reserva queda en estado "pending_approval"
    Y la reserva tiene TTL de 24 horas
    Y la reserva aparece en el panel de solicitudes del rentador

  Escenario: Rentador aprueba la solicitud
    Dada una solicitud "pending_approval" del conductor "A" sobre el vehículo "AP100AA" del "2026-07-04T10:00:00Z" al "2026-07-06T10:00:00Z"
    Cuando el rentador aprueba la solicitud
    Entonces la reserva pasa a "pending_payment"
    Y el conductor tiene 10 minutos para pagar

  Escenario: Rentador rechaza con razón
    Dada una solicitud "pending_approval" del conductor "A" sobre el vehículo "AP100AA" del "2026-07-07T10:00:00Z" al "2026-07-09T10:00:00Z"
    Cuando el rentador rechaza la solicitud con razón "Vehículo en mantenimiento"
    Entonces la reserva pasa a "rejected"
    Y el detalle de la reserva expone la razón "Vehículo en mantenimiento"

  Escenario: Aprobar dispara auto-rechazo en cascada de solapadas
    Dada una solicitud "pending_approval" del conductor "A" sobre el vehículo "AP100AA" del "2026-07-10T10:00:00Z" al "2026-07-13T10:00:00Z"
    Y una solicitud "pending_approval" del conductor "B" sobre el vehículo "AP100AA" del "2026-07-12T10:00:00Z" al "2026-07-15T10:00:00Z"
    Cuando el rentador aprueba la solicitud del conductor "A"
    Entonces la reserva del conductor "A" queda en estado "pending_payment"
    Y la reserva del conductor "B" queda en estado "rejected"
    Y la reserva del conductor "B" tiene una razón de rechazo no vacía

  Escenario: TTL vencido sin respuesta
    Dada una solicitud "pending_approval" del conductor "A" sobre el vehículo "AP100AA" del "2026-07-16T10:00:00Z" al "2026-07-18T10:00:00Z"
    Cuando transcurren 25 horas sin respuesta del rentador
    Y el sistema ejecuta el job de expiración de reservas
    Entonces la reserva del conductor "A" queda en estado "expired"

  Escenario: Auto-accept salta pending_approval
    Dado un rentador con vehículo "AP200BB" en modo auto-aceptación
    Cuando el conductor "A" crea una reserva del vehículo "AP200BB" desde "2026-07-20T10:00:00Z" hasta "2026-07-22T10:00:00Z"
    Entonces la reserva queda en estado "pending_payment"

  Escenario: Conductor retira solicitud pendiente
    Dada una solicitud "pending_approval" del conductor "A" sobre el vehículo "AP100AA" del "2026-07-23T10:00:00Z" al "2026-07-25T10:00:00Z"
    Cuando el conductor "A" retira la solicitud
    Entonces la reserva del conductor "A" queda en estado "cancelled"

  Escenario: Rentador ajeno intenta aprobar
    Dada una solicitud "pending_approval" del conductor "A" sobre el vehículo "AP100AA" del "2026-07-26T10:00:00Z" al "2026-07-28T10:00:00Z"
    Cuando un rentador ajeno intenta aprobar la solicitud
    Entonces el sistema responde 403
    Y la reserva del conductor "A" queda en estado "pending_approval"

  Escenario: Aprobar solicitud ya rechazada falla
    Dada una solicitud "pending_approval" del conductor "A" sobre el vehículo "AP100AA" del "2026-07-29T10:00:00Z" al "2026-07-31T10:00:00Z"
    Y el rentador rechazó la solicitud
    Cuando el rentador intenta aprobar la solicitud nuevamente
    Entonces el sistema responde 409 con código "RESERVATION_INVALID_TRANSITION"
