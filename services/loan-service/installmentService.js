import db from '../../config/db.js';

export class InstallmentService {
  /**
   * Generates installment schedule in memory.
   * @param {Object} params
   * @param {number} params.principalAmount
   * @param {number} params.annualInterestRate
   * @param {number} params.tenureMonths
   * @param {string} params.disbursementDate
   * @returns {Object} { emiAmount, totalInterest, totalPayable, installments: Array }
   */
  static generateSchedule({ principalAmount, annualInterestRate, tenureMonths, disbursementDate }) {
    const principal = parseFloat(principalAmount);
    const rate = parseFloat(annualInterestRate);
    const tenure = parseInt(tenureMonths, 10);
    const disbDate = disbursementDate ? new Date(disbursementDate) : new Date();

    const monthlyRate = rate / 12 / 100;
    let emiAmount = 0;

    if (monthlyRate === 0) {
      emiAmount = Math.round((principal / tenure) * 100) / 100;
    } else {
      emiAmount = Math.round(((principal * monthlyRate * Math.pow(1 + monthlyRate, tenure)) / (Math.pow(1 + monthlyRate, tenure) - 1)) * 100) / 100;
    }

    const totalPayable = emiAmount * tenure;
    const totalInterest = totalPayable - principal;

    let outBalance = principal;
    let dueDate = new Date(disbDate);
    dueDate.setMonth(dueDate.getMonth() + 1);

    const installments = [];

    for (let i = 1; i <= tenure; i++) {
      let instPrincipal = 0;
      let instInterest = 0;

      if (i === tenure) {
        // Last installment adjusts rounding differences
        instPrincipal = outBalance;
        instInterest = Math.round((emiAmount - instPrincipal) * 100) / 100;
        if (instInterest < 0) {
          instInterest = 0;
          emiAmount = instPrincipal; // Adjust last EMI
        }
      } else {
        instInterest = Math.round((outBalance * monthlyRate) * 100) / 100;
        instPrincipal = Math.round((emiAmount - instInterest) * 100) / 100;
      }

      const openingBalance = Math.round((outBalance + instPrincipal) * 100) / 100; // Not perfectly accurate, but outBalance is opening balance BEFORE deducting principal. Wait, SQL has: ROUND(v_out_balance + v_inst_principal, 2) which is outBalance before subtraction.
      
      outBalance = Math.round((outBalance - instPrincipal) * 100) / 100;

      installments.push({
        installmentNumber: i,
        dueDate: new Date(dueDate),
        openingBalance: Math.round((outBalance + instPrincipal) * 100) / 100,
        principalAmount: instPrincipal,
        interestAmount: instInterest,
        totalAmount: emiAmount,
        remainingAmount: emiAmount,
        closingBalance: outBalance,
        status: 'PENDING'
      });

      dueDate.setMonth(dueDate.getMonth() + 1);
    }

    return {
      emiAmount,
      totalInterest: Math.round(totalInterest * 100) / 100,
      totalPayable: Math.round(totalPayable * 100) / 100,
      installments
    };
  }

  /**
   * Bulk insert installments within a transaction.
   * @param {Object} connection - MySQL connection (from pool.getConnection())
   * @param {number} loanId 
   * @param {Array} installments 
   */
  static async insertInstallments(connection, loanId, installments) {
    const values = installments.map(inst => [
      loanId,
      inst.installmentNumber,
      inst.dueDate.toISOString().split('T')[0],
      inst.openingBalance,
      inst.principalAmount,
      inst.interestAmount,
      inst.totalAmount,
      inst.remainingAmount,
      inst.closingBalance,
      inst.status
    ]);

    const query = `
      INSERT INTO loan_installments (
        loan_id, installment_number, due_date, opening_balance,
        principal_amount, interest_amount, total_amount, remaining_amount,
        closing_balance, installment_status
      ) VALUES ?
    `;

    await connection.query(query, [values]);
  }
}
