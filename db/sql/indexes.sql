CREATE INDEX idx_messages_chat_time ON messages (chat_id, timestamp DESC);
CREATE INDEX idx_chat_members_user ON chat_members (user_name);
