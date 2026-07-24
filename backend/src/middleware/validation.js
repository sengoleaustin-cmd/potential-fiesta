const { body, validationResult } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const validateEmail = () => body('email').isEmail().normalizeEmail();
const validatePassword = () => body('password').isLength({ min: 6 });
const validateRequired = (field) => body(field).notEmpty().trim();

module.exports = {
  handleValidationErrors,
  validateEmail,
  validatePassword,
  validateRequired,
};
