// Payment Routes
import express from 'express';
import * as paymentController from '../controllers/paymentController.js';

const router = express.Router();

const enforceAdminHeader = (req, res, next) => {
  const role = req.user?.role || req.headers['x-user-role'];
  if (role !== 'ADMIN') {
    return res.status(403).json({ success: false, message: 'Access denied. Admin only.' });
  }
  next();
};

router.use(enforceAdminHeader);

router.get('/', paymentController.getAllPayments);
router.get('/:id', paymentController.getPaymentById);
router.post('/', paymentController.recordPayment);
router.get('/loan/:loanId', paymentController.getPaymentsByLoan);
router.get('/customer/:customerId', paymentController.getPaymentsByCustomer);

export default router;
