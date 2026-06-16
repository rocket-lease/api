-- Penalty: el unique pasa de (ticket_id) a (ticket_id, user_id).
-- Un mismo fallo de admin puede penalizar a ambas partes de la reserva con el
-- mismo ticket_id; el unique por ticket impedía la segunda penalización
-- (PenaltyAlreadyAppliedException / unique violation). Ahora es único por
-- (ticket, usuario): cada parte recibe a lo sumo una penalización por ticket.

DROP INDEX IF EXISTS "penalties_ticket_id_key";

CREATE UNIQUE INDEX IF NOT EXISTS "penalties_ticket_id_user_id_key"
    ON "penalties"("ticket_id", "user_id");
