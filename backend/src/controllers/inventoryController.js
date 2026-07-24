const pool = require('../config/database');
const logger = require('../utils/logger');

class InventoryController {
  // Products
  static async getProducts(req, res) {
    try {
      const result = await pool.query(
        `SELECT id, product_code, product_name, description, unit_price, reorder_level, created_at
         FROM products ORDER BY product_code`
      );

      res.json({
        total: result.rows.length,
        products: result.rows,
      });
    } catch (error) {
      logger.error('Get products error:', error.message);
      res.status(500).json({ error: 'Failed to fetch products' });
    }
  }

  static async getProductById(req, res) {
    try {
      const { id } = req.params;

      const result = await pool.query(
        `SELECT id, product_code, product_name, description, unit_price, reorder_level
         FROM products WHERE id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Product not found' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      logger.error('Get product error:', error.message);
      res.status(500).json({ error: 'Failed to fetch product' });
    }
  }

  static async createProduct(req, res) {
    try {
      const { productCode, productName, description, unitPrice, reorderLevel } = req.body;

      const result = await pool.query(
        `INSERT INTO products (product_code, product_name, description, unit_price, reorder_level)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, product_code, product_name, unit_price`,
        [productCode, productName, description, unitPrice, reorderLevel]
      );

      logger.info(`Product created: ${productCode}`);

      res.status(201).json({
        message: 'Product created successfully',
        product: result.rows[0],
      });
    } catch (error) {
      logger.error('Create product error:', error.message);
      res.status(500).json({ error: 'Failed to create product' });
    }
  }

  // Stock
  static async getStockLevels(req, res) {
    try {
      const result = await pool.query(
        `SELECT s.id, s.product_id, s.warehouse_id, s.quantity, s.last_updated,
                p.product_code, p.product_name, p.unit_price, p.reorder_level
         FROM stock s
         LEFT JOIN products p ON s.product_id = p.id
         ORDER BY p.product_code`
      );

      res.json({
        total: result.rows.length,
        stock: result.rows,
      });
    } catch (error) {
      logger.error('Get stock levels error:', error.message);
      res.status(500).json({ error: 'Failed to fetch stock levels' });
    }
  }

  static async addStock(req, res) {
    try {
      const { productId, warehouseId, quantity } = req.body;

      // Check if stock record exists
      const existing = await pool.query(
        `SELECT id FROM stock WHERE product_id = $1 AND warehouse_id = $2`,
        [productId, warehouseId]
      );

      let result;
      if (existing.rows.length > 0) {
        // Update existing
        result = await pool.query(
          `UPDATE stock SET quantity = quantity + $1, last_updated = CURRENT_TIMESTAMP
           WHERE product_id = $2 AND warehouse_id = $3
           RETURNING id, product_id, warehouse_id, quantity`,
          [quantity, productId, warehouseId]
        );
      } else {
        // Create new
        result = await pool.query(
          `INSERT INTO stock (product_id, warehouse_id, quantity)
           VALUES ($1, $2, $3)
           RETURNING id, product_id, warehouse_id, quantity`,
          [productId, warehouseId, quantity]
        );
      }

      logger.info(`Stock added for product ${productId}: ${quantity} units`);

      res.status(201).json({
        message: 'Stock updated successfully',
        stock: result.rows[0],
      });
    } catch (error) {
      logger.error('Add stock error:', error.message);
      res.status(500).json({ error: 'Failed to add stock' });
    }
  }

  static async updateStock(req, res) {
    try {
      const { id } = req.params;
      const { quantity } = req.body;

      const result = await pool.query(
        `UPDATE stock SET quantity = $1, last_updated = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING id, product_id, warehouse_id, quantity`,
        [quantity, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Stock record not found' });
      }

      logger.info(`Stock updated: ${id}`);

      res.json({
        message: 'Stock updated successfully',
        stock: result.rows[0],
      });
    } catch (error) {
      logger.error('Update stock error:', error.message);
      res.status(500).json({ error: 'Failed to update stock' });
    }
  }

  // Stock Alerts
  static async getReorderAlerts(req, res) {
    try {
      const result = await pool.query(
        `SELECT s.id, s.product_id, s.quantity, p.product_code, p.product_name, 
                p.reorder_level, p.unit_price,
                (p.reorder_level - s.quantity) as shortage
         FROM stock s
         LEFT JOIN products p ON s.product_id = p.id
         WHERE s.quantity <= p.reorder_level
         ORDER BY shortage DESC`
      );

      res.json({
        alerts: result.rows,
        total: result.rows.length,
      });
    } catch (error) {
      logger.error('Get reorder alerts error:', error.message);
      res.status(500).json({ error: 'Failed to fetch reorder alerts' });
    }
  }

  // Inventory Reports
  static async getInventoryValue(req, res) {
    try {
      const result = await pool.query(
        `SELECT p.product_code, p.product_name, s.quantity, p.unit_price,
                (s.quantity * p.unit_price) as inventory_value
         FROM stock s
         LEFT JOIN products p ON s.product_id = p.id
         ORDER BY inventory_value DESC`
      );

      const totalValue = result.rows.reduce((sum, item) => sum + parseFloat(item.inventory_value), 0);

      res.json({
        items: result.rows,
        totalInventoryValue: totalValue,
      });
    } catch (error) {
      logger.error('Get inventory value error:', error.message);
      res.status(500).json({ error: 'Failed to calculate inventory value' });
    }
  }
}

module.exports = InventoryController;
