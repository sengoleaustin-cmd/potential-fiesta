const express = require('express');
const router = express.Router();

// Accounting module routes

// General Ledger
router.get('/ledger', (req, res) => {
  res.json({ message: 'Get general ledger' });
});

router.post('/journal-entry', (req, res) => {
  res.json({ message: 'Create journal entry' });
});

// Accounts Payable
router.get('/payable', (req, res) => {
  res.json({ message: 'Get accounts payable' });
});

router.post('/invoice', (req, res) => {
  res.json({ message: 'Create invoice' });
});

// Accounts Receivable
router.get('/receivable', (req, res) => {
  res.json({ message: 'Get accounts receivable' });
});

// Financial Reports
router.get('/reports/income-statement', (req, res) => {
  res.json({ message: 'Get income statement' });
});

router.get('/reports/balance-sheet', (req, res) => {
  res.json({ message: 'Get balance sheet' });
});

router.get('/reports/cash-flow', (req, res) => {
  res.json({ message: 'Get cash flow statement' });
});

module.exports = router;
