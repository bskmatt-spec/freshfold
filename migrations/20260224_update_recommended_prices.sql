-- Update recommended_price for known service templates
-- Run this against your production database (use a backup or run in a transaction if unsure)

BEGIN;

-- Wash & Fold: representative $25
UPDATE services
SET recommended_price = 25
WHERE name = 'Wash & Fold' AND (recommended_price IS DISTINCT FROM 25);

-- Dry Cleaning: representative per-item average $12
UPDATE services
SET recommended_price = 12
WHERE name = 'Dry Cleaning' AND (recommended_price IS DISTINCT FROM 12);

-- Wash & Press: representative per-item $6
UPDATE services
SET recommended_price = 6
WHERE name = 'Wash & Press' AND (recommended_price IS DISTINCT FROM 6);

-- Bedding & Linens: representative $35
UPDATE services
SET recommended_price = 35
WHERE name = 'Bedding & Linens' AND (recommended_price IS DISTINCT FROM 35);

-- Express Service: representative surcharge $15
UPDATE services
SET recommended_price = 15
WHERE name = 'Express Service' AND (recommended_price IS DISTINCT FROM 15);

COMMIT;

-- To preview rows that will change, run:
-- SELECT id, name, recommended_price FROM services WHERE name IN (
--   'Wash & Fold','Dry Cleaning','Wash & Press','Bedding & Linens','Express Service'
-- );
