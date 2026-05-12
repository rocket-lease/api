#language: es
Característica: Gestión de favoritos
  Como conductor
  quiero agregar, ver y eliminar vehículos de mis favoritos
  para acceder rápido a las opciones que me interesan

  Antecedentes:
    Dado que estoy autenticado como conductor

  Escenario: Agregar un vehículo a favoritos
    Cuando agrego el vehículo "11111111-1111-1111-1111-111111111111" a favoritos
    Entonces el vehículo aparece en mi lista de favoritos

  Escenario: Ver favoritos con el vehículo guardado
    Dado que tengo el vehículo "22222222-2222-2222-2222-222222222222" en mis favoritos
    Cuando cargo mi lista de favoritos
    Entonces la lista contiene el vehículo "22222222-2222-2222-2222-222222222222"

  Escenario: Eliminar un favorito
    Dado que tengo el vehículo "33333333-3333-3333-3333-333333333333" en mis favoritos
    Cuando elimino el vehículo "33333333-3333-3333-3333-333333333333" de favoritos
    Entonces la lista ya no contiene el vehículo "33333333-3333-3333-3333-333333333333"

  Escenario: No se puede agregar el mismo favorito dos veces
    Dado que tengo el vehículo "44444444-4444-4444-4444-444444444444" en mis favoritos
    Cuando agrego el vehículo "44444444-4444-4444-4444-444444444444" a favoritos
    Entonces el sistema indica que el favorito ya existe con código 409

  Escenario: No se puede eliminar un favorito inexistente
    Cuando elimino el vehículo "55555555-5555-5555-5555-555555555555" de favoritos
    Entonces el sistema indica que el favorito no existe con código 404

  Escenario: Lista vacía para un conductor sin favoritos
    Cuando cargo mi lista de favoritos
    Entonces la lista de favoritos está vacía
