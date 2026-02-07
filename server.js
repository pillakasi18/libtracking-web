// server.js
const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const path = require("path");

const JWT_SECRET = "replace_this_with_a_long_random_secret"; // <-- change in production

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const db = new sqlite3.Database("./db.sqlite");

// promisified helpers
function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}
function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}
function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// Initialize DB
(async function initDB() {
  try {
    await dbRun("PRAGMA foreign_keys = ON;");
    await dbRun(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL
    );`);
    await dbRun(`CREATE TABLE IF NOT EXISTS statuses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      content TEXT,
      image_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );`);
    await dbRun(`CREATE TABLE IF NOT EXISTS reactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      status_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      emoji TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(status_id, user_id),
      FOREIGN KEY(status_id) REFERENCES statuses(id),
      FOREIGN KEY(user_id) REFERENCES users(id)
    );`);
    console.log("DB initialized");
  } catch (e) {
    console.error("DB init error:", e);
  }
})();

// Helper: get user id from Authorization header if present (returns id or null)
function optionalAuthUserId(req) {
  try {
    const auth = req.headers.authorization;
    if (!auth) return null;
    const token = auth.split(" ")[1];
    if (!token) return null;
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded.id;
  } catch {
    return null;
  }
}

// Middleware: require auth
function requireAuth(req, res, next) {
  try {
    const auth = req.headers.authorization;
    if (!auth) return res.status(401).json({ error: "Missing token" });
    const token = auth.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { id, username }
    return next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

/* ---------- Auth endpoints ---------- */

// Register
app.post("/api/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password)
      return res.status(400).json({ error: "Missing fields" });
    const hashed = await bcrypt.hash(password, 10);
    const result = await dbRun(
      "INSERT INTO users (username,email,password) VALUES (?, ?, ?)",
      [username, email, hashed]
    );
    return res.json({ message: "User created", userId: result.lastID });
  } catch (err) {
    if (err.message && err.message.includes("UNIQUE constraint failed"))
      return res.status(400).json({ error: "Email already exists" });
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

// Login
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "Missing fields" });
    const user = await dbGet("SELECT * FROM users WHERE email = ?", [email]);
    if (!user) return res.status(401).json({ error: "Invalid credentials" });
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, {
      expiresIn: "7d",
    });
    return res.json({ token, user: { id: user.id, username: user.username, email: user.email } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

/* ---------- Status endpoints ---------- */

// Create a status (auth required)
app.post("/api/statuses", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { content, image_url } = req.body;
    if (!content && !image_url)
      return res.status(400).json({ error: "Provide content or image_url" });
    const result = await dbRun(
      "INSERT INTO statuses (user_id, content, image_url) VALUES (?, ?, ?)",
      [userId, content || null, image_url || null]
    );
    const newStatus = await dbGet("SELECT * FROM statuses WHERE id = ?", [result.lastID]);
    return res.json({ message: "Status created", status: newStatus });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

// Get statuses (public). If Authorization provided, response will include `my_reaction` per status.
app.get("/api/statuses", async (req, res) => {
  try {
    const me = optionalAuthUserId(req); // may be null
    const statuses = await dbAll(
      `SELECT s.id, s.user_id, s.content, s.image_url, s.created_at, u.username
        FROM statuses s JOIN users u ON s.user_id = u.id
        ORDER BY s.created_at DESC
        LIMIT 50;`
    );
    const ids = statuses.map((s) => s.id);
    let counts = [];
    if (ids.length > 0) {
      const placeholders = ids.map(() => "?").join(",");
      counts = await dbAll(
        `SELECT status_id, emoji, COUNT(*) AS cnt
          FROM reactions
          WHERE status_id IN (${placeholders})
          GROUP BY status_id, emoji`,
        ids
      );
    }
    // map counts to status
    const countsByStatus = {};
    counts.forEach((r) => {
      countsByStatus[r.status_id] = countsByStatus[r.status_id] || {};
      countsByStatus[r.status_id][r.emoji] = r.cnt;
    });

    // get my reactions if logged in
    const myMap = {};
    if (me && ids.length > 0) {
      const placeholders = ids.map(() => "?").join(",");
      const params = [me].concat(ids);
      const myRows = await dbAll(
        `SELECT status_id, emoji FROM reactions WHERE user_id = ? AND status_id IN (${placeholders})`,
        params
      );
      myRows.forEach((r) => (myMap[r.status_id] = r.emoji));
    }

    // prepare final list
    const out = statuses.map((s) => ({
      id: s.id,
      user_id: s.user_id,
      username: s.username,
      content: s.content,
      image_url: s.image_url,
      created_at: s.created_at,
      reaction_counts: countsByStatus[s.id] || {},
      my_reaction: myMap[s.id] || null,
    }));

    return res.json({ statuses: out });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

/* ---------- Reactions endpoints ---------- */
