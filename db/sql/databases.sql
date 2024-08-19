-- Create the extension if it doesn't exist
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
\c postgres;
-- Drop database
DROP DATABASE IF EXISTS dev;

-- Create the database if it doesn't exist
CREATE DATABASE dev;

-- Connect to the newly created database
\c dev;

-- Create the extension if it doesn't exist
CREATE EXTENSION IF NOT EXISTS "pgcrypto";