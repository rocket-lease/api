-- ─────────────────────────────────────────────────────────────────────────────
-- seed-demo-vehicles.sql
--
-- Seed de 20 vehículos + 8 reservation rule sets para la demo, distribuidos en
-- 4 usuarios pre-existentes. Pensado para correrse contra Supabase (prod o
-- staging) con psql, NO contra docker local. Para seed local de dev usar
-- scripts/seed.sh, que va por la API y genera datos coherentes con auth.
--
-- Uso:
--   psql "$DIRECT_URL" -f scripts/seed-demo-vehicles.sql
--
-- ⚠️  IMPORTANTE — ¿Por qué este script usa gen_random_uuid()?
-- ─────────────────────────────────────────────────────────────
-- La columna `vehicles.id` y `reservation_rule_sets.id` son TEXT en la DB,
-- pero el dominio (src/domain/entities/vehicle.entity.ts) valida los IDs con
-- z.string().uuid('Invalid ID format') al RECONSTRUIR la entidad desde la DB.
--
-- Si insertás IDs custom estilo 'v-bmw' o 'rs-flex-zucc' (legibles para
-- debugging), todo INSERT pasa, pero la primera vez que el repo intente cargar
-- esas filas (GET /vehicle, GET /vehicle/:id, etc.) Zod lanza
-- InvalidEntityDataException y la API devuelve 400 para *toda la tabla*.
--
-- Por eso este script genera UUIDs reales con gen_random_uuid()::text y usa
-- temp tables con slugs legibles solo para mantener las referencias FK
-- (vehicles.reservation_rule_set_id, photos.vehicleId, etc.) legibles dentro
-- del script. Los slugs nunca llegan a la DB.
--
-- Regla general: cualquier dato que termine en una columna validada como UUID
-- por el dominio debe ser un UUID en la DB, no un string descriptivo.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── Limpiar seeds anteriores (idempotencia) ─────────────────────────────────
-- Borramos por plate (único) en vez de por id, porque los UUIDs cambian en
-- cada corrida. FKs con ON DELETE CASCADE limpian photos y characteristics.
DELETE FROM vehicles WHERE plate LIKE 'AC___AA' OR plate LIKE 'AC___BB'
                       OR plate LIKE 'AC___CC' OR plate LIKE 'AC___DD'
                       OR plate LIKE 'AC___EE';

-- Borramos rule sets por owner_id+name (combinación natural).
DELETE FROM reservation_rule_sets
WHERE owner_id IN (
  'debfec83-3d99-4233-a854-3dc62d3c0d2e', -- zucc
  'fa857c33-6058-4cfd-a31a-d298d91245ea', -- mariano
  'f4a080dc-fc6c-45df-b813-18863f3514de', -- juanma
  '90b7373d-23b0-4ee4-9f3f-14c0941a41f9'  -- francisco
) AND name IN ('Flexible', 'Premium', 'Estándar', 'Viajes largos', 'Pickup aventura');

-- ── Mapeo slug → UUID ───────────────────────────────────────────────────────
-- Temp tables locales a la transacción. Generan un UUID por slug y nos
-- permiten escribir el resto del script con nombres legibles.

CREATE TEMP TABLE _rs (
  slug TEXT PRIMARY KEY,
  id   TEXT NOT NULL DEFAULT gen_random_uuid()::text
) ON COMMIT DROP;

INSERT INTO _rs(slug) VALUES
  ('flex-zucc'), ('prem-zucc'),
  ('std-mar'),   ('viaje-mar'),
  ('std-jua'),   ('pick-jua'),
  ('flex-fra'),  ('std-fra');

CREATE TEMP TABLE _v (
  slug TEXT PRIMARY KEY,
  id   TEXT NOT NULL DEFAULT gen_random_uuid()::text
) ON COMMIT DROP;

