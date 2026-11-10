import db from '../config/db.js';

// Configuration
const NUM_RECORDS = 1000;
const BATCH_SIZE = 100;
const STATIC_PASSWORD_HASH = '$2b$10$tZ26fJmR.gO9x/5N2sJ.I.Z/0pZtU0L28b8uU/NqJ9X/3G5Z8O2sC'; // Hash for "password123"

// Helper to generate random Indian names
const firstNames = ['Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Krishna', 'Ishaan', 'Shaurya', 'Ananya', 'Diya', 'Advika', 'Jiya', 'Sana', 'Aadya', 'Kavya', 'Pari', 'Khushi', 'Bhavya', 'Neha', 'Rahul', 'Amit', 'Pooja', 'Vikram'];
const lastNames = ['Sharma', 'Verma', 'Gupta', 'Patel', 'Singh', 'Kumar', 'Das', 'Reddy', 'Rao', 'Chauhan', 'Mehta', 'Yadav', 'Pandey', 'Nair', 'Bose'];
const generateName = () => `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`;
const generatePhone = () => `9${Math.floor(Math.random() * 900000000 + 100000000)}`;
const generatePAN = () => `${String.fromCharCode(...Array(5).fill(0).map(()=>Math.random()*26+65))}${Math.floor(Math.random()*9000+1000)}${String.fromCharCode(Math.random()*26+65)}`;
const generateAadhaar = () => `${Math.floor(Math.random() * 900000000000 + 100000000000)}`;

// Date math helper
const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};
const addMonths = (date, months) => {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
};

// Batch Insert Helper
const insertInBatches = async (connection, table, columns, data) => {
  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    const batch = data.slice(i, i + BATCH_SIZE);
    const placeholders = batch.map(() => `(${columns.map(() => '?').join(',')})`).join(',');
    const flatData = batch.flat();
    await connection.query(`INSERT INTO ${table} (${columns.join(',')}) VALUES ${placeholders}`, flatData);
  }
};

