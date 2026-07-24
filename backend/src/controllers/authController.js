const pool = require('../config/database');
const logger = require('../utils/logger');

class AuthController {
  static async register(req, res) {
    try {
      const { email, password, firstName, lastName } = req.body;

      // Check if user already exists
      const existingUser = await pool.query(
        'SELECT id FROM users WHERE email = $1',
        [email]
      );

      if (existingUser.rows.length > 0) {
        return res.status(409).json({ error: 'Email already registered' });
      }

      // Hash password
      const { hashPassword } = require('../utils/password');
      const passwordHash = await hashPassword(password);

      // Create user
      const result = await pool.query(
        `INSERT INTO users (email, password_hash, first_name, last_name, role, status)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, email, first_name, last_name, role`,
        [email, passwordHash, firstName, lastName, 'user', 'active']
      );

      const user = result.rows[0];
      logger.info(`New user registered: ${email}`);

      res.status(201).json({
        message: 'User registered successfully',
        user,
      });
    } catch (error) {
      logger.error('Registration error:', error.message);
      res.status(500).json({ error: 'Registration failed' });
    }
  }

  static async login(req, res) {
    try {
      const { email, password } = req.body;

      // Find user by email
      const userResult = await pool.query(
        'SELECT id, email, password_hash, first_name, last_name, role, status FROM users WHERE email = $1',
        [email]
      );

      if (userResult.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const user = userResult.rows[0];

      // Check password
      const { comparePassword } = require('../utils/password');
      const validPassword = await comparePassword(password, user.password_hash);

      if (!validPassword) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      // Check user status
      if (user.status !== 'active') {
        return res.status(403).json({ error: 'User account is inactive' });
      }

      // Generate token
      const { generateToken } = require('../utils/jwt');
      const token = generateToken(user);

      logger.info(`User logged in: ${email}`);

      res.json({
        message: 'Login successful',
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role,
        },
      });
    } catch (error) {
      logger.error('Login error:', error.message);
      res.status(500).json({ error: 'Login failed' });
    }
  }

  static async logout(req, res) {
    try {
      logger.info(`User logged out: ${req.user.email}`);
      res.json({ message: 'Logout successful' });
    } catch (error) {
      logger.error('Logout error:', error.message);
      res.status(500).json({ error: 'Logout failed' });
    }
  }

  static async refreshToken(req, res) {
    try {
      const { generateToken } = require('../utils/jwt');
      const token = generateToken(req.user);

      res.json({
        message: 'Token refreshed',
        token,
      });
    } catch (error) {
      logger.error('Token refresh error:', error.message);
      res.status(500).json({ error: 'Token refresh failed' });
    }
  }
}

module.exports = AuthController;
