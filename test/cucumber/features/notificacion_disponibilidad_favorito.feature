# language: es
Característica: Notificación de disponibilidad de favorito
  Como conductor
  quiero recibir una notificación cuando un vehículo favorito tiene nueva disponibilidad
  para aprovechar oportunidades sin estar revisando constantemente

  Antecedentes:
    Dado que estoy autenticado
    Y un vehículo con los siguientes datos:
      | patente | marca | modelo | año | pasajeros | baul | transmisión | accesible | color | kilometraje | precio base | descripción | fotos | provincia | ciudad | disponible desde |
      | FAV-NTF | CocheNotif | X | 2024 | 5 | 400 | Manual | No | Rojo | 100 | 50000 | Vehículo test notificación | https://i.com/favntf.jpg | B | CABA | 2026-06-01 |
    Y el vehículo ya está publicado

  # AC3: DADO que guardo un vehículo como favorito
  #      CUANDO hay nueva disponibilidad
  #      ENTONCES recibo notificación.

  Escenario: Favorito con nueva disponibilidad genera notificación
    Dado que tengo el vehículo en mis favoritos
    Y el vehículo favorito no está disponible actualmente
    Cuando hay nueva disponibilidad del vehículo favorito
    Entonces recibo una notificación de disponibilidad

  Escenario: Favorito ya disponible no genera notificación duplicada
    Dado que tengo el vehículo en mis favoritos
    Y el vehículo favorito ya está disponible
    Cuando hay nueva disponibilidad del vehículo favorito
    Entonces no recibo una notificación de disponibilidad

  Escenario: Múltiples favoritos con disponibilidad generan notificaciones individuales
    Dado que tengo el vehículo en mis favoritos
    Y que existe un vehículo publicado con patente "FAV-NTF2" y precio base 60000
    Y agrego el vehículo a favoritos
    Y el vehículo favorito no está disponible actualmente
    Cuando hay nueva disponibilidad del vehículo favorito
    Entonces recibo una notificación de disponibilidad

  Escenario: Vehículo no favorito no genera notificación
    Dado que existe un vehículo publicado con patente "NO-FAV" y precio base 30000
    Cuando hay nueva disponibilidad del vehículo con patente "NO-FAV"
    Entonces no recibo una notificación de disponibilidad

  Escenario: Eliminar favorito detiene las notificaciones
    Dado que tengo el vehículo en mis favoritos
    Y elimino el vehículo de favoritos
    Y el vehículo no está disponible actualmente
    Cuando hay nueva disponibilidad del vehículo "FAV-NTF"
    Entonces no recibo una notificación de disponibilidad
