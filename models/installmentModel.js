// Installment Model
export const getInstallmentById = async (db, installmentId) => {
  try {
    const [installments] = await db.query(
      'SELECT * FROM loan_installments WHERE id = ?',
      [installmentId]
    );
    return installments.length > 0 ? installments[0] : null;
  } catch (error) {
    throw new Error(`Error fetching installment: ${error.message}`);
  }
};

export const getInstallmentsByLoan = async (db, loanId) => {
  try {
    const [installments] = await db.query(
      'SELECT * FROM loan_installments WHERE loan_id = ?',
      [loanId]
    );
    return installments;
  } catch (error) {
    throw new Error(`Error fetching installments: ${error.message}`);
  }
};

export const createInstallment = async (db, installmentData) => {
  try {
    const [result] = await db.query(
      'INSERT INTO loan_installments SET ?',
      [installmentData]
    );
    return result.insertId;
  } catch (error) {
    throw new Error(`Error creating installment: ${error.message}`);
  }
};

export const updateInstallment = async (db, installmentId, installmentData) => {
  try {
    const [result] = await db.query(
      'UPDATE loan_installments SET ? WHERE id = ?',
      [installmentData, installmentId]
    );
    return result.affectedRows > 0;
  } catch (error) {
    throw new Error(`Error updating installment: ${error.message}`);
  }
};

export const getOverdueInstallments = async (db) => {
  try {
    const [installments] = await db.query(
      `SELECT * FROM loan_installments WHERE due_date < NOW() AND status != 'PAID'`
    );
    return installments;
  } catch (error) {
    throw new Error(`Error fetching overdue installments: ${error.message}`);
  }
};
