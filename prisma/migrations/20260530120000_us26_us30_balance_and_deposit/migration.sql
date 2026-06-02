-- US-26 (Reservar con seña) + US-30 (Pagar saldo de reserva señada) — parte 1/2
--
-- El nuevo valor de enum se agrega en su propia migración porque Postgres no
-- permite USAR un valor de enum recién agregado dentro de la misma transacción
-- que lo creó. La migración 2/2 (que recrea la EXCLUDE constraint referenciando
-- 'pending_balance') corre en una transacción posterior, ya con el valor commiteado.

-- Nuevo estado 'pending_balance' (reserva señada, esperando el saldo).
ALTER TYPE "ReservationStatus" ADD VALUE 'pending_balance' BEFORE 'confirmed';
