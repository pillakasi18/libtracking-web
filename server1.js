const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");

const app = express();
const PORT = 5000; // You can change port if needed

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Serve static files (your HTML, CSS, JS)
app.use(express.static(path.join(__dirname)));

// Temporary in-memory "database"
let users = [];

// Route for register
app.post("/register", (req, res) => {
  const { username, password } = req.body;
  users.push({ username, password });
  res.send("✅ User registered successfully!");
});

// Route for login
app.post("/login", (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username && u.password === password);

  if (user) {
    res.send("🎉 Login successful!");
  } else {
    res.send("❌ Invalid username or password");
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
