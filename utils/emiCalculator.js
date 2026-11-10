// EMI Calculator Utility
export const calculateEMI = (principal, annualRate, tenureMonths) => {
  if (principal <= 0 || annualRate < 0 || tenureMonths <= 0) {
    throw new Error('Invalid input: principal, rate, and tenure must be positive');
  }

  const monthlyRate = annualRate / 12 / 100;
  
  if (monthlyRate === 0) {
    // If interest rate is 0
    return principal / tenureMonths;
  }

  const emi = (principal * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths)) /
              (Math.pow(1 + monthlyRate, tenureMonths) - 1);
  
  return Math.round(emi * 100) / 100;
};

export const calculateTotalInterest = (principal, emi, tenureMonths) => {
  const totalPayable = emi * tenureMonths;
  const totalInterest = totalPayable - principal;
  
  return Math.round(totalInterest * 100) / 100;
};

export const generateEMISchedule = (principal, annualRate, tenureMonths, startDate = new Date()) => {
  const emi = calculateEMI(principal, annualRate, tenureMonths);
  const monthlyRate = annualRate / 12 / 100;
  
  const schedule = [];
  let outstandingBalance = principal;
  let currentDate = new Date(startDate);

  for (let i = 1; i <= tenureMonths; i++) {
    const interestPayment = outstandingBalance * monthlyRate;
    const principalPayment = emi - interestPayment;
    outstandingBalance -= principalPayment;

    schedule.push({
      installmentNumber: i,
      dueDate: new Date(currentDate),
      principalPayment: Math.round(principalPayment * 100) / 100,
      interestPayment: Math.round(interestPayment * 100) / 100,
      emiAmount: Math.round(emi * 100) / 100,
      outstandingBalance: Math.round(Math.max(0, outstandingBalance) * 100) / 100,
    });

    // Move to next month
    currentDate.setMonth(currentDate.getMonth() + 1);
  }

  return schedule;
};
