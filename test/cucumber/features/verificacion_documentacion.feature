# language: es
Característica: Verificación de documentación del vehículo
    Como rentador
    quiero validar la documentación de mi vehículo
    para que quede habilitado para alquiler en la plataforma

    Antecedentes:
        Dado que estoy autenticado
        Y un vehículo con los siguientes datos:
            | patente | marca | modelo | año  | pasajeros | baul | transmisión | accesible | color | kilometraje | precio base | descripción                  | fotos                          |
            | AE987CC | Ford  | Ranger | 2023 | 5         | 800  | Manual      | No        | Gris  | 45000       | 38000000    | Pick-up lista para trabajar  | https://i.com/1.jpg            |

    # AC1: El sistema solicita documentación obligatoria
    Escenario: Solicitud de documentos al crear vehículo
        Dado que he creado un vehículo
        Cuando accedo al paso de documentación
        Entonces el sistema solicita obligatoriamente el título
        Y el sistema solicita obligatoriamente la cédula verde

    # AC2: Subida de documentos → Pendiente de aprobación
    Escenario: Subida de documentos y pendiente de aprobación
        Dado que he creado un vehículo
        Cuando subo los siguientes documentos del vehículo:
            | documento | archivo                          |
            | title     | data:image/jpeg;base64,/9j/4AAQ... |
            | greenCard | data:image/jpeg;base64,/9j/4AAQ... |
        Entonces el vehículo queda en estado "Pendiente de aprobación"
        Y el vehículo no aparece en el catálogo

    # AC3 (vía stub automático): Aprobación → Publicado + notificación
    # AC4 (rechazo): Se cubrirá cuando se integre un provider real de verificación documental

    # Edge case: Consultar estado de la documentación
    Escenario: Consultar estado de la documentación
        Dado que el vehículo tiene documentación pendiente de aprobación
        Cuando consulto el estado de la documentación
        Entonces el estado de la documentación es "pending"
        Y la documentación incluye título y cédula verde

    # Edge case: Auto-aprobación por el sistema (stub)
    Escenario: Auto-aprobación de documentación por el sistema
        Dado que el vehículo tiene documentación pendiente de aprobación
        Cuando transcurre el tiempo de verificación
        Y el sistema ejecuta el proceso de verificación de documentos
        Entonces la documentación queda aprobada automáticamente
        Y el vehículo pasa a estado "Publicado"
        Y el rentador recibe una notificación de aprobación