INSERT INTO _v(slug) VALUES
  ('kicks'), ('taos'), ('pulse'), ('sw4'), ('bmw'),         -- zucc
  ('yaris'), ('golf'), ('tracker'), ('duster'), ('renegade'), -- mariano
  ('s10'), ('maverick'), ('vento'), ('wrv'), ('frontier'),  -- juanma
  ('tcross'), ('focus'), ('kangoo'), ('kwid'), ('toro');    -- francisco

-- ── Rule sets ───────────────────────────────────────────────────────────────
INSERT INTO reservation_rule_sets (
  id, owner_id, name, description,
  cancellation_policy, deposit, max_kilometrage_type, max_kilometrage_value,
  min_rental_days, max_rental_days,
  created_at, updated_at
)
SELECT rs.id, d.owner_id, d.name, d.description,
       d.cancellation_policy, d.deposit, d.max_kilometrage_type, d.max_km_value,
       d.min_days, d.max_days,
       now(), now()
FROM (VALUES
  ('flex-zucc', 'debfec83-3d99-4233-a854-3dc62d3c0d2e', 'Flexible',        'Cancelación libre hasta 24hs antes.',                   'FLEXIBLE'::"CancellationPolicy", 'NONE'::"DepositPolicy",          'UNLIMITED'::"MaxKilometrageType", NULL::int, 1, NULL::int),
  ('prem-zucc', 'debfec83-3d99-4233-a854-3dc62d3c0d2e', 'Premium',         'Reserva mínima 2 días, depósito 50%, max 250 km/día.',  'STRICT',                          'FIFTY_PERCENT',                  'LIMITED',                          250,       2, 14),
  ('std-mar',   'fa857c33-6058-4cfd-a31a-d298d91245ea', 'Estándar',        'Cancelación moderada, depósito del 10%.',               'MODERATE',                        'TEN_PERCENT',                    'UNLIMITED',                        NULL,      1, NULL),
  ('viaje-mar', 'fa857c33-6058-4cfd-a31a-d298d91245ea', 'Viajes largos',   'Mínimo 3 días, kilómetros libres, depósito 10%.',       'MODERATE',                        'TEN_PERCENT',                    'UNLIMITED',                        NULL,      3, 21),
  ('std-jua',   'f4a080dc-fc6c-45df-b813-18863f3514de', 'Estándar',        'Cancelación moderada, sin depósito.',                   'MODERATE',                        'NONE',                           'UNLIMITED',                        NULL,      1, NULL),
  ('pick-jua',  'f4a080dc-fc6c-45df-b813-18863f3514de', 'Pickup aventura', 'Mínimo 3 días, depósito 50%, max 400 km/día.',          'STRICT',                          'FIFTY_PERCENT',                  'LIMITED',                          400,       3, NULL),
  ('flex-fra',  '90b7373d-23b0-4ee4-9f3f-14c0941a41f9', 'Flexible',        'Sin depósito, cancelación libre hasta 48hs antes.',     'FLEXIBLE',                        'NONE',                           'UNLIMITED',                        NULL,      1, NULL),
  ('std-fra',   '90b7373d-23b0-4ee4-9f3f-14c0941a41f9', 'Estándar',        'Depósito del 10%, cancelación moderada, mínimo 2 días.', 'MODERATE',                        'TEN_PERCENT',                    'UNLIMITED',                        NULL,      2, NULL)
) AS d(slug, owner_id, name, description, cancellation_policy, deposit, max_kilometrage_type, max_km_value, min_days, max_days)
JOIN _rs rs USING (slug);

-- ── Vehicles ────────────────────────────────────────────────────────────────
-- Cities deben pertenecer a FEATURED_CITIES en web/src/features/vehiculos/components/BuscarPage.tsx:
--   CABA, Córdoba, Rosario, Mendoza, La Plata, Mar del Plata, Tucumán, Salta
-- Si una city no está acá, el filtro de búsqueda no encuentra el vehículo.
INSERT INTO vehicles (
  id, plate, brand, model, year, color, transmission, passengers,
  "trunkLiters", "isAccessible", enabled, mileage, base_price_cents, description,
  province, city, available_from, auto_accept,
  "ownerId", reservation_rule_set_id, "createdAt", "updatedAt"
)
SELECT v.id, d.plate, d.brand, d.model, d.year, d.color, d.transmission::"Transmission", d.passengers,
       d.trunk_liters, d.is_accessible, true, d.mileage, d.base_price_cents, d.description,
       d.province, d.city, d.available_from, d.auto_accept,
       d.owner_id, rs.id, now(), now()
