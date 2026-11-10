// Loan Routes
import express from 'express';
import * as loanController from '../controllers/loanController.js';

const router = express.Router();

router.get('/', loanController.getAllLoans);
router.get('/:id', loanController.getLoanById);
router.post('/:id/close', loanController.closeLoan);
router.get('/customer/:customerId', loanController.getActiveLoansByCustomer);

export default router;
