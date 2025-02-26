const express = require("express");
const Paymentrouter = express.Router();
const paymentController = require("../controllers/paymentController");

Paymentrouter.post("/request", paymentController.initiatePayment);
Paymentrouter.post("/response", paymentController.handlePaymentResponse);

module.exports = Paymentrouter;
