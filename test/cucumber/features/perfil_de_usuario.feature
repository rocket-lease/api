# language: es
Característica: Perfil de usuario
  Como usuario
  quiero ver y editar mi perfil
  para mantener mis datos actualizados

  Escenario: Ver perfil con datos personales, estado y preferencias
    Dado que existe un usuario autenticado con email "perfil@ejemplo.com" y contraseña "Passw0rd!"
    Cuando solicita su perfil
    Entonces ve sus datos personales, estado de verificación, nivel, score y preferencias

  Escenario: Editar datos del perfil y ver cambios inmediatos
    Dado que existe un usuario autenticado con email "edicion@ejemplo.com" y contraseña "Passw0rd!"
    Cuando actualiza su perfil con nombre "Juan Perfil", teléfono "1199988877", transmisión "automatic", accesibilidad "rampa, asideras" y precio máximo diario 45000
    Y sube una nueva foto de perfil "avatar-nuevo.png"
    Entonces los cambios del perfil quedan guardados y visibles inmediatamente

  Escenario: Obtener preferencias para precargar búsqueda
    Dado que existe un usuario autenticado con email "preferencias@ejemplo.com" y contraseña "Passw0rd!"
    Y tiene preferencias de vehículo guardadas con transmisión "manual", accesibilidad "silla plegable" y precio máximo diario 38000
    Cuando solicita su perfil
    Entonces recibe las preferencias guardadas para precargar filtros de búsqueda
