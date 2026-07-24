const pool = require('../config/database');
const logger = require('../utils/logger');

class HRController {
  // Employees
  static async getAllEmployees(req, res) {
    try {
      const result = await pool.query(
        `SELECT e.id, e.employee_id, e.department, e.position, e.hire_date, e.salary, e.status,
                u.first_name, u.last_name, u.email
         FROM employees e
         LEFT JOIN users u ON e.user_id = u.id
         ORDER BY e.employee_id`
      );

      res.json({
        total: result.rows.length,
        employees: result.rows,
      });
    } catch (error) {
      logger.error('Get employees error:', error.message);
      res.status(500).json({ error: 'Failed to fetch employees' });
    }
  }

  static async getEmployeeById(req, res) {
    try {
      const { id } = req.params;

      const result = await pool.query(
        `SELECT e.id, e.employee_id, e.department, e.position, e.hire_date, e.salary, e.status,
                u.first_name, u.last_name, u.email
         FROM employees e
         LEFT JOIN users u ON e.user_id = u.id
         WHERE e.id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Employee not found' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      logger.error('Get employee error:', error.message);
      res.status(500).json({ error: 'Failed to fetch employee' });
    }
  }

  static async createEmployee(req, res) {
    try {
      const { userId, employeeId, department, position, hireDate, salary } = req.body;

      const result = await pool.query(
        `INSERT INTO employees (user_id, employee_id, department, position, hire_date, salary, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, employee_id, department, position, hire_date, salary`,
        [userId, employeeId, department, position, hireDate, salary, 'active']
      );

      logger.info(`Employee created: ${employeeId}`);

      res.status(201).json({
        message: 'Employee created successfully',
        employee: result.rows[0],
      });
    } catch (error) {
      logger.error('Create employee error:', error.message);
      res.status(500).json({ error: 'Failed to create employee' });
    }
  }

  static async updateEmployee(req, res) {
    try {
      const { id } = req.params;
      const { department, position, salary, status } = req.body;

      const result = await pool.query(
        `UPDATE employees 
         SET department = COALESCE($1, department),
             position = COALESCE($2, position),
             salary = COALESCE($3, salary),
             status = COALESCE($4, status)
         WHERE id = $5
         RETURNING id, employee_id, department, position, salary, status`,
        [department, position, salary, status, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Employee not found' });
      }

      logger.info(`Employee updated: ${id}`);

      res.json({
        message: 'Employee updated successfully',
        employee: result.rows[0],
      });
    } catch (error) {
      logger.error('Update employee error:', error.message);
      res.status(500).json({ error: 'Failed to update employee' });
    }
  }

  // Attendance
  static async getAttendance(req, res) {
    try {
      const { employeeId, startDate, endDate } = req.query;

      let query = `SELECT a.id, a.employee_id, a.attendance_date, a.check_in, a.check_out, a.status,
                          e.employee_id as emp_id, u.first_name, u.last_name
                   FROM attendance a
                   LEFT JOIN employees e ON a.employee_id = e.id
                   LEFT JOIN users u ON e.user_id = u.id
                   WHERE 1=1`;
      const params = [];

      if (employeeId) {
        query += ` AND a.employee_id = $${params.length + 1}`;
        params.push(employeeId);
      }
      if (startDate) {
        query += ` AND a.attendance_date >= $${params.length + 1}`;
        params.push(startDate);
      }
      if (endDate) {
        query += ` AND a.attendance_date <= $${params.length + 1}`;
        params.push(endDate);
      }

      query += ` ORDER BY a.attendance_date DESC`;

      const result = await pool.query(query, params);

      res.json({
        total: result.rows.length,
        records: result.rows,
      });
    } catch (error) {
      logger.error('Get attendance error:', error.message);
      res.status(500).json({ error: 'Failed to fetch attendance' });
    }
  }

  static async recordAttendance(req, res) {
    try {
      const { employeeId, attendanceDate, checkIn, checkOut, status } = req.body;

      const result = await pool.query(
        `INSERT INTO attendance (employee_id, attendance_date, check_in, check_out, status)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, employee_id, attendance_date, check_in, check_out, status`,
        [employeeId, attendanceDate, checkIn, checkOut, status || 'present']
      );

      logger.info(`Attendance recorded for employee: ${employeeId}`);

      res.status(201).json({
        message: 'Attendance recorded successfully',
        record: result.rows[0],
      });
    } catch (error) {
      logger.error('Record attendance error:', error.message);
      res.status(500).json({ error: 'Failed to record attendance' });
    }
  }

  // Payroll
  static async generatePayroll(req, res) {
    try {
      const { startDate, endDate } = req.body;

      const employees = await pool.query(
        `SELECT id, employee_id, salary FROM employees WHERE status = 'active'`
      );

      const payrollRecords = employees.rows.map((emp) => ({
        employeeId: emp.employee_id,
        month: startDate,
        salary: emp.salary,
        status: 'generated',
      }));

      logger.info(`Payroll generated for ${payrollRecords.length} employees`);

      res.status(201).json({
        message: 'Payroll generated successfully',
        total: payrollRecords.length,
        records: payrollRecords,
      });
    } catch (error) {
      logger.error('Generate payroll error:', error.message);
      res.status(500).json({ error: 'Failed to generate payroll' });
    }
  }

  // Leave Requests
  static async getLeaveRequests(req, res) {
    try {
      const { employeeId, status } = req.query;

      let query = `SELECT lr.id, lr.employee_id, lr.leave_type, lr.start_date, lr.end_date,
                          lr.reason, lr.status, e.employee_id as emp_id, u.first_name, u.last_name
                   FROM leave_requests lr
                   LEFT JOIN employees e ON lr.employee_id = e.id
                   LEFT JOIN users u ON e.user_id = u.id
                   WHERE 1=1`;
      const params = [];

      if (employeeId) {
        query += ` AND lr.employee_id = $${params.length + 1}`;
        params.push(employeeId);
      }
      if (status) {
        query += ` AND lr.status = $${params.length + 1}`;
        params.push(status);
      }

      query += ` ORDER BY lr.created_at DESC`;

      const result = await pool.query(query, params);

      res.json({
        total: result.rows.length,
        requests: result.rows,
      });
    } catch (error) {
      logger.error('Get leave requests error:', error.message);
      res.status(500).json({ error: 'Failed to fetch leave requests' });
    }
  }

  static async requestLeave(req, res) {
    try {
      const { employeeId, leaveType, startDate, endDate, reason } = req.body;

      const result = await pool.query(
        `INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, reason, status)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, employee_id, leave_type, start_date, end_date, status`,
        [employeeId, leaveType, startDate, endDate, reason, 'pending']
      );

      logger.info(`Leave request created for employee: ${employeeId}`);

      res.status(201).json({
        message: 'Leave request submitted successfully',
        request: result.rows[0],
      });
    } catch (error) {
      logger.error('Request leave error:', error.message);
      res.status(500).json({ error: 'Failed to request leave' });
    }
  }

  static async approveLeaveRequest(req, res) {
    try {
      const { id } = req.params;

      const result = await pool.query(
        `UPDATE leave_requests SET status = 'approved' WHERE id = $1
         RETURNING id, employee_id, leave_type, status`,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Leave request not found' });
      }

      logger.info(`Leave request approved: ${id}`);

      res.json({
        message: 'Leave request approved',
        request: result.rows[0],
      });
    } catch (error) {
      logger.error('Approve leave error:', error.message);
      res.status(500).json({ error: 'Failed to approve leave' });
    }
  }
}

module.exports = HRController;
