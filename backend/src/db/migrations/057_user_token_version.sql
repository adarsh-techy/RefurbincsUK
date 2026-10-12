-- Migration: 057_user_token_version.sql
-- Logins are JWTs that stay valid for days. token_version is signed into
-- every token and checked on each request, so bumping it signs the user out
-- everywhere. A trigger bumps it whenever the password, role, permissions or
-- active flag change — whichever code path makes the change.

ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION users_bump_token_version() RETURNS trigger AS $$
BEGIN
  IF NEW.password_hash IS DISTINCT FROM OLD.password_hash
     OR NEW.role IS DISTINCT FROM OLD.role
     OR NEW.permissions IS DISTINCT FROM OLD.permissions
     OR NEW.active IS DISTINCT FROM OLD.active THEN
    NEW.token_version := OLD.token_version + 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_token_version ON users;
CREATE TRIGGER users_token_version
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION users_bump_token_version();
