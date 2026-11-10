import db from '../config/db.js';
import exceljs from 'exceljs';
import { createRequire } from 'module';
import { PassThrough } from 'stream';
const require = createRequire(import.meta.url);
const archiver = require('archiver');
const { createObjectCsvStringifier } = require('csv-writer');

class CustomerExportService {
  
  static getBaseFilterSql(filters) {
    let joinSql = `
      JOIN users u ON c.user_id = u.id
      LEFT JOIN loans l ON c.id = l.customer_id
      LEFT JOIN loan_scheme_snapshots lss ON l.id = lss.loan_id
    `;
    let whereSql = `WHERE u.role = 'CUSTOMER'`;
    const params = [];

    if (filters.frequency && filters.frequency !== 'ALL') {
      whereSql += ` AND lss.repayment_frequency = ? AND l.loan_status IN ('ACTIVE', 'OVERDUE')`;
      params.push(filters.frequency);
    }

    if (filters.searchQuery) {
      const q = `%${filters.searchQuery}%`;
      whereSql += ` AND (
        c.full_name LIKE ? OR 
        u.email LIKE ? OR 
        c.phone LIKE ? OR 
        c.customer_code LIKE ? OR 
        l.loan_number LIKE ?
      )`;
      params.push(q, q, q, q, q);
    }

    return { joinSql, whereSql, params };
  }

  static sanitizeValue(val) {
    if (val === null || val === undefined) return '';
    let str = String(val);
    if (/^[=+\-@]/.test(str)) {
      return "'" + str; // prevent CSV/Excel injection
    }
    return str;
  }

  static maskAadhaar(val) {
    if (!val) return 'N/A';
    return val.replace(/.(?=.{4})/g, 'X');
  }

  static maskPan(val) {
    if (!val) return 'N/A';
    return val.replace(/.(?=.{4})/g, 'X');
  }

  // --- SQL Generators ---

  static async getCustomersBatch(connection, joinSql, whereSql, params, limit, offset) {
    const sql = `
      SELECT DISTINCT 
        c.id as 'Customer ID',
        c.customer_code as 'Customer Code',
        c.full_name as 'Full Name',
        u.email as 'Email',
        c.phone as 'Phone',
        c.date_of_birth as 'Date of Birth',
        c.gender as 'Gender',
        c.address as 'Address',
        c.aadhaar_number as 'Aadhaar',
        c.pan_number as 'PAN',
        c.occupation as 'Occupation',
        c.monthly_income as 'Monthly Income',
        u.account_status as 'Status',
        c.created_at as 'Registration Date'
      FROM customer_profiles c
      ${joinSql}
      ${whereSql}
      ORDER BY c.id ASC
      LIMIT ? OFFSET ?
    `;
    const [rows] = await connection.query(sql, [...params, limit, offset]);
    return rows.map(r => ({
      ...r,
      Aadhaar: this.maskAadhaar(r.Aadhaar),
      PAN: this.maskPan(r.PAN)
    }));
  }

  static async getLoansBatch(connection, joinSql, whereSql, params, limit, offset) {
    const sql = `
      SELECT DISTINCT
        l.id as 'Loan ID',
        l.loan_number as 'Loan Number',
        c.id as 'Customer ID',
        c.customer_code as 'Customer Code',
        lss.scheme_name as 'Scheme Name',
        lss.repayment_frequency as 'Frequency',
        l.principal_amount as 'Principal Amount',
        lss.interest_rate as 'Interest Rate',
        lss.interest_type as 'Interest Type',
        lss.duration_value as 'Duration Value',
        lss.duration_unit as 'Duration Unit',
        l.loan_status as 'Status',
        l.application_id as 'Application ID',
        l.created_at as 'Approval Date',
        l.disbursement_date as 'Disbursement Date',
        l.maturity_date as 'Maturity Date',
        l.outstanding_balance as 'Outstanding Balance'
      FROM loans l
      JOIN customer_profiles c ON l.customer_id = c.id
      JOIN users u ON c.user_id = u.id
      LEFT JOIN loan_scheme_snapshots lss ON l.id = lss.loan_id
      ${whereSql.replace('WHERE ', 'WHERE l.id IS NOT NULL AND ')}
      ORDER BY l.id ASC
      LIMIT ? OFFSET ?
    `;
    const [rows] = await connection.query(sql, [...params, limit, offset]);
    return rows;
  }

  static async getInstallmentsBatch(connection, joinSql, whereSql, params, limit, offset) {
    const sql = `
      SELECT DISTINCT
        i.id as 'Installment ID',
        l.loan_number as 'Loan Number',
        i.installment_number as 'Installment No',
        i.due_date as 'Due Date',
        i.principal_amount as 'Principal Amount',
        i.interest_amount as 'Interest Amount',
        i.total_amount as 'Scheduled Amount',
        i.paid_amount as 'Amount Paid',
        i.remaining_amount as 'Remaining Amount',
        i.installment_status as 'Status',
        i.penalty_amount as 'Penalty Amount'
      FROM loan_installments i
      JOIN loans l ON i.loan_id = l.id
      JOIN customer_profiles c ON l.customer_id = c.id
      JOIN users u ON c.user_id = u.id
      LEFT JOIN loan_scheme_snapshots lss ON l.id = lss.loan_id
      ${whereSql.replace('WHERE ', 'WHERE i.id IS NOT NULL AND ')}
      ORDER BY i.id ASC
      LIMIT ? OFFSET ?
    `;
    const [rows] = await connection.query(sql, [...params, limit, offset]);
    return rows;
  }

