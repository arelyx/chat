require("dotenv").config();
const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const http = require("http");
const {Pool} = require("pg");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const ws = require("./ws");

if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required');
}
if (!process.env.POSTGRES_DB || !process.env.POSTGRES_USER || !process.env.POSTGRES_PASSWORD) {
    throw new Error('Database environment variables (POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD) are required');
}

const pool = new Pool({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: process.env.POSTGRES_PORT || 5432,
    database: process.env.POSTGRES_DB,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
})

const app = express();
const api = express.Router();

app.use(cors());
app.use(express.json());
app.use("/api", api);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const validateRegistration = (req, res, next) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({"error": "Username and password are required"});
    }

    if (typeof username !== 'string' || typeof password !== 'string') {
        return res.status(400).json({"error": "Username and password must be strings"});
    }

    if (username.length < 3 || username.length > 50) {
        return res.status(400).json({"error": "Username must be between 3 and 50 characters"});
    }

    if (password.length < 6) {
        return res.status(400).json({"error": "Password must be at least 6 characters long"});
    }

    // Basic username format validation (alphanumeric and underscores only)
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        return res.status(400).json({"error": "Username can only contain letters, numbers, and underscores"});
    }

    next();
};

const validateLogin = (req, res, next) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({"error": "Username and password are required"});
    }

    if (typeof username !== 'string' || typeof password !== 'string') {
        return res.status(400).json({"error": "Username and password must be strings"});
    }

    next();
};

const authenticate = (req, res, next) => {
    if (!req.headers.authorization) {
        return res.status(401).json({"error": "Authorization header required"});
    }

    try {
        const token = req.headers.authorization.split(" ")[1];
        if (!token) {
            return res.status(401).json({"error": "Token required"});
        }

        const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
        req.username = decodedToken.username;
        next();
    }
    catch (error) {
        console.log(`Unable to authenticate... ${error}`);
        return res.status(401).json({"error": "Unauthorized"});
    }
}

const validateChatId = (req, res, next) => {
    if (!UUID_RE.test(req.params.chatId)) {
        return res.status(400).json({"error": "Valid chat ID is required"});
    }
    next();
};

// role of user in chat: 'admin', 'member', or null
const getRole = async (chatId, username) => {
    const result = await pool.query(
        "SELECT role FROM chat_members WHERE chat_id = $1 AND user_name = $2",
        [chatId, username]
    );
    return result.rows.length > 0 ? result.rows[0].role : null;
};

const requireAdmin = async (req, res, next) => {
    try {
        const role = await getRole(req.params.chatId, req.username);
        if (role !== 'admin') {
            return res.status(403).json({"error": "Admin access required"});
        }
        next();
    } catch (error) {
        console.log(`Unable to check role... ${error}`);
        res.status(500).json({"error": "Error checking permissions"});
    }
};

const newInviteCode = () => crypto.randomBytes(6).toString("base64url");

api.get("/", (req, res) => {
    res.send("Hello world!");
})

api.get("/user", authenticate, async (req, res) => {
    try {
        const result = await pool.query("SELECT id, name FROM users WHERE name = $1", [req.username]);

        if (result.rows.length === 0) {
            return res.status(404).json({"error": "User not found"});
        }

        res.status(200).json({
            id: result.rows[0].id,
            name: result.rows[0].name
        });
    } catch (error) {
        console.log(`Unable to get user... ${error}`);
        res.status(500).json({"error": "Error getting user"});
    }
})

api.post("/register", validateRegistration, async (req, res) => {
    const username = req.body.username;
    const password = req.body.password;

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await pool.query(
            "INSERT INTO users (name, password_hash) VALUES ($1, $2) RETURNING id, name",
            [username, hashedPassword]
        );

        const token = jwt.sign({username: username}, process.env.JWT_SECRET, {expiresIn: "6h"});
        res.status(201).json({
            "message": "User registered successfully",
            "token": token,
            "user": {
                id: result.rows[0].id,
                name: result.rows[0].name
            }
        });
    } catch (error) {
        console.log(`Unable to register user... ${error}`);
        if (error.message.includes("duplicate") || error.code === '23505') {
            return res.status(409).json({"error": "Username not available"});
        }
        res.status(500).json({"error": "Error registering user"});
    }
})

