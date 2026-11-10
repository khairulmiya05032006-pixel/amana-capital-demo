import db from '../config/db.js';

class PenaltyPolicyService {
  /**
   * Fetch current penalty settings for all frequencies
   */
  static async getAllPolicies(pool = db) {
    const [rows] = await pool.query('SELECT * FROM penalty_settings');
    const policies = {};
    for (const r of rows) {
      policies[r.repayment_frequency] = r;
    }
    return policies;
  }

  /**
   * Fetch current penalty setting for a specific frequency
   */
  static async getPolicy(frequency, pool = db) {
    const [rows] = await pool.query('SELECT * FROM penalty_settings WHERE repayment_frequency = ?', [frequency]);
    if (rows.length === 0) return null;
    return rows[0];
  }

  /**
   * Update penalty settings for all frequencies provided, incrementing version
   */
  static async updatePolicies(connection, data, userId = 1, ipAddress = '127.0.0.1') {
    const frequencies = ['DAILY', 'WEEKLY', 'MONTHLY'];
    
    for (const freq of frequencies) {
      if (data[freq]) {
        const config = data[freq];
        const currentPolicy = await this.getPolicy(freq, connection);
        const newVersion = currentPolicy && currentPolicy.version ? currentPolicy.version + 1 : 1;

        await connection.query(`
          INSERT INTO penalty_settings 
          (repayment_frequency, penalty_rate, fixed_penalty_amount, grace_period_days, calculation_method, auto_apply, maximum_penalty_cap, updated_by, version, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
          ON DUPLICATE KEY UPDATE 
            penalty_rate = VALUES(penalty_rate),
            fixed_penalty_amount = VALUES(fixed_penalty_amount),
            grace_period_days = VALUES(grace_period_days),
            calculation_method = VALUES(calculation_method),
            auto_apply = VALUES(auto_apply),
            maximum_penalty_cap = VALUES(maximum_penalty_cap),
            updated_by = VALUES(updated_by),
            version = VALUES(version),
            updated_at = NOW()
        `, [
          freq,
          parseFloat(config.penalty_rate) || 0,
          parseFloat(config.fixed_penalty_amount) || 0,
          parseInt(config.grace_period_days, 10) || 0,
          config.calculation_method || 'PERCENTAGE_OF_OVERDUE',
          config.auto_apply === 'ENABLED' || config.auto_apply === 'true' || config.auto_apply === true || config.auto_apply === 1,
          parseFloat(config.maximum_penalty_cap) || 0,
          userId,
          newVersion
        ]);
      }
    }

    // Log update in audit_logs
    await connection.query(`
      INSERT INTO audit_logs (
        user_id, module_name, entity_name, action, description, ip_address, created_at
      ) VALUES (?, 'SETTINGS', 'penalty_settings', 'UPDATE', 'Updated Frequency-Based Penalty Settings', ?, NOW())
    `, [userId, ipAddress]);
  }
}

export default PenaltyPolicyService;
