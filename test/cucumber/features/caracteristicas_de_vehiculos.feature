# language: es
Característica: Caracteristicas de vehiculos
    Como rentador
    quiero agregar etiquetas y caracteristicas especiales a mis vehiculos
    para que los conductores los encuentren mas facilmente

    Antecedentes:
        Dado que estoy autenticado

    Escenario: Agregar caracteristicas a un vehiculo
        Dado un vehículo con los siguientes datos:
            | patente | marca | modelo | año  | pasajeros | baul | transmisión | accesible | color | kilometraje | precio base | descripción              | fotos               |
            | AE123BC | Ford  | Focus  | 2023 | 5         | 450  | Manual      | No        | Gris  | 12000       | 35000000    | Hatchback para la ciudad | https://i.com/1.jpg |
        Y el vehiculo ya esta publicado
        Cuando actualizo las caracteristicas del vehiculo a "GPS, silla para bebe, techo solar"
        Entonces el vehiculo queda con las caracteristicas "GPS, silla para bebe, techo solar"

    Escenario: Filtrar por caracteristicas
        Dado vehiculos con las siguientes caracteristicas:
            | patente | caracteristicas      |
            | AA111AA | GPS, silla para bebe |
            | BB222BB | techo solar          |
        Cuando filtro vehiculos por "GPS"
        Entonces solo aparecen vehiculos con la caracteristica "GPS"

    Escenario: Eliminar una caracteristica
        Dado un vehiculo con las caracteristicas "GPS, techo solar"
        Cuando elimino la caracteristica "GPS"
        Entonces el vehiculo no tiene la caracteristica "GPS"
        Y el vehiculo no aparece en el catalogo filtrado por "GPS"
