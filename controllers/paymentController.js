const crypto = require("crypto");
const axios = require("axios");
const querystring = require("querystring");

// Use the QPay redirect URL from environment variables (or fallback)
const REDIRECT_URL = process.env.QPAY_REDIRECT_URL;
console.log("[DEBUG] REDIRECT_URL set to:", REDIRECT_URL);

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
  console.log(
    "[DEBUG] Generating secure hash using fixed fields order:",
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
  const formattedDate = dd + MM + yyyy + HH + mm + ss;
  console.log("[DEBUG] Current date:", now.toString());
  console.log("[DEBUG] Formatted TransactionRequestDate:", formattedDate);
  return formattedDate;
};

/**
 * Generates a unique 20-character Payment Unique Number (PUN) using crypto.
 *
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
 * Initiates a payment request to QPay by constructing the required fields,
 * generating a secure hash, and making a POST request to the QPay endpoint.
 *
 * @param {Object} req - Express request object containing payment details in the body.
 * @param {Object} res - Express response object for sending the JSON response.
 */
exports.initiatePayment = async (req, res) => {
  console.log("[DEBUG] Initiate Payment called with request body:", req.body);
  try {
    const {
      amount,
      bankId,
      language,
      merchantId,
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
      ExtraFields_f14: REDIRECT_URL,
      Lang: language && language.trim() ? language.trim() : "En",
      MerchantID: merchantId.trim(),
      MerchantModuleSessionID: truncatedPUN,
      PUN: truncatedPUN,
      PaymentDescription: description.trim(),
      Quantity: "1",
      TransactionRequestDate: generateTransactionDate(),
      NationalID:
        nationalId && nationalId.trim() !== ""
          ? nationalId.trim()
          : "7483885725", // Fallback if not provided
    };

    console.log("[DEBUG] Payment Data Fields:");
    Object.entries(paymentData).forEach(([key, value]) => {
      console.log(`  ${key}: "${value}"`);
    });

    paymentData.SecureHash = generateSecureHash(
      paymentData,
      process.env.QPAY_SECRET_KEY.trim()
    );
    console.log("[DEBUG] Final Payment Data (with SecureHash):", paymentData);

    console.log(
      "[DEBUG] Sending POST request to QPay endpoint:",
      process.env.QPAY_REDIRECT_URL
    );
    console.log("[DEBUG] Request payload:", querystring.stringify(paymentData));

    const qpayResponse = await axios.post(
      process.env.QPAY_REDIRECT_URL,
      querystring.stringify(paymentData),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );
    console.log("[DEBUG] QPay response received:", qpayResponse.data);

    return res.json({
      status: "success",
      redirectUrl: process.env.QPAY_REDIRECT_URL,
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
      {
        transactionID,
        confirmationID,
        paymentStatus,
      }
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

// Export common utility functions in case they are needed elsewhere
module.exports.generateSecureHash = generateSecureHash;
module.exports.generateTransactionDate = generateTransactionDate;
module.exports.generatePUN = generatePUN;
