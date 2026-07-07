const { WebSocketServer } = require("ws");
const jwt = require("jsonwebtoken");

// username -> Set of sockets (a user may have multiple tabs open)
const connections = new Map();
let pool = null;

const onlineUsers = () => [...connections.keys()];

const send = (socket, payload) => {
    if (socket.readyState === socket.OPEN) {
        socket.send(JSON.stringify(payload));
    }
};

const broadcastAll = (payload) => {
    for (const sockets of connections.values()) {
        for (const socket of sockets) {
            send(socket, payload);
        }
    }
};

const broadcastToUser = (username, payload) => {
    const sockets = connections.get(username);
    if (!sockets) return;
    for (const socket of sockets) {
        send(socket, payload);
    }
};

const broadcastToChat = async (chatId, payload) => {
    try {
        const result = await pool.query("SELECT user_name FROM chat_members WHERE chat_id = $1", [chatId]);
        for (const row of result.rows) {
            broadcastToUser(row.user_name, payload);
        }
    } catch (error) {
        console.log(`Unable to broadcast to chat... ${error}`);
    }
};

const addConnection = (username, socket) => {
    if (!connections.has(username)) {
        connections.set(username, new Set());
        broadcastAll({ type: "presence", username, online: true });
    }
    connections.get(username).add(socket);
};

const removeConnection = (username, socket) => {
    const sockets = connections.get(username);
    if (!sockets) return;
    sockets.delete(socket);
    if (sockets.size === 0) {
        connections.delete(username);
        broadcastAll({ type: "presence", username, online: false });
    }
};

const init = (server, dbPool) => {
    pool = dbPool;
    const wss = new WebSocketServer({ server, path: "/api/ws" });

    wss.on("connection", (socket, req) => {
        let username;
        try {
            const token = new URL(req.url, "http://localhost").searchParams.get("token");
            username = jwt.verify(token, process.env.JWT_SECRET).username;
        } catch {
            socket.close(4001, "Unauthorized");
            return;
        }

        addConnection(username, socket);
        send(socket, { type: "presence:init", online: onlineUsers() });

        socket.on("message", async (raw) => {
            let msg;
            try {
                msg = JSON.parse(raw);
            } catch {
                return;
            }

            // typing indicator: relay to chat members if sender is one
            if (msg.type === "typing" && typeof msg.chatId === "string") {
                try {
                    const result = await pool.query(
                        "SELECT 1 FROM chat_members WHERE chat_id = $1 AND user_name = $2",
                        [msg.chatId, username]
                    );
                    if (result.rows.length > 0) {
                        broadcastToChat(msg.chatId, { type: "typing", chatId: msg.chatId, username });
                    }
                } catch (error) {
                    console.log(`Unable to relay typing... ${error}`);
                }
            }
        });

        socket.on("close", () => removeConnection(username, socket));
        socket.on("error", () => removeConnection(username, socket));
    });

    // keepalive: terminate dead connections
    setInterval(() => {
        for (const socket of wss.clients) {
            if (socket.isAlive === false) {
                socket.terminate();
                continue;
            }
            socket.isAlive = false;
            socket.ping();
        }
    }, 30000);

    wss.on("connection", (socket) => {
        socket.isAlive = true;
        socket.on("pong", () => { socket.isAlive = true; });
    });
};

module.exports = { init, broadcastAll, broadcastToUser, broadcastToChat };
