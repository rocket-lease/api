# language: es
Característica: Promocion de vehiculos
    Como rentador
    quiero pagar para promocionar mis vehículos
    para darles mayor visibilidad en los resultados de búsqueda

    Antecedentes:
        Dado que estoy autenticado
        Y un vehículo con los siguientes datos:
            | patente | marca | modelo | año  | pasajeros | baul | transmisión | accesible | color | kilometraje | precio base | descripción                  | fotos                          |
            | AE987CC | Ford  | Ranger | 2023 | 5         | 800  | Manual      | No        | Gris  | 45000       | 38000000    | Pick-up lista para trabajar  | https://i.com/1.jpg            |
        Y el vehículo ya está publicado

    Escenario: Ver opciones de promocion
        Cuando accedo a las opciones de promoción del vehículo
        Entonces veo las siguientes opciones de duración:
            | duracion | costo  |
            | 7 días   | 5000   |
            | 14 días  | 9000   |
            | 30 días  | 15000  |

    Escenario: Promocion exitosa
        Cuando confirmo la promoción del vehículo por "7 días"
        Entonces el vehículo pasa a estado "promocionado"
        Y el vehículo aparece antes que los no promocionados en los resultados de búsqueda

    Escenario: Vencimiento de promocion
        Dado que el vehículo está promocionado
        Cuando transcurre el tiempo de promoción
        Y el sistema ejecuta el job de expiración de promociones
        Entonces el vehículo vuelve a su posición orgánica en los resultados de búsqueda

    Escenario: Promocion duplicada
        Dado que el vehículo está promocionado
        Cuando confirmo la promoción del vehículo por "7 días"
        Entonces el sistema indica que ya está activa una promoción

    Escenario: Re-promocion despues de vencimiento
        Dado que el vehículo estuvo promocionado y la promoción expiró
        Cuando confirmo la promoción del vehículo por "14 días"
        Entonces el vehículo pasa a estado "promocionado"
