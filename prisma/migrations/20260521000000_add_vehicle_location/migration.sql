-- AlterTable: ubicación geográfica de los vehículos para el mapa de rentadoras.
-- Columnas nullable: la tabla `vehicles` ya está poblada y el alta nueva exige
-- coordenadas vía el contrato; estas columnas no bloquean filas existentes.
ALTER TABLE "vehicles"
  ADD COLUMN "address"   TEXT,
  ADD COLUMN "latitude"  DOUBLE PRECISION,
  ADD COLUMN "longitude" DOUBLE PRECISION,
  ADD COLUMN "location_approximate" BOOLEAN NOT NULL DEFAULT false;

-- Backfill aproximado: centroide de la ciudad para los vehículos existentes.
-- Se marca `location_approximate = true` para que el rentador refine el pin.
WITH city_centroids (city, lat, lng) AS (
  VALUES
    ('Buenos Aires',                -34.6037, -58.3816),
    ('Ciudad Autónoma de Buenos Aires', -34.6037, -58.3816),
    ('CABA',                        -34.6037, -58.3816),
    ('La Plata',                    -34.9215, -57.9545),
    ('Mar del Plata',               -38.0055, -57.5426),
    ('Bahía Blanca',                -38.7183, -62.2663),
    ('Córdoba',                     -31.4201, -64.1888),
    ('Rosario',                     -32.9468, -60.6393),
    ('Santa Fe',                    -31.6333, -60.7000),
    ('Mendoza',                     -32.8895, -68.8458),
    ('San Miguel de Tucumán',       -26.8083, -65.2176),
    ('Tucumán',                     -26.8083, -65.2176),
    ('Salta',                       -24.7821, -65.4232),
    ('Neuquén',                     -38.9516, -68.0591),
    ('San Carlos de Bariloche',     -41.1335, -71.3103),
    ('Bariloche',                   -41.1335, -71.3103),
    ('Posadas',                     -27.3621, -55.9008),
    ('Resistencia',                 -27.4514, -58.9868),
    ('Corrientes',                  -27.4692, -58.8306),
    ('San Salvador de Jujuy',       -24.1858, -65.2995)
)
UPDATE "vehicles" v
SET "latitude" = c.lat,
    "longitude" = c.lng,
    "location_approximate" = true
FROM city_centroids c
WHERE lower(v."city") = lower(c.city)
  AND v."latitude" IS NULL;

-- Fallback: ciudad no reconocida → centroide aproximado del país.
UPDATE "vehicles"
SET "latitude" = -38.4161,
    "longitude" = -63.6167,
    "location_approximate" = true
WHERE "latitude" IS NULL;

-- Índice para el prefiltro por bounding-box de las consultas del mapa.
CREATE INDEX "vehicles_latitude_longitude_idx" ON "vehicles"("latitude", "longitude");
