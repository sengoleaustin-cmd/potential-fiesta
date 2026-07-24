const pool = require('../config/database');
const logger = require('../utils/logger');

class AccountingController {
  // Chart of Accounts
  static async getChartOfAccounts(req, res) {
    try {
      const result = await pool.query(
        `SELECT id, account_code, account_name, account_type, created_at
         FROM chart_of_accounts ORDER BY account_code`
      );

      res.json({
        total: result.rows.length,
        accounts: result.rows,
      });
    } catch (error) {
      logger.error('Get chart of accounts error:', error.message);
      res.status(500).json({ error: 'Failed to fetch accounts' });
    }
  }

  static async createAccount(req, res) {
    try {
      const { accountCode, accountName, accountType } = req.body;

      const result = await pool.query(
        `INSERT INTO chart_of_accounts (account_code, account_name, account_type)
         VALUES ($1, $2, $3)
         RETURNING id, account_code, account_name, account_type`,
        [accountCode, accountName, accountType]
      );

      logger.info(`Account created: ${accountCode}`);

      res.status(201).json({
        message: 'Account created successfully',
        account: result.rows[0],
      });
    } catch (error) {
      logger.error('Create account error:', error.message);
      res.status(500).json({ error: 'Failed to create account' });
    }
  }

  // Journal Entries
  static async getJournalEntries(req, res) {
    try {
      const result = await pool.query(
        `SELECT je.id, je.entry_date, je.description, je.reference_number,
                u.first_name, u.last_name, je.created_at
         FROM journal_entries je
         LEFT JOIN users u ON je.created_by = u.id
         ORDER BY je.entry_date DESC`
      );

      res.json({
        total: result.rows.length,
        entries: result.rows,
      });
    } catch (error) {
      logger.error('Get journal entries error:', error.message);
      res.status(500).json({ error: 'Failed to fetch journal entries' });
    }
  }

  static async createJournalEntry(req, res) {
    const client = await pool.connect();
    try {
      const { entryDate, description, referenceNumber, details } = req.body;

      // Validate that debits equal credits
      const totalDebit = details.reduce((sum, d) => sum + (d.debit || 0), 0);
      const totalCredit = details.reduce((sum, d) => sum + (d.credit || 0), 0);

      if (Math.abs(totalDebit - totalCredit) > 0.01) {
        return res.status(400).json({ error: 'Debits must equal credits' });
      }

      await client.query('BEGIN');

      // Create journal entry
      const entryResult = await client.query(
        `INSERT INTO journal_entries (entry_date, description, reference_number, created_by)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [entryDate, description, referenceNumber, req.user.id]
      );

      const entryId = entryResult.rows[0].id;

      // Insert details
      for (const detail of details) {
        await client.query(
          `INSERT INTO journal_entry_details (journal_entry_id, account_id, debit, credit)
           VALUES ($1, $2, $3, $4)`,
          [entryId, detail.accountId, detail.debit || 0, detail.credit || 0]
        );
      }

      await client.query('COMMIT');

      logger.info(`Journal entry created: ${entryId}`);

      res.status(201).json({
        message: 'Journal entry created successfully',
        entryId,
      });
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Create journal entry error:', error.message);
      res.status(500).json({ error: 'Failed to create journal entry' });
    } finally {
      client.release();
    }
  }

  static async getJournalEntryDetails(req, res) {
    try {
      const { entryId } = req.params;

      const result = await pool.query(
        `SELECT jed.id, jed.journal_entry_id, jed.account_id,
                coa.account_code, coa.account_name,
                jed.debit, jed.credit
         FROM journal_entry_details jed
         LEFT JOIN chart_of_accounts coa ON jed.account_id = coa.id
         WHERE jed.journal_entry_id = $1`,
        [entryId]
      );

      res.json({
        total: result.rows.length,
        details: result.rows,
      });
    } catch (error) {
      logger.error('Get journal entry details error:', error.message);
      res.status(500).json({ error: 'Failed to fetch entry details' });
    }
  }

  // Financial Reports
  static async getTrialBalance(req, res) {
    try {
      const result = await pool.query(
        `SELECT coa.id, coa.account_code, coa.account_name, coa.account_type,
                COALESCE(SUM(CASE WHEN jed.debit > 0 THEN jed.debit ELSE 0 END), 0) as total_debit,
                COALESCE(SUM(CASE WHEN jed.credit > 0 THEN jed.credit ELSE 0 END), 0) as total_credit
         FROM chart_of_accounts coa
         LEFT JOIN journal_entry_details jed ON coa.id = jed.account_id
         GROUP BY coa.id, coa.account_code, coa.account_name, coa.account_type
         ORDER BY coa.account_code`
      );

      const totalDebit = result.rows.reduce((sum, row) => sum + parseFloat(row.total_debit), 0);
      const totalCredit = result.rows.reduce((sum, row) => sum + parseFloat(row.total_credit), 0);

      res.json({
        accounts: result.rows,
        totals: {
          totalDebit,
          totalCredit,
          balanced: Math.abs(totalDebit - totalCredit) < 0.01,
        },
      });
    } catch (error) {
      logger.error('Get trial balance error:', error.message);
      res.status(500).json({ error: 'Failed to generate trial balance' });
    }
  }

  static async getIncomeStatement(req, res) {
    try {
      const { startDate, endDate } = req.query;

      const result = await pool.query(
        `SELECT coa.account_type, coa.account_name,
                COALESCE(SUM(CASE WHEN jed.credit > 0 THEN jed.credit ELSE 0 END), 0) as revenue,
                COALESCE(SUM(CASE WHEN jed.debit > 0 THEN jed.debit ELSE 0 END), 0) as expense
         FROM chart_of_accounts coa
         LEFT JOIN journal_entry_details jed ON coa.id = jed.account_id
         LEFT JOIN journal_entries je ON jed.journal_entry_id = je.id
         WHERE coa.account_type IN ('Revenue', 'Expense')
         AND ($1::date IS NULL OR je.entry_date >= $1)
         AND ($2::date IS NULL OR je.entry_date <= $2)
         GROUP BY coa.account_type, coa.account_name`,
        [startDate, endDate]
      );

      res.json({
        period: { startDate, endDate },
        items: result.rows,
      });
    } catch (error) {
      logger.error('Get income statement error:', error.message);
      res.status(500).json({ error: 'Failed to generate income statement' });
    }
  }
}

module.exports = AccountingController;
