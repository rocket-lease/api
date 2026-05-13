# language: es
Característica: Perfil de usuario
  Como usuario
  quiero ver y editar mi perfil
  para mantener mis datos actualizados

  Escenario: Ver perfil con datos personales, estado y preferencias
    Dado que existe un usuario autenticado con email "perfil@ejemplo.com" y contrasena "Passw0rd!"
    Cuando solicita su perfil
    Entonces ve sus datos personales, estado de verificacion, nivel, score y preferencias

  Escenario: Editar datos del perfil y ver cambios inmediatos
    Dado que existe un usuario autenticado con email "edicion@ejemplo.com" y contrasena "Passw0rd!"
    Cuando actualiza su perfil con nombre "Juan Perfil", telefono "1199988877", transmision "automatic", accesibilidad "rampa, asideras" y precio maximo diario 45000
    Y sube una nueva foto de perfil "avatar-nuevo.png"
    Entonces los cambios del perfil quedan guardados y visibles inmediatamente

  Escenario: Obtener preferencias para precargar busqueda
    Dado que existe un usuario autenticado con email "preferencias@ejemplo.com" y contrasena "Passw0rd!"
    Y tiene preferencias de vehiculo guardadas con transmision "manual", accesibilidad "silla plegable" y precio maximo diario 38000
    Cuando solicita su perfil
    Entonces recibe las preferencias guardadas para precargar filtros de busqueda
