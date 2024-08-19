-- Create tables (to be changed later)
DROP TABLE IF EXISTS users;

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    data JSONB
);

CREATE TABLE chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author TEXT NOT NULL REFERENCES users(name),
    name TEXT NOT NULL,
    date_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    data JSONB
);

-- CREATE TABLE messages (
--     id INTEGER PRIMARY KEY,
--     sender_id INTEGER,
--     receiver_id INTEGER,
--     message TEXT,
--     timestamp DATETIME
-- );