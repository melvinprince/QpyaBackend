// /***********************************
//  * cybersourceController.js
//  * ---------------------------------
//  * Node.js controller for CyberSource
//  * Secure Acceptance Hosted Checkout Integration.
//  **********************************/
// const crypto = require("crypto");
// const uuid = require("uuid"); // For generating unique transaction IDs if needed
// require("dotenv").config();
//
// // Load configuration from environment variables
// const {
//   CYBERSOURCE_PROFILE_ID,
//   CYBERSOURCE_ACCESS_KEY,
//   CYBERSOURCE_SECRET_KEY,
// } = process.env;
//
// /**
//  * Utility: Create HMAC SHA256 signature for the Secure Acceptance fields.
//  * The signing string is built by using the exact order specified in the "signed_field_names" field.
//  *
//  * @param {Object} data - Key/value pairs for fields to be signed.
//  * @param {string} secretKey - Your Secure Acceptance Secret Key.
//  * @returns {string} The generated signature (Base64-encoded).
//  */
// function sign(data, secretKey) {
//   // Use the order specified in the signed_field_names field.
//   const orderedFields = data.signed_field_names.split(",");
//   const signingString = orderedFields
//     .map((field) => `${field}=${data[field]}`)
//     .join(",");
//   const hmac = crypto.createHmac("sha256", secretKey);
//   hmac.update(signingString);
//   return hmac.digest("base64");
// }
//
// /**
//  * POST /payment/cybersource/request
//  * Creates the form fields, signs them, and returns them to the client.
//  * The client should then construct a form that auto‑posts to CyberSource's Hosted Checkout URL.
//  */
// exports.initiateCyberSourcePayment = async (req, res) => {
//   try {
//     // Extract order details (and optional device fingerprint) from the request body.
//     const {
//       amount,
//       currency = "USD",
//       referenceNumber,
//       device_fingerprint_id,
//     } = req.body;
//
//     // Generate a unique ID for the transaction.
//     const transactionUuid = uuid.v4();
//
//     // Get current date/time in ISO format (trimmed to seconds).
//     const signedDateTime = new Date().toISOString().split(".")[0] + "Z";
//
//     // Define the fields that will be signed. Order is critical.
//     const signedFieldNames = [
//       "access_key",
//       "profile_id",
//       "transaction_uuid",
//       "signed_field_names",
//       "signed_date_time",
//       "transaction_type",
//       "reference_number",
//       "amount",
//       "currency",
//       "locale",
//       "device_fingerprint_id", // Include device fingerprint if provided.
//     ];
//
//     // Populate the form fields required by CyberSource.
//     const fieldsToSign = {
//       access_key: CYBERSOURCE_ACCESS_KEY,
//       profile_id: CYBERSOURCE_PROFILE_ID,
//       transaction_uuid: transactionUuid,
//       signed_field_names: signedFieldNames.join(","),
//       signed_date_time: signedDateTime,
//       transaction_type: "sale", // Change to "authorization" if needed.
//       reference_number: referenceNumber || `REF-${Date.now()}`,
//       amount,
//       currency,
//       locale: "en-us",
//       device_fingerprint_id, // This should match the key from the client.
//     };
//
//     // Generate the signature.
//     const signature = sign(fieldsToSign, CYBERSOURCE_SECRET_KEY);
//
//     // Hosted Checkout URL (adjust based on environment)
//     const paymentUrl = "https://secureacceptance.cybersource.com/pay";
//
//     return res.json({
//       success: true,
//       message: "Payment form parameters generated successfully.",
//       paymentUrl,
//       formFields: {
//         ...fieldsToSign,
//         signature,
//       },
//     });
//   } catch (error) {
//     console.error("[initiateCyberSourcePayment] Error:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Failed to initiate payment session.",
//       error: error.message,
//     });
//   }
// };
//
// /**
//  * POST /payment/cybersource/response
//  * CyberSource posts transaction response data to this endpoint after payment processing.
//  * This function verifies the response signature to ensure data integrity.
//  */
// exports.paymentResponse = async (req, res) => {
//   try {
//     // Copy the response data from CyberSource.
//     const fields = { ...req.body };
//
//     // Extract the received signature and then remove it from the data for re-signing.
//     const responseSignature = fields.signature;
//     delete fields.signature;
//
//     // Extract the signed_field_names list to determine which fields were signed.
//     const signedNames = fields.signed_field_names.split(",");
//
//     // Build an object with only the signed fields.
//     const dataToSign = {};
//     signedNames.forEach((field) => {
//       dataToSign[field] = fields[field];
//     });
//
//     // Recompute the signature using the same method.
//     const computedSignature = sign(dataToSign, CYBERSOURCE_SECRET_KEY);
//
//     // Compare the computed signature with the received signature.
//     if (computedSignature === responseSignature) {
//       const decision = fields.decision; // For example, "ACCEPT", "DECLINE", "ERROR"
//       console.log("[paymentResponse] Valid signature. Decision:", decision);
//
//       // Process further actions (update order, notify user, etc.) as needed.
//       return res.status(200).json({
//         success: true,
//         message: `Payment ${decision}`,
//         data: fields,
//       });
//     } else {
//       console.error("[paymentResponse] Signature mismatch!");
//       return res.status(400).json({
//         success: false,
//         message: "Invalid signature in payment response.",
//       });
//     }
//   } catch (error) {
//     console.error("[paymentResponse] Error:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Error processing payment response.",
//       error: error.message,
//     });
//   }
// };

