# language: es
Característica: Pagar reserva
  Como conductor quiero pagar mi reserva con diferentes métodos
  para formalizar el alquiler de forma segura

  Antecedentes:
    Dado que estoy autenticado
    Y un vehículo con los siguientes datos:
      | patente | marca | modelo | año  | pasajeros | baul | transmisión | accesible | color | kilometraje | precio base | descripción | fotos                          | autoAccept |
      | AE987CC | Ford  | Ranger | 2023 | 5         | 800  | Manual      | No        | Gris  | 45000       | 2400000     |             | https://example.com/photo1.jpg | false      |
    Y el vehículo ya está publicado

  # AC1: El conductor ve los métodos de pago disponibles
  # DADO que estoy en el flujo de pago CUANDO selecciono el método
  # ENTONCES veo tarjeta de crédito, débito, transferencia bancaria y billeteras virtuales

  Escenario: El conductor ve los métodos de pago disponibles
    Dado que soy un conductor "A" autenticado
    Y que el conductor "A" reservó el vehículo "AE987CC" desde "2026-07-01T10:00:00Z" hasta "2026-07-03T10:00:00Z" firmando el contrato
    Cuando el conductor "A" consulta los métodos de pago disponibles
    Entonces el conductor "A" ve métodos de pago: "credit_card, debit_card, bank_transfer, digital_wallet"

  # AC2: Pago por transferencia bancaria genera CBU/CVU con validez 2h
  # DADO que elijo pago por transferencia CUANDO confirmo
  # ENTONCES el sistema genera CBU/CVU y monto con validez de 2 horas,
  # y la reserva queda en 'Pendiente de acreditación'

  Escenario: Pago por transferencia bancaria inicia flujo de pendiente de acreditación
    Dado que soy un conductor "A" autenticado
    Y que el conductor "A" reservó el vehículo "AE987CC" desde "2026-07-01T10:00:00Z" hasta "2026-07-03T10:00:00Z" firmando el contrato
    Cuando el conductor "A" inicia pago por transferencia bancaria
    Entonces la reserva del conductor "A" queda en estado "pending_approval"
    Y la reserva tiene un código de transferencia generado
    Y la transferencia expira en 2 horas

  # AC3: Transferencia no acreditada en 2h → reserva cancelada
  # DADO que la transferencia no se acredita en 2 horas CUANDO vence el plazo
  # ENTONCES la reserva se cancela y el vehículo vuelve a estar disponible

  Escenario: Transferencia vencida cancela la reserva
    Dado que soy un conductor "A" autenticado
    Y que el conductor "A" reservó el vehículo "AE987CC" desde "2026-07-01T10:00:00Z" hasta "2026-07-03T10:00:00Z" firmando el contrato
    Y el conductor "A" inicia pago por transferencia bancaria
    Cuando transcurren 2 horas sin acreditar la transferencia
    Y el sistema ejecuta el job de expiración de transferencias
    Entonces la reserva del conductor "A" queda en estado "cancelled"
    Y el conductor "B" puede reservar el vehículo "AE987CC" desde "2026-07-01T10:00:00Z" hasta "2026-07-03T10:00:00Z" firmando el contrato

  # AC4: Pago exitoso → Confirmada, voucher QR, notificación
  # DADO que el pago es exitoso CUANDO se confirma
  # ENTONCES la reserva pasa a 'Confirmada', se genera voucher QR y se notifica

  Escenario: Pago con tarjeta de crédito confirma la reserva inmediatamente
    Dado que soy un conductor "A" autenticado
    Y que el conductor "A" reservó el vehículo "AE987CC" desde "2026-07-01T10:00:00Z" hasta "2026-07-03T10:00:00Z" firmando el contrato
    Cuando el conductor "A" confirma el pago con "credit_card"
    Entonces la reserva del conductor "A" queda en estado "confirmed"
    Y se genera un voucher QR para la reserva
    Y se notifica al conductor y al rentador

  Escenario: Pago con billetera virtual (Mercado Pago) confirma la reserva inmediatamente
    Dado que soy un conductor "A" autenticado
    Y que el conductor "A" reservó el vehículo "AE987CC" desde "2026-07-01T10:00:00Z" hasta "2026-07-03T10:00:00Z" firmando el contrato
    Cuando el conductor "A" confirma el pago con "digital_wallet" y proveedor "mercadopago"
    Entonces la reserva del conductor "A" queda en estado "confirmed"
    Y se genera un voucher QR para la reserva

  Escenario: Acreditación de transferencia bancaria confirma la reserva
    Dado que soy un conductor "A" autenticado
    Y que el conductor "A" reservó el vehículo "AE987CC" desde "2026-07-01T10:00:00Z" hasta "2026-07-03T10:00:00Z" firmando el contrato
    Y el conductor "A" inicia pago por transferencia bancaria
    Cuando se acredita la transferencia bancaria del conductor "A"
    Entonces la reserva del conductor "A" queda en estado "confirmed"
    Y se genera un voucher QR para la reserva

  # Edge cases

  Escenario: No se puede pagar una reserva ya confirmada
    Dado que soy un conductor "A" autenticado
    Y que el conductor "A" reservó el vehículo "AE987CC" desde "2026-07-01T10:00:00Z" hasta "2026-07-03T10:00:00Z" firmando el contrato
    Y el conductor "A" confirma el pago con "credit_card"
    Cuando el conductor "A" confirma el pago con "debit_card"
    Entonces el conductor "A" recibe el código de error "RESERVATION_INVALID_TRANSITION"

  Escenario: No se puede iniciar transferencia en reserva expirada
    Dado que soy un conductor "A" autenticado
    Y que el conductor "A" reservó el vehículo "AE987CC" desde "2026-07-01T10:00:00Z" hasta "2026-07-03T10:00:00Z" firmando el contrato
    Y transcurren 11 minutos sin completar el pago
    Y el sistema ejecuta el job de expiración de reservas
    Cuando el conductor "A" inicia pago por transferencia bancaria
    Entonces el conductor "A" recibe el código de error "RESERVATION_HOLD_EXPIRED"
