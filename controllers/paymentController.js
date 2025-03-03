const crypto = require("crypto");
const axios = require("axios");
const querystring = require("querystring");
require("dotenv").config();

// Use the QPay redirect URL from environment variables (or fallback)
const REDIRECT_URL = process.env.QPAY_REDIRECT_URL;
console.log("[DEBUG] REDIRECT_URL set to:", REDIRECT_URL);

const onSuccessRedirect = "https://dpay-dev.netlify.app/payment-response";

/**
 * Generates a secure hash for QPay requests.
 * The hash string is built by concatenating the secret key and
 * all required fields in alphabetical order.
 *
 * Expected order:
 *   Action, Amount, BankID, CurrencyCode, ExtraFields_f14, Lang, MerchantID,
 *   MerchantModuleSessionID, NationalID, PaymentDescription, PUN, Quantity, TransactionRequestDate
 *
 * @param {Object} data - The data object containing all required fields.
 * @param {string} secretKey - The QPay secret key used for hashing.
 * @returns {string} - The generated secure hash in uppercase.
 */
const generateSecureHash = (data, secretKey) => {
  // Alphabetical order of the request fields as per QPay guide
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
  console.log(
    "[DEBUG] Generating secure hash using fields order:",
    fieldsOrder
  );

  let hashString = secretKey;
  fieldsOrder.forEach((field) => {
    const fieldValue = data[field] ? data[field].toString().trim() : "";
    console.log(`[DEBUG] Field "${field}" value: "${fieldValue}"`);
    hashString += fieldValue;
  });
  console.log("[DEBUG] Hash string before hashing:", hashString);

  const secureHash = crypto
    .createHash("sha256")
    .update(hashString)
    .digest("hex")
    .toUpperCase();

  console.log("[DEBUG] Generated secure hash:", secureHash);
  return secureHash;
};

/**
 * Generates the current date-time in ddMMyyyyHHmmss format.
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
  const formattedDate = dd + MM + yyyy + HH + mm + ss;
  console.log("[DEBUG] Current date:", now.toString());
  console.log("[DEBUG] Formatted TransactionRequestDate:", formattedDate);
  return formattedDate;
};

/**
 * Generates a unique 20-character Payment Unique Number (PUN) using crypto.
 * @returns {string} - The generated 20-character PUN.
 */
const generatePUN = () => {
  const pun = crypto
    .randomBytes(10)
    .toString("hex")
    .substring(0, 20)
    .toUpperCase();
  console.log("[DEBUG] Generated PUN:", pun);
  return pun;
};

/**
 * Initiates a payment request to QPay.
 * Constructs the required fields, generates a secure hash using the new field order,
 * and returns the data for browser redirection.
 *
 * @param {Object} req - Express request object containing payment details in the body.
 * @param {Object} res - Express response object for sending the JSON response.
 */
exports.initiatePayment = async (req, res) => {
  console.log("[DEBUG] Initiate Payment called with request body:", req.body);
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

    const requiredFields = ["amount", "bankId", "merchantId", "description"];
    const missingFields = requiredFields.filter((field) => !req.body[field]);
    if (missingFields.length > 0) {
      console.error("[DEBUG] Missing required fields:", missingFields);
      return res.status(400).json({
        status: "error",
        message: `Missing required fields: ${missingFields.join(", ")}`,
      });
    }

    const truncatedPUN = pun ? pun.trim().substring(0, 20) : generatePUN();
    console.log("[DEBUG] Using PUN:", truncatedPUN);

    const formattedAmount = Math.round(parseFloat(amount) * 100).toString();
    console.log(
      "[DEBUG] Formatted amount (smallest currency unit):",
      formattedAmount
    );

    const paymentData = {
      Action: "0", // "0" denotes a purchase/sale request
      Amount: formattedAmount,
      BankID: bankId.trim(),
      CurrencyCode: "634", // ISO code for QAR
      ExtraFields_f14: onSuccessRedirect,
      Lang: language && language.trim() ? language.trim() : "En",
      MerchantID: merchantId.trim(),
      MerchantModuleSessionID: truncatedPUN,
      NationalID:
        nationalId && nationalId.trim() !== ""
          ? nationalId.trim()
          : "7483885725", // Fallback if not provided
      PUN: truncatedPUN,
      PaymentDescription: description.trim(),
      Quantity: "1",
      TransactionRequestDate: generateTransactionDate(),
    };

    console.log("[DEBUG] Payment Data Fields:");
    Object.entries(paymentData).forEach(([key, value]) => {
      console.log(`  ${key}: "${value}"`);
    });

    // Generate the secure hash using the updated alphabetical order
    paymentData.SecureHash = generateSecureHash(
      paymentData,
      process.env.QPAY_SECRET_KEY.trim()
    );
    console.log("[DEBUG] Final Payment Data (with SecureHash):", paymentData);

    // Instead of making a server-to-server POST call to QPay,
    // return the payment data and the QPay endpoint URL.
    console.log("[DEBUG] Returning payment data for browser redirection.");
    return res.json({
      status: "success",
      redirectUrl: REDIRECT_URL,
      paymentData,
    });
  } catch (error) {
    console.error(
      "[DEBUG] Payment initiation error:",
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
  console.log("[DEBUG] Handling Payment Response with request body:", req.body);
  try {
    const responseParams = req.body;
    const receivedSecureHash = responseParams["Response.SecureHash"];
    console.log(
      "[DEBUG] Received SecureHash from response:",
      receivedSecureHash
    );

    if (!receivedSecureHash) {
      console.error("[DEBUG] Missing Secure Hash in Response");
      return res.status(400).json({
        status: "error",
        message: "Missing Secure Hash in Response",
      });
    }

    // Use alphabetical order for the response fields
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
    console.log(
      "[DEBUG] Using fixed fields order for response hash:",
      fieldsOrder
    );

    let hashString = process.env.QPAY_SECRET_KEY.trim();
    fieldsOrder.forEach((field) => {
      const value = responseParams[field]
        ? responseParams[field].toString().trim()
        : "";
      console.log(`[DEBUG] Response field "${field}" value: "${value}"`);
      hashString += value;
    });
    console.log("[DEBUG] Hash string for response before hashing:", hashString);

    const generatedSecureHash = crypto
      .createHash("sha256")
      .update(hashString)
      .digest("hex")
      .toUpperCase();
    console.log(
      "[DEBUG] Generated SecureHash for response:",
      generatedSecureHash
    );

    if (receivedSecureHash !== generatedSecureHash) {
      console.error("[DEBUG] Secure Hash Validation Failed");
      return res.status(400).json({
        status: "error",
        message: "Invalid secure hash",
      });
    }

    const paymentStatus = responseParams["Response.Status"];
    const confirmationID = responseParams["Response.ConfirmationID"];
    const transactionID = responseParams["Response.PUN"];

    console.log(
      "[DEBUG] Payment Response Validation successful. Extracted details:",
      { transactionID, confirmationID, paymentStatus }
    );

    return res.json({
      status: "success",
      data: {
        paymentStatus,
        confirmationID,
        transactionDetails: responseParams,
      },
    });
  } catch (error) {
    console.error("[DEBUG] Payment response handling error:", error);
    return res.status(500).json({
      status: "error",
      message: "Failed to process payment response",
    });
  }
};
