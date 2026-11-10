/**
 * Generates a standard loan number (e.g. LN-20260808-000123)
 * @param {number} loanId - The primary key ID of the loan record
 * @returns {string} The formatted loan number
 */
export function generateLoanNumber(loanId) {
  const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const idStr = loanId.toString().padStart(6, '0');
  return `LN-${dateStr}-${idStr}`;
}
