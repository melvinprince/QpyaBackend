const crypto = require("crypto");
const axios = require("axios");
const querystring = require("querystring");
require("dotenv").config();

const REDIRECT_URL = process.env.QPAY_REDIRECT_URL;
const onSuccessRedirect = "https://dpay-dev.netlify.app/payment-response";

const generateSecureHash = (data, secretKey) => {
  // Order fields alphabetically as per QPay guidelines
  const fieldsOrder = [
    "Action",
    "Amount",
    "BankID",
    "CurrencyCode",
    "ExtraFields_f14",
    "Lang",
    "MerchantID",
    "MerchantModuleSessionID",
    "NationalID",
    "PaymentDescription",
    "PUN",
    "Quantity",
    "TransactionRequestDate",
  ];
  let hashString = secretKey;
  fieldsOrder.forEach((field) => {
    const fieldValue = data[field] ? data[field].toString().trim() : "";
    hashString += fieldValue;
  });
  // Debug: Log the concatenated hash string for verification
  console.log("Concatenated Hash String:", hashString);
  const secureHash = crypto
    .createHash("sha256")
    .update(hashString)
    .digest("hex")
    .toUpperCase();
  console.log("Generated Secure Hash:", secureHash);
  return secureHash;
};

const generateTransactionDate = () => {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const MM = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = now.getFullYear();
  const HH = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return dd + MM + yyyy + HH + mm + ss;
};

const generatePUN = () => {
  return crypto.randomBytes(10).toString("hex").substring(0, 20).toUpperCase();
};

exports.initiatePayment = async (req, res) => {
  try {
    const {
      amount,
      bankId = process.env.QPAY_BANK_ID,
      language,
      merchantId = process.env.QPAY_MERCHANT_ID,
      pun,
      nationalId,
      description,
    } = req.body;

    // Required fields check
    const requiredFields = ["amount", "bankId", "merchantId", "description"];
    const missingFields = requiredFields.filter((field) => !req.body[field]);
    if (missingFields.length > 0) {
      return res.status(400).json({
        status: "error",
        message: `Missing required fields: ${missingFields.join(", ")}`,
      });
    }

    // Use provided pun if exists, otherwise generate one
    const truncatedPUN = pun ? pun.trim().substring(0, 20) : generatePUN();
    const formattedAmount = Math.round(parseFloat(amount) * 100).toString();

    const paymentData = {
      Action: "0",
      Amount: formattedAmount,
      BankID: bankId.trim(),
      CurrencyCode: "634",
      ExtraFields_f14: onSuccessRedirect,
      Lang: language && language.trim() ? language.trim() : "En",
      MerchantID: merchantId.trim(),
      MerchantModuleSessionID: truncatedPUN, // Use same value for consistency
      NationalID: nationalId ? nationalId.trim() : "",
      PaymentDescription: description.trim(),
      PUN: truncatedPUN,
      Quantity: "1",
      TransactionRequestDate: generateTransactionDate(),
    };

    // Generate secure hash
    paymentData.SecureHash = generateSecureHash(
      paymentData,
      process.env.QPAY_SECRET_KEY
    );

    console.log("Payment Data", paymentData);

    // Build an HTML form with hidden inputs for each field and auto-submit it.
    let formFields = "";
    Object.entries(paymentData).forEach(([key, value]) => {
      formFields += `<input type="hidden" name="${key}" value="${value}" />\n`;
    });

    const html = `
      <html>
      <head>
        <title>Redirecting to QPay</title>
      </head>
      <body onload="document.forms[0].submit();">
        <p>Please wait while we redirect you to QPay...</p>
        <form action="${REDIRECT_URL}" method="POST">
          ${formFields}
        </form>
      </body>
      </html>
    `;

    // Send the form directly as the response
    return res.send(html);
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: "Payment initiation failed",
      details: error.response ? error.response.data : error.message,
    });
  }
};

exports.handlePaymentResponse = async (req, res) => {
  try {
    const responseParams = req.body;
    const receivedSecureHash = responseParams["Response.SecureHash"];
    if (!receivedSecureHash) {
      return res.status(400).json({
        status: "error",
        message: "Missing Secure Hash in Response",
      });
    }
    const fieldsOrder = [
      "Response.AcquirerID",
      "Response.Amount",
      "Response.BankID",
      "Response.CardExpiryDate",
      "Response.CardHolderName",
      "Response.CardNumber",
      "Response.ConfirmationID",
      "Response.CurrencyCode",
      "Response.EZConnectResponseDate",
      "Response.Lang",
      "Response.MerchantID",
      "Response.MerchantModuleSessionID",
      "Response.PUN",
      "Response.Status",
      "Response.StatusMessage",
    ];
    let hashString = process.env.QPAY_SECRET_KEY;
    fieldsOrder.forEach((field) => {
      const value = responseParams[field]
        ? responseParams[field].toString().trim()
        : "";
      hashString += value;
    });
    console.log("Response Hash String:", hashString);
    const generatedSecureHash = crypto
      .createHash("sha256")
      .update(hashString)
      .digest("hex")
      .toUpperCase();
    console.log("Generated Response Secure Hash:", generatedSecureHash);
    if (receivedSecureHash !== generatedSecureHash) {
      return res.status(400).json({
        status: "error",
        message: "Invalid secure hash",
      });
    }
    const paymentStatus = responseParams["Response.Status"];
    const confirmationID = responseParams["Response.ConfirmationID"];
    const transactionID = responseParams["Response.PUN"];
    return res.json({
      status: "success",
      data: {
        paymentStatus,
        confirmationID,
        transactionDetails: responseParams,
      },
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: "Failed to process payment response",
    });
  }
};