FROM (VALUES
  -- ZUCC (debfec83-…)
  ('kicks',    'flex-zucc', 'AC101AA', 'Nissan',    'Kicks',    2023, 'Gris',    'Automatico', 5, 432.0,  false, 22000.0, 2700000, 'SUV compacta, ágil en ciudad y ruta.',                                'Buenos Aires', 'CABA',         '2026-01-01', true,  'debfec83-3d99-4233-a854-3dc62d3c0d2e'),
  ('taos',     'flex-zucc', 'AC102BB', 'Volkswagen','Taos',     2022, 'Azul',    'Automatico', 5, 520.0,  false, 38000.0, 3500000, 'SUV mediana con techo solar. Perfecta para viajes largos.',           'Buenos Aires', 'CABA',         '2026-01-01', false, 'debfec83-3d99-4233-a854-3dc62d3c0d2e'),
  ('pulse',    NULL,        'AC103CC', 'Fiat',      'Pulse',    2023, 'Gris',    'Automatico', 5, 500.0,  true,  24000.0, 2400000, 'Crossover moderno con accesibilidad adaptada.',                       'Buenos Aires', 'CABA',         '2026-01-01', false, 'debfec83-3d99-4233-a854-3dc62d3c0d2e'),
  ('sw4',      'prem-zucc', 'AC104DD', 'Toyota',    'SW4',      2021, 'Blanco',  'Automatico', 7, 1300.0, false, 60000.0, 5500000, 'SUV 7 pasajeros, 4x4, techo solar, pet friendly.',                    'Santa Fe',     'Rosario',      '2026-01-01', false, 'debfec83-3d99-4233-a854-3dc62d3c0d2e'),
  ('bmw',      'prem-zucc', 'AC105EE', 'BMW',       'X3',       2022, 'Azul',    'Automatico', 5, 550.0,  false, 40000.0, 7500000, 'SUV premium con techo panorámico.',                                   'Buenos Aires', 'CABA',         '2026-01-01', true,  'debfec83-3d99-4233-a854-3dc62d3c0d2e'),
  -- MARIANO (fa857c33-…)
  ('yaris',    NULL,        'AC201AA', 'Toyota',    'Yaris',    2023, 'Blanco',  'Automatico', 5, 286.0,  false, 18000.0, 1900000, 'Sedán compacto, muy económico.',                                      'Buenos Aires', 'CABA',         '2026-01-01', false, 'fa857c33-6058-4cfd-a31a-d298d91245ea'),
  ('golf',     'std-mar',   'AC202BB', 'Volkswagen','Golf',     2022, 'Gris',    'Manual',     5, 380.0,  false, 42000.0, 2800000, 'Hatchback alemán, excelente terminación.',                            'Buenos Aires', 'CABA',         '2026-01-01', true,  'fa857c33-6058-4cfd-a31a-d298d91245ea'),
  ('tracker',  'std-mar',   'AC203CC', 'Chevrolet', 'Tracker',  2023, 'Azul',    'Automatico', 5, 393.0,  true,  20000.0, 3000000, 'SUV familiar accesible con silla para bebé.',                         'Buenos Aires', 'CABA',         '2026-01-01', false, 'fa857c33-6058-4cfd-a31a-d298d91245ea'),
  ('duster',   'viaje-mar', 'AC204DD', 'Renault',   'Duster',   2022, 'Gris',    'Manual',     5, 475.0,  false, 46000.0, 2600000, 'SUV todoterreno para escapadas a la naturaleza.',                     'Buenos Aires', 'CABA',         '2026-01-01', false, 'fa857c33-6058-4cfd-a31a-d298d91245ea'),
  ('renegade', 'std-mar',   'AC205EE', 'Jeep',      'Renegade', 2023, 'Negro',   'Automatico', 5, 320.0,  false, 23000.0, 3200000, 'SUV off-road que acepta mascotas.',                                    'Buenos Aires', 'CABA',         '2026-01-01', false, 'fa857c33-6058-4cfd-a31a-d298d91245ea'),
  -- JUANMA (f4a080dc-…)
  ('s10',      'pick-jua',  'AC301AA', 'Chevrolet', 'S10',      2022, 'Gris',    'Manual',     5, 1100.0, false, 50000.0, 4500000, 'Pickup doble cabina, acepta mascotas.',                               'Buenos Aires', 'CABA',         '2026-01-01', false, 'f4a080dc-fc6c-45df-b813-18863f3514de'),
  ('maverick', 'std-jua',   'AC302BB', 'Ford',      'Maverick', 2023, 'Naranja', 'Automatico', 5, 500.0,  false, 20000.0, 4200000, 'Pickup compacta urbana, confirmación instantánea.',                   'Buenos Aires', 'CABA',         '2026-01-01', true,  'f4a080dc-fc6c-45df-b813-18863f3514de'),
  ('vento',    NULL,        'AC303CC', 'Volkswagen','Vento',    2022, 'Blanco',  'Manual',     5, 500.0,  false, 42000.0, 2400000, 'Sedán alemán espacioso y eficiente.',                                 'Buenos Aires', 'CABA',         '2026-01-01', false, 'f4a080dc-fc6c-45df-b813-18863f3514de'),
  ('wrv',      NULL,        'AC304DD', 'Honda',     'WR-V',     2023, 'Rojo',    'Automatico', 5, 370.0,  true,  20000.0, 2200000, 'Crossover compacto accesible y conectado.',                           'Buenos Aires', 'CABA',         '2026-01-01', false, 'f4a080dc-fc6c-45df-b813-18863f3514de'),
  ('frontier', 'pick-jua',  'AC305EE', 'Nissan',    'Frontier', 2022, 'Negro',   'Manual',     5, 1100.0, false, 50000.0, 4700000, 'Pickup robusta para el interior del país.',                           'Córdoba',      'Córdoba',      '2026-01-01', false, 'f4a080dc-fc6c-45df-b813-18863f3514de'),
  -- FRANCISCO ALT (90b7373d-…)
  ('tcross',   'flex-fra',  'AC401AA', 'Volkswagen','T-Cross',  2023, 'Gris',    'Automatico', 5, 400.0,  false, 20000.0, 2800000, 'SUV compacta moderna, lista para salir hoy.',                         'Buenos Aires', 'CABA',         '2026-01-01', true,  '90b7373d-23b0-4ee4-9f3f-14c0941a41f9'),
  ('focus',    'std-fra',   'AC402BB', 'Ford',      'Focus',    2022, 'Rojo',    'Manual',     5, 500.0,  false, 42000.0, 2600000, 'Compacto deportivo con gran manejo.',                                 'Buenos Aires', 'CABA',         '2026-01-01', false, '90b7373d-23b0-4ee4-9f3f-14c0941a41f9'),
  ('kangoo',   NULL,        'AC403CC', 'Renault',   'Kangoo',   2018, 'Blanco',  'Manual',     7, 1800.0, false, 85000.0, 2200000, 'Furgón familiar 7 pasajeros para grupos o mudanzas.',                 'Buenos Aires', 'CABA',         '2026-01-01', false, '90b7373d-23b0-4ee4-9f3f-14c0941a41f9'),
  ('kwid',     'flex-fra',  'AC404DD', 'Renault',   'Kwid',     2022, 'Naranja', 'Manual',     5, 290.0,  false, 42000.0, 1500000, 'El auto más accesible para la ciudad.',                               'Buenos Aires', 'CABA',         '2026-01-01', false, '90b7373d-23b0-4ee4-9f3f-14c0941a41f9'),
  ('toro',     'std-fra',   'AC405EE', 'Fiat',      'Toro',     2023, 'Negro',   'Automatico', 5, 1250.0, false, 24000.0, 4000000, 'Pickup mediana automática, acepta mascotas.',                          'Buenos Aires', 'CABA',         '2026-01-01', false, '90b7373d-23b0-4ee4-9f3f-14c0941a41f9')
) AS d(slug, rs_slug, plate, brand, model, year, color, transmission, passengers, trunk_liters, is_accessible, mileage, base_price_cents, description, province, city, available_from, auto_accept, owner_id)
JOIN _v v USING (slug)
LEFT JOIN _rs rs ON rs.slug = d.rs_slug;

