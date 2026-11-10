/**
 * Send a successful API response
 * @param {Object} res - Express response object
 * @param {string} message - Success message
 * @param {any} [data=null] - Payload data
 * @param {Object} [meta=null] - Pagination or extra meta info
 * @param {number} [statusCode=200] - HTTP status code
 */
export const sendSuccess = (res, message, data = null, meta = null, statusCode = 200) => {
  const response = {
    success: true,
    message,
    ...(data && { data }),
    ...(meta && { meta }),
  };
  return res.status(statusCode).json(response);
};

/**
 * Send an error API response
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 * @param {any} [errors=null] - Detailed error information
 * @param {number} [statusCode=500] - HTTP status code
 */
export const sendError = (res, message, errors = null, statusCode = 500) => {
  const response = {
    success: false,
    message,
    ...(errors && { errors }),
  };
  return res.status(statusCode).json(response);
};

/**
 * Send a validation error response
 * @param {Object} res - Express response object
 * @param {any} errors - Validation errors
 */
export const sendValidationError = (res, errors) => {
  return sendError(res, 'Validation Error', errors, 400);
};

/**
 * Send a not found error response
 * @param {Object} res - Express response object
 * @param {string} [resource='Resource'] - Name of the missing resource
 */
export const sendNotFound = (res, resource = 'Resource') => {
  return sendError(res, `${resource} not found`, null, 404);
};

/**
 * Send an unauthorized error response
 * @param {Object} res - Express response object
 * @param {string} [message='Unauthorized'] - Error message
 */
export const sendUnauthorized = (res, message = 'Unauthorized') => {
  return sendError(res, message, null, 401);
};

/**
 * Send a forbidden error response
 * @param {Object} res - Express response object
 * @param {string} [message='Access Denied'] - Error message
 */
export const sendForbidden = (res, message = 'Access Denied') => {
  return sendError(res, message, null, 403);
};
