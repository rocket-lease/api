# language: es
Característica: Perfil de usuario
  Como usuario
  quiero ver y editar mi perfil
  para mantener mis datos actualizados

  Antecedentes:
    Dado que existe un usuario autenticado con email "test@ejemplo.com" y contraseña "Passw0rd!"

  Escenario: Ver perfil con datos personales, estado y preferencias
    Cuando solicito mi perfil
    Entonces veo mis datos personales, estado de verificación, nivel, score y preferencias

  Escenario: Editar datos del perfil y ver cambios inmediatos
    Cuando actualizo mi perfil con nombre "Juan Perfil", teléfono "1199988877", transmisión "automatic", accesibilidad "rampa, asideras" y precio máximo diario 45000
    Y subo una nueva foto de perfil "avatar-nuevo.png"
    Entonces los cambios del perfil quedan guardados y visibles inmediatamente

  Escenario: Obtener preferencias para precargar búsqueda
    Y tiene preferencias de vehículo guardadas con transmisión "manual", accesibilidad "silla plegable" y precio máximo diario 38000
    Cuando solicito mi perfil
    Entonces recibo las preferencias guardadas para precargar filtros de búsqueda
