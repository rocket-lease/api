#language: es
Característica: Verificación de cuenta por OTP (email y teléfono)

  Escenario: Recibo OTP por email y SMS al completar el registro
    Dado que me registro con nombre "Ana", email "ana@ejemplo.com", DNI "12345678", teléfono "1100001111" y contraseña "Passw0rd!"
    Entonces se envió un OTP por email a "ana@ejemplo.com"
    Y se envió un OTP por SMS al "1100001111"

  Escenario: Ingreso OTP correcto y el canal queda verificado
    Dado que me registro con nombre "Beto", email "beto@ejemplo.com", DNI "12345678", teléfono "1100002222" y contraseña "Passw0rd!"
    Cuando envío el OTP correcto del canal "email"
    Entonces el canal "email" queda verificado
    Y el estado de la cuenta indica email verificado

  Escenario: Ingreso OTP incorrecto y permite reintentar
    Dado que me registro con nombre "Carla", email "carla@ejemplo.com", DNI "12345678", teléfono "1100003333" y contraseña "Passw0rd!"
    Cuando envío el OTP "000000" para el canal "email"
    Entonces el sistema indica código incorrecto con 2 intentos restantes

  Escenario: Tres intentos fallidos agotan el OTP
    Dado que me registro con nombre "Dora", email "dora@ejemplo.com", DNI "12345678", teléfono "1100004444" y contraseña "Passw0rd!"
    Cuando envío el OTP "000000" para el canal "email"
    Y envío el OTP "111111" para el canal "email"
    Y envío el OTP "222222" para el canal "email"
    Entonces el sistema indica que se agotaron los intentos

  Escenario: OTP expirado al intentar usarlo
    Dado que me registro con nombre "Esteban", email "esteban@ejemplo.com", DNI "12345678", teléfono "1100005555" y contraseña "Passw0rd!"
    Y el OTP del canal "email" ya expiró
    Cuando envío el OTP correcto del canal "email"
    Entonces el sistema indica que el OTP expiró y ofrece reenviar uno nuevo

  Escenario: Reenvío de OTP genera un código nuevo
    Dado que me registro con nombre "Fer", email "fer@ejemplo.com", DNI "12345678", teléfono "1100006666" y contraseña "Passw0rd!"
    Y pasaron 31 segundos desde el último envío
    Cuando solicito reenviar el OTP del canal "email"
    Entonces se envió un nuevo OTP por email a "fer@ejemplo.com"
