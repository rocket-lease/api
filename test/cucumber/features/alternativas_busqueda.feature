# language: es
Característica: Alternativas de búsqueda
  Como conductor
  quiero recibir sugerencias de alternativas cercanas cuando no hay resultados exactos
  para encontrar opciones relevantes sin tener que repetir la búsqueda

  Antecedentes:
    Dado que estoy autenticado

  # AC2: DADO que no hay resultados exactos para mi búsqueda
  #      CUANDO el sistema lo detecta
  #      ENTONCES sugiere alternativas cercanas con diferencias
  #             claramente indicadas.

  Escenario: No hay resultados exactos y se muestran alternativas cercanas
    Dado que soy un conductor "A" autenticado
    Cuando busco vehículos con los siguientes criterios:
      | marca  | modelo  | año  | precio máximo | transmisión |
      | Toyota | Corolla | 2024 | 50000         | Automatic   |
    Entonces el sistema muestra 0 resultados exactos
    Y el sistema sugiere alternativas cercanas
    Y las alternativas muestran las diferencias claramente indicadas

  Escenario: Hay resultados exactos y no se muestran alternativas
    Dado que soy un conductor "B" autenticado
    Y que existe un vehículo publicado con patente "ALT-001" y precio base 35000
    Cuando busco vehículos con los siguientes criterios:
      | marca | modelo | año  | precio máximo |
      | Ford  | Ranger | 2023 | 60000         |
    Entonces el sistema muestra al menos 1 resultado exacto
    Y el sistema no sugiere alternativas

  Escenario: No hay resultados exactos ni alternativas cercanas
    Dado que soy un conductor "C" autenticado
    Cuando busco vehículos con los siguientes criterios:
      | marca | modelo     | año  | precio máximo |
      | Tesla | Cybertruck | 2025 | 100000        |
    Entonces el sistema muestra 0 resultados exactos
    Y el sistema indica que no hay alternativas cercanas

  Escenario: Alternativas se muestran ordenadas por cercanía al criterio de búsqueda
    Dado que soy un conductor "D" autenticado
    Y que existe un vehículo publicado con patente "ALT-002" y precio base 25000
    Y que existe un vehículo publicado con patente "ALT-003" y precio base 45000
    Cuando busco vehículos con los siguientes criterios:
      | marca | modelo | año  | precio máximo |
      | Seat  | León   | 2024 | 40000         |
    Entonces el sistema muestra 0 resultados exactos
    Y el sistema sugiere alternativas cercanas
    Y las alternativas se muestran ordenadas por cercanía

  Escenario: Búsqueda con filtros sin resultados pero con alternativas en otra categoría
    Dado que soy un conductor "E" autenticado
    Y que existe un vehículo publicado con patente "ALT-004" y precio base 28000
    Cuando busco vehículos con los siguientes criterios:
      | marca   | modelo  | año  | precio máximo | transmisión |
      | Peugeot | 208     | 2025 | 30000         | Manual      |
    Entonces el sistema muestra 0 resultados exactos
    Y el sistema sugiere alternativas cercanas
    Y las alternativas indican en qué se diferencian de los criterios buscados
