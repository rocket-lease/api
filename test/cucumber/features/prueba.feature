# language: es
Característica: Prueba testing

  Escenario: Prueba de testing en cucumber js
    Dado estoy probando cucumber
    Cuando ejecuto un test
    Entonces da exitoso

  Escenario: Prueba de testing en cucumber js fallida
    Dado estoy probando cucumber
    Cuando ejecuto un test que deberia fallar
    Entonces da error
