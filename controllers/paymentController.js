const crypto = require("crypto");
const axios = require("axios");
const querystring = require("querystring");

// Use the QPay redirect URL from environment variables (or fallback)
const REDIRECT_URL = process.env.QPAY_REDIRECT_URL;

/**
 * Generates a secure hash for QPay requests using a fixed field order.
 * The hash string is built by concatenating the secret key with each field value,
 * in the order specified by QPay documentation, then applying SHA-256 and converting to uppercase.
 *
 * @param {Object} data - The data object containing all required fields for QPay.
 * @param {string} secretKey - The QPay secret key used for hashing.
 * @returns {string} - The generated secure hash in uppercase.
 */
const generateSecureHash = (data, secretKey) => {
  // Fixed field order per QPay documentation
  const fieldsOrder = [
    "Action",
    "BankID",
    "MerchantID",
    "CurrencyCode",
    "Amount",
    "PUN",
    "PaymentDescription",
    "MerchantModuleSessionID",
    "TransactionRequestDate",
    "Quantity",
    "ExtraFields_f14",
    "Lang",
    "NationalID",
  ];

  let hashString = secretKey;
  fieldsOrder.forEach((field) => {
    hashString += data[field] ? data[field].toString().trim() : "";
  });

  return crypto
    .createHash("sha256")
    .update(hashString)
    .digest("hex")
    .toUpperCase();
};

/**
 * Generates the current date-time in ddMMyyyyHHmmss format.
 * This format is specified by QPay for the TransactionRequestDate field.
 *
 * @returns {string} - The formatted date-time string.
 */
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

/**
 * Generates a unique 20-character Payment Unique Number (PUN) using crypto.
 *
 * @returns {string} - The generated 20-character PUN.
 */
const generatePUN = () => {
  return crypto.randomBytes(10).toString("hex").substring(0, 20).toUpperCase();
};

/**
 * Initiates a payment request to QPay by constructing the required fields,
 * generating a secure hash, and making a POST request to the QPay endpoint.
 *
 * @param {Object} req - Express request object containing payment details in the body.
 * @param {Object} res - Express response object for sending the JSON response.
 */
exports.initiatePayment = async (req, res) => {
  try {
    // Extract essential fields from request body
    const {
      amount,
      bankId,
      language,
      merchantId,
      pun,
      nationalId,
      description,
    } = req.body;

    // Validate required fields
    const requiredFields = ["amount", "bankId", "merchantId", "description"];
    const missingFields = requiredFields.filter((field) => !req.body[field]);
    if (missingFields.length > 0) {
      return res.status(400).json({
        status: "error",
        message: `Missing required fields: ${missingFields.join(", ")}`,
      });
    }

    // Use provided PUN if available; otherwise, generate one
    const truncatedPUN = pun ? pun.trim().substring(0, 20) : generatePUN();

    // Convert amount to the smallest currency unit (e.g., multiply by 100)
    const formattedAmount = Math.round(parseFloat(amount) * 100).toString();

    // Prepare payment data for the QPay request
    const paymentData = {
      Action: "0", // "0" typically denotes a purchase/sale request
      Amount: formattedAmount,
      BankID: bankId.trim(),
      CurrencyCode: "634", // ISO currency code for QAR
      ExtraFields_f14: REDIRECT_URL,
      Lang: language && language.trim() ? language.trim() : "En", // Default to "En" if not provided
      MerchantID: merchantId.trim(),
      MerchantModuleSessionID: truncatedPUN, // Required: same as PUN for session identification
      PUN: truncatedPUN,
      PaymentDescription: description.trim(),
      Quantity: "1",
      TransactionRequestDate: generateTransactionDate(),
      NationalID:
        nationalId && nationalId.trim() !== ""
          ? nationalId.trim()
          : "7483885725", // Fallback if not provided
    };

    // Generate the secure hash using the secret key and fixed field order
    paymentData.SecureHash = generateSecureHash(
      paymentData,
      process.env.QPAY_SECRET_KEY.trim()
    );

    // Post the request to QPay
    const qpayResponse = await axios.post(
      process.env.QPAY_REDIRECT_URL,
      querystring.stringify(paymentData),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    return res.json({
      status: "success",
      redirectUrl: process.env.QPAY_REDIRECT_URL,
      paymentData,
    });
  } catch (error) {
    console.error(
      "Payment initiation error:",
      error.response ? error.response.data : error.message
    );
    return res.status(500).json({
      status: "error",
      message: "Payment initiation failed",
      details: error.response ? error.response.data : error.message,
    });
  }
};

/**
 * Handles the payment response from QPay by validating the secure hash
 * and returning the payment status, confirmation ID, and other details.
 *
 * @param {Object} req - Express request object containing QPay response data in the body.
 * @param {Object} res - Express response object for sending the JSON response.
 */
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

    // Fixed field order for Payment Response per QPay documentation
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

    let hashString = process.env.QPAY_SECRET_KEY.trim();
    fieldsOrder.forEach((field) => {
      hashString += responseParams[field]
        ? responseParams[field].toString().trim()
        : "";
    });

    const generatedSecureHash = crypto
      .createHash("sha256")
      .update(hashString)
      .digest("hex")
      .toUpperCase();

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
    console.error("Payment response handling error:", error);
    return res.status(500).json({
      status: "error",
      message: "Failed to process payment response",
    });
  }
};

// Export common utility functions in case they are needed elsewhere
module.exports.generateSecureHash = generateSecureHash;
module.exports.generateTransactionDate = generateTransactionDate;
module.exports.generatePUN = generatePUN;
