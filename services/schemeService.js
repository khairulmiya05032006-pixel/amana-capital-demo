import db from '../config/db.js';

class SchemeService {
  /**
   * List all schemes based on filters
   */
  static async listSchemes(filters = {}) {
    let query = `
      SELECT s.*, 
        (SELECT COUNT(*) FROM loan_scheme_snapshots WHERE scheme_code = s.scheme_code AND scheme_version = s.version) as enrolled_count
      FROM loan_schemes s
      WHERE 1=1
    `;
    const params = [];

    if (filters.status) {
      query += ` AND s.status = ?`;
      params.push(filters.status);
    }
    
    if (filters.repayment_frequency) {
      query += ` AND s.repayment_frequency = ?`;
      params.push(filters.repayment_frequency);
    }

    if (filters.search) {
      query += ` AND (s.scheme_name LIKE ? OR s.scheme_code LIKE ?)`;
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    query += ` ORDER BY s.created_at DESC`;

    const [rows] = await db.query(query, params);
    return rows;
  }

  /**
   * Get a specific scheme by ID
   */
  static async getSchemeById(id, connection = null) {
    const conn = connection || db;
    const [rows] = await conn.query(`SELECT * FROM loan_schemes WHERE id = ?`, [id]);
    if (rows.length === 0) throw new Error('Scheme not found');
    return rows[0];
  }

  /**
   * Get the active version of a scheme by code
   */
  static async getActiveSchemeByCode(code) {
    const [rows] = await db.query(`SELECT * FROM loan_schemes WHERE scheme_code = ? AND status = 'ACTIVE' LIMIT 1`, [code]);
    if (rows.length === 0) throw new Error('Active scheme not found for code: ' + code);
    return rows[0];
  }

  /**
   * Create a new scheme (DRAFT or ACTIVE)
   */
  static async createScheme(data, userId) {
    const {
      scheme_code, scheme_name, description, status = 'DRAFT',
      interest_type, base_interest_rate, repayment_frequency,
      duration_value, duration_unit, penalty_mode
    } = data;

    // Process penalty fields based on mode
    let penalty_type = 'NONE';
    let penalty_value = 0.00;
    let grace_period_days = 0;
    let processing_fee_type = data.processing_fee_type || 'FIXED';
    let processing_fee_value = data.processing_fee_value || 0;

    if (penalty_mode === 'CUSTOM') {
      penalty_type = data.penalty_type || 'PERCENTAGE';
      penalty_value = penalty_type === 'FIXED' ? (data.penalty_value_fixed || 0) : (data.penalty_value || 0);
      grace_period_days = data.grace_period_days || 0;
    }

    // Ensure code is unique for version 1
    const [existing] = await db.query(`SELECT id FROM loan_schemes WHERE scheme_code = ? AND version = 1`, [scheme_code]);
    if (existing.length > 0) throw new Error('Scheme code already exists');

    const [result] = await db.query(`
      INSERT INTO loan_schemes (
        scheme_code, scheme_name, description, version, status,
        interest_type, base_interest_rate, repayment_frequency,
        duration_value, duration_unit, grace_period_days,
        penalty_type, penalty_value, processing_fee_type, processing_fee_value,
        penalty_mode, created_by
      ) VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      scheme_code, scheme_name, description, status,
      interest_type, base_interest_rate, repayment_frequency,
      duration_value, duration_unit, grace_period_days,
      penalty_type, penalty_value, processing_fee_type, processing_fee_value,
      penalty_mode || 'INHERIT_FREQUENCY_DEFAULT', userId
    ]);

    await this.logSchemeAction(userId, result.insertId, 'SCHEME_CREATED', data);
    return result.insertId;
  }

  /**
   * Update a DRAFT scheme (If ACTIVE, must clone)
   */
  static async updateScheme(id, data, userId) {
    const scheme = await this.getSchemeById(id);
    
    if (scheme.status !== 'DRAFT') {
      throw new Error('Only DRAFT schemes can be modified. Please clone the active scheme to create a new version.');
    }

    const {
      scheme_name, description, status,
      interest_type, base_interest_rate, repayment_frequency,
      duration_value, duration_unit, penalty_mode
    } = data;

    let penalty_type = 'NONE';
    let penalty_value = 0.00;
    let grace_period_days = 0;
    let processing_fee_type = data.processing_fee_type || scheme.processing_fee_type;
    let processing_fee_value = data.processing_fee_value || scheme.processing_fee_value;

    if (penalty_mode === 'CUSTOM') {
      penalty_type = data.penalty_type || 'PERCENTAGE';
      penalty_value = penalty_type === 'FIXED' ? (data.penalty_value_fixed || 0) : (data.penalty_value || 0);
      grace_period_days = data.grace_period_days || 0;
    }

    await db.query(`
      UPDATE loan_schemes SET
        scheme_name = ?, description = ?, status = COALESCE(?, status),
        interest_type = ?, base_interest_rate = ?, repayment_frequency = ?,
        duration_value = ?, duration_unit = ?, grace_period_days = ?,
        penalty_type = ?, penalty_value = ?, processing_fee_type = ?, processing_fee_value = ?,
        penalty_mode = ?
      WHERE id = ?
    `, [
      scheme_name, description, status,
      interest_type, base_interest_rate, repayment_frequency,
      duration_value, duration_unit, grace_period_days,
      penalty_type, penalty_value, processing_fee_type, processing_fee_value,
      penalty_mode || 'INHERIT_FREQUENCY_DEFAULT',
      id
    ]);

    await this.logSchemeAction(userId, id, 'SCHEME_UPDATED', data);
    return true;
  }

  /**
   * Clone a scheme into a new version (or completely new code)
   * If isNewVersion = true, it increments the version of the same scheme_code.
   * If isNewVersion = false, it uses a new scheme_code provided in data.
   */
  static async cloneScheme(id, data, isNewVersion, userId) {
    const parentScheme = await this.getSchemeById(id);
    
    let newVersion = 1;
    let newCode = data.scheme_code;
    let newStatus = 'DRAFT'; // Clones are always draft initially

    if (isNewVersion) {
      newCode = parentScheme.scheme_code;
      // Find max version
      const [maxVerRow] = await db.query(`SELECT MAX(version) as max_v FROM loan_schemes WHERE scheme_code = ?`, [newCode]);
      newVersion = (maxVerRow[0].max_v || 0) + 1;
      
      // Auto-archive or inactivate previous active versions if the new one becomes active?
      // Usually that's done explicitly when publishing the new version.
    }

    const [result] = await db.query(`
      INSERT INTO loan_schemes (
        scheme_code, scheme_name, description, version, parent_scheme_id, status,
        interest_type, base_interest_rate, repayment_frequency,
        duration_value, duration_unit, grace_period_days,
        penalty_type, penalty_value, processing_fee_type, processing_fee_value,
        created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      newCode, 
      data.scheme_name || parentScheme.scheme_name, 
      data.description || parentScheme.description, 
      newVersion, 
      parentScheme.id, 
      newStatus,
      data.interest_type || parentScheme.interest_type, 
      data.base_interest_rate || parentScheme.base_interest_rate, 
      data.repayment_frequency || parentScheme.repayment_frequency,
      data.duration_value || parentScheme.duration_value, 
      data.duration_unit || parentScheme.duration_unit, 
      data.grace_period_days || parentScheme.grace_period_days,
      data.penalty_type || parentScheme.penalty_type, 
      data.penalty_value || parentScheme.penalty_value, 
      data.processing_fee_type || parentScheme.processing_fee_type, 
      data.processing_fee_value || parentScheme.processing_fee_value,
      userId
    ]);

    await this.logSchemeAction(userId, result.insertId, 'SCHEME_CLONED', { parent_id: parentScheme.id, new_version: newVersion });
    return result.insertId;
  }

  /**
   * Change scheme status (e.g., ACTIVE, INACTIVE, ARCHIVED)
   */
  static async changeStatus(id, newStatus, userId) {
    const scheme = await this.getSchemeById(id);
    
    // If activating a new version, optionally mark previous versions INACTIVE
    if (newStatus === 'ACTIVE') {
      await db.query(`UPDATE loan_schemes SET status = 'INACTIVE' WHERE scheme_code = ? AND id != ? AND status = 'ACTIVE'`, [scheme.scheme_code, id]);
    }

    await db.query(`UPDATE loan_schemes SET status = ? WHERE id = ?`, [newStatus, id]);
    await this.logSchemeAction(userId, id, `SCHEME_STATUS_${newStatus}`, { previous_status: scheme.status });
    
    return true;
  }

  /**
   * Utility for logging actions
   */
  static async logSchemeAction(userId, schemeId, action, details) {
    await db.query(`
      INSERT INTO audit_logs (user_id, module_name, entity_name, entity_id, action, new_values)
      VALUES (?, 'LoanSchemes', 'loan_schemes', ?, ?, ?)
    `, [userId, schemeId, action, JSON.stringify(details)]);
  }
}

export default SchemeService;
