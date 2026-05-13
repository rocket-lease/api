#language: es
Característica: Recuperación de contraseña

  Escenario: Solicitud de recuperación con email existente
    Dado que existe un usuario registrado con email "olvidadizo@ejemplo.com" y contraseña "Passw0rd!"
    Cuando el usuario solicita recuperar contraseña para el email "olvidadizo@ejemplo.com"
    Entonces el sistema confirma que se envió el mail de recuperación
    Y se registró un envío de mail de recuperación a "olvidadizo@ejemplo.com"

  Escenario: Solicitud de recuperación con email inexistente
    Cuando el usuario solicita recuperar contraseña para el email "noexiste@ejemplo.com"
    Entonces el sistema confirma que se envió el mail de recuperación

  Escenario: Solicitud de recuperación con email inválido
    Cuando el usuario solicita recuperar contraseña para el email "no-es-un-email"
    Entonces el sistema rechaza la solicitud por email inválido

  Escenario: Reset de contraseña con token válido
    Cuando el usuario envía un reset de contraseña con token válido y nueva contraseña "Newp4ssw0rd!"
    Entonces el sistema confirma el cambio de contraseña

  Escenario: Reset de contraseña con token inválido
    Cuando el usuario envía un reset de contraseña con token "token-invalido" y nueva contraseña "Newp4ssw0rd!"
    Entonces el sistema rechaza el reset por token inválido

  Escenario: Reset de contraseña con nueva contraseña débil
    Cuando el usuario envía un reset de contraseña con token válido y nueva contraseña "1234"
    Entonces el sistema rechaza el reset por contraseña débil
