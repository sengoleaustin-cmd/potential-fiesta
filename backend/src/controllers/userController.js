const pool = require('../config/database');
const logger = require('../utils/logger');

class UserController {
  static async getAllUsers(req, res) {
    try {
      const result = await pool.query(
        `SELECT id, email, first_name, last_name, role, status, created_at
         FROM users ORDER BY created_at DESC`
      );

      res.json({
        total: result.rows.length,
        users: result.rows,
      });
    } catch (error) {
      logger.error('Get users error:', error.message);
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  }

  static async getUserById(req, res) {
    try {
      const { id } = req.params;

      const result = await pool.query(
        `SELECT id, email, first_name, last_name, role, status, created_at
         FROM users WHERE id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      logger.error('Get user error:', error.message);
      res.status(500).json({ error: 'Failed to fetch user' });
    }
  }

  static async createUser(req, res) {
    try {
      const { email, password, firstName, lastName, role } = req.body;

      // Check if user exists
      const existing = await pool.query(
        'SELECT id FROM users WHERE email = $1',
        [email]
      );

      if (existing.rows.length > 0) {
        return res.status(409).json({ error: 'Email already exists' });
      }

      const { hashPassword } = require('../utils/password');
      const passwordHash = await hashPassword(password);

      const result = await pool.query(
        `INSERT INTO users (email, password_hash, first_name, last_name, role, status)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, email, first_name, last_name, role`,
        [email, passwordHash, firstName, lastName, role || 'user', 'active']
      );

      logger.info(`User created: ${email}`);

      res.status(201).json({
        message: 'User created successfully',
        user: result.rows[0],
      });
    } catch (error) {
      logger.error('Create user error:', error.message);
      res.status(500).json({ error: 'Failed to create user' });
    }
  }

  static async updateUser(req, res) {
    try {
      const { id } = req.params;
      const { firstName, lastName, role, status } = req.body;

      const result = await pool.query(
        `UPDATE users 
         SET first_name = COALESCE($1, first_name),
             last_name = COALESCE($2, last_name),
             role = COALESCE($3, role),
             status = COALESCE($4, status),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $5
         RETURNING id, email, first_name, last_name, role, status`,
        [firstName, lastName, role, status, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      logger.info(`User updated: ${id}`);

      res.json({
        message: 'User updated successfully',
        user: result.rows[0],
      });
    } catch (error) {
      logger.error('Update user error:', error.message);
      res.status(500).json({ error: 'Failed to update user' });
    }
  }

  static async deleteUser(req, res) {
    try {
      const { id } = req.params;

      const result = await pool.query(
        'DELETE FROM users WHERE id = $1 RETURNING id, email',
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      logger.info(`User deleted: ${id}`);

      res.json({
        message: 'User deleted successfully',
        user: result.rows[0],
      });
    } catch (error) {
      logger.error('Delete user error:', error.message);
      res.status(500).json({ error: 'Failed to delete user' });
    }
  }
}

module.exports = UserController;
