export class ScheduleService {
  /**
   * Generates a preview or final schedule array based on the scheme config and loan amount
   */
  static generateSchedule(scheme, principalAmount, startDateStr) {
    const principal = parseFloat(principalAmount);
    if (isNaN(principal) || principal <= 0) {
      throw new Error('Invalid principal amount');
    }

    const startDate = startDateStr ? new Date(startDateStr) : new Date();
    
    // 1. Calculate duration in standard units
    const { duration_value, duration_unit, repayment_frequency } = scheme;
    
    // For simplicity, we define "Total Installments" based on frequency, but capped by the exact duration
    // E.g. Duration = 100 Days, Frequency = Daily -> 100 installments
    // Duration = 12 Weeks, Frequency = Weekly -> 12 installments
    // We assume the schema validates that frequency and duration units align logically.
    
    let totalInstallments = 0;
    
    if (repayment_frequency === 'DAILY') {
      if (duration_unit === 'DAYS') totalInstallments = duration_value;
      else if (duration_unit === 'WEEKS') totalInstallments = duration_value * 7;
      else if (duration_unit === 'MONTHS') totalInstallments = duration_value * 30; // Approx
    } else if (repayment_frequency === 'WEEKLY') {
      if (duration_unit === 'WEEKS') totalInstallments = duration_value;
      else throw new Error("Weekly frequency requires duration in WEEKS");
    } else if (repayment_frequency === 'MONTHLY') {
      if (duration_unit === 'MONTHS') totalInstallments = duration_value;
      else throw new Error("Monthly frequency requires duration in MONTHS");
    }

    if (totalInstallments <= 0 || !Number.isInteger(totalInstallments)) {
      throw new Error("Invalid total installments calculated");
    }

    // 2. Calculate Total Interest
    let totalInterest = 0;
    const isFlatAmount = (
      scheme.interest_calculation_method === 'FLAT_AMOUNT' ||
      scheme.flat_interest_amount !== undefined ||
      scheme.interest_amount !== undefined ||
      scheme.interest_type === 'FLAT_AMOUNT'
    );

    if (isFlatAmount) {
      // Direct Flat Interest Amount for the entire loan
      const rawInterest = scheme.flat_interest_amount !== undefined
        ? scheme.flat_interest_amount
        : (scheme.interest_amount !== undefined ? scheme.interest_amount : (scheme.base_interest_amount || 0));
      totalInterest = Math.max(0, Math.round(parseFloat(rawInterest || 0) * 100) / 100);
    } else if (scheme.interest_type === 'FLAT') {
      // Legacy percentage calculation: Assuming base_interest_rate is annual percentage rate (APR)
      // Flat Interest = P * (R/100) * (T in Years)
      let years = 0;
      if (duration_unit === 'DAYS') years = duration_value / 365.0;
      else if (duration_unit === 'WEEKS') years = duration_value / 52.0;
      else if (duration_unit === 'MONTHS') years = duration_value / 12.0;

      totalInterest = principal * ((scheme.base_interest_rate || 0) / 100.0) * years;
    } else {
      // REDUCING_BALANCE logic (legacy percentage approximation)
      const r = ((scheme.base_interest_rate || 0) / 100.0) / (
        repayment_frequency === 'MONTHLY' ? 12 :
        repayment_frequency === 'WEEKLY' ? 52 : 365
      );
      
      if (r === 0) {
        totalInterest = 0;
      } else {
        const pmt = principal * (r * Math.pow(1 + r, totalInstallments)) / (Math.pow(1 + r, totalInstallments) - 1);
        totalInterest = (pmt * totalInstallments) - principal;
      }
    }

    totalInterest = Math.round(totalInterest * 100) / 100;

    // 3. Exact Total Payable & Upward Rounding (Section B & C)
    const exactTotalPayable = Math.round((principal + totalInterest) * 100) / 100;
    const roundedTotalPayable = Math.ceil(exactTotalPayable);
    const totalRoundingAdjustment = Math.round((roundedTotalPayable - exactTotalPayable) * 100) / 100;

    // Validation (Section G)
    if (roundedTotalPayable < totalInstallments) {
      throw new Error('Total payable is insufficient to produce at least ₹1 per installment');
    }
    if (principal > 9999999999999.99 || roundedTotalPayable > 9999999999999.99) {
      throw new Error('Financial values exceed database precision');
    }

    // 4. Front-Loaded Higher EMI and Back-Loaded Lower EMI Algorithm
    // Higher whole-rupee installments appear FIRST, lower installments appear LAST
    const baseEmi = Math.floor(roundedTotalPayable / totalInstallments);
    const remainder = roundedTotalPayable % totalInstallments;

    const installmentTotals = new Array(totalInstallments);
    for (let i = 0; i < totalInstallments; i++) {
      if (i < remainder) {
        installmentTotals[i] = baseEmi + 1; // Higher EMI
      } else {
        installmentTotals[i] = baseEmi;     // Lower EMI
      }
    }

    // 5. Financial Component Allocation & Reconciliation (Section F)
    // Precise monetary arithmetic in integer paise
    const principalPaise = Math.round(principal * 100);
    const interestPaise = Math.round(totalInterest * 100);
    const roundingPaise = Math.round(totalRoundingAdjustment * 100);
    const totalNetPaise = principalPaise + interestPaise;

    let cumNetPaise = 0;
    let prevCumPrincipalPaise = 0;
    const installments = [];
    let currentPrincipalBalance = principal;
    
    // For Monthly, we keep track of the start date's day of month
    const startDayOfMonth = startDate.getDate();

    for (let i = 1; i <= totalInstallments; i++) {
      const idx = i - 1;
      const isLast = (i === totalInstallments);

      let dueDate = new Date(startDate);
      if (repayment_frequency === 'DAILY') {
        dueDate.setDate(dueDate.getDate() + i);
      } else if (repayment_frequency === 'WEEKLY') {
        dueDate.setDate(dueDate.getDate() + (i * 7));
      } else if (repayment_frequency === 'MONTHLY') {
        dueDate.setMonth(dueDate.getMonth() + i);
        // Handle Month-End boundaries (e.g. Jan 31 -> Feb 28)
        if (dueDate.getDate() !== startDayOfMonth) {
          dueDate.setDate(0); // Moves to last day of previous month
        }
      }

      const instTotalRupees = installmentTotals[idx];
      const instTotalPaise = instTotalRupees * 100;

      // Allocate rounding adjustment to the final true-up installment
      const instRoundingPaise = isLast ? roundingPaise : 0;
      const instRoundingAmount = instRoundingPaise / 100;

      const instNetPaise = instTotalPaise - instRoundingPaise;
      cumNetPaise += instNetPaise;

      let instPrincipalPaise = 0;
      if (isLast) {
        instPrincipalPaise = principalPaise - prevCumPrincipalPaise;
      } else if (totalNetPaise > 0) {
        const cumTargetP = Math.round(principalPaise * (cumNetPaise / totalNetPaise));
        instPrincipalPaise = cumTargetP - prevCumPrincipalPaise;
        prevCumPrincipalPaise = cumTargetP;
      } else {
        instPrincipalPaise = 0;
      }

      const instInterestPaise = instNetPaise - instPrincipalPaise;
      const instPrincipalAmount = instPrincipalPaise / 100;
      const instInterestAmount = instInterestPaise / 100;

      // Integrity checks (Section G)
      if (!Number.isInteger(instTotalRupees) || instTotalRupees <= 0) {
        throw new Error(`Calculated EMI amounts contain fractional rupees or are invalid: ${instTotalRupees}`);
      }
      const checkLinePaise = instPrincipalPaise + instInterestPaise + instRoundingPaise;
      if (checkLinePaise !== instTotalPaise) {
        throw new Error(`Component allocations do not reconcile on installment #${i}`);
      }

      const closingBalance = isLast ? 0.00 : Math.max(0, Math.round((currentPrincipalBalance - instPrincipalAmount) * 100) / 100);

      installments.push({
        installment_number: i,
        due_date: dueDate.toISOString().split('T')[0],
        opening_balance: Math.round(currentPrincipalBalance * 100) / 100,
        principal_amount: instPrincipalAmount,
        interest_amount: instInterestAmount,
        rounding_adjustment: instRoundingAmount,
        total_amount: instTotalRupees, // Always an integer whole rupee
        closing_balance: closingBalance
      });

      currentPrincipalBalance -= instPrincipalAmount;
    }

    // Global Reconciliation validation (Section F & G)
    const sumPrincipal = Math.round(installments.reduce((sum, inst) => sum + inst.principal_amount, 0) * 100) / 100;
    const sumInterest = Math.round(installments.reduce((sum, inst) => sum + inst.interest_amount, 0) * 100) / 100;
    const sumRounding = Math.round(installments.reduce((sum, inst) => sum + inst.rounding_adjustment, 0) * 100) / 100;
    const sumTotal = installments.reduce((sum, inst) => sum + inst.total_amount, 0);

    if (sumPrincipal !== principal || sumInterest !== totalInterest || sumRounding !== totalRoundingAdjustment || sumTotal !== roundedTotalPayable) {
      throw new Error('Component allocations do not reconcile to global loan terms');
    }

    const higherEmiAmount = remainder > 0 ? baseEmi + 1 : baseEmi;
    const higherEmiCount = remainder > 0 ? remainder : totalInstallments;
    const lowerEmiAmount = remainder > 0 ? baseEmi : 0;
    const lowerEmiCount = remainder > 0 ? totalInstallments - remainder : 0;

    return {
      summary: {
        principal: principal,
        total_interest: totalInterest,
        flat_interest_amount: totalInterest,
        rounding_adjustment: totalRoundingAdjustment,
        exact_total_payable: exactTotalPayable,
        total_payable: roundedTotalPayable,
        total_installments: totalInstallments,
        base_emi: baseEmi,
        higher_emi_amount: higherEmiAmount,
        higher_emi_count: higherEmiCount,
        lower_emi_amount: lowerEmiAmount,
        lower_emi_count: lowerEmiCount,
        regular_payment: higherEmiAmount,
        final_adjustment: totalRoundingAdjustment,
        frequency: repayment_frequency,
        calculation_method: isFlatAmount ? 'FLAT_AMOUNT' : 'PERCENTAGE'
      },
      installments: installments
    };
  }
}

export default ScheduleService;