-- ── Photos ──────────────────────────────────────────────────────────────────
-- CDN: https://res.cloudinary.com/dvq0izocr/image/upload/
-- Resuelve cada vehicle por slug usando la temp table _v.
--
-- ⚠️  Convención de orden de fotos:
-- La tabla `photos` no tiene columna de orden. El repo ordena las fotos por
-- URL ascendente (postgres.vehicle.repository.ts → VEHICLE_INCLUDE), así que
-- los archivos DEBEN nombrarse con sufijo numérico `<modelo>-1.jpg`,
-- `<modelo>-2.jpg`, `<modelo>-3.jpg` para que la foto -1 sea la portada.
-- Si subís fotos sin sufijo el orden queda librado al lex-sort del path.
INSERT INTO photos (id, "vehicleId", url)
SELECT gen_random_uuid()::text, v.id, d.url
FROM (VALUES
  ('kicks',    'https://res.cloudinary.com/dvq0izocr/image/upload/v1779299597/rocket-lease/vehicle-photos/nissan-kicks-1.jpg'),
  ('kicks',    'https://res.cloudinary.com/dvq0izocr/image/upload/v1779299600/rocket-lease/vehicle-photos/nissan-kicks-2.jpg'),
  ('kicks',    'https://res.cloudinary.com/dvq0izocr/image/upload/v1779299602/rocket-lease/vehicle-photos/nissan-kicks-3.jpg'),
  ('taos',     'https://res.cloudinary.com/dvq0izocr/image/upload/v1779299654/rocket-lease/vehicle-photos/volkswagen-taos-1.jpg'),
  ('taos',     'https://res.cloudinary.com/dvq0izocr/image/upload/v1779299656/rocket-lease/vehicle-photos/volkswagen-taos-2.jpg'),
  ('taos',     'https://res.cloudinary.com/dvq0izocr/image/upload/v1779299658/rocket-lease/vehicle-photos/volkswagen-taos-3.jpg'),
  ('pulse',    'https://res.cloudinary.com/dvq0izocr/image/upload/v1779299560/rocket-lease/vehicle-photos/fiat-pulse-1.jpg'),
  ('pulse',    'https://res.cloudinary.com/dvq0izocr/image/upload/v1779299562/rocket-lease/vehicle-photos/fiat-pulse-2.jpg'),
  ('pulse',    'https://res.cloudinary.com/dvq0izocr/image/upload/v1779299564/rocket-lease/vehicle-photos/fiat-pulse-3.jpg'),
  ('sw4',      'https://res.cloudinary.com/dvq0izocr/image/upload/v1779299630/rocket-lease/vehicle-photos/toyota-sw4-1.jpg'),
  ('sw4',      'https://res.cloudinary.com/dvq0izocr/image/upload/v1779299633/rocket-lease/vehicle-photos/toyota-sw4-2.jpg'),
  ('sw4',      'https://res.cloudinary.com/dvq0izocr/image/upload/v1779299635/rocket-lease/vehicle-photos/toyota-sw4-3.jpg'),
  ('bmw',      'https://res.cloudinary.com/dvq0izocr/image/upload/v1779299545/rocket-lease/vehicle-photos/bmw-x3-1.jpg'),
  ('bmw',      'https://res.cloudinary.com/dvq0izocr/image/upload/v1779299547/rocket-lease/vehicle-photos/bmw-x3-2.jpg'),
  ('bmw',      'https://res.cloudinary.com/dvq0izocr/image/upload/v1779299548/rocket-lease/vehicle-photos/bmw-x3-3.jpg'),
  ('yaris',    'https://res.cloudinary.com/dvq0izocr/image/upload/v1779299638/rocket-lease/vehicle-photos/toyota-yaris-1.jpg'),
  ('yaris',    'https://res.cloudinary.com/dvq0izocr/image/upload/v1779299641/rocket-lease/vehicle-photos/toyota-yaris-2.jpg'),
  ('yaris',    'https://res.cloudinary.com/dvq0izocr/image/upload/v1779299644/rocket-lease/vehicle-photos/toyota-yaris-3.jpg'),
  ('golf',     'https://res.cloudinary.com/dvq0izocr/image/upload/v1779299647/rocket-lease/vehicle-photos/volkswagen-golf-1.jpg'),
  ('golf',     'https://res.cloudinary.com/dvq0izocr/image/upload/v1779299650/rocket-lease/vehicle-photos/volkswagen-golf-2.jpg'),
  ('golf',     'https://res.cloudinary.com/dvq0izocr/image/upload/v1779299652/rocket-lease/vehicle-photos/volkswagen-golf-3.jpg'),
  ('tracker',  'https://res.cloudinary.com/dvq0izocr/image/upload/v1779299552/rocket-lease/vehicle-photos/chevrolet-tracker-1.jpg'),
  ('tracker',  'https://res.cloudinary.com/dvq0izocr/image/upload/v1779299554/rocket-lease/vehicle-photos/chevrolet-tracker-2.jpg'),
  ('tracker',  'https://res.cloudinary.com/dvq0izocr/image/upload/v1779299557/rocket-lease/vehicle-photos/chevrolet-tracker-3.jpg'),
  ('duster',   'https://res.cloudinary.com/dvq0izocr/image/upload/v1779299607/rocket-lease/vehicle-photos/renault-duster-1.jpg'),
  ('duster',   'https://res.cloudinary.com/dvq0izocr/image/upload/v1779299609/rocket-lease/vehicle-photos/renault-duster-2.jpg'),
  ('duster',   'https://res.cloudinary.com/dvq0izocr/image/upload/v1779299612/rocket-lease/vehicle-photos/renault-duster-3.jpg'),
  ('renegade', 'https://res.cloudinary.com/dvq0izocr/image/upload/v1779299590/rocket-lease/vehicle-photos/jeep-renegade-1.jpg'),
  ('renegade', 'https://res.cloudinary.com/dvq0izocr/image/upload/v1779299593/rocket-lease/vehicle-photos/jeep-renegade-2.jpg'),
  ('renegade', 'https://res.cloudinary.com/dvq0izocr/image/upload/v1779299595/rocket-lease/vehicle-photos/jeep-renegade-3.jpg'),
  ('s10',      'https://res.cloudinary.com/dvq0izocr/image/upload/v1779299665/rocket-lease/vehicle-photos/chevrolet-s10-1.png'),
  ('s10',      'https://res.cloudinary.com/dvq0izocr/image/upload/v1779299668/rocket-lease/vehicle-photos/chevrolet-s10-2.png'),
  ('s10',      'https://res.cloudinary.com/dvq0izocr/image/upload/v1779299672/rocket-lease/vehicle-photos/chevrolet-s10-3.png'),
  ('maverick', 'https://res.cloudinary.com/dvq0izocr/image/upload/v1779299675/rocket-lease/vehicle-photos/ford-maverick-1.png'),
  ('maverick', 'https://res.cloudinary.com/dvq0izocr/image/upload/v1779299678/rocket-lease/vehicle-photos/ford-maverick-2.png'),
  ('maverick', 'https://res.cloudinary.com/dvq0izocr/image/upload/v1779299681/rocket-lease/vehicle-photos/ford-maverick-3.png'),
  ('vento',    'https://res.cloudinary.com/dvq0izocr/image/upload/v1779299711/rocket-lease/vehicle-photos/volkswagen-vento-1.png'),
  ('vento',    'https://res.cloudinary.com/dvq0izocr/image/upload/v1779299714/rocket-lease/vehicle-photos/volkswagen-vento-2.png'),
  ('vento',    'https://res.cloudinary.com/dvq0izocr/image/upload/v1779299718/rocket-lease/vehicle-photos/volkswagen-vento-3.png'),
  ('wrv',      'https://res.cloudinary.com/dvq0izocr/image/upload/v1779299687/rocket-lease/vehicle-photos/honda-wrv-1.png'),
  ('wrv',      'https://res.cloudinary.com/dvq0izocr/image/upload/v1779299690/rocket-lease/vehicle-photos/honda-wrv-2.png'),
  ('wrv',      'https://res.cloudinary.com/dvq0izocr/image/upload/v1779299694/rocket-lease/vehicle-photos/honda-wrv-3.png'),
  ('frontier', 'https://res.cloudinary.com/dvq0izocr/image/upload/v1779299702/rocket-lease/vehicle-photos/nissan-frontier-1.png'),
  ('frontier', 'https://res.cloudinary.com/dvq0izocr/image/upload/v1779299705/rocket-lease/vehicle-photos/nissan-frontier-2.png'),
  ('frontier', 'https://res.cloudinary.com/dvq0izocr/image/upload/v1779299709/rocket-lease/vehicle-photos/nissan-frontier-3.png'),
  ('tcross',   'https://res.cloudinary.com/dvq0izocr/image/upload/v1779299660/rocket-lease/vehicle-photos/volkswagen-tcross-1.jpg'),
  ('focus',    'https://res.cloudinary.com/dvq0izocr/image/upload/v1779299575/rocket-lease/vehicle-photos/ford-focus-1.png'),
  ('focus',    'https://res.cloudinary.com/dvq0izocr/image/upload/v1779299580/rocket-lease/vehicle-photos/ford-focus-2.png'),
  ('focus',    'https://res.cloudinary.com/dvq0izocr/image/upload/v1779299583/rocket-lease/vehicle-photos/ford-focus-3.png'),
  ('kangoo',   'https://res.cloudinary.com/dvq0izocr/image/upload/v1779299614/rocket-lease/vehicle-photos/renault-kangoo-1.jpg'),
  ('kangoo',   'https://res.cloudinary.com/dvq0izocr/image/upload/v1779299616/rocket-lease/vehicle-photos/renault-kangoo-2.jpg'),
  ('kangoo',   'https://res.cloudinary.com/dvq0izocr/image/upload/v1779299619/rocket-lease/vehicle-photos/renault-kangoo-3.jpg'),
  ('kwid',     'https://res.cloudinary.com/dvq0izocr/image/upload/v1779299621/rocket-lease/vehicle-photos/renault-kwid-1.jpg'),
  ('kwid',     'https://res.cloudinary.com/dvq0izocr/image/upload/v1779299624/rocket-lease/vehicle-photos/renault-kwid-2.jpg'),
  ('kwid',     'https://res.cloudinary.com/dvq0izocr/image/upload/v1779299628/rocket-lease/vehicle-photos/renault-kwid-3.jpg'),
  ('toro',     'https://res.cloudinary.com/dvq0izocr/image/upload/v1779299567/rocket-lease/vehicle-photos/fiat-toro-1.jpg'),
  ('toro',     'https://res.cloudinary.com/dvq0izocr/image/upload/v1779299570/rocket-lease/vehicle-photos/fiat-toro-2.jpg'),
  ('toro',     'https://res.cloudinary.com/dvq0izocr/image/upload/v1779299572/rocket-lease/vehicle-photos/fiat-toro-3.jpg')
) AS d(slug, url)
JOIN _v v USING (slug);

