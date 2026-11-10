import logger from '../utils/logger.js';
// Error Controller
export const handleNotFound = (req, res) => {
  res.status(404).render('errors/404', {
    message: 'Page not found',
    url: req.originalUrl,
  });
};

export const handleServerError = (err, req, res, next) => {
  logger.error('Server error:', err);
  
  res.status(err.status || 500).render('errors/500', {
    message: err.message || 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err : {},
  });
};

export const handleValidationError = (req, res) => {
  res.status(400).json({
    success: false,
    message: 'Validation error',
    errors: req.errors || [],
  });
};
