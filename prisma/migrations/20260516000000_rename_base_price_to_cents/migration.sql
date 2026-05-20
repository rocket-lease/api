-- Rename column and convert existing values from pesos to centavos (× 100)
ALTER TABLE vehicles RENAME COLUMN "basePrice" TO base_price_cents;
ALTER TABLE vehicles ALTER COLUMN base_price_cents TYPE INTEGER
  USING ROUND(base_price_cents * 100)::INTEGER;
