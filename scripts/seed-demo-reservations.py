#!/usr/bin/env python3
"""
seed-demo-reservations.py
─────────────────────────
Genera reservas para la demo respetando:
- State machine completo (pending_payment/approval, confirmed, in_progress, completed, cancelled, rejected, expired)
- EXCLUDE constraint: no overlap entre reservas blocking (pending_payment, confirmed, in_progress) sobre el mismo vehículo
- Blackout 2026-05-18..2026-06-01 para los vehículos del rentador "zucc" (demo)
- Rango de fechas 2026-03-01..2026-11-30
- Campos requeridos por estado (voucher_token para confirmed+, return_qr_token para in_progress+, etc.)

Uso:
    psql "$DIRECT_URL" -t -A -F'|' -c \\
      'SELECT id, plate, brand, model, "ownerId", base_price_cents FROM vehicles ORDER BY "ownerId", brand;' \\
      > /tmp/vehicles.txt
    python3 scripts/seed-demo-reservations.py        # genera /tmp/seed-reservations.sql
    psql "$DIRECT_URL" -f /tmp/seed-reservations.sql

⚠️  IMPORTANTE — ¿Por qué inserción directa por SQL en lugar de ir por la API?
─────────────────────────────────────────────────────────────────────────────
Crear reservas pasando por POST /reservations + POST /reservations/:id/payment
requeriría 162 round-trips con manejo de auth (token de cada conductor) y
estado fresh (hold de 10min, etc). Para data de demo es 10x más rápido
generar el SQL directo, pero hay que replicar a mano todos los efectos
secundarios que normalmente hace la entity Reservation:
  - voucher_token (uuid) cuando status >= confirmed
  - return_qr_token (uuid) cuando status >= in_progress
  - paid_at, payment_method, wallet_provider (si digital_wallet)
  - started_at cuando status >= in_progress
  - completed_at cuando completed
  - hold_expires_at solo si pending_payment/pending_approval
  - rejection_reason cuando rejected

Si cambia la state machine en api/src/domain/entities/reservation.entity.ts,
revisar build_reservation() en este script.
"""
import random
import uuid
from datetime import datetime, timedelta, timezone

random.seed(20260515)  # Reproducible

# ── Users ─────────────────────────────────────────────────────────────────────
OWNERS = {
    'zucc':      'debfec83-3d99-4233-a854-3dc62d3c0d2e',
    'mariano':   'fa857c33-6058-4cfd-a31a-d298d91245ea',
    'juanma':    'f4a080dc-fc6c-45df-b813-18863f3514de',
    'francisco': '90b7373d-23b0-4ee4-9f3f-14c0941a41f9',
}
EXTRA_CONDUCTORS = {
    'aizen':  '0e4ad363-e922-4a76-b02c-14fa8bd0ae0e',
    'maikel': 'e91897e4-b48b-44f9-8534-eb435f4a69a7',
}
ALL_CONDUCTORS = {**OWNERS, **EXTRA_CONDUCTORS}
OWNER_IDS = set(OWNERS.values())
DEMO_OWNER = OWNERS['zucc']

# ── Vehicles ──────────────────────────────────────────────────────────────────
vehicles = []
with open('/tmp/vehicles.txt') as f:
    for line in f:
        line = line.strip()
        if not line:
            continue
        parts = line.split('|')
        if len(parts) < 6:
            continue
        owner = parts[4]
        if owner not in OWNER_IDS:
            continue
        vehicles.append({
            'id': parts[0],
            'plate': parts[1],
            'brand': parts[2],
            'model': parts[3],
            'owner_id': owner,
            'price': int(parts[5]),
        })

# ── Date constants ────────────────────────────────────────────────────────────
TZ = timezone.utc
TODAY = datetime(2026, 5, 20, 12, 0, tzinfo=TZ)
RANGE_START = datetime(2026, 3, 1, tzinfo=TZ)
RANGE_END = datetime(2026, 11, 30, tzinfo=TZ)
BLACKOUT_START = datetime(2026, 5, 18, tzinfo=TZ)
BLACKOUT_END = datetime(2026, 6, 1, tzinfo=TZ)

