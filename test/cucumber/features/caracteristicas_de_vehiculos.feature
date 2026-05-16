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
        Y el vehículo ya está publicado
        Cuando actualizo las características del vehículo a "GPS, silla para bebe, techo solar"
        Entonces el vehículo queda con las características "GPS, silla para bebe, techo solar"

    Escenario: Filtrar por caracteristicas
        Dado vehículos con las siguientes características:
            | patente | caracteristicas      |
            | AA111AA | GPS, silla para bebe |
            | BB222BB | techo solar          |
        Cuando filtro vehículos por "GPS"
        Entonces solo aparecen vehículos con la característica "GPS"

    Escenario: Eliminar una caracteristica
        Dado un vehículo con las características "GPS, techo solar"
        Cuando elimino la característica "GPS"
        Entonces el vehículo no tiene la característica "GPS"
        Y el vehículo no aparece en el catálogo filtrado por "GPS"
