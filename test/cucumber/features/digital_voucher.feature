# language: es
Característica: Voucher Digital con código QR
  Como conductor con reserva confirmada
  quiero recibir un voucher digital con código QR
  para presentarlo al retirar el vehículo y tener comprobante de mi reserva

  Antecedentes:
    Dado que estoy autenticado
    Y un vehículo con los siguientes datos:
      | patente | marca | modelo | año  | pasajeros | baul | transmisión | accesible | color | kilometraje | precio base | descripción | fotos                          |
      | AE987CC | Ford  | Ranger | 2023 | 5         | 800  | Manual      | No        | Gris  | 45000       | 2400000     |             | https://example.com/photo1.jpg |
    Y el vehículo ya está publicado con auto-aceptación activada
    Y que soy un conductor "A" autenticado

  Escenario: Generar voucher al confirmar el pago
    Dado que el conductor "A" reservó el vehículo "AE987CC" desde "2026-07-01T10:00:00Z" hasta "2026-07-03T10:00:00Z" firmando el contrato
    Cuando el conductor "A" confirma el pago con "credit_card"
    Entonces el pago es exitoso
    Y la respuesta incluye un "voucherToken" válido
    Y puedo obtener el voucher de la reserva con los datos del conductor y vehículo

  Escenario: Verificar voucher válido
    Dado que el conductor "A" reservó el vehículo "AE987CC" desde "2026-07-01T10:00:00Z" hasta "2026-07-03T10:00:00Z" firmando el contrato
    Y el conductor "A" confirma el pago con "credit_card"
    Cuando el rentador escanea y verifica el token del voucher
    Entonces la verificación es exitosa indicando que el voucher es válido

  Escenario: Invalidar voucher si la reserva es cancelada
    Dado que el conductor "A" reservó el vehículo "AE987CC" desde "2026-07-01T10:00:00Z" hasta "2026-07-03T10:00:00Z" firmando el contrato
    Y el conductor "A" confirma el pago con "credit_card"
    Y la reserva es cancelada a través del vehículo
    Cuando el rentador escanea y verifica el token del voucher
    Entonces la verificación indica que el voucher no es válido
