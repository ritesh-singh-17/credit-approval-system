function calculateMonthlyInstallment(loanAmount, tenureMonths, interestRate) {
    // Convert annual interest rate to monthly interest rate
    let monthlyInterestRate = interestRate / (12 * 100);

    let numerator = loanAmount * monthlyInterestRate * Math.pow(1 + monthlyInterestRate, tenureMonths);

    let denominator = Math.pow(1 + monthlyInterestRate, tenureMonths) - 1;

    // Calculate EMI using the formula
    let emi = (numerator) / (denominator);

    // Round to two decimal places
    emi = Math.round(emi * 100) / 100;

    return emi;
}

module.exports = calculateMonthlyInstallment