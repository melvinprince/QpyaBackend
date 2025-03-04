const express = require("express");
const router = express.Router();
const qpayController = require("../controllers/qpayController");
const cybersourceController = require("../controllers/cybersourceController");

router.post("/qpay/request", qpayController.initiateQPayPayment);
router.post("/qpay/response", qpayController.handleQPayResponse);

router.post(
  "/cybersource/request",
  cybersourceController.initiateCyberSourcePayment
);
router.post("/cybersource/response", cybersourceController.paymentResponse);

module.exports = router;
