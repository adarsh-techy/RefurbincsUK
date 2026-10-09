-- Links a physical RFID/NFC tag (factory UID or UHF EPC, stored normalised:
-- upper-case alphanumerics only) to a battery, so a tag read resolves to a
-- battery exactly like a QR scan does. Assigned in bulk from the RFID
-- Assignment page (Excel/CSV of battery number + tag).
ALTER TABLE batteries ADD COLUMN IF NOT EXISTS rfid_tag VARCHAR(64) UNIQUE;
CREATE INDEX IF NOT EXISTS idx_batteries_rfid_tag ON batteries (rfid_tag);
