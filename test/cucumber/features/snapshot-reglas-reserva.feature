# language: es
Característica: Snapshot inmutable de reglas en Reservation (US-49)
  Las reservas confirmadas mantienen las reglas y el precio que regían al
  momento de confirmar el pago, incluso si después el rentador modifica el
  set o el precio del vehículo.

  Escenario: Cambio posterior del set no afecta reserva confirmada
    Dado que soy rentador con un vehículo "AP100AA" en modo auto-aceptación
    Y el vehículo "AP100AA" usa un set "Flexible" sin seña
    Y el conductor "A" confirmó una reserva del vehículo "AP100AA"
    Cuando el rentador cambia el set "Flexible" a depositPercentage = 50
    Entonces la reserva confirmada del conductor "A" conserva depositPercentageSnapshot vacío

  Escenario: Cambio posterior del precio no afecta reserva confirmada
    Dado que soy rentador con un vehículo "AP200BB" en modo auto-aceptación
    Y el vehículo "AP200BB" tiene basePriceCents = 50000
    Y el conductor "A" confirmó una reserva del vehículo "AP200BB"
    Cuando el rentador cambia el precio del vehículo "AP200BB" a 70000
    Entonces la reserva confirmada del conductor "A" conserva basePriceCentsSnapshot = 50000

  Escenario: Vehículo sin set asignado usa defaults al confirmar
    Dado que soy rentador con un vehículo "AP300CC" en modo auto-aceptación sin set asignado
    Cuando el conductor "A" confirma una reserva del vehículo "AP300CC"
    Entonces la reserva queda con depositPercentageSnapshot vacío
    Y la reserva queda con cancellationPolicySnapshot = "FLEXIBLE"
    Y la reserva queda con maxKilometrageTypeSnapshot = "UNLIMITED"
    Y la reserva queda con minRentalDaysSnapshot = 1