# ── Helpers ───────────────────────────────────────────────────────────────────
def overlaps(start, end, ranges):
    for s, e in ranges:
        if start < e and s < end:
            return True
    return False

def sql_ts(dt):
    if dt is None:
        return 'NULL'
    return f"'{dt.strftime('%Y-%m-%d %H:%M:%S')}+00'::timestamptz"

def sql_str(s):
    if s is None:
        return 'NULL'
    return "'" + s.replace("'", "''") + "'"

def sql_uuid(u):
    if u is None:
        return 'NULL'
    return f"'{u}'::uuid"

# ── Status generator ──────────────────────────────────────────────────────────
STATUS_WEIGHTS = [
    ('completed', 30),
    ('confirmed', 12),
    ('in_progress', 4),
    ('pending_payment', 6),
    ('pending_approval', 6),
    ('cancelled', 12),
    ('rejected', 6),
    ('expired', 6),
]

def pick_status(start, end, is_demo_blackout):
    valid = []
    for s, w in STATUS_WEIGHTS:
        if s == 'in_progress':
            if not (start <= TODAY <= end) or is_demo_blackout:
                continue
        elif s == 'completed':
            if end >= TODAY:
                continue
        elif s in ('confirmed', 'pending_payment', 'pending_approval'):
            if start <= TODAY:
                continue
        valid.append((s, w))
    if not valid:
        return None
    pop, ws = zip(*valid)
    return random.choices(pop, weights=ws, k=1)[0]

# ── Build reservation row ─────────────────────────────────────────────────────
PAYMENT_METHODS_IMMEDIATE = ['credit_card', 'debit_card', 'digital_wallet']
WALLET_PROVIDERS = ['mercadopago', 'uala']
REJECT_REASONS = [
    'Conductor sin reputación suficiente para mi auto.',
    'Las fechas no me alcanzan para prepararlo.',
    'Tengo el auto en service esa semana, perdón.',
    'Prefiero alquileres más largos para el modelo.',
    'No coincide la zona de retiro con mi disponibilidad.',
]
CANCEL_REASONS = [
    'Me cambiaron los planes del viaje.',
    'Conseguí otro auto más cercano.',
    'Surgió un imprevisto familiar.',
    'Reservé por error la fecha equivocada.',
]
TRANSFER_ALIASES = ['carmen.alquiler.mp', 'rocket.lease.123', 'auto.disponible.ar', 'reserva.transfer.bsas']