async function runSeeder() {
  console.log(`🚀 Starting Database Seeder: Generating ${NUM_RECORDS} lifecycle records...`);
  const startTime = Date.now();
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // 0. Ensure we have at least one loan type
    const [existingTypes] = await connection.query('SELECT id, minimum_duration_months, maximum_duration_months, minimum_interest_rate, minimum_amount FROM loan_types WHERE is_active = 1 LIMIT 3');
    let loanTypes = existingTypes;
    
    if (loanTypes.length === 0) {
      console.log('⚠️ No active loan types found. Creating default schemes...');
      await connection.query(`
        INSERT INTO loan_types (loan_type_code, loan_name, maximum_amount, minimum_interest_rate, maximum_interest_rate, minimum_duration_months, maximum_duration_months, is_active)
        VALUES 
        ('PERSONAL_LOAN', 'Personal Loan', 500000, 10, 15, 6, 36, 1),
        ('BUSINESS_LOAN', 'Business Loan', 1000000, 12, 18, 12, 60, 1)
      `);
      const [newTypes] = await connection.query('SELECT id, minimum_duration_months, maximum_duration_months, minimum_interest_rate, minimum_amount FROM loan_types WHERE is_active = 1');
      loanTypes = newTypes;
    }

    // 1. Phase 1: User & Customer Generation
    console.log(`\n👥 Phase 1: Generating ${NUM_RECORDS} Users and Customer Profiles...`);
    const usersData = [];
    const profilesData = [];
    
    const createdCustomers = [];
    
    for (let i = 0; i < NUM_RECORDS; i++) {
      const userCode = `U-${i.toString().padStart(6, '0')}`;
      const email = `test.user${Date.now()}${i}@example.com`;
      
      const [userRes] = await connection.query(
        `INSERT INTO users (user_code, email, password_hash, role, account_status) VALUES (?, ?, ?, 'CUSTOMER', 'ACTIVE')`,
        [userCode, email, STATIC_PASSWORD_HASH]
      );
      const userId = userRes.insertId;

      const customerCode = `C-${i.toString().padStart(6, '0')}`;
      const fullName = generateName();
      const phone = generatePhone();
      const aadhaar = generateAadhaar();
      const pan = generatePAN();
      
      const [profRes] = await connection.query(
        `INSERT INTO customer_profiles (user_id, customer_code, full_name, phone, aadhaar_number, pan_number, profile_status) VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE')`,
        [userId, customerCode, fullName, phone, aadhaar, pan]
      );
      
      createdCustomers.push({ customerId: profRes.insertId, userId });
    }
    console.log(`✅ Phase 1 Complete. Inserted ${NUM_RECORDS} Users and Profiles.`);

    // 2. Phase 2: Loan Creation & Scheme Matching
    console.log(`\n💰 Phase 2: Generating Loan Applications and Loans...`);
    const createdLoans = [];

    for (let i = 0; i < NUM_RECORDS; i++) {
      const customer = createdCustomers[i];
      const loanType = loanTypes[Math.floor(Math.random() * loanTypes.length)];
      
      const principal = Math.floor(Math.random() * 90000 + 10000); // 10k to 100k
      const interestRate = parseFloat(loanType.minimum_interest_rate);
      const tenure = loanType.minimum_duration_months || 6;
      
      const appNumber = `A-${i.toString().padStart(6, '0')}`;
      
      const [appRes] = await connection.query(
        `INSERT INTO loan_applications (application_number, customer_id, loan_type_id, requested_amount, requested_interest_rate, requested_duration_months, purpose, application_status, reviewed_by, reviewed_at) 
         VALUES (?, ?, ?, ?, ?, ?, 'Business Expansion', 'APPROVED', 1, NOW())`,
        [appNumber, customer.customerId, loanType.id, principal, interestRate, tenure]
      );
      const appId = appRes.insertId;

      // Create Loan
      const loanNumber = `L-${i.toString().padStart(6, '0')}`;
      const totalInterest = (principal * interestRate * tenure) / 1200;
      const totalPayable = principal + totalInterest;
      const emiAmount = totalPayable / tenure;
      
      const disbursementDate = new Date(); // Today
      const firstEmiDate = addMonths(disbursementDate, 1);
      const maturityDate = addMonths(disbursementDate, tenure);

      const frequencies = ['DAILY', 'WEEKLY', 'MONTHLY'];
      const freq = frequencies[Math.floor(Math.random() * frequencies.length)];

      const [loanRes] = await connection.query(
        `INSERT INTO loans (loan_number, application_id, customer_id, loan_type_id, approved_by, principal_amount, annual_interest_rate, tenure_months, emi_amount, total_interest, total_payable, outstanding_balance, disbursement_date, first_installment_date, maturity_date, repayment_frequency, loan_status)
         VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')`,
        [loanNumber, appId, customer.customerId, loanType.id, principal, interestRate, tenure, emiAmount, totalInterest, totalPayable, totalPayable, disbursementDate, firstEmiDate, maturityDate, freq]
      );
      
      createdLoans.push({
        loanId: loanRes.insertId,
        freq,
        tenure,
        emiAmount,
        firstEmiDate
      });
    }
    console.log(`✅ Phase 2 Complete. Inserted ${NUM_RECORDS} Loans.`);

    // 3. Phase 3 & 4: Multi-EMI Payment Transactions Simulation
    console.log(`\n💸 Phase 3 & 4: Simulating Repayment Ledgers & Transactions...`);
    const installmentsData = [];
    
    // We will generate 3 installments per loan to simulate history
    for (let i = 0; i < createdLoans.length; i++) {
      const loan = createdLoans[i];
      let currentDueDate = loan.firstEmiDate;
      let remainingBalance = loan.tenure * loan.emiAmount;

      for (let inst = 1; inst <= 3; inst++) {
        // Calculate due date based on frequency
        if (inst > 1) {
          if (loan.freq === 'DAILY') currentDueDate = addDays(currentDueDate, 1);
          else if (loan.freq === 'WEEKLY') currentDueDate = addDays(currentDueDate, 7);
          else currentDueDate = addMonths(currentDueDate, 1);
        }

        // Determine realistic human behavior
        const rand = Math.random();
        let status = 'PENDING';
        let paidAmount = 0.00;
        let penaltyAmount = 0.00;
        
        if (rand < 0.70) {
          status = 'PAID';
          paidAmount = loan.emiAmount;
        } else if (rand < 0.85) {
          status = 'PARTIALLY_PAID';
          paidAmount = loan.emiAmount / 2;
        } else {
          status = 'OVERDUE';
          penaltyAmount = 50.00; // Flat penalty simulation
        }
        
        const openingBalance = remainingBalance;
        remainingBalance -= paidAmount;
        const closingBalance = remainingBalance;
        
        const principalAmount = loan.emiAmount * 0.8;
        const interestAmount = loan.emiAmount * 0.2;
        const remainingAmount = (loan.emiAmount + penaltyAmount) - paidAmount;
        
        installmentsData.push([
          loan.loanId,
          inst,
          currentDueDate.toISOString().slice(0, 19).replace('T', ' '),
          openingBalance,
          principalAmount,
          interestAmount,
          loan.emiAmount,
          penaltyAmount,
          paidAmount,
          remainingAmount,
          closingBalance,
          status,
          status !== 'PENDING' && status !== 'OVERDUE' ? new Date().toISOString().slice(0, 19).replace('T', ' ') : null
        ]);
      }
    }

    if (installmentsData.length > 0) {
      await insertInBatches(
        connection, 
        'loan_installments', 
        ['loan_id', 'installment_number', 'due_date', 'opening_balance', 'principal_amount', 'interest_amount', 'total_amount', 'penalty_amount', 'paid_amount', 'remaining_amount', 'closing_balance', 'installment_status', 'paid_date'], 
        installmentsData
      );
    }
    
    console.log(`✅ Phase 3 & 4 Complete. Generated ${installmentsData.length} EMI historical ledgers.`);

    await connection.commit();
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n🎉 Seeding Completed Successfully in ${duration} seconds!`);

  } catch (err) {
    await connection.rollback();
    console.error(`\n❌ Seeder failed:`, err);
  } finally {
    connection.release();
    process.exit(0);
  }
}

runSeeder();
