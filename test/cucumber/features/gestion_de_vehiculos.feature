#language: es

Característica: Gestion de vehiculos
    Como rentador
    quiero actualizar, habilitar, deshabilitar y eliminar mis vehículos
    para mantener mi flota actualizada

    Antecedentes:
        Dado que estoy autenticado

    # Frontend
    @ignore
    Escenario:
      Dado que accedo a mis vehículos 
      Cuando selecciono uno 
      Entonces veo opciones de actualizar, habilitar/deshabilitar y eliminar

      Escenario: Actualizacion exitosa de vehiculo
        Dado un vehículo con los siguientes datos:
            | patente | marca | modelo | año  | pasajeros | baul | transmisión | accesible | color | kilometraje | precio base | descripción                  | fotos                          |
            | AE987CC | Ford  | Ranger | 2023 | 5         | 800  | Manual      | No        | Gris  | 45000       | 38000000    | Pick-up lista para trabajar  | https://i.com/1.jpg            |
        Y el vehiculo ya esta publicado
        Cuando actualizo la información de un vehículo con los siguientes datos:
            | color | kilometraje | precio base | descripción                   | fotos                                         |
            | Azul  | 67000       | 40000000    | Pick-up con service realizado | https://i.com/1.jpg,https://i.com/2.jpg       |
        Entonces el vehiculo queda actualizado

    Escenario: Actualizacion fallida de vehiculo
        Dado un vehículo con los siguientes datos:
            | patente | marca | modelo | año  | pasajeros | baul | transmisión | accesible | color | kilometraje | precio base | descripción                  | fotos                          |
            | AE987CC | Ford  | Ranger | 2023 | 5         | 800  | Manual      | No        | Gris  | 45000       | 38000000    | Pick-up lista para trabajar  | https://i.com/1.jpg            |
        Y el vehiculo ya esta publicado
        Cuando actualizo la información de un vehículo con los siguientes datos:
            | patente    | 
            | BT257CS    |
        Entonces el sistema indica que no se puede modificar el campo "patente"
        Y el vehiculo no se actualiza

    # TODO: completar cuando este la reserva
    @ignore
    Escenario: Deshabilitacion de un vehiculo con reservas
        Dado un vehículo con los siguientes datos:
            | patente | marca | modelo | año  | pasajeros | baul | transmisión | accesible | color | kilometraje | precio base | descripción                  | fotos                          |
            | AE987CC | Ford  | Ranger | 2023 | 5         | 800  | Manual      | No        | Gris  | 45000       | 38000000    | Pick-up lista para trabajar  | https://i.com/1.jpg            |
        Y el vehículo tiene las siguientes reservas:
            | usuario             |
            | usuario@ejemplo.com |
        Cuando deshabilito el vehículo
        Entonces el vehículo pasa a 'Deshabilitado'
        Y no aparece en búsquedas
        Y no afecta reservas ya confirmadas

    # TODO: completar cuando este la reserva
    @ignore
    Escenario:
        Dado un vehículo con los siguientes datos:
            | patente | marca | modelo | año  | pasajeros | baul | transmisión | accesible | color | kilometraje | precio base | descripción                  | fotos                          |
            | AE987CC | Ford  | Ranger | 2023 | 5         | 800  | Manual      | No        | Gris  | 45000       | 38000000    | Pick-up lista para trabajar  | https://i.com/1.jpg            |
        Y el vehículo tiene las siguientes reservas:
            | usuario             |
            | usuario@ejemplo.com |
        Cuando elimino el vehículo 
        Entonces el sistema cancela las reserva

    Escenario:
        Dado un vehículo con los siguientes datos:
            | patente | marca | modelo | año  | pasajeros | baul | transmisión | accesible | color | kilometraje | precio base | descripción                  | fotos                          |
            | AE987CC | Ford  | Ranger | 2023 | 5         | 800  | Manual      | No        | Gris  | 45000       | 38000000    | Pick-up lista para trabajar  | https://i.com/1.jpg            |
        Y el vehículo esta deshabilitado 
        Cuando habilito el vehículo
        Entonces el vehículo aparece en el catálogo
