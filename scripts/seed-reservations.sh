#!/usr/bin/env bash
# Seed bulk de reservas DIRECTO a la DB (bypass api state machine).
#
# - Detecta dinámicamente todos los vehículos publicados y todos los users
#   que tienen al menos 1 vehículo (los usa como pool de conductores).
# - Por cada vehículo inserta 22 reservas distribuidas entre marzo y noviembre
#   de 2026, cubriendo TODOS los statuses excepto `pending_approval`.
# - El conductor de cada reserva se elige al azar del pool, excluyendo al
#   owner del vehículo (sino la api tiraría OwnerCannotReserveOwnVehicle).
# - LIMPIA reservas previas sobre los vehículos seedeables antes de insertar,
#   para evitar choques con el EXCLUDE constraint `reservations_no_overlap`.
#
# Uso: bash scripts/seed-reservations.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env"

if [ -f "$ENV_FILE" ]; then
  set -a
  source "$ENV_FILE"
  set +a
fi

if [ -z "${DIRECT_URL:-}" ]; then
  echo "ERROR: DIRECT_URL must be set in .env" >&2
  exit 1
fi

echo "→ Conectando a $(echo "$DIRECT_URL" | sed -E 's|.*@([^/]+).*|\1|') ..." >&2

psql "$DIRECT_URL" -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;

-- 1) Cleanup: eliminar reservas previas en los vehículos que vamos a re-seedear.
--    Se borran SOLO de vehículos cuyo owner es user con vehículo (= pool seedeable).
WITH active_users AS (
  SELECT DISTINCT "ownerId" AS id FROM vehicles
),
seedable_vehicles AS (
  SELECT v.id
  FROM vehicles v
  WHERE EXISTS (SELECT 1 FROM active_users au WHERE au.id <> v."ownerId")
)
DELETE FROM reservations
WHERE vehicle_id IN (SELECT id FROM seedable_vehicles);

-- 2) Pool + slots + insert.
WITH active_users AS (
  SELECT DISTINCT "ownerId" AS id FROM vehicles
),
slots(idx, start_at, end_at, status, has_payment, rejection_reason) AS (
  VALUES
    -- Pasado (completed / cancelled / rejected / expired)
    (1,  '2026-03-01T10:00:00Z'::timestamptz, '2026-03-04T18:00:00Z'::timestamptz, 'completed',       true,  NULL::text),
    (2,  '2026-03-10T09:00:00Z'::timestamptz, '2026-03-12T18:00:00Z'::timestamptz, 'completed',       true,  NULL),
    (3,  '2026-03-18T08:00:00Z'::timestamptz, '2026-03-22T20:00:00Z'::timestamptz, 'cancelled',       false, NULL),
    (4,  '2026-04-01T10:00:00Z'::timestamptz, '2026-04-05T18:00:00Z'::timestamptz, 'completed',       true,  NULL),
    (5,  '2026-04-12T10:00:00Z'::timestamptz, '2026-04-13T18:00:00Z'::timestamptz, 'rejected',        false, 'Vehículo en mantenimiento'),
    (6,  '2026-04-20T09:00:00Z'::timestamptz, '2026-04-24T18:00:00Z'::timestamptz, 'completed',       true,  NULL),
    (7,  '2026-05-01T09:00:00Z'::timestamptz, '2026-05-05T18:00:00Z'::timestamptz, 'completed',       true,  NULL),
    (8,  '2026-05-10T10:00:00Z'::timestamptz, '2026-05-11T18:00:00Z'::timestamptz, 'expired',         false, NULL),
    -- Presente (in_progress atraviesa hoy 2026-05-17)
    (9,  '2026-05-15T10:00:00Z'::timestamptz, '2026-05-20T18:00:00Z'::timestamptz, 'in_progress',     true,  NULL),
    -- Futuro inmediato (pending_payment con hold a 1h, se auto-expirará)
    (10, '2026-05-25T10:00:00Z'::timestamptz, '2026-05-28T18:00:00Z'::timestamptz, 'pending_payment', false, NULL),
    -- Futuro (confirmed / cancelled / rejected / expired)
    (11, '2026-06-05T10:00:00Z'::timestamptz, '2026-06-08T18:00:00Z'::timestamptz, 'confirmed',       true,  NULL),
    (12, '2026-06-20T10:00:00Z'::timestamptz, '2026-06-24T18:00:00Z'::timestamptz, 'confirmed',       true,  NULL),
    (13, '2026-07-10T10:00:00Z'::timestamptz, '2026-07-14T18:00:00Z'::timestamptz, 'confirmed',       true,  NULL),
    (14, '2026-07-25T10:00:00Z'::timestamptz, '2026-07-28T18:00:00Z'::timestamptz, 'cancelled',       false, NULL),
    (15, '2026-08-05T10:00:00Z'::timestamptz, '2026-08-09T18:00:00Z'::timestamptz, 'confirmed',       true,  NULL),
    (16, '2026-08-20T10:00:00Z'::timestamptz, '2026-08-24T18:00:00Z'::timestamptz, 'rejected',        false, 'El vehículo no estará disponible'),
    (17, '2026-09-01T10:00:00Z'::timestamptz, '2026-09-05T18:00:00Z'::timestamptz, 'confirmed',       true,  NULL),
    (18, '2026-09-18T10:00:00Z'::timestamptz, '2026-09-22T18:00:00Z'::timestamptz, 'confirmed',       true,  NULL),
    (19, '2026-10-05T10:00:00Z'::timestamptz, '2026-10-08T18:00:00Z'::timestamptz, 'confirmed',       true,  NULL),
    (20, '2026-10-22T10:00:00Z'::timestamptz, '2026-10-25T18:00:00Z'::timestamptz, 'expired',         false, NULL),
    (21, '2026-11-05T10:00:00Z'::timestamptz, '2026-11-10T18:00:00Z'::timestamptz, 'confirmed',       true,  NULL),
    (22, '2026-11-20T10:00:00Z'::timestamptz, '2026-11-25T18:00:00Z'::timestamptz, 'confirmed',       true,  NULL)
)
INSERT INTO reservations (
  id, vehicle_id, conductor_id, rentador_id, status,
  start_at, end_at, hold_expires_at, total_cents, currency, payment_method,
  contract_accepted_at, paid_at, rejection_reason,
  created_at, updated_at
)
SELECT
  gen_random_uuid()::text,
  v.id,
  (SELECT au.id FROM active_users au WHERE au.id <> v."ownerId" ORDER BY random() LIMIT 1),
  v."ownerId",
  s.status::"ReservationStatus",
  s.start_at,
  s.end_at,
  CASE WHEN s.status = 'pending_payment' THEN NOW() + INTERVAL '1 hour' ELSE NULL END,
  GREATEST(
    1,
    (v.base_price_cents * EXTRACT(EPOCH FROM (s.end_at - s.start_at)) / 86400)::int
  ),
  'ARS',
  CASE WHEN s.has_payment THEN 'credit_card'::"PaymentMethod" ELSE NULL END,
  NOW(),
  CASE WHEN s.has_payment THEN LEAST(s.start_at - INTERVAL '1 hour', NOW()) ELSE NULL END,
  s.rejection_reason,
  NOW(),
  NOW()
FROM vehicles v
CROSS JOIN slots s
WHERE EXISTS (SELECT 1 FROM active_users au WHERE au.id <> v."ownerId");

-- 3) Resumen.
SELECT
  status,
  COUNT(*) AS cantidad
FROM reservations
GROUP BY status
ORDER BY status;

COMMIT;
SQL

echo "→ Hecho." >&2
