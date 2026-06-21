-- Drop FK: reviews_reviewed_id_fkey
-- `reviewed_id` es polimórfico — apunta a users.id (reseñas de conductor/rentador)
-- o a vehicles.id (reseñas de vehículo). La FK a users impedía las reseñas de
-- vehículo (FK violation). La distinción de a qué entidad apunta se resuelve por
-- `target_type`. El índice (target_type, reviewed_id) se conserva.

ALTER TABLE "reviews" DROP CONSTRAINT IF EXISTS "reviews_reviewed_id_fkey";
