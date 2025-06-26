require("dotenv").config();
const express = require("express");
const cors = require("cors");
const {Pool} = require("pg");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

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

app.use(cors());
app.use(express.json());

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
    console.log("Authenticating...");
    console.log(req.headers.authorization);
    
    // Check if authorization header exists
    if (!req.headers.authorization) {
        return res.status(401).json({"error": "Authorization header required"});
    }
    
    try{
        const token = req.headers.authorization.split(" ")[1];
        if (!token) {
            return res.status(401).json({"error": "Token required"});
        }
        
        const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
        if (!decodedToken){
            return res.status(401).json({"error": "Unauthorized"});
        }
        req.username = decodedToken.username;
        next();
    }
    catch (error) {
        console.log(`Unable to authenticate... ${error}`);
        return res.status(401).json({"error": "Unauthorized"});
    }
}

app.get("/", (req, res) => {
    res.send("Hello world!");
})

app.get("/user", authenticate, async (req, res) => {
    try {
        const result = await pool.query("SELECT id, name FROM users WHERE name = $1", [req.username]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({"error": "User not found"});
        }
        
        console.log("UserRequest results: "+ JSON.stringify(result.rows));
        res.status(200).json({
            id: result.rows[0].id,
            name: result.rows[0].name
        });
    } catch (error) {
        console.log(`Unable to get user... ${error}`);
        res.status(500).json({"error": "Error getting user"});
    }
})

app.post("/register", validateRegistration, async (req, res) => {
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

app.post("/login", validateLogin, async (req, res) => {
    const username = req.body.username;
    const password = req.body.password;
    
    try {
        console.log("Logging in user...");
        const result = await pool.query("SELECT id, name, password_hash FROM users WHERE name = $1", [username]);
        
        if (result.rows.length === 0) {
            return res.status(401).json({"error": "Invalid username or password"});
        }
        
        const user = result.rows[0];
        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        
        if (isValidPassword) {
            const token = jwt.sign({username: username}, process.env.JWT_SECRET, {expiresIn: "6h"});
            console.log("User logged in successfully!");
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

app.get("/chats", async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT id, name, author, date_created FROM chats ORDER BY date_created DESC"
        );
        
        console.log("ChatRequest results: "+ JSON.stringify(result.rows));
        res.status(200).json(result.rows);
    } catch (error) {
        console.log(`Unable to get chats... ${error}`);
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

app.post("/chats", authenticate, validateChatCreation, async (req, res) => {
    const chatName = req.body.name;
    const chatAuthor = req.username;
    
    try {
        const result = await pool.query(
            "INSERT INTO chats (author, name) VALUES ($1, $2) RETURNING id, name, author, date_created",
            [chatAuthor, chatName]
        );
        
        res.status(201).json({
            "message": "Chat created successfully",
            "chat": result.rows[0]
        });
    } catch (error) {
        console.log(`Unable to create chat... ${error}`);
        res.status(500).json({"error": "Error creating chat"});
    }
})

app.get("/chats/:chatId", async (req, res) => {
    const chatId = req.params.chatId;
    
    if (!chatId || typeof chatId !== 'string') {
        return res.status(400).json({"error": "Valid chat ID is required"});
    }
    
    try {
        const result = await pool.query(
            "SELECT id, name, author, date_created FROM chats WHERE id = $1",
            [chatId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({"error": "Chat not found"});
        }
        
        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.log(`Unable to get chat... ${error}`);
        res.status(500).json({"error": "Error getting chat"});
    }
})

app.delete("/chats/:chatId", authenticate, async (req, res) => {
    const chatId = req.params.chatId;
    
    if (!chatId || typeof chatId !== 'string') {
        return res.status(400).json({"error": "Valid chat ID is required"});
    }
    
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // First check if chat exists and user has permission to delete it
        const chatResult = await client.query(
            "SELECT author FROM chats WHERE id = $1",
            [chatId]
        );
        
        if (chatResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({"error": "Chat not found"});
        }
        
        if (chatResult.rows[0].author !== req.username) {
            await client.query('ROLLBACK');
            return res.status(403).json({"error": "Not authorized to delete this chat"});
        }
        
        // Delete messages first (due to foreign key constraint)
        await client.query("DELETE FROM messages WHERE chat_id = $1", [chatId]);
        
        // Then delete the chat
        await client.query("DELETE FROM chats WHERE id = $1", [chatId]);
        
        await client.query('COMMIT');
        res.status(200).json({"message": "Chat deleted successfully"});
    } catch (error) {
        await client.query('ROLLBACK');
        console.log(`Unable to delete chat... ${error}`);
        res.status(500).json({"error": "Error deleting chat"});
    } finally {
        client.release();
    }
})

// Get all users (public route)
app.get("/users", async (req, res) => {
    try {
        const result = await pool.query("SELECT name FROM users ORDER BY name ASC");
        res.status(200).json(result.rows);
    } catch (error) {
        console.log(`Unable to get users... ${error}`);
        res.status(500).json({"error": "Error getting users"});
    }
});

app.get("/chats/:chatId/messages", async (req, res) => {
    const chatId = req.params.chatId;
    if (!chatId || typeof chatId !== 'string') {
        return res.status(400).json({"error": "Valid chat ID is required"});
    }
    try {
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

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({"error": "Internal server error"});
});

// 404 handler for undefined routes
app.use('*', (req, res) => {
    res.status(404).json({"error": "Route not found"});
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
})