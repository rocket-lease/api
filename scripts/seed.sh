#!/usr/bin/env bash
set -euo pipefail

API_BASE="${API_BASE:-http://localhost:8080}"
SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env"

if [ -f "$ENV_FILE" ]; then
  set -a
  source "$ENV_FILE"
  set +a
fi

if [ -z "${SUPABASE_URL:-}" ] || [ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
  echo "ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (in .env or env)" >&2
  exit 1
fi

log() { echo "$*" >&2; }

confirm_email() {
  local user_id="$1" email="$2"
  log "  Confirming email for $email ..."
  http_code=$(curl -s -o /dev/null -w '%{http_code}' -X PUT \
    "${SUPABASE_URL}/auth/v1/admin/users/${user_id}" \
    -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json" \
    -d '{"email_confirm":true}')
  if [ "$http_code" -eq 200 ]; then
    log "    OK (email confirmed)"
  else
    log "    WARN: Supabase returned HTTP ${http_code} (user may already be confirmed)"
  fi
}

get_supabase_user_id() {
  local email="$1"
  curl -s "${SUPABASE_URL}/auth/v1/admin/users" \
    -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" |
    jq -r --arg email "$email" '.users[] | select(.email == $email) | .id'
}

call_api() {
  local method="$1" path="$2" token="${3:-}" body="${4:-}"
  local hdrs=(-H "Content-Type: application/json")
  if [ -n "$token" ]; then
    hdrs+=(-H "Authorization: Bearer $token")
  fi
  if [ -n "$body" ]; then
    curl -s -w '\n%{http_code}' -X "$method" "${API_BASE}${path}" \
      "${hdrs[@]}" -d "$body"
  else
    curl -s -w '\n%{http_code}' -X "$method" "${API_BASE}${path}" \
      "${hdrs[@]}"
  fi
}

register_user() {
  local name="$1" email="$2" dni="$3" phone="$4" password="$5"
  log "  Registering $email ..."
  resp=$(call_api POST /auth/register "" \
    "$(jq -nc --arg n "$name" --arg e "$email" --arg d "$dni" --arg p "$phone" --arg pw "$password" \
      '{name: $n, email: $e, dni: $d, phone: $p, password: $pw}')")
  http_code=$(echo "$resp" | tail -1)
  body=$(echo "$resp" | sed '$d')
  if [ "$http_code" = "201" ]; then
    user_id=$(echo "$body" | jq -r '.id')
    log "    Created with id: $user_id"
    echo "$user_id"
  elif [ "$http_code" = "409" ] || { [ "$http_code" = "400" ] && echo "$body" | grep -q "already been registered"; }; then
    log "    Already exists"
    user_id=$(get_supabase_user_id "$email")
    if [ -n "$user_id" ]; then
      log "    Found existing id: $user_id"
      echo "$user_id"
    else
      log "    WARN: Could not find user in Supabase"
      echo ""
    fi
  else
    log "    ERROR ($http_code): $body"
    echo ""
  fi
}

login_user() {
  local email="$1" password="$2"
  log "  Logging in $email ..."
  resp=$(call_api POST /auth/login "" \
    "$(jq -nc --arg e "$email" --arg p "$password" '{email: $e, password: $p}')")
  http_code=$(echo "$resp" | tail -1)
  body=$(echo "$resp" | sed '$d')
  if [ "$http_code" = "201" ]; then
    log "    OK"
    echo "$body" | jq -r '.access_token'
  else
    log "    ERROR: Login failed for $email ($http_code): $body"
    echo ""
  fi
}

create_vehicle() {
  local token="$1" data="$2"
  log "  Creating vehicle..."
  resp=$(call_api POST /vehicle "$token" "$data")
  http_code=$(echo "$resp" | tail -1)
  body=$(echo "$resp" | sed '$d')
  if [ "$http_code" = "201" ]; then
    vid=$(echo "$body" | jq -r '.id')
    log "    Created vehicle: $vid"
    echo "$vid"
  else
    log "    ERROR ($http_code): $body"
    echo ""
  fi
}

PASSWORD="RocketLease123!"

# ── Cleanup existing seed users ─────────────────
log ""
log "=== 0/5 Cleanup existing seed users ==="

# Clean Supabase Auth
for email in carlos.seed@example.com maria.seed@example.com juan.seed@example.com; do
  uid=$(get_supabase_user_id "$email")
  if [ -n "$uid" ]; then
    log "  Deleting $email from Supabase Auth ..."
    curl -s -X DELETE "${SUPABASE_URL}/auth/v1/admin/users/${uid}" \
      -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
      -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" > /dev/null
    log "    Done"
  fi
done

# Clean local DB (docker exec)
DB_CONTAINER=$(docker ps --filter name=api-db --format '{{.Names}}' | head -1)
if [ -n "$DB_CONTAINER" ]; then
  log "  Cleaning local DB ..."
  docker exec "$DB_CONTAINER" psql -U postgres -d rocket_lease \
    -c "DELETE FROM favorites; DELETE FROM reservations; DELETE FROM vehicle_characteristics; DELETE FROM photos; DELETE FROM vehicles; DELETE FROM users WHERE email LIKE '%.seed@%';" > /dev/null 2>&1
  log "    Done"
else
  log "  WARN: No Docker DB container found, skipping local DB cleanup"
fi

# ── Users ──────────────────────────────────────
echo ""
echo "=== 1/5 Register users ==="

CARLOS_ID=$(register_user "Carlos García" "carlos.seed@example.com" "12345678" "+541112345678" "$PASSWORD")
MARIA_ID=$(register_user "María López" "maria.seed@example.com" "23456789" "+541112345679" "$PASSWORD")
JUAN_ID=$(register_user "Juan Pérez" "juan.seed@example.com" "34567890" "+541112345680" "$PASSWORD")

# ── Confirm emails ─────────────────────────────
echo ""
echo "=== 2/5 Confirm emails via Supabase Admin API ==="

if [ -n "$CARLOS_ID" ]; then confirm_email "$CARLOS_ID" "carlos.seed@example.com"; fi
if [ -n "$MARIA_ID" ]; then confirm_email "$MARIA_ID" "maria.seed@example.com"; fi
if [ -n "$JUAN_ID" ]; then confirm_email "$JUAN_ID" "juan.seed@example.com"; fi

# ── Login ──────────────────────────────────────
echo ""
echo "=== 3/5 Login ==="

CARLOS_TOKEN=$(login_user "carlos.seed@example.com" "$PASSWORD")
MARIA_TOKEN=$(login_user "maria.seed@example.com" "$PASSWORD")
JUAN_TOKEN=$(login_user "juan.seed@example.com" "$PASSWORD")

if [ -z "$CARLOS_TOKEN" ] || [ -z "$JUAN_TOKEN" ]; then
  log "ERROR: Could not obtain tokens."
  exit 1
fi

# ── Vehicles ────────────────────────────────────
echo ""
echo "=== 4/5 Create vehicles ==="

CAT='cat' # dummy var to avoid heredoc issues with $ in JSON

SEDAN_ID=$(create_vehicle "$CARLOS_TOKEN" "$($CAT <<'JSON'
{
  "plate": "AB123CD",
  "brand": "Toyota",
  "model": "Corolla",
  "year": 2022,
  "passengers": 5,
  "trunkLiters": 470,
  "transmission": "Automatico",
  "isAccessible": false,
  "photos": ["https://placehold.co/800x600/EEE/333?text=Corolla+1", "https://placehold.co/800x600/EEE/333?text=Corolla+2"],
  "color": "Blanco",
  "mileage": 15000,
  "basePriceCents": 25000,
  "description": "Sedan comodo y economico, ideal para ciudad",
  "characteristics": ["GPS", "BLUETOOTH", "USB_CHARGER"],
  "availableFrom": "2026-01-01",
  "province": "CABA",
  "city": "Palermo"
}
JSON
)")

SUV_ID=$(create_vehicle "$CARLOS_TOKEN" "$($CAT <<'JSON'
{
  "plate": "EF456GH",
  "brand": "Ford",
  "model": "Territory",
  "year": 2023,
  "passengers": 5,
  "trunkLiters": 520,
  "transmission": "Automatico",
  "isAccessible": true,
  "photos": ["https://placehold.co/800x600/EEE/333?text=Territory+1"],
  "color": "Negro",
  "mileage": 8000,
  "basePriceCents": 45000,
  "description": "SUV espaciosa con accesibilidad",
  "characteristics": ["GPS", "BABY_SEAT", "WIFI", "PET_FRIENDLY"],
  "availableFrom": "2026-03-15",
  "province": "Buenos Aires",
  "city": "La Plata"
}
JSON
)")

PICKUP_ID=$(create_vehicle "$MARIA_TOKEN" "$($CAT <<'JSON'
{
  "plate": "IJ789KL",
  "brand": "Volkswagen",
  "model": "Amarok",
  "year": 2021,
  "passengers": 5,
  "trunkLiters": 800,
  "transmission": "Manual",
  "isAccessible": false,
  "photos": ["https://placehold.co/800x600/EEE/333?text=Amarok+1", "https://placehold.co/800x600/EEE/333?text=Amarok+2"],
  "color": "Gris",
  "mileage": 45000,
  "basePriceCents": 55000,
  "description": "Pickup robusta para trabajos pesados o viajes",
  "characteristics": ["BLUETOOTH", "USB_CHARGER"],
  "availableFrom": "2026-02-01",
  "province": "Córdoba",
  "city": "Córdoba Capital"
}
JSON
)")

# ── Reservations ────────────────────────────────
echo ""
echo "=== 5/5 Create reservations ==="

if [ -n "$SEDAN_ID" ]; then
  log "  Creating reservation (Corolla, confirmed)..."
  resp=$(call_api POST /reservations "$JUAN_TOKEN" \
    "$(jq -nc --arg vid "$SEDAN_ID" '{vehicleId: $vid, startAt: "2026-06-01T10:00:00Z", endAt: "2026-06-05T10:00:00Z", contractAccepted: true}')")
  http_code=$(echo "$resp" | tail -1)
  body=$(echo "$resp" | sed '$d')
  if [ "$http_code" = "201" ]; then
    log "    Created: $(echo "$body" | jq -r '.id')"
  else
    log "    ERROR ($http_code): $body"
  fi
fi

if [ -n "$SUV_ID" ]; then
  log "  Creating reservation (Territory, in_progress)..."
  resp=$(call_api POST /reservations "$JUAN_TOKEN" \
    "$(jq -nc --arg vid "$SUV_ID" '{vehicleId: $vid, startAt: "2026-05-15T08:00:00Z", endAt: "2026-05-18T08:00:00Z", contractAccepted: true}')")
  http_code=$(echo "$resp" | tail -1)
  body=$(echo "$resp" | sed '$d')
  if [ "$http_code" = "201" ]; then
    res_id=$(echo "$body" | jq -r '.id')
    log "    Created: $res_id"
    log "    Confirming payment..."
    resp2=$(call_api POST "/reservations/${res_id}/payment" "$JUAN_TOKEN" \
      '{"paymentMethod":"debit_card"}')
    code2=$(echo "$resp2" | tail -1)
    if [ "$code2" = "201" ]; then
      log "    Paid"
    else
      log "    Payment ERROR ($code2): $(echo "$resp2" | sed '$d')"
    fi
  else
    log "    ERROR ($http_code): $body"
  fi
fi

# ── Summary ────────────────────────────────────
echo ""
echo "=== Done ==="
echo ""
echo "Users:"
echo "  carlos.seed@example.com / $PASSWORD  (rentador)"
echo "  maria.seed@example.com / $PASSWORD   (rentador)"
echo "  juan.seed@example.com / $PASSWORD    (conductor)"
