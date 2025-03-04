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
      override_custom_cancel_page:
        "https://qpyabackend.onrender.com/payment/cybersource/response",
      override_custom_receipt_page:
        "https://qpyabackend.onrender.com/payment/cybersource/response",
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
  console.log("Cybersource Response Received:", req.body);

  try {
    const fields = { ...req.body };

    if (!fields.signed_field_names) {
      console.error(
        "[paymentResponse] Missing signed_field_names in response."
      );
      return res.redirect(
        "https://dpay-dev.netlify.app/payment-response?status=error&message=No Response Data"
      );
    }

    const responseSignature = fields.signature;
    delete fields.signature;

    const signedNames = fields.signed_field_names
      ? fields.signed_field_names.split(",")
      : [];
    const dataToSign = {};
    signedNames.forEach((field) => {
      dataToSign[field] = fields[field];
    });

    const computedSignature = sign(dataToSign, CYBERSOURCE_SECRET_KEY);

    if (computedSignature === responseSignature) {
      const decision = fields.decision || "UNKNOWN";
      console.log("[paymentResponse] Valid signature. Decision:", decision);

      return res.redirect(
        `https://dpay-dev.netlify.app/payment-response?status=${decision}&message=Transaction ${decision}`
      );
    } else {
      console.error("[paymentResponse] Signature mismatch!");
      return res.redirect(
        "https://dpay-dev.netlify.app/payment-response?status=failed&message=Invalid Signature"
      );
    }
  } catch (error) {
    console.error("[paymentResponse] Error:", error);
    return res.redirect(
      "https://dpay-dev.netlify.app/payment-response?status=error&message=Processing Error"
    );
  }
};
