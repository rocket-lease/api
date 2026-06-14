# language: es
Característica: Recomendaciones personalizadas
  Como conductor con historial de reservas
  quiero recibir recomendaciones de vehículos personalizadas
  para descubrir opciones relevantes sin tener que buscar

  Antecedentes:
    Dado que estoy autenticado
    Y un vehículo con los siguientes datos:
      | patente | marca | modelo | año | pasajeros | baul | transmisión | accesible | color | kilometraje | precio base | descripción | fotos | provincia | ciudad | disponible desde |
      | REC-001 | Ford  | Focus  | 2024 | 5         | 400  | Manual      | No        | Azul  | 10000       | 4500000     | Vehículo test recomendaciones | https://i.com/rec001.jpg | B | CABA | 2026-06-01 |
    Y el vehículo ya está publicado con auto-aceptación activada

  # AC1: DADO que tengo al menos una reserva completada
  #      CUANDO accedo al inicio de la app
  #      ENTONCES veo una sección "Sugerido para vos" con vehículos
  #             basados en mi historial y preferencias.

  Escenario: Conductor con reservas confirmadas ve sugerencias personalizadas en el inicio
    Dado que soy un conductor "A" autenticado
    Y que el conductor "A" reservó el vehículo "REC-001" desde "2026-07-01T10:00:00Z" hasta "2026-07-03T10:00:00Z" firmando el contrato
    Y el conductor "A" confirma el pago con "credit_card"
    Cuando accedo al inicio de la app
    Entonces veo una sección "Sugerido para vos"
    Y la sección contiene vehículos recomendados basados en mi historial y preferencias

  Escenario: Conductor sin reservas previas no ve la sección de sugerencias
    Dado que soy un conductor "B" autenticado
    Cuando accedo al inicio de la app
    Entonces no veo la sección "Sugerido para vos"

  Escenario: Sugerencias se personalizan según preferencias del conductor
    Dado que soy un conductor "C" autenticado
    Y tiene preferencias de vehículo guardadas con transmisión "automatic", accesibilidad "rampa" y precio máximo diario 50000
    Y que existe un vehículo publicado con patente "REC-002" y precio base 35000
    Y que el conductor "C" reservó el vehículo "REC-002" desde "2026-08-01T10:00:00Z" hasta "2026-08-03T10:00:00Z" firmando el contrato
    Y el conductor "C" confirma el pago con "credit_card"
    Cuando accedo al inicio de la app
    Entonces veo una sección "Sugerido para vos"
    Y los vehículos sugeridos cumplen con mis preferencias de transmisión, accesibilidad y precio

  Escenario: Conductor sin preferencias recibe sugerencias basadas solo en su historial
    Dado que soy un conductor "D" autenticado
    Y que el conductor "D" reservó el vehículo "REC-001" desde "2026-09-01T10:00:00Z" hasta "2026-09-03T10:00:00Z" firmando el contrato
    Y el conductor "D" confirma el pago con "debit_card"
    Cuando accedo al inicio de la app
    Entonces veo una sección "Sugerido para vos"
    Y los vehículos sugeridos son del mismo tipo que los reservados anteriormente

  Escenario: Conductor sin reservas ni preferencias no ve sugerencias
    Dado que soy un conductor "E" autenticado
    Y no tengo preferencias de vehículo guardadas
    Cuando accedo al inicio de la app
    Entonces no veo la sección "Sugerido para vos"
