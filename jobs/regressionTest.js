import ScheduleService from '../services/scheduleService.js';

async function runRegressionTest() {
  console.log("=== MONTHLY REGRESSION TEST ===");
  
  // Test case 1: ₹50,000, 18% Flat, 12 Months
  const scheme1 = {
    duration_value: 12,
    duration_unit: 'MONTHS',
    repayment_frequency: 'MONTHLY',
    interest_type: 'FLAT',
    base_interest_rate: 18
  };
  const principal1 = 50000;
  
  const result1 = ScheduleService.generateSchedule(scheme1, principal1, '2026-08-01');
  
  console.log("Test Case 1:");
  console.log(`Principal: ₹${result1.summary.principal}`);
  console.log(`Total Interest: ₹${result1.summary.total_interest}`);
  console.log(`Total Payable: ₹${result1.summary.total_payable}`);
  console.log(`Installment Count: ${result1.summary.total_installments}`);
  
  // Expected Business Output:
  // 50000 * 18% * 1 year = 9000 interest
  // Total = 59000
  // Installment = 59000 / 12 = 4916.67
  const passed1 = result1.summary.total_interest === 9000 && 
                  result1.summary.total_payable === 59000 && 
                  result1.summary.total_installments === 12;
                  
  console.log(`Status: ${passed1 ? 'PASS ✅' : 'FAIL ❌'}`);
  if (!passed1) process.exit(1);
  
  // Test Case 2: Month-end leap year boundary (Jan 31st -> Feb 28th -> Mar 31st)
  // Let's use 2026-01-31. 2026 is NOT a leap year, so Feb has 28 days.
  const result2 = ScheduleService.generateSchedule(scheme1, principal1, '2026-01-31');
  console.log("\nTest Case 2 (Calendar Boundaries - 2026-01-31):");
  console.log(`Inst 1 Due: ${result2.installments[0].due_date}`); // Should be Feb 28
  console.log(`Inst 2 Due: ${result2.installments[1].due_date}`); // Should be Mar 31
  console.log(`Inst 3 Due: ${result2.installments[2].due_date}`); // Should be Apr 30
  
  const passed2 = result2.installments[0].due_date.includes('02-28') &&
                  result2.installments[1].due_date.includes('03-31') &&
                  result2.installments[2].due_date.includes('04-30');
                  
  console.log(`Status: ${passed2 ? 'PASS ✅' : 'FAIL ❌'}`);
  
  if (!passed2) process.exit(1);
  
  console.log("\nAll regression tests passed successfully.");
  process.exit(0);
}

runRegressionTest();
