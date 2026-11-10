// Application configuration
export const appConfig = {
  appName: 'MicroFinance Loan Management System',
  version: '1.0.0',
  description: 'A complete microfinance loan management application',
  
  // Server configuration
  server: {
    port: process.env.PORT || 8080,
    host: process.env.HOST || 'localhost',
  },

  // Database configuration
  database: {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'microfinance_db',
    port: process.env.DB_PORT || 3306,
    connectionLimit: 15,
    waitForConnections: true,
    queueLimit: 0,
  },

  // JWT configuration
  jwt: {
    secret: process.env.JWT_SECRET || 'your-jwt-secret-key',
    expiresIn: '24h',
    refreshExpiresIn: '7d',
  },

  // Session configuration
  session: {
    secret: process.env.SESSION_SECRET || 'session-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  },

  // File upload configuration
  upload: {
    profileDir: 'storage/uploads/profiles/',
    documentDir: 'storage/uploads/documents/',
    tempDir: 'storage/uploads/temp/',
    maxFileSize: 5 * 1024 * 1024, // 5MB
    allowedMimes: ['image/jpeg', 'image/png', 'application/pdf'],
  },

  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: 'combined',
  },
};

export default appConfig;
