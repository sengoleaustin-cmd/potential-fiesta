const pool = require('../config/database');
const logger = require('../utils/logger');

class ProjectController {
  // Projects
  static async getAllProjects(req, res) {
    try {
      const result = await pool.query(
        `SELECT id, project_code, project_name, description, start_date, end_date, status
         FROM projects ORDER BY start_date DESC`
      );

      res.json({
        total: result.rows.length,
        projects: result.rows,
      });
    } catch (error) {
      logger.error('Get projects error:', error.message);
      res.status(500).json({ error: 'Failed to fetch projects' });
    }
  }

  static async getProjectById(req, res) {
    try {
      const { id } = req.params;

      const project = await pool.query(
        `SELECT id, project_code, project_name, description, start_date, end_date, status
         FROM projects WHERE id = $1`,
        [id]
      );

      if (project.rows.length === 0) {
        return res.status(404).json({ error: 'Project not found' });
      }

      // Get project tasks
      const tasks = await pool.query(
        `SELECT t.id, t.task_name, t.description, t.assigned_to, t.due_date, t.status, t.priority,
                u.first_name, u.last_name
         FROM tasks t
         LEFT JOIN users u ON t.assigned_to = u.id
         WHERE t.project_id = $1
         ORDER BY t.due_date ASC`,
        [id]
      );

      res.json({
        project: project.rows[0],
        tasks: tasks.rows,
      });
    } catch (error) {
      logger.error('Get project error:', error.message);
      res.status(500).json({ error: 'Failed to fetch project' });
    }
  }

  static async createProject(req, res) {
    try {
      const { projectCode, projectName, description, startDate, endDate } = req.body;

      const result = await pool.query(
        `INSERT INTO projects (project_code, project_name, description, start_date, end_date, status)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, project_code, project_name, start_date, end_date`,
        [projectCode, projectName, description, startDate, endDate, 'active']
      );

      logger.info(`Project created: ${projectCode}`);

      res.status(201).json({
        message: 'Project created successfully',
        project: result.rows[0],
      });
    } catch (error) {
      logger.error('Create project error:', error.message);
      res.status(500).json({ error: 'Failed to create project' });
    }
  }

  static async updateProject(req, res) {
    try {
      const { id } = req.params;
      const { projectName, description, endDate, status } = req.body;

      const result = await pool.query(
        `UPDATE projects 
         SET project_name = COALESCE($1, project_name),
             description = COALESCE($2, description),
             end_date = COALESCE($3, end_date),
             status = COALESCE($4, status)
         WHERE id = $5
         RETURNING id, project_code, project_name, status`,
        [projectName, description, endDate, status, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Project not found' });
      }

      logger.info(`Project updated: ${id}`);

      res.json({
        message: 'Project updated successfully',
        project: result.rows[0],
      });
    } catch (error) {
      logger.error('Update project error:', error.message);
      res.status(500).json({ error: 'Failed to update project' });
    }
  }

  // Tasks
  static async getProjectTasks(req, res) {
    try {
      const { projectId } = req.params;
      const { status } = req.query;

      let query = `SELECT t.id, t.task_name, t.description, t.assigned_to, t.due_date, t.status, t.priority,
                          u.first_name, u.last_name
                   FROM tasks t
                   LEFT JOIN users u ON t.assigned_to = u.id
                   WHERE t.project_id = $1`;
      const params = [projectId];

      if (status) {
        query += ` AND t.status = $2`;
        params.push(status);
      }

      query += ` ORDER BY t.due_date ASC`;

      const result = await pool.query(query, params);

      res.json({
        total: result.rows.length,
        tasks: result.rows,
      });
    } catch (error) {
      logger.error('Get project tasks error:', error.message);
      res.status(500).json({ error: 'Failed to fetch tasks' });
    }
  }

  static async createTask(req, res) {
    try {
      const { projectId } = req.params;
      const { taskName, description, assignedTo, dueDate, priority } = req.body;

      const result = await pool.query(
        `INSERT INTO tasks (project_id, task_name, description, assigned_to, due_date, priority, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, task_name, due_date, status, priority`,
        [projectId, taskName, description, assignedTo, dueDate, priority, 'pending']
      );

      logger.info(`Task created for project: ${projectId}`);

      res.status(201).json({
        message: 'Task created successfully',
        task: result.rows[0],
      });
    } catch (error) {
      logger.error('Create task error:', error.message);
      res.status(500).json({ error: 'Failed to create task' });
    }
  }

  static async updateTask(req, res) {
    try {
      const { id } = req.params;
      const { taskName, description, assignedTo, dueDate, status, priority } = req.body;

      const result = await pool.query(
        `UPDATE tasks 
         SET task_name = COALESCE($1, task_name),
             description = COALESCE($2, description),
             assigned_to = COALESCE($3, assigned_to),
             due_date = COALESCE($4, due_date),
             status = COALESCE($5, status),
             priority = COALESCE($6, priority)
         WHERE id = $7
         RETURNING id, task_name, status, priority`,
        [taskName, description, assignedTo, dueDate, status, priority, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Task not found' });
      }

      logger.info(`Task updated: ${id}`);

      res.json({
        message: 'Task updated successfully',
        task: result.rows[0],
      });
    } catch (error) {
      logger.error('Update task error:', error.message);
      res.status(500).json({ error: 'Failed to update task' });
    }
  }

  // Project Progress
  static async getProjectProgress(req, res) {
    try {
      const { projectId } = req.params;

      const progress = await pool.query(
        `SELECT 
           COUNT(*) as total_tasks,
           SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_tasks,
           SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_tasks,
           SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_tasks,
           ROUND(100.0 * SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) / COUNT(*), 2) as completion_percentage
         FROM tasks
         WHERE project_id = $1`,
        [projectId]
      );

      res.json(progress.rows[0]);
    } catch (error) {
      logger.error('Get project progress error:', error.message);
      res.status(500).json({ error: 'Failed to fetch project progress' });
    }
  }
}

module.exports = ProjectController;
