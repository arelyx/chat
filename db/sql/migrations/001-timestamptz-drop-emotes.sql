-- 2026-07-07: applied to existing DBs when this schema shipped (fresh installs get it from schema.sql)
ALTER TABLE messages ALTER COLUMN timestamp TYPE TIMESTAMPTZ USING timestamp AT TIME ZONE 'UTC';
ALTER TABLE chats ALTER COLUMN date_created TYPE TIMESTAMPTZ USING date_created AT TIME ZONE 'UTC';
ALTER TABLE chat_members ALTER COLUMN date_joined TYPE TIMESTAMPTZ USING date_joined AT TIME ZONE 'UTC';
DROP TABLE IF EXISTS emotes;
