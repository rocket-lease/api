# language: es
Característica: Panel de reservas del rentador
  Como rentador quiero ver todas mis reservas organizadas por estado
  para gestionar mi operación diaria

  Antecedentes:
    Dado que existe un vehículo publicado con patente "RT123AA" y precio base 1000000

  Escenario: El rentador ve sus reservas
    Dado que el conductor "A" reservó el vehículo "RT123AA" desde "2026-08-01T10:00:00Z" hasta "2026-08-03T10:00:00Z" firmando el contrato
    Cuando el rentador consulta su panel de reservas
    Entonces recibo HTTP 200
    Y el panel contiene 1 reserva en estado "pending_payment"

  Escenario: Filtrar por estado
    Dado que el conductor "A" reservó el vehículo "RT123AA" desde "2026-08-10T10:00:00Z" hasta "2026-08-12T10:00:00Z" firmando el contrato
    Y el conductor "A" confirma el pago con "credit_card"
    Cuando el rentador filtra su panel por estado "confirmed"
    Entonces recibo HTTP 200
    Y el panel contiene 1 reserva en estado "confirmed"

  Escenario: Paginación
    Dado que el conductor "A" reservó el vehículo "RT123AA" desde "2026-09-01T10:00:00Z" hasta "2026-09-02T10:00:00Z" firmando el contrato
    Y que el conductor "A" reservó el vehículo "RT123AA" desde "2026-09-05T10:00:00Z" hasta "2026-09-06T10:00:00Z" firmando el contrato
    Cuando el rentador consulta su panel con página 1 y tamaño 1
    Entonces recibo HTTP 200
    Y el panel contiene 1 reserva
    Y el total reportado es 2

  Escenario: Sin token retorna 401
    Cuando consulto el panel del rentador sin token
    Entonces recibo HTTP 401
