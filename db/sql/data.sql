-- Insert sample data
INSERT INTO users (name, password_hash, data)
VALUES ('default', crypt('password', gen_salt('bf')), '{}'::jsonb); 
