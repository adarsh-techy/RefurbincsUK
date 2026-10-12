-- Migration: 056_client_battery_prefix.sql
-- Battery codes are PREFIX-NNNNNNN. The prefix used to be worked out from
-- the first three letters of the client's name every time, so "Zeta A" and
-- "Zeta B" both got ZET- and shared one number sequence (and renaming a
-- client changed its prefix). Each client now stores its own prefix.
--
-- Backfill: a client keeps its name-derived prefix when it is free, or when
-- the client already owns batteries with it. A client with no batteries
-- whose derived prefix is taken gets the next free one (ZET → ZEA, ZEB…).
-- Only if two clients ALREADY own batteries under the same prefix do both
-- keep it (codes stay unique; ownership is battery.client_name) — then the
-- unique index is skipped and uniqueness is enforced by the app.

ALTER TABLE clients ADD COLUMN IF NOT EXISTS battery_prefix VARCHAR(6);

-- Letters only: a code is matched as ^[A-Z]+-?[0-9]+$, so a digit in the
-- prefix would break parsing.
ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_battery_prefix_format;
ALTER TABLE clients ADD CONSTRAINT clients_battery_prefix_format
  CHECK (battery_prefix IS NULL OR battery_prefix ~ '^[A-Z]{1,6}$');

-- Is this prefix free for the client (id = p_client_id, named p_name)?
-- Taken = another client stores it, or batteries of another client already
-- use it.
CREATE OR REPLACE FUNCTION battery_prefix_is_free(p_prefix TEXT, p_client_id INT, p_name TEXT)
RETURNS BOOLEAN AS $$
  SELECT NOT EXISTS (
           SELECT 1 FROM clients c
            WHERE c.battery_prefix = p_prefix AND c.id IS DISTINCT FROM p_client_id
         )
     AND NOT EXISTS (
           SELECT 1 FROM batteries b
            WHERE b.battery_code LIKE p_prefix || '-%'
              AND lower(trim(COALESCE(b.client_name, ''))) <> lower(trim(COALESCE(p_name, '')))
         );
$$ LANGUAGE sql STABLE;

-- First free prefix for a name: its first three letters, then the first two
-- letters + each later letter of the name, then the first two + A..Z, then
-- the first three + A..Z, then the first three + two letters.
CREATE OR REPLACE FUNCTION next_battery_prefix(p_name TEXT, p_client_id INT)
RETURNS TEXT AS $$
DECLARE
  letters TEXT := upper(regexp_replace(COALESCE(p_name, ''), '[^a-zA-Z]', '', 'g'));
  base TEXT;
  cand TEXT;
  i INT;
  j INT;
BEGIN
  IF letters = '' THEN letters := 'CLT'; END IF;
  base := left(letters, 3);
  IF battery_prefix_is_free(base, p_client_id, p_name) THEN RETURN base; END IF;
  IF length(letters) >= 2 THEN
    FOR i IN 3..length(letters) LOOP
      cand := left(letters, 2) || substr(letters, i, 1);
      IF cand <> base AND battery_prefix_is_free(cand, p_client_id, p_name) THEN RETURN cand; END IF;
    END LOOP;
    FOR i IN 65..90 LOOP
      cand := left(letters, 2) || chr(i);
      IF battery_prefix_is_free(cand, p_client_id, p_name) THEN RETURN cand; END IF;
    END LOOP;
  END IF;
  FOR i IN 65..90 LOOP
    cand := base || chr(i);
    IF battery_prefix_is_free(cand, p_client_id, p_name) THEN RETURN cand; END IF;
  END LOOP;
  FOR i IN 65..90 LOOP
    FOR j IN 65..90 LOOP
      cand := base || chr(i) || chr(j);
      IF battery_prefix_is_free(cand, p_client_id, p_name) THEN RETURN cand; END IF;
    END LOOP;
  END LOOP;
  RAISE EXCEPTION 'No free battery prefix for %', p_name;
END;
$$ LANGUAGE plpgsql;

-- Backfill, clients that already own batteries under their derived prefix
-- first, then oldest first.
DO $$
DECLARE
  r RECORD;
  derived TEXT;
BEGIN
  FOR r IN
    SELECT c.id, c.name,
           EXISTS (
             SELECT 1 FROM batteries b
              WHERE lower(trim(b.client_name)) = lower(trim(c.name))
                AND b.battery_code LIKE left(upper(regexp_replace(c.name, '[^a-zA-Z]', '', 'g')), 3) || '-%'
           ) AS owns_derived
      FROM clients c
     WHERE c.battery_prefix IS NULL
     ORDER BY 3 DESC, c.created_at, c.id
  LOOP
    derived := left(upper(regexp_replace(r.name, '[^a-zA-Z]', '', 'g')), 3);
    IF derived <> '' AND (r.owns_derived OR battery_prefix_is_free(derived, r.id, r.name)) THEN
      UPDATE clients SET battery_prefix = derived WHERE id = r.id;
    ELSE
      UPDATE clients SET battery_prefix = next_battery_prefix(r.name, r.id) WHERE id = r.id;
    END IF;
  END LOOP;
END $$;

-- Every new client gets one, whichever code path inserts it.
CREATE OR REPLACE FUNCTION clients_set_battery_prefix() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.battery_prefix IS NULL THEN
    NEW.battery_prefix := next_battery_prefix(NEW.name, NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_clients_battery_prefix ON clients;
CREATE TRIGGER trg_clients_battery_prefix
  BEFORE INSERT ON clients
  FOR EACH ROW EXECUTE FUNCTION clients_set_battery_prefix();

-- Unique at the database level unless legacy data already shares a prefix.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT battery_prefix FROM clients
     WHERE battery_prefix IS NOT NULL
     GROUP BY battery_prefix HAVING COUNT(*) > 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS clients_battery_prefix_unique ON clients (battery_prefix);
  END IF;
END $$;
