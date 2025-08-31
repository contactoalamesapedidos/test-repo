const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Get product details (AJAX)
router.get('/:id', async (req, res) => {
  try {
    const productId = req.params.id;
    
    const [products] = await db.execute(`
      SELECT p.*, r.nombre as restaurante_nombre, r.id as restaurante_id,
             cp.nombre as categoria_nombre
      FROM productos p
      JOIN restaurantes r ON p.restaurante_id = r.id
      JOIN categorias_productos cp ON p.categoria_id = cp.id
      WHERE p.id = ? AND p.disponible = 1
    `, [productId]);
    
    if (products.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Producto no encontrado' 
      });
    }
    
    const product = products[0];
    
    // Get product options if any
    const [options] = await db.execute(`
      SELECT op.*, vo.id as valor_id, vo.nombre as valor_nombre, 
             vo.precio_adicional, vo.disponible as valor_disponible
      FROM opciones_productos op
      LEFT JOIN valores_opciones vo ON op.id = vo.opcion_id
      WHERE op.producto_id = ?
      ORDER BY op.orden_display, vo.orden_display
    `, [productId]);
    
    // Group options by option type
    const groupedOptions = {};
    options.forEach(option => {
      if (!groupedOptions[option.id]) {
        groupedOptions[option.id] = {
          id: option.id,
          nombre: option.nombre,
          tipo: option.tipo,
          requerido: option.requerido,
          valores: []
        };
      }
      
      if (option.valor_id) {
        groupedOptions[option.id].valores.push({
          id: option.valor_id,
          nombre: option.valor_nombre,
          precio_adicional: parseFloat(option.precio_adicional),
          disponible: option.valor_disponible
        });
      }
    });
    
    product.opciones = Object.values(groupedOptions);
    
    res.json({
      success: true,
      product: product
    });
    
  } catch (error) {
    console.error('Error obteniendo producto:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error interno del servidor' 
    });
  }
});

// Actualizar visibilidad de un producto
router.put('/:id/visibility', async (req, res) => {
  try {
    const productId = req.params.id;
    const { visible } = req.body;
    if (typeof visible === 'undefined') {
      return res.status(400).json({ success: false, message: 'Falta el campo visible' });
    }
    await db.execute('UPDATE productos SET visible = ? WHERE id = ?', [!!visible, productId]);
    res.json({ success: true, message: 'Visibilidad actualizada' });
  } catch (error) {
    console.error('Error actualizando visibilidad:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
});

module.exports = router;
