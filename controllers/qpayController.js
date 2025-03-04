// const crypto = require("crypto");
// require("dotenv").config();
//
// const REDIRECT_URL = process.env.QPAY_REDIRECT_URL;
// const onSuccessRedirect = process.env.RETURN_URL;
//
// const generateSecureHash = (data, secretKey) => {
//   const fieldsOrder = [
//     "Action",
//     "Amount",
//     "BankID",
//     "CurrencyCode",
//     "ExtraFields_f14",
//     "Lang",
//     "MerchantID",
//     "MerchantModuleSessionID",
//     "NationalID",
//     "PUN",
//     "PaymentDescription",
//     "Quantity",
//     "TransactionRequestDate",
//   ];
//
//   let hashString = secretKey;
//   fieldsOrder.forEach((field) => {
//     const fieldValue = data[field] ? data[field].toString().trim() : "";
//     hashString += fieldValue;
//   });
//
//   return crypto.createHash("sha256").update(hashString).digest("hex");
// };
//
// const generateTransactionDate = () => {
//   const now = new Date();
//   return now
//     .toISOString()
//     .replace(/[-:.TZ]/g, "")
//     .substring(0, 14);
// };
//
// const generatePUN = () => {
//   return crypto.randomBytes(10).toString("hex").substring(0, 20).toUpperCase();
// };
//
// exports.initiateQPayPayment = async (req, res) => {
//   try {
//     const {
//       amount,
//       bankId,
//       language,
//       merchantId,
//       pun,
//       nationalId,
//       description,
//     } = req.body;
//
//     if (!amount || !bankId || !merchantId || !description) {
//       return res
//         .status(400)
//         .json({ status: "error", message: "Missing required fields." });
//     }
//
//     const truncatedPUN = pun ? pun.trim().substring(0, 20) : generatePUN();
//     const formattedAmount = Math.round(parseFloat(amount) * 100).toString();
//
//     const paymentData = {
//       Action: "0",
//       Amount: formattedAmount,
//       BankID: bankId.trim(),
//       CurrencyCode: "634",
//       ExtraFields_f14: onSuccessRedirect,
//       Lang: language || "en",
//       MerchantID: merchantId.trim(),
//       MerchantModuleSessionID: truncatedPUN,
//       NationalID: nationalId || "",
//       PUN: truncatedPUN,
//       PaymentDescription: description.trim(),
//       Quantity: "1",
//       TransactionRequestDate: generateTransactionDate(),
//     };
//
//     paymentData.SecureHash = generateSecureHash(
//       paymentData,
//       process.env.QPAY_SECRET_KEY
//     );
//
//     return res.json({
//       success: true,
//       message: "Payment ready",
//       paymentUrl: REDIRECT_URL,
//       formFields: paymentData,
//     });
//   } catch (error) {
//     return res.status(500).json({
//       status: "error",
//       message: "Payment initiation failed",
//       error: error.message,
//     });
//   }
// };
//
// exports.handleQPayResponse = async (req, res) => {
//   try {
//     const responseParams = req.body;
//     const receivedSecureHash = responseParams["Response.SecureHash"];
//     if (!receivedSecureHash)
//       return res
//         .status(400)
//         .json({ status: "error", message: "Missing Secure Hash in Response" });
//
//     const fieldsOrder = [
//       "Response.AcquirerID",
//       "Response.Amount",
//       "Response.BankID",
//       "Response.CardExpiryDate",
//       "Response.CardHolderName",
//       "Response.CardNumber",
//       "Response.ConfirmationID",
//       "Response.CurrencyCode",
//       "Response.EZConnectResponseDate",
//       "Response.Lang",
//       "Response.MerchantID",
//       "Response.MerchantModuleSessionID",
//       "Response.PUN",
//       "Response.Status",
//       "Response.StatusMessage",
//     ];
//
//     let hashString = process.env.QPAY_SECRET_KEY;
//     fieldsOrder.forEach(
//       (field) => (hashString += (responseParams[field] || "").trim())
//     );
//
//     const generatedSecureHash = crypto
//       .createHash("sha256")
//       .update(hashString)
//       .digest("hex")
//       .toUpperCase();
//     if (receivedSecureHash !== generatedSecureHash)
//       return res
//         .status(400)
//         .json({ status: "error", message: "Invalid secure hash" });
//
//     return res.json({
//       status: "success",
//       paymentStatus: responseParams["Response.Status"],
//       transactionDetails: responseParams,
//     });
//   } catch (error) {
//     return res
//       .status(500)
//       .json({ status: "error", message: "Failed to process payment response" });
//   }
// };

const { triggerAsyncId } = require("async_hooks");
const crypto = require("crypto");
require("dotenv").config();

const REDIRECT_URL = process.env.QPAY_REDIRECT_URL;
const onSuccessRedirect = process.env.RETURN_URL;

const generateSecureHash = (data, secretKey) => {
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
    "PUN",
    "PaymentDescription",
    "Quantity",
    "TransactionRequestDate",
  ];

  let hashString = secretKey;
  fieldsOrder.forEach((field) => {
    const fieldValue = data[field] ? data[field].toString().trim() : "";
    hashString += fieldValue;
  });

  return crypto.createHash("sha256").update(hashString).digest("hex");
};