api.post("/login", validateLogin, async (req, res) => {
    const username = req.body.username;
    const password = req.body.password;

    try {
        const result = await pool.query("SELECT id, name, password_hash FROM users WHERE name = $1", [username]);

        if (result.rows.length === 0) {
            return res.status(401).json({"error": "Invalid username or password"});
        }

        const user = result.rows[0];
        const isValidPassword = await bcrypt.compare(password, user.password_hash);

        if (isValidPassword) {
            const token = jwt.sign({username: username}, process.env.JWT_SECRET, {expiresIn: "6h"});
            res.status(200).json({
                "message": "User logged in successfully",
                "token": token,
                "user": {
                    id: user.id,
                    name: user.name
                }
            });
        } else {
            res.status(401).json({"error": "Invalid username or password"});
        }
    } catch (error) {
        console.log(`Unable to login user... ${error}`);
        res.status(500).json({"error": "Error logging in"});
    }
})

// chats the user is a member of
api.get("/chats", authenticate, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT c.id, c.name, c.author, c.discoverable, c.date_created, m.role
             FROM chats c JOIN chat_members m ON m.chat_id = c.id
             WHERE m.user_name = $1
             ORDER BY c.date_created DESC`,
            [req.username]
        );
        res.status(200).json(result.rows);
    } catch (error) {
        console.log(`Unable to get chats... ${error}`);
        res.status(500).json({"error": "Error getting chats"});
    }
})

// publicly discoverable chats (for the join panel)
api.get("/chats/discoverable", authenticate, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT c.id, c.name, c.author, c.date_created,
                    (m.user_name IS NOT NULL) AS joined
             FROM chats c
             LEFT JOIN chat_members m ON m.chat_id = c.id AND m.user_name = $1
             WHERE c.discoverable = true
             ORDER BY c.date_created DESC`,
            [req.username]
        );
        res.status(200).json(result.rows);
    } catch (error) {
        console.log(`Unable to get discoverable chats... ${error}`);
        res.status(500).json({"error": "Error getting chats"});
    }
})

const validateChatCreation = (req, res, next) => {
    const { name } = req.body;

    if (!name) {
        return res.status(400).json({"error": "Chat name is required"});
    }

    if (typeof name !== 'string') {
        return res.status(400).json({"error": "Chat name must be a string"});
    }

    if (name.length < 1 || name.length > 100) {
        return res.status(400).json({"error": "Chat name must be between 1 and 100 characters"});
    }

    next();
};

