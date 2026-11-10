import logger from '../../utils/logger.js';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import ejsMate from 'ejs-mate';

import authRoutes from '../../routes/authRoutes.js';
import userRoutes from '../../routes/userRoutes.js';
import customerRoutes from '../../routes/customerRoutes.js';
import dashboardRoutes from '../../routes/dashboardRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.set('view engine', 'ejs');
app.engine('ejs', ejsMate);
app.set('views', path.join(__dirname, '../../views'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(cors({
  origin: process.env.CORS_ALLOWED_ORIGINS?.split(',') || ['http://localhost:8080'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
}));

// Middleware to mock req.user from headers passed by Gateway
app.use((req, res, next) => {
  const userId = req.headers['x-user-id'];
  const userRole = req.headers['x-user-role'];
  if (userId) {
    req.user = { id: userId, role: userRole };
  }
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.use((err, req, res, next) => {
  logger.error("Auth Service Error:", err);
  let status = err.status || 500;
  let message = err.message || 'Internal Server Error';

  if (err.code === 'ER_DUP_ENTRY' || err.errno === 1062 || (message && message.includes('Duplicate entry'))) {
    status = 409;
    if (message.includes('uk_customer_phone')) {
      message = 'This phone number is already registered with another account. Please use a different phone number or log in.';
    } else if (message.includes('email') || message.includes('users.email')) {
      message = 'An account with this email address already exists. Please log in instead.';
    } else {
      message = 'An account with these details already exists. Please check your information or log in.';
    }
  }

  res.status(status).json({ success: false, message });
});

const PORT = 8081;
app.listen(PORT, () => logger.info(`Auth Service listening on port ${PORT}`));
