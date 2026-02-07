const express = require('express');
const app = express();
const PORT = 3000;

// Serve static files (HTML, CSS, images)
app.use(express.static(__dirname));

// Handle Buy Now POST request and redirect
app.post('/buy/:id', (req, res) => {
  // Here you can add logic to save the order before redirect
  res.redirect('/buy-page.html'); // replace with your actual buy page filename
});

// Handle Add to Cart POST request and redirect
app.post('/cart/:id', (req, res) => {
  // Here you can add logic to update the cart before redirect
  res.redirect('/cart-page.html'); // replace with your actual cart page filename
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
