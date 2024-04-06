const db = require("../db");

// Function to calculate credit score
const calculateCreditScore = async (customerId) => {
  try {
    let creditScore = 100; // Initialize credit score to maximum value
    // Get past loans data for the customer
    const pastLoansQuery = `SELECT * FROM loans WHERE customer_id = ?`;
    const pastLoansRows = db.query(
      pastLoansQuery,
      [customerId],
      async (error, result) => {
        if (error) throw error;

        // Initialize variables to store components for calculating credit score
        let pastLoansPaidOnTime = 0;
        let numberOfLoansTaken = result.length;
        let loanActivityInCurrentYear = 0;
        let loanApprovedVolume = 0;

        // Calculate components based on past loans data
        result.forEach((loan) => {
          // Check how many emis of the loan was paid on time
          pastLoansPaidOnTime += loan.emis_paid_on_time;

          // Check if the loan was taken in the current year
          const currentDate = new Date();
          const loanStartDate = new Date(loan.start_date);
          if (loanStartDate.getFullYear() === currentDate.getFullYear()) {
            loanActivityInCurrentYear++;
          }

          // Calculate total loan approved volume
          loanApprovedVolume += loan.loan_amount;
        });

        // Get customer's approved limit
        const approvedLimitQuery = `SELECT approved_limit FROM customers WHERE customer_id = ?`;
        const approvedLimitRows = await db.query(
          approvedLimitQuery,
          [customerId],
          async (err, result2) => {
            if (err) throw err;
            const approvedLimit = result2[0].approved_limit;

            // Check if sum of current loans of customer > approved limit of customer
            const currentLoansQuery = `SELECT SUM(loan_amount) AS total_loans FROM loans WHERE customer_id = ?`;
            const currentLoansRows = await db.query(
              currentLoansQuery,
              [customerId],
              (err, result3) => {
                if(err) throw err;
                const totalCurrentLoans = result3[0].total_loans || 0;
                if (totalCurrentLoans > approvedLimit) {
                  creditScore = 0;
                } else {
                  // Adjust credit score based on components
                  creditScore -= 25; // Deduct 5 points for each loan taken
                  // creditScore += (pastLoansPaidOnTime * 10); // Add 10 points for each past loan paid on time
                  // creditScore += (loanActivityInCurrentYear * 15); // Add 15 points for each loan activity in current year
                  // creditScore += (Math.floor(loanApprovedVolume / 100000)); // Add points based on loan approved volume (rounded to nearest lakh)
                  console.log(creditScore)
                }

              }
            );
          }
        );
      }
    );
    return creditScore;
  } catch (error) {
    console.error("Error calculating credit score:", error);
    throw error;
  }
}

module.exports = calculateCreditScore;