api.post("/chats", authenticate, validateChatCreation, async (req, res) => {
    const chatName = req.body.name;
    const chatAuthor = req.username;
    const discoverable = req.body.discoverable !== false;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await client.query(
            "INSERT INTO chats (author, name, invite_code, discoverable) VALUES ($1, $2, $3, $4) RETURNING id, name, author, invite_code, discoverable, date_created",
            [chatAuthor, chatName, newInviteCode(), discoverable]
        );
        await client.query(
            "INSERT INTO chat_members (chat_id, user_name, role) VALUES ($1, $2, 'admin')",
            [result.rows[0].id, chatAuthor]
        );
        await client.query('COMMIT');

        res.status(201).json({
            "message": "Chat created successfully",
            "chat": result.rows[0]
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.log(`Unable to create chat... ${error}`);
        res.status(500).json({"error": "Error creating chat"});
    } finally {
        client.release();
    }
})

// chat details: members, requester's role, invite code for admins
api.get("/chats/:chatId", authenticate, validateChatId, async (req, res) => {
    const chatId = req.params.chatId;

    try {
        const result = await pool.query(
            "SELECT id, name, author, invite_code, discoverable, date_created FROM chats WHERE id = $1",
            [chatId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({"error": "Chat not found"});
        }

        const chat = result.rows[0];
        const role = await getRole(chatId, req.username);

        if (!role && !chat.discoverable) {
            return res.status(403).json({"error": "Not a member of this chat"});
        }

        const members = await pool.query(
            "SELECT user_name, role FROM chat_members WHERE chat_id = $1 ORDER BY date_joined ASC",
            [chatId]
        );

        res.status(200).json({
            id: chat.id,
            name: chat.name,
            author: chat.author,
            discoverable: chat.discoverable,
            date_created: chat.date_created,
            role: role,
            invite_code: role === 'admin' ? chat.invite_code : undefined,
            members: members.rows
        });
    } catch (error) {
        console.log(`Unable to get chat... ${error}`);
        res.status(500).json({"error": "Error getting chat"});
    }
})

// admin: toggle discoverability
api.patch("/chats/:chatId", authenticate, validateChatId, requireAdmin, async (req, res) => {
    const { discoverable } = req.body;

    if (typeof discoverable !== 'boolean') {
        return res.status(400).json({"error": "discoverable must be a boolean"});
    }

    try {
        await pool.query("UPDATE chats SET discoverable = $1 WHERE id = $2", [discoverable, req.params.chatId]);
        res.status(200).json({"message": "Chat updated successfully"});
    } catch (error) {
        console.log(`Unable to update chat... ${error}`);
        res.status(500).json({"error": "Error updating chat"});
    }
})

api.delete("/chats/:chatId", authenticate, validateChatId, requireAdmin, async (req, res) => {
    try {
        await ws.broadcastToChat(req.params.chatId, { type: "chat:deleted", chatId: req.params.chatId });
        await pool.query("DELETE FROM chats WHERE id = $1", [req.params.chatId]);
        res.status(200).json({"message": "Chat deleted successfully"});
    } catch (error) {
        console.log(`Unable to delete chat... ${error}`);
        res.status(500).json({"error": "Error deleting chat"});
    }
})

// join a chat by invite code
api.post("/chats/join", authenticate, async (req, res) => {
    const { invite_code } = req.body;

    if (!invite_code || typeof invite_code !== 'string') {
        return res.status(400).json({"error": "Invite code is required"});
    }

    try {
        const result = await pool.query("SELECT id, name FROM chats WHERE invite_code = $1", [invite_code.trim()]);

        if (result.rows.length === 0) {
            return res.status(404).json({"error": "Invalid invite code"});
        }

        const chat = result.rows[0];
        await pool.query(
            "INSERT INTO chat_members (chat_id, user_name) VALUES ($1, $2) ON CONFLICT DO NOTHING",
            [chat.id, req.username]
        );

        ws.broadcastToChat(chat.id, { type: "chat:members", chatId: chat.id });

        res.status(200).json({"message": "Joined chat successfully", "chat": {id: chat.id, name: chat.name}});
    } catch (error) {
        console.log(`Unable to join chat... ${error}`);
        res.status(500).json({"error": "Error joining chat"});
    }
})

// join a discoverable chat from the public list
api.post("/chats/:chatId/join", authenticate, validateChatId, async (req, res) => {
    const chatId = req.params.chatId;

    try {
        const result = await pool.query("SELECT id, name, discoverable FROM chats WHERE id = $1", [chatId]);

        if (result.rows.length === 0) {
            return res.status(404).json({"error": "Chat not found"});
        }

        if (!result.rows[0].discoverable) {
            return res.status(403).json({"error": "Chat is invite-only"});
        }

        await pool.query(
            "INSERT INTO chat_members (chat_id, user_name) VALUES ($1, $2) ON CONFLICT DO NOTHING",
            [chatId, req.username]
        );

        ws.broadcastToChat(chatId, { type: "chat:members", chatId });

        res.status(200).json({"message": "Joined chat successfully"});
    } catch (error) {
        console.log(`Unable to join chat... ${error}`);
        res.status(500).json({"error": "Error joining chat"});
    }
})

api.post("/chats/:chatId/leave", authenticate, validateChatId, async (req, res) => {
    try {
        const result = await pool.query(
            "DELETE FROM chat_members WHERE chat_id = $1 AND user_name = $2 RETURNING user_name",
            [req.params.chatId, req.username]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({"error": "Not a member of this chat"});
        }

        ws.broadcastToChat(req.params.chatId, { type: "chat:members", chatId: req.params.chatId });

        res.status(200).json({"message": "Left chat successfully"});
    } catch (error) {
        console.log(`Unable to leave chat... ${error}`);
        res.status(500).json({"error": "Error leaving chat"});
    }
})

// admin: add a user to the chat
api.post("/chats/:chatId/members", authenticate, validateChatId, requireAdmin, async (req, res) => {
    const { username } = req.body;

    if (!username || typeof username !== 'string') {
        return res.status(400).json({"error": "Username is required"});
    }

    try {
        const userResult = await pool.query("SELECT name FROM users WHERE name = $1", [username]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({"error": "User not found"});
        }

        await pool.query(
            "INSERT INTO chat_members (chat_id, user_name) VALUES ($1, $2) ON CONFLICT DO NOTHING",
            [req.params.chatId, username]
        );

        ws.broadcastToChat(req.params.chatId, { type: "chat:members", chatId: req.params.chatId });
        ws.broadcastToUser(username, { type: "chat:joined", chatId: req.params.chatId });

        res.status(200).json({"message": "User added to chat"});
    } catch (error) {
        console.log(`Unable to add member... ${error}`);
        res.status(500).json({"error": "Error adding member"});
    }
})

// admin: remove a user from the chat (admins cannot be removed)
api.delete("/chats/:chatId/members/:username", authenticate, validateChatId, requireAdmin, async (req, res) => {
    try {
        const result = await pool.query(
            "DELETE FROM chat_members WHERE chat_id = $1 AND user_name = $2 AND role != 'admin' RETURNING user_name",
            [req.params.chatId, req.params.username]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({"error": "Member not found (admins cannot be removed)"});
        }

        ws.broadcastToChat(req.params.chatId, { type: "chat:members", chatId: req.params.chatId });
        ws.broadcastToUser(req.params.username, { type: "kicked", chatId: req.params.chatId });

        res.status(200).json({"message": "User removed from chat"});
    } catch (error) {
        console.log(`Unable to remove member... ${error}`);
        res.status(500).json({"error": "Error removing member"});
    }
})

// Get all users
api.get("/users", async (req, res) => {
    try {
        const result = await pool.query("SELECT name FROM users ORDER BY name ASC");
        res.status(200).json(result.rows);
    } catch (error) {
        console.log(`Unable to get users... ${error}`);
        res.status(500).json({"error": "Error getting users"});
    }
});

// readable by members, or by anyone logged in if the chat is discoverable
api.get("/chats/:chatId/messages", authenticate, validateChatId, async (req, res) => {
    const chatId = req.params.chatId;

    try {
        const chatResult = await pool.query("SELECT discoverable FROM chats WHERE id = $1", [chatId]);
        if (chatResult.rows.length === 0) {
            return res.status(404).json({"error": "Chat not found"});
        }

        const role = await getRole(chatId, req.username);
        if (!role && !chatResult.rows[0].discoverable) {
            return res.status(403).json({"error": "Not a member of this chat"});
        }

        const result = await pool.query(
            "SELECT id, chat_id, sender_name, message, timestamp FROM messages WHERE chat_id = $1 ORDER BY timestamp ASC",
            [chatId]
        );
        res.status(200).json(result.rows);
    } catch (error) {
        console.log(`Unable to get messages... ${error}`);
        res.status(500).json({"error": "Error getting messages"});
    }
});

const validateMessage = (req, res, next) => {
    const { message } = req.body;

    if (!message) {
        return res.status(400).json({"error": "Message content is required"});
    }

    if (typeof message !== 'string') {
        return res.status(400).json({"error": "Message must be a string"});
    }

    if (message.trim().length === 0) {
        return res.status(400).json({"error": "Message cannot be empty"});
    }

    if (message.length > 1000) {
        return res.status(400).json({"error": "Message too long (max 1000 characters)"});
    }

    next();
};

// members only
api.post("/chats/:chatId/messages", authenticate, validateChatId, validateMessage, async (req, res) => {
    const chatId = req.params.chatId;
    const messageContent = req.body.message.trim();
    const senderName = req.username;

    try {
        const role = await getRole(chatId, senderName);
        if (!role) {
            return res.status(403).json({"error": "Join the chat to send messages"});
        }

        const result = await pool.query(
            "INSERT INTO messages (sender_name, chat_id, message) VALUES ($1, $2, $3) RETURNING id, sender_name, message, timestamp",
            [senderName, chatId, messageContent]
        );

        ws.broadcastToChat(chatId, { type: "message:new", chatId, message: {...result.rows[0], chat_id: chatId} });

        res.status(201).json({
            "message": "Message sent successfully",
            "data": result.rows[0]
        });
    } catch (error) {
        console.log(`Unable to send message... ${error}`);
        res.status(500).json({"error": "Error sending message"});
    }
});

// admin: delete a message
api.delete("/chats/:chatId/messages/:messageId", authenticate, validateChatId, requireAdmin, async (req, res) => {
    if (!UUID_RE.test(req.params.messageId)) {
        return res.status(400).json({"error": "Valid message ID is required"});
    }

    try {
        const result = await pool.query(
            "DELETE FROM messages WHERE id = $1 AND chat_id = $2 RETURNING id",
            [req.params.messageId, req.params.chatId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({"error": "Message not found"});
        }

        ws.broadcastToChat(req.params.chatId, { type: "message:deleted", chatId: req.params.chatId, messageId: req.params.messageId });

        res.status(200).json({"message": "Message deleted successfully"});
    } catch (error) {
        console.log(`Unable to delete message... ${error}`);
        res.status(500).json({"error": "Error deleting message"});
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({"error": "Internal server error"});
});

// 404 handler for undefined routes
app.use((req, res) => {
    res.status(404).json({"error": "Route not found"});
});

const PORT = process.env.PORT || 3000;

const server = http.createServer(app);
ws.init(server, pool);

server.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
})
