# language: es
Característica: Ajuste masivo de precios (US-54)
  Como rentador con múltiples vehículos
  Quiero editar precios en lote
  Para ahorrar tiempo en la gestión de mi flota

  Antecedentes:
    Dado que soy un rentador "carmen" autenticado

  Escenario: Rentador ajusta +15% a 3 vehículos
    Dado que publiqué 3 vehículos con precio base 10000 centavos
    Cuando aplico un ajuste de precio PERCENTAGE con delta 15 a esos vehículos
    Entonces la respuesta es exitosa
    Y los 3 vehículos tienen el nuevo precio 11500 centavos

  Escenario: Rentador establece precio fijo a 2 vehículos
    Dado que publiqué 2 vehículos con precio base 5000 centavos
    Cuando aplico un ajuste de precio SET con valor 8000 centavos a esos vehículos
    Entonces la respuesta es exitosa
    Y los 2 vehículos tienen el nuevo precio 8000 centavos

  Escenario: Vehículo ajeno bloquea toda la operación
    Dado que publiqué 1 vehículos con precio base 10000 centavos
    Y que existe un vehículo de otro rentador
    Cuando aplico un ajuste de precio SET con valor 5000 centavos incluyendo el vehículo ajeno
    Entonces el sistema responde con error 409
    Y el código de error es "BULK_PRICE_VEHICLE_UNAVAILABLE"

  Escenario: Cálculo daría precio negativo, rollback completo
    Dado que publiqué 2 vehículos con precio base 10000 centavos
    Cuando aplico un ajuste de precio PERCENTAGE con delta -100 a esos vehículos
    Entonces el sistema responde con error 400
    Y el código de error es "BULK_PRICE_RESULT_INVALID"

  Escenario: Conteo de reservas activas
    Dado que publiqué 2 vehículos con precio base 10000 centavos
    Cuando consulto el conteo de reservas activas de esos vehículos
    Entonces la respuesta es exitosa
    Y el conteo incluye los 2 vehículos
