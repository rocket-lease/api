# language: es
Característica: Registro de usuarios

  Escenario: Registro exitoso con datos válidos
    Dado que un nuevo usuario quiere registrarse con nombre "Juan", email "juan@ejemplo.com", DNI "12345678", teléfono "1123456789" y contraseña "Passw0rd!"
    Cuando envía el formulario de registro
    Entonces la cuenta es creada exitosamente
    Y el usuario puede acceder a la plataforma

  Escenario: Intento de registro con email ya existente
    Dado que ya existe un usuario registrado con email "repetido@ejemplo.com"
    Y que un nuevo usuario quiere registrarse con nombre "Pedro", email "repetido@ejemplo.com", DNI "87654321", teléfono "1198765432" y contraseña "Passw0rd!"
    Cuando envía el formulario de registro
    Entonces el sistema indica que el correo ya está en uso
    Y no se crea la cuenta

  Escenario: Intento de registro con email inválido
    Dado que un nuevo usuario quiere registrarse con nombre "Ana", email "no-es-un-email", DNI "12345678", teléfono "1123456789" y contraseña "Passw0rd!"
    Cuando envía el formulario de registro
    Entonces el sistema indica que el email es inválido

  Escenario: Intento de registro con contraseña débil
    Dado que un nuevo usuario quiere registrarse con nombre "Luis", email "luis@ejemplo.com", DNI "12345678", teléfono "1123456789" y contraseña "1234"
    Cuando envía el formulario de registro
    Entonces el sistema indica los requisitos mínimos de contraseña

  Escenario: Intento de registro con DNI inválido
    Dado que un nuevo usuario quiere registrarse con nombre "María", email "maria@ejemplo.com", DNI "abc", teléfono "1123456789" y contraseña "Passw0rd!"
    Cuando envía el formulario de registro
    Entonces el sistema indica que el DNI es inválido
