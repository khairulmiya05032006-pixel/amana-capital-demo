import db from '../config/db.js';
import DisbursementService from '../services/disbursementService.js';
import LoanSchemeAssignmentService from '../services/loanSchemeAssignmentService.js';

async function runTests() {
  console.log("=== RUNNING REFACTOR E2E TESTS ===");
  try {
    console.log("Mocking admin_account treasury and unified loan schemes...");
    await db.query("INSERT INTO admin_account (id, balance) VALUES (1, 10000.00) ON DUPLICATE KEY UPDATE balance = 10000.00");
    await db.query(`
      INSERT INTO loan_schemes (id, scheme_code, scheme_name, interest_type, base_interest_rate, repayment_frequency, duration_value, duration_unit, status)
      VALUES (1, 'TEST-M', 'Test Monthly', 'FLAT', 12.00, 'MONTHLY', 12, 'MONTHS', 'ACTIVE')
      ON DUPLICATE KEY UPDATE status = 'ACTIVE'
    `);

    // Clean up
    await db.query("DELETE FROM loan_installments WHERE loan_id IN (SELECT id FROM loans WHERE application_id >= 10000)");
    await db.query("DELETE FROM loan_transactions WHERE loan_id IN (SELECT id FROM loans WHERE application_id >= 10000)");
    await db.query("DELETE FROM loan_scheme_snapshots WHERE loan_id IN (SELECT id FROM loans WHERE application_id >= 10000)");
    await db.query("DELETE FROM loans WHERE application_id >= 10000");
    await db.query("DELETE FROM loan_applications WHERE id >= 10000");
    await db.query("DELETE FROM customer_profiles WHERE id >= 10000");

    // Insert Mock Customer
    await db.query("INSERT IGNORE INTO users (id, role, email, password_hash) VALUES (10000, 'CUSTOMER', 'test@test.com', 'pwd')");
    await db.query("INSERT IGNORE INTO customer_profiles (id, user_id, full_name, customer_code) VALUES (10000, 10000, 'Test User', 'CUST-10000')");
    
    // Insert Mock Scheme
    await db.query("DELETE FROM loan_schemes WHERE id >= 10000");
    await db.query("INSERT INTO loan_schemes (id, scheme_code, scheme_name, repayment_frequency, interest_type, base_interest_rate, duration_value, duration_unit, status) VALUES (10000, 'SCH-TEST', 'Test Scheme', 'DAILY', 'FLAT', 10.0, 30, 'DAYS', 'ACTIVE')");

    console.log("\n--- TEST 1: APPLICATION PENDING ---");
    const [appResult] = await db.query(`
      INSERT INTO loan_applications (id, application_number, customer_id, loan_type_id, requested_amount, requested_duration_months, purpose, monthly_income, application_status)
      VALUES (10000, 'APP-TEST-1', 10000, 1, 10000, 1, 'Test', 50000, 'PENDING')
    `);
    let [loans] = await db.query("SELECT * FROM loans WHERE application_id = 10000");
    console.log(`Loans created for pending application: ${loans.length} (Expected: 0)`);

    console.log("\n--- TEST 2: APPROVAL ---");
    await db.query(`
      UPDATE loan_applications SET 
      application_status = 'APPROVED', loan_type_id = 1, requested_amount = 500, requested_interest_rate = 12.0, requested_duration_months = 30, reviewed_by = 1
      WHERE id = 10000
    `);
    [loans] = await db.query("SELECT * FROM loans WHERE application_id = 10000");
    const [app] = await db.query("SELECT * FROM loan_applications WHERE id = 10000");
    console.log(`Loans created after approval: ${loans.length} (Expected: 0)`);
    console.log(`Application loan_scheme_id: ${app[0].loan_scheme_id} (Expected: 1)`);

    console.log("\n--- TEST 3: DISBURSEMENT ---");
    const adminId = 1; // Assuming admin ID 1 exists
    const disburseResult = await DisbursementService.disburseApplication(10000, adminId);
    console.log("Disbursement Result:", disburseResult.success ? 'SUCCESS' : 'FAILED');
    
    [loans] = await db.query("SELECT * FROM loans WHERE application_id = 10000");
    const [snapshots] = await db.query("SELECT * FROM loan_scheme_snapshots WHERE loan_id = ?", [loans[0].id]);
    const [installments] = await db.query("SELECT * FROM loan_installments WHERE loan_id = ?", [loans[0].id]);
    const [transactions] = await db.query("SELECT * FROM loan_transactions WHERE loan_id = ?", [loans[0].id]);
    console.log(`Loans created: ${loans.length} (Expected: 1)`);
    console.log(`Snapshots created: ${snapshots.length} (Expected: 1)`);
    console.log(`Installments created: ${installments.length} (Expected: > 0)`);
    console.log(`Transactions created: ${transactions.length} (Expected: 1)`);

    console.log("\n--- TEST 4: DOUBLE DISBURSEMENT ---");
    try {
      await DisbursementService.disburseApplication(10000, adminId);
      console.log("Second disbursement SUCCEEDED (Expected: FAILURE!)");
    } catch (e) {
      console.log("Second disbursement FAILED as expected with error:", e.message);
    }

    console.log("\n--- TEST 5: FAILED DISBURSEMENT ROLLBACK ---");
    // Create another approved application
    await db.query(`
      INSERT INTO loan_applications (id, application_number, customer_id, loan_type_id, requested_amount, requested_duration_months, purpose, monthly_income, application_status, reviewed_by)
      VALUES (10001, 'APP-TEST-2', 10000, 1, 500, 1, 'Test', 50000, 'APPROVED', 1)
    `);
    
    // Monkey-patch ScheduleService to throw error
    const originalGenerate = LoanSchemeAssignmentService.assignAndGenerateSchedule;
    LoanSchemeAssignmentService.assignAndGenerateSchedule = async () => {
      throw new Error("Simulated schedule generation failure");
    };

    try {
      await DisbursementService.disburseApplication(10001, adminId);
      console.log("Rollback test SUCCEEDED (Expected: FAILURE!)");
    } catch (e) {
      console.log("Rollback test caught error:", e.message);
    }

    // Verify nothing was persisted
    let [loansRollback] = await db.query("SELECT * FROM loans WHERE application_id = 10001");
    console.log(`Loans created for failed disbursement: ${loansRollback.length} (Expected: 0)`);
    
    LoanSchemeAssignmentService.assignAndGenerateSchedule = originalGenerate; // restore

  } catch (err) {
    console.error("Test Error:", err);
  } finally {
    process.exit(0);
  }
}

runTests();
