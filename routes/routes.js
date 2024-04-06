const express = require('express');
const router = express.Router();
const controller = require('../controllers/controller');

// Routes for operations
router.post('/register', controller.registerCustomer);
router.post('/check-eligibility', controller.checkLoanEligibility);
router.post('/create-loan', controller.createLoan);
router.get('/view-loan/:loan_id', controller.viewLoan);
router.post('/make-payment/:customer_id/:loan_id', controller.makePayment);
router.get('/view-statement/:customer_id/:loan_id', controller.viewLoanStatement);



module.exports = router;
