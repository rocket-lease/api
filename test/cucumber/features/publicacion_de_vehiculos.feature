#language: es
Característica: Publicacion de vehículos
    Como rentador
    quiero publicar mis vehículos
    para ponerlos en alquiler en la plataforma

    Antecedentes:
        Dado que estoy autenticado

    Escenario: Listado de vehiculo recien creado
        Dado un vehículo con los siguientes datos:
            | patente | marca | modelo | año  | pasajeros | baul | transmisión | accesible | color | kilometraje | precio base | descripción                  | fotos                          |
            | AE987CC | Ford  | Ranger | 2023 | 5         | 800  | Manual      | No        | Gris  | 45000       | 38000000    | Pick-up lista para trabajar  | https://i.com/1.jpg            |
        Cuando envio el formulario de creacion de vehiculo
        Entonces el vehiculo es publicado
        Y el vehículo aparece en 'Mis vehículos'

    Escenario: Publicacion de un vehiculo ya registrado
        Dado un vehículo con los siguientes datos:
            | patente | marca | modelo | año  | pasajeros | baul | transmisión | accesible | color | kilometraje | precio base | descripción                  | fotos                          |
            | AE987CC | Ford  | Ranger | 2023 | 5         | 800  | Manual      | No        | Gris  | 45000       | 38000000    | Pick-up lista para trabajar  | https://i.com/1.jpg            |
        Y el vehiculo ya esta publicado
        Cuando envio el formulario de creacion de vehiculo
        Entonces el vehiculo no se publica
        Y el sistema indica que el vehículo ya existe

    Escenario: Intento de publicacion con campos obligatorios faltantes
        Dado un vehículo con los siguientes datos:
            | patente | marca | modelo | año  | pasajeros | baul | transmisión | accesible | color | kilometraje | precio base | descripción                  | fotos                          |
            |         | Ford  | Ranger | 2023 | 5         | 800  | Manual      | No        | Gris  | 45000       | 38000000    | Pick-up lista para trabajar  | https://i.com/1.jpg            |
        Cuando envio el formulario de creacion de vehiculo
        Entonces el vehiculo no se publica
        Y el sistema indica que faltan campos obligatorios

    Escenario: Publicacion de un vehiculo con precio negativo
        Dado un vehículo con los siguientes datos:
            | patente | marca | modelo | año  | pasajeros | baul | transmisión | accesible | color | kilometraje | precio base | descripción                  | fotos                          |
            | AE987CC | Ford  | Ranger | 2023 | 5         | 800  | Manual      | No        | Gris  | 45000       | -38000000    | Pick-up lista para trabajar  | https://i.com/1.jpg            |
        Cuando envio el formulario de creacion de vehiculo
        Entonces el vehiculo no se publica
        Y el sistema muestra un error de validación

    Escenario: Publicacion de un vehiculo con precio en cero
        Dado un vehículo con los siguientes datos:
            | patente | marca | modelo | año  | pasajeros | baul | transmisión | accesible | color | kilometraje | precio base | descripción                  | fotos                          |
            | AE987CC | Ford  | Ranger | 2023 | 5         | 800  | Manual      | No        | Gris  | 45000       | 0           | Pick-up lista para trabajar  | https://i.com/1.jpg            |
        Cuando envio el formulario de creacion de vehiculo
        Entonces el vehiculo no se publica
        Y el sistema muestra un error de validación
