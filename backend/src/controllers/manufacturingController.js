const pool = require('../config/database');
const logger = require('../utils/logger');

class ManufacturingController {
  // Bill of Materials
  static async getBOM(req, res) {
    try {
      const result = await pool.query(
        `SELECT bom.id, bom.product_id, bom.component_id,
                p.product_code as product_code, p.product_name as product_name,
                c.product_code as component_code, c.product_name as component_name,
                bom.quantity
         FROM bom
         LEFT JOIN products p ON bom.product_id = p.id
         LEFT JOIN products c ON bom.component_id = c.id
         ORDER BY p.product_code`
      );

      res.json({
        total: result.rows.length,
        bom: result.rows,
      });
    } catch (error) {
      logger.error('Get BOM error:', error.message);
      res.status(500).json({ error: 'Failed to fetch BOM' });
    }
  }

  static async getBOMByProductId(req, res) {
    try {
      const { productId } = req.params;

      const result = await pool.query(
        `SELECT bom.id, bom.product_id, bom.component_id, bom.quantity,
                c.product_code, c.product_name, c.unit_price
         FROM bom
         LEFT JOIN products c ON bom.component_id = c.id
         WHERE bom.product_id = $1`,
        [productId]
      );

      res.json({
        total: result.rows.length,
        components: result.rows,
      });
    } catch (error) {
      logger.error('Get BOM by product error:', error.message);
      res.status(500).json({ error: 'Failed to fetch BOM' });
    }
  }

  static async createBOM(req, res) {
    try {
      const { productId, componentId, quantity } = req.body;

      const result = await pool.query(
        `INSERT INTO bom (product_id, component_id, quantity)
         VALUES ($1, $2, $3)
         RETURNING id, product_id, component_id, quantity`,
        [productId, componentId, quantity]
      );

      logger.info(`BOM created for product: ${productId}`);

      res.status(201).json({
        message: 'BOM created successfully',
        bom: result.rows[0],
      });
    } catch (error) {
      logger.error('Create BOM error:', error.message);
      res.status(500).json({ error: 'Failed to create BOM' });
    }
  }

  // Work Orders
  static async getWorkOrders(req, res) {
    try {
      const { status } = req.query;

      let query = `SELECT wo.id, wo.product_id, wo.quantity, wo.due_date, wo.status,
                          p.product_code, p.product_name
                   FROM work_orders wo
                   LEFT JOIN products p ON wo.product_id = p.id
                   WHERE 1=1`;
      const params = [];

      if (status) {
        query += ` AND wo.status = $${params.length + 1}`;
        params.push(status);
      }

      query += ` ORDER BY wo.due_date ASC`;

      const result = await pool.query(query, params);

      res.json({
        total: result.rows.length,
        workOrders: result.rows,
      });
    } catch (error) {
      logger.error('Get work orders error:', error.message);
      res.status(500).json({ error: 'Failed to fetch work orders' });
    }
  }

  static async getWorkOrderById(req, res) {
    try {
      const { id } = req.params;

      const result = await pool.query(
        `SELECT wo.id, wo.product_id, wo.quantity, wo.due_date, wo.status,
                p.product_code, p.product_name
         FROM work_orders wo
         LEFT JOIN products p ON wo.product_id = p.id
         WHERE wo.id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Work order not found' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      logger.error('Get work order error:', error.message);
      res.status(500).json({ error: 'Failed to fetch work order' });
    }
  }

  static async createWorkOrder(req, res) {
    try {
      const { productId, quantity, dueDate } = req.body;

      const result = await pool.query(
        `INSERT INTO work_orders (product_id, quantity, due_date, status)
         VALUES ($1, $2, $3, $4)
         RETURNING id, product_id, quantity, due_date, status`,
        [productId, quantity, dueDate, 'pending']
      );

      logger.info(`Work order created for product: ${productId}`);

      res.status(201).json({
        message: 'Work order created successfully',
        workOrder: result.rows[0],
      });
    } catch (error) {
      logger.error('Create work order error:', error.message);
      res.status(500).json({ error: 'Failed to create work order' });
    }
  }

  static async updateWorkOrder(req, res) {
    try {
      const { id } = req.params;
      const { quantity, dueDate, status } = req.body;

      const result = await pool.query(
        `UPDATE work_orders 
         SET quantity = COALESCE($1, quantity),
             due_date = COALESCE($2, due_date),
             status = COALESCE($3, status)
         WHERE id = $4
         RETURNING id, product_id, quantity, status`,
        [quantity, dueDate, status, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Work order not found' });
      }

      logger.info(`Work order updated: ${id}`);

      res.json({
        message: 'Work order updated successfully',
        workOrder: result.rows[0],
      });
    } catch (error) {
      logger.error('Update work order error:', error.message);
      res.status(500).json({ error: 'Failed to update work order' });
    }
  }

  // Production Planning
  static async getProductionAnalysis(req, res) {
    try {
      const result = await pool.query(
        `SELECT 
           COUNT(*) as total_work_orders,
           SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_orders,
           SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_orders,
           SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_orders,
           SUM(quantity) as total_units_to_produce,
           SUM(CASE WHEN status = 'completed' THEN quantity ELSE 0 END) as completed_units
         FROM work_orders`
      );

      res.json(result.rows[0]);
    } catch (error) {
      logger.error('Get production analysis error:', error.message);
      res.status(500).json({ error: 'Failed to fetch production analysis' });
    }
  }
}

module.exports = ManufacturingController;
