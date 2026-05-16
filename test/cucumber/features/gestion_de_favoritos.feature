#language: es
Característica: Gestión de favoritos
  Como conductor
  quiero agregar, ver y eliminar vehículos de mis favoritos
  para acceder rápido a las opciones que me interesan

  Antecedentes:
    Dado que estoy autenticado
    Y un vehículo con los siguientes datos:
      | patente | marca | modelo | año | pasajeros | baul | transmisión | accesible | color | kilometraje | precio base | descripción | fotos | provincia | ciudad | disponible desde |
      | FAV-000 | CocheFavorito | Z | 2024 | 5 | 400 | Manual | No | Rojo | 100 | 50000 | Vehículo test favoritos | https://i.com/fav.jpg | B | CABA | 2026-06-01 |
    Y el vehículo ya está publicado

  Escenario: Agregar un vehículo a favoritos
    Cuando agrego el vehículo a favoritos
    Entonces el vehículo aparece en mi lista de favoritos

  Escenario: Ver favoritos con el vehículo guardado
    Dado que tengo el vehículo en mis favoritos
    Cuando cargo mi lista de favoritos
    Entonces la lista contiene el vehículo

  Escenario: Eliminar un favorito
    Dado que tengo el vehículo en mis favoritos
    Cuando elimino el vehículo de favoritos
    Entonces la lista ya no contiene el vehículo

  Escenario: No se puede agregar el mismo favorito dos veces
    Dado que tengo el vehículo en mis favoritos
    Cuando agrego el vehículo a favoritos
    Entonces el sistema indica que el favorito ya existe con código 409

  Escenario: No se puede eliminar un favorito inexistente
    Cuando elimino el vehículo de favoritos
    Entonces el sistema indica que el favorito no existe con código 404

  Escenario: Lista vacía para un conductor sin favoritos
    Cuando cargo mi lista de favoritos
    Entonces la lista de favoritos está vacía