  static async getPaymentsBatch(connection, joinSql, whereSql, params, limit, offset) {
    const sql = `
      SELECT DISTINCT
        p.id as 'Payment ID',
        p.receipt_number as 'Receipt Ref',
        p.transaction_reference as 'Transaction Ref',
        l.loan_number as 'Loan Number',
        c.customer_code as 'Customer Code',
        p.payment_amount as 'Payment Amount',
        p.payment_method as 'Method',
        p.payment_date as 'Payment Date',
        p.payment_status as 'Status'
      FROM payments p
      JOIN loans l ON p.loan_id = l.id
      JOIN customer_profiles c ON p.customer_id = c.id
      JOIN users u ON c.user_id = u.id
      LEFT JOIN loan_scheme_snapshots lss ON l.id = lss.loan_id
      ${whereSql.replace('WHERE ', 'WHERE p.id IS NOT NULL AND ')}
      ORDER BY p.id ASC
      LIMIT ? OFFSET ?
    `;
    const [rows] = await connection.query(sql, [...params, limit, offset]);
    return rows;
  }

  // --- Export Generators ---

  static async generateExcelStream(filters, res) {
    const connection = await db.getConnection();
    let totalExported = 0;
    try {
      const { joinSql, whereSql, params } = this.getBaseFilterSql(filters);
      
      const pass = new PassThrough();
      pass.pipe(res);

      const workbook = new exceljs.stream.xlsx.WorkbookWriter({ 
        stream: pass, 
        useStyles: true, 
        useSharedStrings: true 
      });
      
      // Setup sheets
      const summarySheet = workbook.addWorksheet('Summary');
      const customersSheet = workbook.addWorksheet('Customers');
      const loansSheet = workbook.addWorksheet('Loans');
      const installmentsSheet = workbook.addWorksheet('Installments');
      const paymentsSheet = workbook.addWorksheet('Payments');

      summarySheet.columns = [
        { header: 'Property', key: 'prop', width: 30 },
        { header: 'Value', key: 'val', width: 50 }
      ];
      summarySheet.addRow({ prop: 'Export Date', val: new Date().toLocaleString() });
      summarySheet.addRow({ prop: 'Filter Frequency', val: filters.frequency || 'ALL' });
      summarySheet.addRow({ prop: 'Filter Search', val: filters.searchQuery || 'None' });

      const batchSize = 1000;

      // Helper to process batches
      const processSheet = async (sheet, fetchFn) => {
        let offset = 0;
        let isFirstBatch = true;
        while (true) {
          const rows = await fetchFn(connection, joinSql, whereSql, params, batchSize, offset);
          if (rows.length === 0) break;
          
          if (isFirstBatch) {
            sheet.columns = Object.keys(rows[0]).map(k => ({ header: k, key: k, width: 20 }));
            isFirstBatch = false;
          }
          
          rows.forEach(row => {
            const safeRow = {};
            for (const key in row) safeRow[key] = this.sanitizeValue(row[key]);
            sheet.addRow(safeRow).commit();
            totalExported++;
          });
          
          offset += batchSize;
        }
      };

      await processSheet(customersSheet, this.getCustomersBatch.bind(this));
      await processSheet(loansSheet, this.getLoansBatch.bind(this));
      await processSheet(installmentsSheet, this.getInstallmentsBatch.bind(this));
      await processSheet(paymentsSheet, this.getPaymentsBatch.bind(this));

      summarySheet.commit();
      customersSheet.commit();
      loansSheet.commit();
      installmentsSheet.commit();
      paymentsSheet.commit();

      await workbook.commit();
      return totalExported;
    } finally {
      connection.release();
    }
  }

  static async generateCsvZipStream(filters, res) {
    const connection = await db.getConnection();
    let totalExported = 0;
    try {
      const { joinSql, whereSql, params } = this.getBaseFilterSql(filters);
      
      const archive = new archiver.ZipArchive({ zlib: { level: 9 } });
      archive.pipe(res);

      const batchSize = 1000;

      const appendCsvToArchive = async (filename, fetchFn) => {
        let offset = 0;
        let isFirstBatch = true;
        let stringifier = null;
        const pass = new PassThrough();
        archive.append(pass, { name: filename });
        
        while (true) {
          const rows = await fetchFn(connection, joinSql, whereSql, params, batchSize, offset);
          if (rows.length === 0) break;
          
          const sanitizedRows = rows.map(row => {
            const safeRow = {};
            for (const key in row) safeRow[key] = this.sanitizeValue(row[key]);
            totalExported++;
            return safeRow;
          });

          if (isFirstBatch) {
            const headers = Object.keys(sanitizedRows[0]).map(k => ({ id: k, title: k }));
            stringifier = createObjectCsvStringifier({ header: headers });
            pass.write(stringifier.getHeaderString());
            isFirstBatch = false;
          }
          
          pass.write(stringifier.stringifyRecords(sanitizedRows));
          offset += batchSize;
        }
        
        pass.end();
      };

      await appendCsvToArchive('customers.csv', this.getCustomersBatch.bind(this));
      await appendCsvToArchive('loans.csv', this.getLoansBatch.bind(this));
      await appendCsvToArchive('installments.csv', this.getInstallmentsBatch.bind(this));
      await appendCsvToArchive('payments.csv', this.getPaymentsBatch.bind(this));

      const summaryStr = `Property,Value\nExport Date,"${new Date().toLocaleString()}"\nFilter Frequency,"${filters.frequency || 'ALL'}"\nFilter Search,"${filters.searchQuery || 'None'}"\n`;
      archive.append(summaryStr, { name: 'summary.csv' });

      await archive.finalize();
      return totalExported;
    } finally {
      connection.release();
    }
  }
}

export default CustomerExportService;
