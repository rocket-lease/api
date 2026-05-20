# language: es
Característica: Inicio de sesión de usuarios

  Escenario: Login exitoso con credenciales válidas
    Dado que existe un usuario registrado con email "usuario@ejemplo.com" y contraseña "Passw0rd!"
    Cuando intento iniciar sesión con email "usuario@ejemplo.com" y contraseña "Passw0rd!"
    Entonces el login es exitoso
    Y recibo un token de acceso

  Escenario: Intento de login con email con formato inválido
    Cuando intento iniciar sesión con email "no-es-un-email" y contraseña "Passw0rd!"
    Entonces el sistema rechaza el login con error 400

  Escenario: Intento de login con contraseña muy corta
    Cuando intento iniciar sesión con email "usuario@ejemplo.com" y contraseña "Abc1"
    Entonces el sistema rechaza el login con error 400

  Escenario: Intento de login con contraseña sin letras
    Cuando intento iniciar sesión con email "usuario@ejemplo.com" y contraseña "12345678"
    Entonces el sistema rechaza el login con error 400

  Escenario: Intento de login con contraseña sin números
    Cuando intento iniciar sesión con email "usuario@ejemplo.com" y contraseña "SoloLetras"
    Entonces el sistema rechaza el login con error 400