/***********************************
 * cybersourceController.js
 * ---------------------------------
 * Node.js controller for CyberSource
 * Secure Acceptance Hosted Checkout Integration.
 **********************************/
const crypto = require("crypto");
const uuid = require("uuid");
require("dotenv").config();

const {
  CYBERSOURCE_PROFILE_ID,
  CYBERSOURCE_ACCESS_KEY,
  CYBERSOURCE_SECRET_KEY,
} = process.env;

function sign(data, secretKey) {
  const orderedFields = data.signed_field_names.split(",");
  const signingString = orderedFields
    .map((field) => `${field}=${data[field]}`)
    .join(",");
  const hmac = crypto.createHmac("sha256", secretKey);
  hmac.update(signingString);
  return hmac.digest("base64");
}

exports.initiateCyberSourcePayment = async (req, res) => {
  try {
    const {
      amount,
      currency = "USD",
      referenceNumber,
      device_fingerprint_id,
    } = req.body;

    const transactionUuid = uuid.v4();
    const signedDateTime = new Date().toISOString().split(".")[0] + "Z";

    const signedFieldNames = [
      "access_key",
      "profile_id",
      "transaction_uuid",
      "signed_field_names",
      "signed_date_time",
      "transaction_type",
      "reference_number",
      "amount",
      "currency",
      "locale",
      "device_fingerprint_id",
      "override_custom_cancel_page", // Add override_custom_cancel_page
      "override_custom_receipt_page", // Add override_custom_receipt_page
    ];

    const fieldsToSign = {
      access_key: CYBERSOURCE_ACCESS_KEY,
      profile_id: CYBERSOURCE_PROFILE_ID,
      transaction_uuid: transactionUuid,
      signed_field_names: signedFieldNames.join(","),
      signed_date_time: signedDateTime,
      transaction_type: "sale",
      reference_number: referenceNumber || `REF-${Date.now()}`,
      amount,
      currency,
      locale: "en-us",
      device_fingerprint_id,
      override_custom_cancel_page: "http://localhost:5173/payment-response", // Custom cancel page
      override_custom_receipt_page: "http://localhost:5173/payment-response", // Custom receipt page
    };

    const signature = sign(fieldsToSign, CYBERSOURCE_SECRET_KEY);
    const paymentUrl = "https://secureacceptance.cybersource.com/pay";

    return res.json({
      success: true,
      message: "Payment form parameters generated successfully.",
      paymentUrl,
      formFields: {
        ...fieldsToSign,
        signature,
      },
    });
  } catch (error) {
    console.error("[initiateCyberSourcePayment] Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to initiate payment session.",
      error: error.message,
    });
  }
};

exports.paymentResponse = async (req, res) => {
  try {
    const fields = { ...req.body };
    const responseSignature = fields.signature;
    delete fields.signature;
    const signedNames = fields.signed_field_names.split(",");
    const dataToSign = {};
    signedNames.forEach((field) => {
      dataToSign[field] = fields[field];
    });
    const computedSignature = sign(dataToSign, CYBERSOURCE_SECRET_KEY);

    if (computedSignature === responseSignature) {
      const decision = fields.decision;
      console.log("[paymentResponse] Valid signature. Decision:", decision);

      return res.status(200).json({
        success: true,
        message: `Payment ${decision}`,
        data: fields,
      });
    } else {
      console.error("[paymentResponse] Signature mismatch!");
      return res.status(400).json({
        success: false,
        message: "Invalid signature in payment response.",
      });
    }
  } catch (error) {
    console.error("[paymentResponse] Error:", error);
    return res.status(500).json({
      success: false,
      message: "Error processing payment response.",
      error: error.message,
    });
  }
};
