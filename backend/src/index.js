require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const logger = require('./utils/logger');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const accountingRoutes = require('./routes/accounting');
const hrRoutes = require('./routes/hr');
const inventoryRoutes = require('./routes/inventory');
const crmRoutes = require('./routes/crm');
const projectRoutes = require('./routes/projects');
const manufacturingRoutes = require('./routes/manufacturing');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined', { stream: logger.stream }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/accounting', accountingRoutes);
app.use('/api/v1/hr', hrRoutes);
app.use('/api/v1/inventory', inventoryRoutes);
app.use('/api/v1/crm', crmRoutes);
app.use('/api/v1/projects', projectRoutes);
app.use('/api/v1/manufacturing', manufacturingRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(err.message);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  logger.info(`ERP Backend Server running on port ${PORT}`);
});

module.exports = app;
