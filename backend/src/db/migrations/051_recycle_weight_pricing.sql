-- Add weight (kg) and price-per-kg fields to recycle_batches
-- Allows recording total weight of recycled batteries and the rate offered by the recycling partner.

ALTER TABLE recycle_batches
  ADD COLUMN IF NOT EXISTS total_weight_kg NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS price_per_kg    NUMERIC(10, 4) DEFAULT 3.40;
