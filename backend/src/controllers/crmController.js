const pool = require('../config/database');
const logger = require('../utils/logger');

class CRMController {
  // Customers
  static async getAllCustomers(req, res) {
    try {
      const result = await pool.query(
        `SELECT id, customer_code, customer_name, email, phone, address, city, country, status
         FROM customers ORDER BY customer_code`
      );

      res.json({
        total: result.rows.length,
        customers: result.rows,
      });
    } catch (error) {
      logger.error('Get customers error:', error.message);
      res.status(500).json({ error: 'Failed to fetch customers' });
    }
  }

  static async getCustomerById(req, res) {
    try {
      const { id } = req.params;

      const customer = await pool.query(
        `SELECT id, customer_code, customer_name, email, phone, address, city, country, status
         FROM customers WHERE id = $1`,
        [id]
      );

      if (customer.rows.length === 0) {
        return res.status(404).json({ error: 'Customer not found' });
      }

      // Get customer opportunities
      const opportunities = await pool.query(
        `SELECT id, opportunity_name, stage, value, probability, close_date
         FROM opportunities WHERE customer_id = $1 ORDER BY close_date DESC`,
        [id]
      );

      res.json({
        customer: customer.rows[0],
        opportunities: opportunities.rows,
      });
    } catch (error) {
      logger.error('Get customer error:', error.message);
      res.status(500).json({ error: 'Failed to fetch customer' });
    }
  }

  static async createCustomer(req, res) {
    try {
      const { customerCode, customerName, email, phone, address, city, country } = req.body;

      const result = await pool.query(
        `INSERT INTO customers (customer_code, customer_name, email, phone, address, city, country, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, customer_code, customer_name, email, status`,
        [customerCode, customerName, email, phone, address, city, country, 'active']
      );

      logger.info(`Customer created: ${customerCode}`);

      res.status(201).json({
        message: 'Customer created successfully',
        customer: result.rows[0],
      });
    } catch (error) {
      logger.error('Create customer error:', error.message);
      res.status(500).json({ error: 'Failed to create customer' });
    }
  }

  static async updateCustomer(req, res) {
    try {
      const { id } = req.params;
      const { customerName, email, phone, address, city, country, status } = req.body;

      const result = await pool.query(
        `UPDATE customers 
         SET customer_name = COALESCE($1, customer_name),
             email = COALESCE($2, email),
             phone = COALESCE($3, phone),
             address = COALESCE($4, address),
             city = COALESCE($5, city),
             country = COALESCE($6, country),
             status = COALESCE($7, status)
         WHERE id = $8
         RETURNING id, customer_code, customer_name, email, status`,
        [customerName, email, phone, address, city, country, status, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Customer not found' });
      }

      logger.info(`Customer updated: ${id}`);

      res.json({
        message: 'Customer updated successfully',
        customer: result.rows[0],
      });
    } catch (error) {
      logger.error('Update customer error:', error.message);
      res.status(500).json({ error: 'Failed to update customer' });
    }
  }

  // Opportunities
  static async getOpportunities(req, res) {
    try {
      const { stage, customerId } = req.query;

      let query = `SELECT o.id, o.customer_id, o.opportunity_name, o.stage, o.value, o.probability, o.close_date,
                          c.customer_code, c.customer_name
                   FROM opportunities o
                   LEFT JOIN customers c ON o.customer_id = c.id
                   WHERE 1=1`;
      const params = [];

      if (stage) {
        query += ` AND o.stage = $${params.length + 1}`;
        params.push(stage);
      }
      if (customerId) {
        query += ` AND o.customer_id = $${params.length + 1}`;
        params.push(customerId);
      }

      query += ` ORDER BY o.close_date ASC`;

      const result = await pool.query(query, params);

      res.json({
        total: result.rows.length,
        opportunities: result.rows,
      });
    } catch (error) {
      logger.error('Get opportunities error:', error.message);
      res.status(500).json({ error: 'Failed to fetch opportunities' });
    }
  }

  static async createOpportunity(req, res) {
    try {
      const { customerId, opportunityName, stage, value, probability, closeDate } = req.body;

      const result = await pool.query(
        `INSERT INTO opportunities (customer_id, opportunity_name, stage, value, probability, close_date)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, customer_id, opportunity_name, stage, value`,
        [customerId, opportunityName, stage, value, probability, closeDate]
      );

      logger.info(`Opportunity created: ${opportunityName}`);

      res.status(201).json({
        message: 'Opportunity created successfully',
        opportunity: result.rows[0],
      });
    } catch (error) {
      logger.error('Create opportunity error:', error.message);
      res.status(500).json({ error: 'Failed to create opportunity' });
    }
  }

  static async updateOpportunity(req, res) {
    try {
      const { id } = req.params;
      const { stage, value, probability, closeDate } = req.body;

      const result = await pool.query(
        `UPDATE opportunities 
         SET stage = COALESCE($1, stage),
             value = COALESCE($2, value),
             probability = COALESCE($3, probability),
             close_date = COALESCE($4, close_date)
         WHERE id = $5
         RETURNING id, opportunity_name, stage, value, probability`,
        [stage, value, probability, closeDate, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Opportunity not found' });
      }

      logger.info(`Opportunity updated: ${id}`);

      res.json({
        message: 'Opportunity updated successfully',
        opportunity: result.rows[0],
      });
    } catch (error) {
      logger.error('Update opportunity error:', error.message);
      res.status(500).json({ error: 'Failed to update opportunity' });
    }
  }

  // Sales Pipeline Analysis
  static async getSalesPipeline(req, res) {
    try {
      const result = await pool.query(
        `SELECT stage, COUNT(*) as count, SUM(value) as total_value, AVG(probability) as avg_probability
         FROM opportunities
         GROUP BY stage
         ORDER BY CASE stage
           WHEN 'Lead' THEN 1
           WHEN 'Prospect' THEN 2
           WHEN 'Qualified' THEN 3
           WHEN 'Proposal' THEN 4
           WHEN 'Negotiation' THEN 5
           WHEN 'Closed Won' THEN 6
           ELSE 99
         END`
      );

      res.json({
        pipeline: result.rows,
      });
    } catch (error) {
      logger.error('Get sales pipeline error:', error.message);
      res.status(500).json({ error: 'Failed to fetch sales pipeline' });
    }
  }
}

module.exports = CRMController;
