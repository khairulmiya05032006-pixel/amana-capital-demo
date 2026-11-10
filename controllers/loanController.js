import db from '../config/db.js';
import * as loanModel from '../models/loanModel.js';

export const getAllLoans = async (req, res, next) => {
  try {
    const loans = await loanModel.getAllLoans(db);
    res.json({ success: true, data: loans });
  } catch (error) {
    next(error);
  }
};

export const getLoanById = async (req, res, next) => {
  try {
    const loan = await loanModel.getLoanById(db, req.params.id);
    if (!loan) {
      return res.status(404).json({ success: false, message: 'Loan not found' });
    }
    res.json({ success: true, data: loan });
  } catch (error) {
    next(error);
  }
};

export const getActiveLoansByCustomer = async (req, res, next) => {
  try {
    const [profiles] = await db.query('SELECT id FROM customer_profiles WHERE user_id = ?', [req.user.id]);
    if (profiles.length === 0) {
      return res.status(404).json({ success: false, message: 'Customer profile not found' });
    }
    const customerId = profiles[0].id;
    
    const loans = await loanModel.getActiveLoansByCustomer(db, customerId);
    res.json({ success: true, data: loans });
  } catch (error) {
    next(error);
  }
};

export const closeLoan = async (req, res, next) => {
  try {
    const loanId = req.params.id;
    const loan = await loanModel.getLoanById(db, loanId);
    if(!loan) {
      return res.status(404).json({ success: false, message: 'Loan not found' });
    }
    
    // Close loan logic:
    // Update loan status to CLOSED
    await loanModel.updateLoan(db, loanId, { loan_status: 'CLOSED' });
    
    res.json({ success: true, message: 'Loan closed successfully' });
  } catch (error) {
    next(error);
  }
};
