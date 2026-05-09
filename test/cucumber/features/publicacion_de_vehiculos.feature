#language: es
Característica: Publicacion de vehículos

    Escenario: Listado de vehiculo recien creado
        # Dado que soy rentador con identidad verificada 
        Dado un vehículo con los siguientes datos:
            | patente    | marca      | modelo  | color   | kilometraje | tipo de transmisión | precio base |  descripción                   |
            | AE987CC    | Ford       | Ranger  | Gris    | 45000       | Manual              | 38000000    | Pick-up lista para trabajar    |
        Cuando envio el formulario de creacion de vehiculo
        Entonces el vehículo aparece en 'Mis vehículos' en estado pendiente de aprobación

    Escenario: Publicacion de un vehiculo ya registrado
        Dado un vehículo con los siguientes datos:
            | patente    | marca      | modelo  | color   | kilometraje | tipo de transmisión | precio base |  descripción                   |
            | AE987CC    | Ford       | Ranger  | Gris    | 45000       | Manual              | 38000000    | Pick-up lista para trabajar    |
        Y el vehiculo ya esta publicado
        Cuando envio el formulario de creacion de vehiculo
        Entonces el sistema indica que el vehículo ya existe

    Escenario: Intento de publicacion con campos obligatorios faltantes
        Dado un vehículo con los siguientes datos:
            | patente    | marca      | modelo  | color   | kilometraje | tipo de transmisión | precio base |  descripción                   |
            | AE987CC    | Ford       | Ranger  | Gris    | 45000       | Manual              | 38000000    | Pick-up lista para trabajar    |
        Cuando envio el formulario de creacion de vehiculo
        Entonces el sistema indica los campos faltantes 
        Y el vehiculo no se publica

    Escenario: Publicacion de un vehiculo con precio negativo
        Dado un vehículo con los siguientes datos:
            | patente    | marca      | modelo  | color   | kilometraje | tipo de transmisión | precio base |  descripción                   |
            | AE987CC    | Ford       | Ranger  | Gris    | 45000       | Manual              | -38000000    | Pick-up lista para trabajar    |
        Cuando envio el formulario de creacion de vehiculo
        Entonces el sistema muestra un error de validación

    Escenario: Publicacion de un vehiculo con precio en cero
        Dado un vehículo con los siguientes datos:
            | patente    | marca      | modelo  | color   | kilometraje | tipo de transmisión | precio base |  descripción                   |
            | AE987CC    | Ford       | Ranger  | Gris    | 45000       | Manual              | 0           | Pick-up lista para trabajar    |
        Cuando envio el formulario de creacion de vehiculo
        Entonces el sistema muestra un error de validación
