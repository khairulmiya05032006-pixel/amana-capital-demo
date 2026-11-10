import logger from '../utils/logger.js';
import db from '../config/db.js';

/**
 * Notification Service
 * A reusable service to mock sending emails/SMS to customers and store a log in the database.
 */
class NotificationService {
  
  /**
   * Send a notification
   * @param {Object} params
   * @param {number} params.userId - The ID of the user to notify
   * @param {number|null} params.loanId - Associated loan ID (optional)
   * @param {string} params.type - E.g. 'LOAN_APPROVED', 'LOAN_DISBURSED', 'PAYMENT_SUCCESS'
   * @param {string} params.channel - 'EMAIL' or 'SMS'
   * @param {string} params.recipient - Email address or phone number
   * @param {string} params.subject - The subject of the message
   * @param {string} params.message - The body of the message
   * @param {Object} params.metadata - Any additional JSON data
   */
  async sendNotification({ userId, loanId = null, type, channel = 'EMAIL', recipient, subject, message, metadata = {} }) {
    try {
      // 1. Mock the sending process
      logger.info(`\n================= [NOTIFICATION SERVICE] =================`);
      logger.info(`[${new Date().toISOString()}] Sending ${channel} to ${recipient}`);
      logger.info(`Type: ${type} | Subject: ${subject}`);
      logger.info(`Message: \n${message}`);
      logger.info(`==========================================================\n`);

      // 2. Log to database
      await db.query(`
        INSERT INTO notifications_log 
          (user_id, loan_id, type, channel, recipient, subject, message, status, metadata, sent_at)
        VALUES 
          (?, ?, ?, ?, ?, ?, ?, 'SENT', ?, CURRENT_TIMESTAMP)
      `, [userId, loanId, type, channel, recipient, subject, message, JSON.stringify(metadata)]);

      return { success: true };
    } catch (error) {
      logger.error('Error sending notification:', error);
      // Even if logging fails, we generally don't want to crash the main transaction
      return { success: false, error: error.message };
    }
  }

  // Helper method: Loan Approved
  async sendLoanApproved(user, applicationNumber) {
    return this.sendNotification({
      userId: user.id,
      type: 'LOAN_APPROVED',
      recipient: user.email,
      subject: 'Loan Application Approved!',
      message: `Dear Customer,\n\nWe are pleased to inform you that your loan application (${applicationNumber}) has been approved.\nFunds will be disbursed shortly.\n\nThank you,\nAmanah Capital Team`
    });
  }

  // Helper method: Loan Disbursed
  async sendLoanDisbursed(user, loanNumber, amount) {
    return this.sendNotification({
      userId: user.id,
      type: 'LOAN_DISBURSED',
      recipient: user.email,
      subject: 'Loan Funds Disbursed',
      message: `Dear Customer,\n\nYour loan (${loanNumber}) for the amount of ${amount} has been successfully disbursed to your registered account.\nYou can view your full EMI schedule in the Customer Dashboard.\n\nThank you,\nAmanah Capital Team`
    });
  }

  // Helper method: Payment Success
  async sendPaymentReceipt(user, loanNumber, amount, txnId) {
    return this.sendNotification({
      userId: user.id,
      type: 'PAYMENT_SUCCESS',
      recipient: user.email,
      subject: 'Payment Receipt',
      message: `Dear Customer,\n\nWe have successfully received your payment of ${amount} towards loan ${loanNumber}.\nTransaction ID: ${txnId}\n\nThank you for paying on time!\nAmanah Capital Team`
    });
  }

  // Helper method: Loan Closed
  async sendLoanClosed(user, loanNumber) {
    return this.sendNotification({
      userId: user.id,
      type: 'LOAN_CLOSED',
      recipient: user.email,
      subject: 'Loan Successfully Closed',
      message: `Congratulations!\n\nYour loan (${loanNumber}) has been fully repaid and is now closed.\nThank you for choosing Amanah Capital.\n\nAmanah Capital Team`
    });
  }
}

export default new NotificationService();
