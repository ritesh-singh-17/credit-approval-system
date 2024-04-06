const xlsx = require("xlsx");
const fs = require("fs");

// Function to read data from Excel file and insert into MySQL table
// Function to read data from Excel file and insert into MySQL table
async function insertDataFromExcel(filePath, tableName) {
  try {
    const db = await require("./db");

    // Read Excel file
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0]; // Assuming data is in the first sheet
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet);

    // Mapping of column names from Excel to MySQL table columns
    const customerColumnMappings = {
      "Customer ID": "customer_id",
      "First Name": "first_name",
      "Last Name": "last_name",
      Age: "age",
      "Phone Number": "phone_number",
      "Monthly Salary": "monthly_salary",
      "Approved Limit": "approved_limit",
      "Current Debt": "current_debt",
    };

    const loanColumnMappings = {
      "Loan ID": "loan_id",
      "Customer ID": "customer_id",
      "Loan Amount": "loan_amount",
      Tenure: "tenure",
      "Interest Rate": "interest_rate",
      "Monthly payment": "monthly_repayment",
      "EMIs paid on Time": "emis_paid_on_time",
      "Date of Approval": "date_of_approval",
      "End Date": "end_date",
    };

    const columns =
      tableName === "customers"
        ? Object.keys(data[0]).map((col) => customerColumnMappings[col])
        : Object.keys(data[0]).map((col) => loanColumnMappings[col]);

    const values = data.map((obj) => {
      const newObj = {};
      for (const col of Object.keys(obj)) {
        if ((col === "Date of Approval" || col === "End Date") && obj[col]) {
          newObj[col] = excelSerialNumberToDate(obj[col]);
        } else {
          newObj[col] = obj[col];
        }
      }
      return Object.values(newObj);
    });


    // Construct the SQL INSERT query
    const query = `INSERT INTO ${tableName} (${columns.join(", ")}) VALUES ?`;

    // Execute SQL query to insert data into table
    await db.query(query, [values], (err, res) => {
      if (err) throw err;
      console.log(res.affectedRows + " records inserted successfully.");
    });

    console.log(`Data inserted into ${tableName} table successfully.`);
  } catch (error) {
    console.error("Error:", error);
  }
}

// Function to convert Excel serial number to standard date format (MM/DD/YYYY)
function excelSerialNumberToDate(serialNum) {
  const date = new Date(
    (serialNum - 1) * 24 * 60 * 60 * 1000 +  new Date("1899-12-31").getTime()
  );
  const month = (date.getMonth() + 1).toString().padStart(2, "0"); // Adding leading zero if needed
  const day = date.getDate().toString().padStart(2, "0"); // Adding leading zero if needed
  const year = date.getFullYear();
  return `${year}-${month}-${day}`;
}

// Insert data from customer_data.xlsx into customers table
// insertDataFromExcel("./customer_data.xlsx", "customers");

// Insert data from loan_data.xlsx into loans table
insertDataFromExcel("./loan_data.xlsx", "loans");
