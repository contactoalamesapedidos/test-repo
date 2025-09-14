const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Get delivery fee for restaurant
router.get('/restaurant/:id/delivery-fee', async (req, res) => {
    try {
        const [restaurants] = await db.execute(`
            SELECT costo_delivery 
            FROM restaurantes 
            WHERE id = ?
        `, [req.params.id]);
        
        if (restaurants.length === 0) {
            return res.json({ deliveryFee: 0 });
        }
        
        const deliveryFee = parseFloat(restaurants[0].costo_delivery) || 0;
        res.json({ deliveryFee });
    } catch (error) {
        console.error('Error fetching delivery fee:', error);
        res.status(500).json({ error: 'Error fetching delivery fee' });
    }
});

router.get('/restaurants/names', async (req, res) => {
    try {
        const [restaurants] = await db.execute(
            'SELECT id, nombre FROM restaurantes WHERE verificado = 1 AND activo = 1 ORDER BY nombre ASC'
        );
        res.json(restaurants);
    } catch (error) {
        console.error('Error fetching restaurant names:', error);
        res.status(500).json({ error: 'Error fetching restaurant names' });
    }
});

module.exports = router;
