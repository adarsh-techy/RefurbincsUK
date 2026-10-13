-- Migration: 058_client_parts.sql
-- Parts inventory is kept per fleet client: every part's stock belongs to one
-- client, repairs on that client's batteries may only use that client's parts,
-- and each part has its own minimum stock limit (set by the super admin) that
-- drives the low-stock alerts. Before this a part was shared by everyone and
-- "low" meant a fixed 5 units.

ALTER TABLE parts ADD COLUMN IF NOT EXISTS client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE parts ADD COLUMN IF NOT EXISTS min_stock INTEGER NOT NULL DEFAULT 5;
ALTER TABLE parts DROP CONSTRAINT IF EXISTS parts_min_stock_check;
ALTER TABLE parts ADD CONSTRAINT parts_min_stock_check CHECK (min_stock >= 0);

-- in_stock keeps its meaning ("not low") but now follows each part's limit
ALTER TABLE parts DROP COLUMN IF EXISTS in_stock;
ALTER TABLE parts ADD COLUMN in_stock BOOLEAN GENERATED ALWAYS AS (quantity > min_stock) STORED;

-- the same SKU can exist once per client (each client has its own stock of it)
ALTER TABLE parts DROP CONSTRAINT IF EXISTS parts_sku_key;
DROP INDEX IF EXISTS parts_client_sku_key;
CREATE UNIQUE INDEX parts_client_sku_key ON parts (client_id, sku) NULLS NOT DISTINCT WHERE sku IS NOT NULL;
CREATE INDEX IF NOT EXISTS parts_client_id_idx ON parts (client_id);

-- Existing parts: with exactly one fleet client they're clearly that
-- client's; otherwise they stay unassigned until the super admin assigns them.
UPDATE parts
   SET client_id = (
     SELECT c.id FROM clients c
       LEFT JOIN users u ON u.id = c.user_id
      WHERE COALESCE(u.role, 'client') <> 'recycle_client'
        AND NOT EXISTS (SELECT 1 FROM recycle_batches rb WHERE rb.recycle_client_id = c.id)
   )
 WHERE client_id IS NULL
   AND (
     SELECT COUNT(*) FROM clients c
       LEFT JOIN users u ON u.id = c.user_id
      WHERE COALESCE(u.role, 'client') <> 'recycle_client'
        AND NOT EXISTS (SELECT 1 FROM recycle_batches rb WHERE rb.recycle_client_id = c.id)
   ) = 1;
