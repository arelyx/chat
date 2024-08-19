require("dotenv").config();
const express = require("express");
const cors = require("cors");
const {Pool} = require("pg");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: process.env.POSTGRES_DB,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
})

app = express();

app.use(cors());
app.use(express.json());

const authenticate = (req, res, next) => {
    console.log("Authenticating...");
    const decodedToken = jwt.verify(req.headers.authorization.split(" ")[1], process.env.JWT_SECRET);
    if (!decodedToken){
        res.status(401).json({"error": "Unauthorized"});
    }
    req.username = decodedToken.username;
    next();
}

app.get("/", (req, res) => {
    res.send("Hello world!");
})

app.get("/user", authenticate, (req, res, next) => {
    pool.query("SELECT * FROM users WHERE name = $1", [req.username], (error, results) => {
        if (error) {
            console.log(`Unable to get user... ${error}`);
            res.status(500).json({"error": "Error getting user"});
        }
        else {
            console.log("UserRequest results: "+ JSON.stringify(results.rows));
            res.status(200).json(results.rows[0]);
        }
    })
})

app.post("/register", (req, res) => {
    const username = req.body.username;
    const password = req.body.password;
    const hashedPassword = bcrypt.hashSync(password, 10);
    pool.query("INSERT INTO users (name, password_hash) VALUES ($1, $2)", [username, hashedPassword], (error, results) => {
        if (error) {
            console.log(`Unable to register user... ${error}`);
            if (error.message.includes("duplicate")){
                res.status(409).json({"error": "Username not available"});
            }
            else{
                res.status(500).json({"error": "Error registering user"});
            }
        }
        else {
            const token = jwt.sign({username: username}, process.env.JWT_SECRET, {expiresIn: "6h"});
            res.status(200).json({"message": "User registered", "token": token});
        }
    })
})

app.post("/login", (req, res) => {
    const username = req.body.username;
    const password = req.body.password;
    pool.query("SELECT * FROM users WHERE name = $1", [username], (error, results) => {
        if (error) {
            console.log(`Unable to login user... ${error}`);
            res.status(500).json({"error": "Error logging in"});
        }
        else {
            if (results.rows.length === 0){
                res.status(401).json({"error": "Invalid username or password"});
            }
            else {
                const user = results.rows[0];
                if (bcrypt.compareSync(password, user.password_hash)){
                    const token = jwt.sign({username: username}, process.env.JWT_SECRET, {expiresIn: "6h"});
                    res.status(200).json({"message": "User logged in", "token": token});
                }
                else {
                    res.status(401).json({"error": "Invalid username or password"});
                }
            }
        }
    })
}
)

app.listen(3000, () => {
    console.log("Server started on port 3000");
})