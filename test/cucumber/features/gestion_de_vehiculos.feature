# language: es
Característica: Gestion de vehiculos
    Como rentador
    quiero actualizar, habilitar, deshabilitar y eliminar mis vehículos
    para mantener mi flota actualizada

    Antecedentes:
        Dado que estoy autenticado
        Y un vehículo con los siguientes datos:
            | patente | marca | modelo | año  | pasajeros | baul | transmisión | accesible | color | kilometraje | precio base | descripción                  | fotos                          |
            | AE987CC | Ford  | Ranger | 2023 | 5         | 800  | Manual      | No        | Gris  | 45000       | 38000000    | Pick-up lista para trabajar  | https://i.com/1.jpg            |
        Y el vehículo ya está publicado

    Escenario: Actualizacion exitosa de vehiculo
        Cuando actualizo la información de un vehículo con los siguientes datos:
            | color | kilometraje | precio base | descripción                   | fotos                                         |
            | Azul  | 67000       | 40000000    | Pick-up con service realizado | https://i.com/1.jpg,https://i.com/2.jpg       |
        Entonces el vehículo queda actualizado

    Escenario: Actualizacion fallida de vehiculo
        Cuando actualizo la información de un vehículo con los siguientes datos:
            | patente    | 
            | BT257CS    |
        Entonces el sistema indica que no se puede modificar el campo "patente"
        Y el vehículo no se actualiza

    Escenario: Eliminacion exitosa de vehiculo
        Cuando elimino el vehículo
        Entonces el vehículo es eliminado
        Y el vehículo no aparece en 'Mis vehículos'

    Escenario: Deshabilitacion de un vehiculo
        Cuando deshabilito el vehículo
        Entonces el vehículo se deshabilita
        Y el vehículo no aparece en el catálogo

    Escenario: Habilitacion de vehiculo deshabilitado
        Dado el vehículo está deshabilitado 
        Cuando habilito el vehículo
        Entonces el vehículo aparece en el catálogo
