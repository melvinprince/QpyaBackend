const crypto = require("crypto");
const axios = require("axios");
const querystring = require("querystring");

// Correct Redirect URL for the payment response
const REDIRECT_URL = "https://dpay-dev.netlify.app/payment-response";

/**
 * Generates a secure hash for QPay requests based on a fixed field order.
 * QPay documentation specifies the exact order in which fields must be concatenated
 * with the secret key, followed by applying a SHA-256 hash and converting to uppercase.
 *
 * @param {Object} data - The data object containing all required fields for QPay.
 * @param {string} secretKey - The QPay secret key used for hashing.
 * @returns {string} - The generated secure hash in uppercase.
 */
const generateSecureHash = (data, secretKey) => {
  console.log("Raw Data Before Hashing:", data);

  // The specific field order dictated by QPay documentation
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
    // Append the trimmed field value if it exists, otherwise append an empty string
    hashString +=
      data[field] !== undefined && data[field] !== null
        ? data[field].toString().trim()
        : "";
  });

  console.log("Hash String Before Hashing:", hashString);

  // Create the SHA-256 hash and convert it to uppercase
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
 * Initiates a payment request to QPay by constructing the required fields,
 * generating a secure hash, and making a POST request to the QPay endpoint.
 *
 * @param {Object} req - Express request object containing payment details in the body.
 * @param {Object} res - Express response object for sending the JSON response.
 */
exports.initiatePayment = async (req, res) => {
  try {
    console.log("Initiating Payment...");

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

    // Check for missing required fields
    const requiredFields = [
      "amount",
      "bankId",
      "merchantId",
      "pun",
      "description",
    ];
    const missingFields = requiredFields.filter((field) => !req.body[field]);

    if (missingFields.length > 0) {
      return res.status(400).json({
        status: "error",
        message: `Missing required fields: ${missingFields.join(", ")}`,
      });
    }

    // Convert amount to the smallest currency unit (multiply by 100 for ISO format)
    const formattedAmount = Math.round(parseFloat(amount) * 100).toString();

    // Truncate PUN to a maximum of 20 characters as required by QPay
    const truncatedPUN = pun.trim().substring(0, 20);

    // Prepare payment data for the QPay request
    const paymentData = {
      Action: "0", // "0" typically denotes a purchase or sale request in QPay docs
      Amount: formattedAmount,
      BankID: bankId.trim(),
      CurrencyCode: "634", // ISO currency code for QAR
      ExtraFields_f14: REDIRECT_URL,
      Lang: language && language.trim() ? language.trim() : "En", // Default to "En" if language is missing
      MerchantID: merchantId.trim(),
      MerchantModuleSessionID: truncatedPUN, // QPay requires both PUN & MerchantModuleSessionID
      PUN: truncatedPUN,
      PaymentDescription: description.trim(),
      Quantity: "1",
      TransactionRequestDate: generateTransactionDate(),
      NationalID:
        nationalId && nationalId.trim() !== ""
          ? nationalId.trim()
          : "7483885725", // Fallback if not provided
    };

    console.log("Payment Data Fields:");
    Object.entries(paymentData).forEach(([key, value]) => {
      console.log(`  ${key}: "${value}"`);
    });

    // Generate the secure hash using the secret key and fixed field order
    paymentData.SecureHash = generateSecureHash(
      paymentData,
      process.env.QPAY_SECRET_KEY.trim()
    );

    console.log("SecureHash Generated:", paymentData.SecureHash);
    console.log(
      "Final Payment Data (Sent to QPay):",
      JSON.stringify(paymentData, null, 2)
    );

    console.log("Sending Request to QPay:", querystring.stringify(paymentData));
    console.log("Headers Used:", {
      "Content-Type": "application/x-www-form-urlencoded",
    });

    // Post the request to QPay
    const qpayResponse = await axios.post(
      process.env.QPAY_REDIRECT_URL,
      querystring.stringify(paymentData),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    console.log("QPay Response:", qpayResponse.data);

    // Return a JSON response to the client with the relevant data
    res.json({
      status: "success",
      redirectUrl: process.env.QPAY_REDIRECT_URL,
      paymentData,
    });
  } catch (error) {
    console.error(
      "Payment initiation error:",
      error.response ? error.response.data : error.message
    );
    res.status(500).json({
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
    console.log("Handling Payment Response...");
    console.log("Full Response Data:", req.body);

    const responseParams = req.body;
    const receivedSecureHash = responseParams["Response.SecureHash"];

    if (!receivedSecureHash) {
      console.error("Missing Secure Hash in Response");
      return res.status(400).json({
        status: "error",
        message: "Missing Secure Hash in Response",
      });
    }

    // Use fixed field order as specified by QPay documentation for Payment Response
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
    console.log("Hash String for Response:", hashString);

    // Generate secure hash using SHA-256 and convert to uppercase
    const generatedSecureHash = crypto
      .createHash("sha256")
      .update(hashString)
      .digest("hex")
      .toUpperCase();

    console.log("Generated Secure Hash:", generatedSecureHash);
    console.log("Received Secure Hash:", receivedSecureHash);

    if (receivedSecureHash !== generatedSecureHash) {
      console.error("Secure Hash Validation Failed");
      return res.status(400).json({
        status: "error",
        message: "Invalid secure hash",
      });
    }

    // Extract critical information from the validated QPay response
    const paymentStatus = responseParams["Response.Status"];
    const confirmationID = responseParams["Response.ConfirmationID"];
    const transactionID = responseParams["Response.PUN"];

    console.log("Payment Result:", {
      transactionID,
      confirmationID,
      paymentStatus,
    });

    res.json({
      status: "success",
      data: {
        paymentStatus,
        confirmationID,
        transactionDetails: responseParams,
      },
    });
  } catch (error) {
    console.error("Payment response handling error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to process payment response",
    });
  }
};
