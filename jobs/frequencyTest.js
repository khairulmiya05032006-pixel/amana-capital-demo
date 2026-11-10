import ScheduleService from '../services/scheduleService.js';

async function runTests() {
  console.log("=== FREQUENCY TESTS ===");
  
  // Phase 7: Daily Schedule Tests
  const dailyScheme = {
    duration_value: 30,
    duration_unit: 'DAYS',
    repayment_frequency: 'DAILY',
    interest_type: 'FLAT',
    base_interest_rate: 18
  };
  
  console.log("\n--- Daily Test 1: Month Boundary (Jan 30) ---");
  const daily1 = ScheduleService.generateSchedule(dailyScheme, 10000, '2026-01-30');
  console.log(`Inst 1 Due: ${daily1.installments[0].due_date}`); // Should be 01-31
  console.log(`Inst 2 Due: ${daily1.installments[1].due_date}`); // Should be 02-01
  const passD1 = daily1.installments[0].due_date.includes('01-31') && daily1.installments[1].due_date.includes('02-01');
  console.log(`Status: ${passD1 ? 'PASS ✅' : 'FAIL ❌'}`);
  
  console.log("\n--- Daily Test 2: Leap Year (Feb 28, 2024) ---");
  const daily2 = ScheduleService.generateSchedule(dailyScheme, 10000, '2024-02-28');
  console.log(`Inst 1 Due: ${daily2.installments[0].due_date}`); // Should be 02-29
  console.log(`Inst 2 Due: ${daily2.installments[1].due_date}`); // Should be 03-01
  const passD2 = daily2.installments[0].due_date.includes('02-29') && daily2.installments[1].due_date.includes('03-01');
  console.log(`Status: ${passD2 ? 'PASS ✅' : 'FAIL ❌'}`);
  
  console.log("\n--- Daily Test 3: Non-Leap Year (Feb 28, 2026) ---");
  const daily3 = ScheduleService.generateSchedule(dailyScheme, 10000, '2026-02-28');
  console.log(`Inst 1 Due: ${daily3.installments[0].due_date}`); // Should be 03-01
  const passD3 = daily3.installments[0].due_date.includes('03-01');
  console.log(`Status: ${passD3 ? 'PASS ✅' : 'FAIL ❌'}`);

  // Phase 8: Weekly Schedule Tests
  const weeklyScheme = {
    duration_value: 4,
    duration_unit: 'WEEKS',
    repayment_frequency: 'WEEKLY',
    interest_type: 'FLAT',
    base_interest_rate: 18
  };

  console.log("\n--- Weekly Test 1: Start Day Preservation ---");
  // 2026-08-12 is a Wednesday
  const weekly1 = ScheduleService.generateSchedule(weeklyScheme, 10000, '2026-08-12');
  console.log(`Start Date: 2026-08-12`);
  console.log(`Inst 1 Due: ${weekly1.installments[0].due_date}`); // Should be 08-19
  console.log(`Inst 2 Due: ${weekly1.installments[1].due_date}`); // Should be 08-26
  console.log(`Inst 3 Due: ${weekly1.installments[2].due_date}`); // Should be 09-02
  
  const passW1 = weekly1.installments[0].due_date.includes('08-19') && 
                 weekly1.installments[1].due_date.includes('08-26') &&
                 weekly1.installments[2].due_date.includes('09-02');
  console.log(`Status: ${passW1 ? 'PASS ✅' : 'FAIL ❌'}`);
  
  if (!passD1 || !passD2 || !passD3 || !passW1) {
    process.exit(1);
  }
  process.exit(0);
}

runTests();