def build_reservation(veh, conductor_id, start, end, status):
    days = (end - start).days
    if days <= 0:
        days = 1
    total = veh['price'] * days
    rid = str(uuid.uuid4())
    contract_accepted_at = start - timedelta(days=random.randint(3, 25))
    created_at = contract_accepted_at - timedelta(minutes=random.randint(2, 30))
    updated_at = created_at

    row = {
        'id': rid,
        'vehicle_id': veh['id'],
        'conductor_id': conductor_id,
        'rentador_id': veh['owner_id'],
        'status': status,
        'start_at': start,
        'end_at': end,
        'hold_expires_at': None,
        'total_cents': total,
        'currency': 'ARS',
        'payment_method': None,
        'contract_accepted_at': contract_accepted_at,
        'paid_at': None,
        'created_at': created_at,
        'updated_at': updated_at,
        'rejection_reason': None,
        'wallet_provider': None,
        'transfer_code': None,
        'transfer_expires_at': None,
        'transfer_alias': None,
        'voucher_token': None,
        'return_qr_token': None,
        'started_at': None,
        'completed_at': None,
    }

    if status == 'pending_payment':
        # Approval ya pasada o auto_accept; hold de 10 min activo
        approved_at = created_at + timedelta(seconds=random.randint(30, 600))
        row['hold_expires_at'] = approved_at + timedelta(minutes=10)
        row['updated_at'] = approved_at
    elif status == 'pending_approval':
        # Caso "esperando rentador" (NO el caso post-bank_transfer)
        row['hold_expires_at'] = created_at + timedelta(hours=24)
        row['updated_at'] = created_at
    elif status == 'confirmed':
        method = random.choice(PAYMENT_METHODS_IMMEDIATE + ['bank_transfer'])
        paid_at = created_at + timedelta(minutes=random.randint(1, 240))
        row['payment_method'] = method
        if method == 'digital_wallet':
            row['wallet_provider'] = random.choice(WALLET_PROVIDERS)
        row['paid_at'] = paid_at
        row['voucher_token'] = str(uuid.uuid4())
        row['updated_at'] = paid_at
    elif status == 'in_progress':
        method = random.choice(PAYMENT_METHODS_IMMEDIATE + ['bank_transfer'])
        paid_at = created_at + timedelta(minutes=random.randint(1, 180))
        started_at = start + timedelta(minutes=random.randint(0, 90))
        row['payment_method'] = method
        if method == 'digital_wallet':
            row['wallet_provider'] = random.choice(WALLET_PROVIDERS)
        row['paid_at'] = paid_at
        row['voucher_token'] = str(uuid.uuid4())
        row['return_qr_token'] = str(uuid.uuid4())
        row['started_at'] = started_at
        row['updated_at'] = started_at
    elif status == 'completed':
        method = random.choice(PAYMENT_METHODS_IMMEDIATE + ['bank_transfer'])
        paid_at = created_at + timedelta(minutes=random.randint(1, 240))
        started_at = start + timedelta(minutes=random.randint(0, 60))
        completed_at = end + timedelta(minutes=random.randint(-30, 120))
        row['payment_method'] = method
        if method == 'digital_wallet':
            row['wallet_provider'] = random.choice(WALLET_PROVIDERS)
        row['paid_at'] = paid_at
        row['voucher_token'] = str(uuid.uuid4())
        row['return_qr_token'] = str(uuid.uuid4())
        row['started_at'] = started_at
        row['completed_at'] = completed_at
        row['updated_at'] = completed_at
    elif status == 'cancelled':
        # Cancelado por el conductor antes de empezar el alquiler
        cancel_at = created_at + timedelta(hours=random.randint(1, 72))
        row['updated_at'] = cancel_at
        # 30% incluye razón explícita
        if random.random() < 0.3:
            row['rejection_reason'] = random.choice(CANCEL_REASONS)
    elif status == 'rejected':
        # Rechazado por rentador desde pending_approval
        reject_at = created_at + timedelta(minutes=random.randint(15, 600))
        row['rejection_reason'] = random.choice(REJECT_REASONS)
        row['updated_at'] = reject_at
    elif status == 'expired':
        # Hold de pago expirado (10min sin pagar) o aprobación expirada (24h sin respuesta)
        if random.random() < 0.5:
            # Hold expirado
            row['updated_at'] = created_at + timedelta(minutes=10)
        else:
            # Aprobación expirada
            row['updated_at'] = created_at + timedelta(hours=24)

    return row

# ── Generate ──────────────────────────────────────────────────────────────────
occupied = {v['id']: [] for v in vehicles}
reservations = []
TARGET_PER_VEHICLE = 6

