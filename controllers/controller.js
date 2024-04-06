const db = require("../db");
const calculateCreditScore = require("../helpers/calculateCreditScore");
const calculateMonthlyInstallment = require("../helpers/calculateEMI");

// Register a new customer
exports.registerCustomer = async (req, res) => {
  try {
    const { first_name, last_name, age, monthly_income, phone_number } =
      req.body;

    // Calculate approved limit
    const approved_limit = Math.round((36 * monthly_income) / 100000) * 100000;

    // Insert new customer into database
    const query = `INSERT INTO customers (first_name, last_name, age, monthly_salary, approved_limit, phone_number) VALUES (?, ?, ?, ?, ?, ?)`;
    const result = await db.query(
      query,
      [
        first_name,
        last_name,
        age,
        monthly_income,
        approved_limit,
        phone_number,
      ],
      (err, result) => {
        const insertedId = result.insertId;

        // Construct response object
        const response = {
          customer_id: insertedId,
          name: `${first_name} ${last_name}`,
          age: age,
          monthly_income: monthly_income,
          approved_limit: approved_limit,
          phone_number: phone_number,
        };

        res.status(201).json(response);
      }
    );
  } catch (error) {
    console.error("Error registering customer:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Check loan eligibility
exports.checkLoanEligibility = async (req, res) => {
  try {
    const { customer_id, loan_amount, interest_rate, tenure } = req.body;

    // Fetch customer's data from database
    const customerQuery = `SELECT * FROM customers WHERE customer_id = ?`;
    const customerRows = await db.query(
      customerQuery,
      [customer_id],
      async (err, result) => {
        if (err) throw err;
        const customer = result[0];

        // Get current date in YYYY-MM-DD format
        const currentDate = new Date().toISOString().split("T")[0];

        // Check if sum of current loans exceeds approved limit
        const currentLoansQuery = `SELECT SUM(loan_amount) AS total_loans FROM loans WHERE customer_id = ? AND date_of_approval <= ? AND (end_date IS NULL OR end_date >= ?)`;
        const currentLoansRows = await db.query(
          currentLoansQuery,
          [customer_id, currentDate, currentDate],
          async (err, result2) => {
            if (err) throw err;

            const totalLoans = result2[0].total_loans || 0;

            if (totalLoans > customer.approved_limit) {
              return res.status(200).json({
                customer_id: customer_id,
                approval: false,
                message: "Sum of current loans exceeds approved limit",
              });
            }

            // Calculate credit score
            const creditScore = await calculateCreditScore(customer_id);
            console.log(creditScore)

            let approval = false;
            let corrected_interest_rate = interest_rate;

            // Check if sum of all current EMIs > 50% of monthly salary
            const emisQuery = `
              SELECT SUM(monthly_repayment) AS total_emis
              FROM loans
              WHERE customer_id = ? AND date_of_approval <= ? AND (end_date IS NULL OR end_date >= ?)`;
            const emisRows = await db.query(
              emisQuery,
              [customer_id, currentDate, currentDate],
              (err, result3) => {
                if (err) throw err;
                const totalEmis = result3[0].total_emis || 0;

                if (totalEmis > 0.5 * customer.monthly_salary) {
                  return res.status(200).json({
                    customer_id: customer_id,
                    approval: false,
                    message:
                      "Sum of all current emis is greater than 50% of the monthly salary",
                  });
                } else {
                  if (creditScore > 50) {
                    approval = true;
                  } else if (creditScore > 30) {
                    approval = true;
                    if (interest_rate < 12) {
                      corrected_interest_rate = 12;
                    }
                  } else if (creditScore > 10) {
                    approval = true;
                    if (interest_rate < 16) {
                      corrected_interest_rate = 16;
                    }
                  }
                }

                // Prepare response
                const response = {
                  customer_id: customer_id,
                  approval: approval,
                  interest_rate: interest_rate,
                  corrected_interest_rate: corrected_interest_rate,
                  tenure: tenure,
                  monthly_installment: approval
                    ? calculateMonthlyInstallment(
                        loan_amount,
                        corrected_interest_rate,
                        tenure
                      )
                    : 0,
                };

                res.status(200).json(response);
              }
            );
          }
        );
      }
    );
  } catch (error) {
    console.error("Error checking eligibility:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Process a new loan based on eligibility
exports.createLoan = async (req, res) => {
  try {
    const { customer_id, loan_amount, interest_rate, tenure } = req.body;

    // Firstly, checkLoanEligibility endpoint will be called to check whether the customer is eligible for the loan or not, and if the customer is eligible for the loan.

    const isCustomerElgibleForTheLoan = await axios.post(
      "http://localhost:5000/check-eligibility",
      {
        customer_id,
        loan_amount,
        interest_rate,
        tenure,
      }
    );

    let { approval, corrected_interest_rate, monthly_installment } =
      isCustomerElgibleForTheLoan;

    let loanApproved = approval;

    const currentDate = new Date();
    const date_of_approval = currentDate.toISOString().split("T")[0];
    const endDate = new Date(currentDate);
    endDate.setMonth(currentDate.getMonth() + tenure);

    const end_date = endDate.toISOString().split("T")[0];

    if (loanApproved) {
      if (corrected_interest_rate !== interest_rate) {
        const query = `INSERT INTO loans (customer_id, loan_amount, interest_rate, tenure, monthly_repayment, emis_paid_on_time, date_of_approval, end_date) VALUES (?, ?, ?, ?, ?, ?,?)`;
        const result = await db.query(query, [
          customer_id,
          loan_amount,
          corrected_interest_rate,
          tenure,
          monthly_installment,
          0,
          date_of_approval,
          end_date,
        ]);
        const insertedId = result.insertId;
        const response = {
          loan_id: insertedId,
          customer_id: customer_id,
          loan_approved: loanApproved,
          message: `Loan is approved but at higher interest rate due to low credit score. New interest rate will be ${corrected_interest_rate}`,
          monthly_installment: monthly_installment,
        };
      }

      // Insert new loan into database
      const query = `INSERT INTO loans (customer_id, loan_amount, interest_rate, tenure, monthly_repayment, emis_paid_on_time, date_of_approval, end_date) VALUES (?, ?, ?, ?, ?)`;
      const result = await db.query(query, [
        customer_id,
        loan_amount,
        interest_rate,
        tenure,
        monthly_installment,
        0,
        date_of_approval,
        end_date,
      ]);
      const insertedId = result.insertId;

      // Prepare response for successful loan creation
      const response = {
        loan_id: insertedId,
        customer_id: customer_id,
        loan_approved: loanApproved,
        message: "Loan approved",
        monthly_installment: monthly_installment,
      };

      res.status(200).json(response);
    } else {
      // Prepare response for unsuccessful loan creation
      const response = {
        loan_id: null,
        customer_id: customer_id,
        loan_approved: loanApproved,
        message: "Loan not approved",
        monthly_installment: 0,
      };

      res.status(200).json(response);
    }
  } catch (error) {
    console.error("Error creating loan:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// View loan details
exports.viewLoan = async (req, res) => {
  try {
    const loanId = req.params.loan_id;

    // Fetch loan details from database
    const loanQuery = `
      SELECT loans.loan_id, loans.customer_id, loans.loan_amount, loans.interest_rate, loans.tenure, loans.monthly_repayment,
             customers.first_name, customers.last_name, customers.phone_number, customers.age
      FROM loans
      INNER JOIN customers ON loans.customer_id = customers.customer_id
      WHERE loans.loan_id = ?
    `;
    const [loanRows] = await db.query(loanQuery, [loanId]);
    if (loanRows.length === 0) {
      return res.status(404).json({ message: "Loan not found" });
    }

    // Prepare response
    const loan = loanRows[0];
    const response = {
      loan_id: loan.loan_id,
      customer: {
        id: loan.customer_id,
        first_name: loan.first_name,
        last_name: loan.last_name,
        phone_number: loan.phone_number,
        age: loan.age,
      },
      loan_amount: loan.loan_amount,
      interest_rate: loan.interest_rate,
      monthly_installment: loan.monthly_repayment,
      tenure: loan.tenure,
    };

    res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching loan details:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Make a payment towards an EMI
exports.makePayment = async (req, res) => {
  try {
    const { customer_id, loan_id } = req.params;
    const { amount } = req.body;

    // Fetch loan details from database
    const loanQuery = `
      SELECT loan_amount, monthly_repayment, emis_paid_on_time 
      FROM loans 
      WHERE loan_id = ? AND customer_id = ?
    `;
    const [loanRows] = await db.query(loanQuery, [loan_id, customer_id]);
    if (loanRows.length === 0) {
      return res
        .status(404)
        .json({ message: "Loan not found for the customer" });
    }

    const loan = loanRows[0];
    const { loan_amount, monthly_repayment, emis_paid_on_time } = loan;

    // Calculate remaining loan amount after payment
    const remainingAmount = loan_amount - amount;
    if (remainingAmount < 0) {
      return res.status(400).json({
        message: `Payment amount exceeds remaining loan amount by ${Math.abs(
          remainingAmount
        )}`,
      });
    }

    // Recalculate EMI amount if payment amount is less/more than the due installment amount
    let updatedMonthlyInstallment = monthly_repayment;

    if (amount !== monthly_repayment) {
      updatedMonthlyInstallment = calculateMonthlyInstallment(
        remainingAmount,
        tenure,
        interest_rate
      );
    }

    // Update loan with remaining amount and updated EMI amount
    const updateQuery = `
      UPDATE loans 
      SET monthly_repayment = ?, emis_paid_on_time = ? 
      WHERE loan_id = ? AND customer_id = ?
    `;
    await db.query(updateQuery, [
      updatedMonthlyInstallment,
      emis_paid_on_time + 1,
      loan_id,
      customer_id,
    ]);

    res.status(200).json({ message: "Payment successful" });
  } catch (error) {
    console.error("Error making payment:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// View loan statement
exports.viewLoanStatement = async (req, res) => {
  try {
    const { customer_id, loan_id } = req.params;

    // Fetch loan details from database
    const loanQuery = `
      SELECT loan_id, loan_amount, interest_rate, monthly_repayment, tenure 
      FROM loans 
      WHERE loan_id = ? AND customer_id = ?
    `;
    const [loanRows] = await db.query(loanQuery, [loan_id, customer_id]);
    if (loanRows.length === 0) {
      return res
        .status(404)
        .json({ message: "Loan not found for the customer" });
    }

    const loan = loanRows[0];
    const { loan_amount, interest_rate, monthly_repayment, tenure } = loan;

    // Calculate remaining number of EMIs
    const remainingEMIs = tenure - emis_paid_on_time;

    const amount_paid = loan_amount - remainingEMIs * monthly_repayment;

    // Prepare loan statement response
    const statement = {
      customer_id: parseInt(customer_id),
      loan_id: parseInt(loan_id),
      principal: loan_amount,
      interest_rate: interest_rate,
      amount_paid: amount_paid,
      monthly_installment: monthly_repayment,
      repayments_left: remainingEMIs,
    };

    res.status(200).json(statement);
  } catch (error) {
    console.error("Error fetching loan statement:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
