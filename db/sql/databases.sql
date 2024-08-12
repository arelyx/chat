CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE DATABASE IF NOT EXISTS chat_db;

-- Use the newly created database
\connect chat_db

CREATE EXTENSION IF NOT EXISTS pgcrypto;