for veh in vehicles:
    generated = 0
    attempts = 0
    while generated < TARGET_PER_VEHICLE and attempts < 80:
        attempts += 1
        # Conductor distinto del owner
        candidate_keys = [k for k, v in ALL_CONDUCTORS.items() if v != veh['owner_id']]
        conductor_id = ALL_CONDUCTORS[random.choice(candidate_keys)]

        days = random.choice([2, 3, 3, 4, 5, 5, 7, 10, 14])
        max_start = RANGE_END - timedelta(days=days)
        days_range = (max_start - RANGE_START).days
        start_offset = random.randint(0, days_range)
        start_hour = random.choice([9, 10, 11, 14, 15, 16])
        start = RANGE_START + timedelta(days=start_offset, hours=start_hour)
        end_hour = random.choice([10, 11, 16, 17])
        end = start + timedelta(days=days, hours=end_hour - start_hour)

        is_demo_blackout = veh['owner_id'] == DEMO_OWNER and (
            start < BLACKOUT_END and end > BLACKOUT_START
        )
        if is_demo_blackout:
            continue

        if overlaps(start, end, occupied[veh['id']]):
            continue

        status = pick_status(start, end, is_demo_blackout)
        if status is None:
            continue

        res = build_reservation(veh, conductor_id, start, end, status)
        reservations.append(res)
        if status in ('pending_payment', 'confirmed', 'in_progress'):
            occupied[veh['id']].append((start, end))
        generated += 1

# ── Emit SQL ──────────────────────────────────────────────────────────────────
out = []
out.append('-- AUTO-GENERATED by gen_reservations.py — DO NOT EDIT MANUALLY')
out.append('-- ' + str(len(reservations)) + ' reservations across ' + str(len(vehicles)) + ' vehicles')
out.append('BEGIN;')
out.append('')
out.append('-- Limpiar reservas existentes de los 4 dueños demo (idempotencia)')
owner_list = ', '.join(f"'{oid}'" for oid in OWNER_IDS)
out.append(f'DELETE FROM reservations WHERE rentador_id IN ({owner_list});')
out.append('')
out.append('INSERT INTO reservations (')
out.append('  id, vehicle_id, conductor_id, rentador_id, status,')
out.append('  start_at, end_at, hold_expires_at, total_cents, currency,')
out.append('  payment_method, wallet_provider, contract_accepted_at, paid_at,')
out.append('  voucher_token, return_qr_token, started_at, completed_at,')
out.append('  rejection_reason, transfer_code, transfer_alias, transfer_expires_at,')
out.append('  created_at, updated_at')
out.append(') VALUES')
rows = []
for r in reservations:
    pm = sql_str(r['payment_method']) + '::"PaymentMethod"' if r['payment_method'] else 'NULL'
    parts = [
        sql_str(r['id']),
        sql_str(r['vehicle_id']),
        sql_str(r['conductor_id']),
        sql_str(r['rentador_id']),
        sql_str(r['status']) + '::"ReservationStatus"',
        sql_ts(r['start_at']),
        sql_ts(r['end_at']),
        sql_ts(r['hold_expires_at']),
        str(r['total_cents']),
        sql_str(r['currency']),
        pm,
        sql_str(r['wallet_provider']),
        sql_ts(r['contract_accepted_at']),
        sql_ts(r['paid_at']),
        sql_uuid(r['voucher_token']),
        sql_uuid(r['return_qr_token']),
        sql_ts(r['started_at']),
        sql_ts(r['completed_at']),
        sql_str(r['rejection_reason']),
        sql_str(r['transfer_code']),
        sql_str(r['transfer_alias']),
        sql_ts(r['transfer_expires_at']),
        sql_ts(r['created_at']),
        sql_ts(r['updated_at']),
    ]
    rows.append('  (' + ', '.join(parts) + ')')
out.append(',\n'.join(rows) + ';')
out.append('')
out.append('COMMIT;')
out.append('')
out.append('-- Resumen')
out.append("SELECT status, COUNT(*) FROM reservations WHERE rentador_id IN (" + owner_list + ") GROUP BY status ORDER BY status;")

with open('/tmp/seed-reservations.sql', 'w') as f:
    f.write('\n'.join(out))

# Stats
from collections import Counter
stats = Counter(r['status'] for r in reservations)
print(f'Generated {len(reservations)} reservations')
for s, c in sorted(stats.items()):
    print(f'  {s}: {c}')
