// Expose the cart sidebar EJS template for client-side rendering
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// GET /cart/sidebar-template
router.get('/sidebar-template', (req, res) => {
  const templatePath = path.join(__dirname, '../views/partials/cart-sidebar.ejs');
  fs.readFile(templatePath, 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading cart-sidebar.ejs:', err);
      return res.status(500).send('Error loading sidebar template');
    }
    res.type('text/plain').send(data);
  });
});

module.exports = router;