-- ── Characteristics ─────────────────────────────────────────────────────────
INSERT INTO vehicle_characteristics (id, vehicle_id, characteristic)
SELECT gen_random_uuid()::text, v.id, d.characteristic::"Characteristic"
FROM (VALUES
  ('kicks', 'GPS'), ('kicks', 'BLUETOOTH'), ('kicks', 'USB_CHARGER'),
  ('taos', 'GPS'), ('taos', 'BLUETOOTH'), ('taos', 'SUNROOF'), ('taos', 'USB_CHARGER'),
  ('pulse', 'GPS'), ('pulse', 'BLUETOOTH'), ('pulse', 'USB_CHARGER'),
  ('sw4', 'GPS'), ('sw4', 'BLUETOOTH'), ('sw4', 'SUNROOF'), ('sw4', 'USB_CHARGER'), ('sw4', 'PET_FRIENDLY'),
  ('bmw', 'GPS'), ('bmw', 'BLUETOOTH'), ('bmw', 'SUNROOF'), ('bmw', 'USB_CHARGER'),
  ('yaris', 'BLUETOOTH'), ('yaris', 'USB_CHARGER'),
  ('golf', 'GPS'), ('golf', 'BLUETOOTH'), ('golf', 'USB_CHARGER'),
  ('tracker', 'GPS'), ('tracker', 'BLUETOOTH'), ('tracker', 'USB_CHARGER'), ('tracker', 'BABY_SEAT'),
  ('duster', 'GPS'), ('duster', 'BLUETOOTH'), ('duster', 'USB_CHARGER'),
  ('renegade', 'GPS'), ('renegade', 'BLUETOOTH'), ('renegade', 'USB_CHARGER'), ('renegade', 'PET_FRIENDLY'),
  ('s10', 'GPS'), ('s10', 'BLUETOOTH'), ('s10', 'USB_CHARGER'), ('s10', 'AUX_CABLE'), ('s10', 'PET_FRIENDLY'),
  ('maverick', 'GPS'), ('maverick', 'BLUETOOTH'), ('maverick', 'USB_CHARGER'),
  ('vento', 'GPS'), ('vento', 'BLUETOOTH'), ('vento', 'USB_CHARGER'),
  ('wrv', 'BLUETOOTH'), ('wrv', 'USB_CHARGER'),
  ('frontier', 'GPS'), ('frontier', 'BLUETOOTH'), ('frontier', 'USB_CHARGER'), ('frontier', 'AUX_CABLE'),
  ('tcross', 'GPS'), ('tcross', 'BLUETOOTH'), ('tcross', 'USB_CHARGER'),
  ('focus', 'GPS'), ('focus', 'BLUETOOTH'), ('focus', 'USB_CHARGER'),
  ('kangoo', 'BLUETOOTH'),
  ('kwid', 'BLUETOOTH'), ('kwid', 'USB_CHARGER'),
  ('toro', 'GPS'), ('toro', 'BLUETOOTH'), ('toro', 'USB_CHARGER'), ('toro', 'AUX_CABLE'), ('toro', 'PET_FRIENDLY')
) AS d(slug, characteristic)
JOIN _v v USING (slug);

COMMIT;

-- ── Verificación ────────────────────────────────────────────────────────────
SELECT brand, model, city, base_price_cents/100 AS price_ars, auto_accept,
       (SELECT COUNT(*) FROM photos p WHERE p."vehicleId" = v.id)            AS photos,
       (SELECT COUNT(*) FROM vehicle_characteristics vc WHERE vc.vehicle_id = v.id) AS chars
FROM vehicles v
WHERE v.plate LIKE 'AC%'
ORDER BY v."ownerId", base_price_cents;
