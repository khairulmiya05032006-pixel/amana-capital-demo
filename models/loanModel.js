// Loan Model
export const getLoanById = async (db, loanId) => {
  try {
    const [loans] = await db.query(
      'SELECT * FROM loans WHERE id = ?',
      [loanId]
    );
    return loans.length > 0 ? loans[0] : null;
  } catch (error) {
    throw new Error(`Error fetching loan: ${error.message}`);
  }
};

export const getAllLoans = async (db) => {
  try {
    const [loans] = await db.query(
      'SELECT * FROM loans'
    );
    return loans;
  } catch (error) {
    throw new Error(`Error fetching loans: ${error.message}`);
  }
};

export const createLoan = async (db, loanData) => {
  try {
    const [result] = await db.query(
      'INSERT INTO loans SET ?',
      [loanData]
    );
    return result.insertId;
  } catch (error) {
    throw new Error(`Error creating loan: ${error.message}`);
  }
};

export const updateLoan = async (db, loanId, loanData) => {
  try {
    const [result] = await db.query(
      'UPDATE loans SET ? WHERE id = ?',
      [loanData, loanId]
    );
    return result.affectedRows > 0;
  } catch (error) {
    throw new Error(`Error updating loan: ${error.message}`);
  }
};

export const getLoansByCustomer = async (db, customerId) => {
  try {
    const [loans] = await db.query(
      'SELECT * FROM loans WHERE customer_id = ?',
      [customerId]
    );
    return loans;
  } catch (error) {
    throw new Error(`Error fetching customer loans: ${error.message}`);
  }
};

export const getActiveLoansByCustomer = async (db, customerId) => {
  try {
    const [loans] = await db.query(
      "SELECT * FROM loans WHERE customer_id = ? AND loan_status = 'ACTIVE'",
      [customerId]
    );
    return loans;
  } catch (error) {
    throw new Error(`Error fetching active loans: ${error.message}`);
  }
};
