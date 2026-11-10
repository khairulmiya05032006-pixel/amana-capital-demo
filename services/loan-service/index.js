import logger from '../../utils/logger.js';
import express from 'express';
import cors from 'cors';

import loanRoutes from '../../routes/loanRoutes.js';
import loanApplicationRoutes from '../../routes/loanApplicationRoutes.js';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
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
app.use('/api/loans', loanRoutes);
app.use('/api/applications', loanApplicationRoutes);

app.use((err, req, res, next) => {
  let status = err.status || 500;
  let message = err.message || 'Internal Server Error';

  if (err.sqlState === '45000' || err.errno === 1644 || (message && message.includes('not pending'))) {
    status = 400;
    message = 'This loan application has already been processed and is no longer pending review.';
  } else {
    logger.error("Loan Service Error:", err);
  }

  res.status(status).json({ success: false, message });
});

const PORT = 8082;
app.listen(PORT, () => logger.info(`Loan Service listening on port ${PORT}`));
