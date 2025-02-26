const express = require("express");
const crypto = require("crypto");
const cors = require("cors");
const dotenv = require("dotenv");
const paymentController = require("./controllers/paymentController");

dotenv.config();

const app = express();
app.use(express.json());

// Enable CORS for local and production environments
app.use(
  cors({
    origin: "*",
    credentials: true,
    methods: ["GET", "POST"],
  })
);

const PORT = process.env.PORT || 8080;
const QPAY_URL = "https://pguat.qcb.gov.qa/qcb-pg/api/gateway/2.0";
const SECRET_KEY = process.env.QPAY_SECRET_KEY;
const MERCHANT_ID = process.env.QPAY_MERCHANT_ID;
const BANK_ID = "QPAYPG03";

// Function to generate a secure hash
const generateSecureHash = (data) => {
  let hashString = SECRET_KEY;
  Object.keys(data)
    .sort()
    .forEach((key) => {
      hashString += data[key];
    });
  return crypto.createHash("sha256").update(hashString).digest("hex");
};

// Function to generate a unique 20-character PUN
const generatePUN = () => {
  return crypto.randomBytes(10).toString("hex").substring(0, 20).toUpperCase();
};

// Middleware to append required fields before processing payment request
const appendPaymentData = (req, res, next) => {
  try {
    console.log("Appending bankId, merchantId, and PUN to request");

    const { amount, description } = req.body;

    if (!amount || !description) {
      return res
        .status(400)
        .json({ error: "Amount and Description are required" });
    }

    // Generate a new 20-character PUN
    const PUN = generatePUN();
    const TransactionRequestDate = new Date()
      .toISOString()
      .replace(/[-:TZ.]/g, "")
      .slice(0, 14);

    // Append additional required fields
    req.body.bankId = BANK_ID;
    req.body.merchantId = MERCHANT_ID;
    req.body.pun = PUN;
    req.body.transactionRequestDate = TransactionRequestDate;

    console.log("Updated Request Data:", req.body);
    next();
  } catch (error) {
    console.error("Error in Middleware:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

// Payment request endpoint
app.post(
  "/payment/request",
  appendPaymentData,
  paymentController.initiatePayment
);

// Payment response endpoint
app.post("/payment/response", paymentController.handlePaymentResponse);

// Server health check endpoint
app.get("/", (req, res) => {
  res.send("<h1 style='text-align:center;color:green'>Website is Running</h1>");
});

// Start the server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
