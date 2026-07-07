-- Insert sample data (dev only)
INSERT INTO users (name, password_hash, data)
VALUES ('default', crypt('password', gen_salt('bf')), '{}'::jsonb);

INSERT INTO chats (author, name, invite_code, discoverable, data)
VALUES ('default', 'chat1', 'DEVCODE1', true, '{}'::jsonb);

INSERT INTO chat_members (chat_id, user_name, role)
SELECT id, 'default', 'admin' FROM chats WHERE name = 'chat1';
