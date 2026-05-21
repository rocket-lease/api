# language: es
Característica: Configurar seña por porcentaje (US-49)
  Como rentador quiero configurar si requiero seña y cuál es mi porcentaje
  para gestionar mis condiciones de alquiler por vehículo.

  Escenario: Rentador habilita seña con porcentaje en un set compartido
    Dado que soy rentador autenticado con un set "Premium" sin seña
    Cuando actualizo el set "Premium" con depositPercentage = 30
    Entonces el set "Premium" queda con depositPercentage 30

  Escenario: Rentador crea set privado para un vehículo
    Dado que soy rentador con un vehículo "AP100AA"
    Cuando creo un set "PrivadoBMW" con vehicleId del vehículo "AP100AA" y depositPercentage = 20
    Entonces el set "PrivadoBMW" queda con vehicleId apuntando al vehículo "AP100AA"
    Y el set "PrivadoBMW" no aparece al listar mis sets compartidos

  Escenario: Rechazo de porcentaje fuera de rango (bajo)
    Dado que soy rentador autenticado
    Cuando intento crear un set "Roto" con depositPercentage = 5
    Entonces recibo 400 con code "DEPOSIT_PERCENTAGE_OUT_OF_RANGE"

  Escenario: Rechazo de porcentaje fuera de rango (alto)
    Dado que soy rentador autenticado
    Cuando intento crear un set "Roto" con depositPercentage = 75
    Entonces recibo 400 con code "DEPOSIT_PERCENTAGE_OUT_OF_RANGE"

  Escenario: vehicleId inmutable post-creación
    Dado que soy rentador con un vehículo "AP100AA"
    Y un set privado "PrivadoBMW" sobre el vehículo "AP100AA"
    Cuando intento actualizar el set "PrivadoBMW" con un vehicleId distinto
    Entonces recibo 400 con code "RULESET_VEHICLE_ID_IMMUTABLE"
