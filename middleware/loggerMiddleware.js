// Logger Middleware
import morgan from 'morgan';

export const requestLogger = morgan('combined');

export const customLogger = (req, res, next) => {
  const timestamp = new Date().toISOString();
  const method = req.method;
  const url = req.originalUrl;
  const userAgent = req.get('user-agent');
  
  console.log(`[${timestamp}] ${method} ${url} - ${userAgent}`);
  
  next();
};

export const errorLogger = (err, req, res, next) => {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] ERROR:`, err.message);
  console.error('Stack:', err.stack);
  
  next(err);
};
