const express = require('express');
const app = express();
const PORT = 3000;

app.use(express.urlencoded({ extended: false }));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/login.html'); // Adjust if your HTML file name/path differs
});

app.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.send("Email and password are required.");
  }
  if (email === "test@example.com" && password === "password123") {
    res.send("Login successful, welcome!");
  } else {
    res.send("Invalid email or password.");
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