const generateTransactionDate = () => {
  const now = new Date();
  return now
    .toISOString()
    .replace(/[-:.TZ]/g, "")
    .substring(0, 14);
};

const generatePUN = () => {
  return crypto.randomBytes(10).toString("hex").substring(0, 20).toUpperCase();
};

exports.initiateQPayPayment = async (req, res) => {
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

    if (!amount || !bankId || !merchantId || !description) {
      return res
        .status(400)
        .json({ status: "error", message: "Missing required fields." });
    }

    const truncatedPUN = pun ? pun.trim().substring(0, 20) : generatePUN();
    const formattedAmount = Math.round(parseFloat(amount) * 100).toString();

    const paymentData = {
      Action: "0",
      Amount: formattedAmount,
      BankID: bankId.trim(),
      CurrencyCode: "634",
      ExtraFields_f14: onSuccessRedirect,
      Lang: language || "en",
      MerchantID: merchantId.trim(),
      MerchantModuleSessionID: truncatedPUN,
      NationalID: nationalId || "",
      PUN: truncatedPUN,
      PaymentDescription: description.trim(),
      Quantity: "1",
      TransactionRequestDate: generateTransactionDate(),
    };

    paymentData.SecureHash = generateSecureHash(
      paymentData,
      process.env.QPAY_SECRET_KEY
    );

    return res.json({
      success: true,
      message: "Payment ready",
      paymentUrl: REDIRECT_URL,
      formFields: paymentData,
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: "Payment initiation failed",
      error: error.message,
    });
  }
};

// exports.handleQPayResponse = async (req, res) => {
//   console.log("triggered");
//
//   try {
//     // Check if the request is a POST request. If not, redirect to the success page.
//     if (req.method !== "POST") {
//       return res.redirect(
//         `/payment-response?status=${req.query["Response.Status"]}&message=${
//           req.query["Response.StatusMessage"] || "Redirected"
//         }`
//       );
//     }
//
//     const responseParams = req.body;
//     const receivedSecureHash = responseParams["Response.SecureHash"];
//
//     if (!receivedSecureHash) {
//       return res
//         .status(400)
//         .json({ status: "error", message: "Missing Secure Hash in Response" });
//     }
//
//     const fieldsOrder = [
//       "Response.AcquirerID",
//       "Response.Amount",
//       "Response.BankID",
//       "Response.CardExpiryDate",
//       "Response.CardHolderName",
//       "Response.CardNumber",
//       "Response.ConfirmationID",
//       "Response.CurrencyCode",
//       "Response.EZConnectResponseDate",
//       "Response.Lang",
//       "Response.MerchantID",
//       "Response.MerchantModuleSessionID",
//       "Response.PUN",
//       "Response.Status",
//       "Response.StatusMessage",
//     ];
//
//     let hashString = process.env.QPAY_SECRET_KEY;
//     fieldsOrder.forEach(
//       (field) => (hashString += (responseParams[field] || "").trim())
//     );
//
//     const generatedSecureHash = crypto
//       .createHash("sha256")
//       .update(hashString)
//       .digest("hex")
//       .toUpperCase();
//
//     if (receivedSecureHash !== generatedSecureHash) {
//       return res
//         .status(400)
//         .json({ status: "error", message: "Invalid secure hash" });
//     }
//
//     // Redirect to the success or failure page with query parameters
//     const redirectUrl = `/payment-response?status=${responseParams["Response.Status"]}&message=${responseParams["Response.StatusMessage"]}`;
//     return res.redirect(redirectUrl);
//   } catch (error) {
//     console.error("Error handling QPay response:", error);
//     return res.redirect(
//       `/payment-response?status=error&message=${encodeURIComponent(
//         "Failed to process payment response"
//       )}`
//     );
//   }
// };

exports.handleQPayResponse = async (req, res) => {
  console.log("QPay Response Received:", JSON.stringify(req.body, null, 2));

  try {
    const responseParams = req.body;

    // Check if the Secure Hash exists
    if (!responseParams || !responseParams["Response.SecureHash"]) {
      console.error("Missing Secure Hash in QPay Response:", responseParams);
      return res.status(400).json({
        status: "error",
        message: "Missing Secure Hash in Response",
        receivedData: responseParams, // Log what was received
      });
    }

    // Extract and verify secure hash
    const receivedSecureHash = responseParams["Response.SecureHash"];

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
    fieldsOrder.forEach(
      (field) => (hashString += (responseParams[field] || "").trim())
    );

    const generatedSecureHash = crypto
      .createHash("sha256")
      .update(hashString)
      .digest("hex")
      .toUpperCase();

    if (receivedSecureHash !== generatedSecureHash) {
      console.error(
        "Invalid Secure Hash! Expected:",
        generatedSecureHash,
        "Received:",
        receivedSecureHash
      );
      return res.status(400).json({
        status: "error",
        message: "Invalid secure hash",
      });
    }

    return res.redirect(
      `https://dpay-dev.netlify.app/payment-response?status=${responseParams["Response.Status"]}&message=${responseParams["Response.StatusMessage"]}`
    );
  } catch (error) {
    console.error("Error handling QPay response:", error);
    return res.redirect(
      "https://dpay-dev.netlify.app/payment-response?status=error&message=Failed to process response"
    );
  }
};
