const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const paymentRouter = require("./routes/paymentRoute");

dotenv.config();

const app = express();
app.use(express.json());

app.use(
  cors({
    origin: "https://dpay-dev.netlify.app/",
    credentials: true,
    methods: ["GET", "POST"],
  })
);

///To get the server Ip Address
// const axios = require("axios");
// async function logOutboundIP() {
//   try {
//     const res = await axios.get("https://api.ipify.org?format=json");
//     console.log("[DEBUG - Outbound] Outbound IP is:", res.data.ip);
//   } catch (err) {
//     console.error("[DEBUG] Could not determine outbound IP", err);
//   }
// }
// logOutboundIP();

const PORT = process.env.PORT || 8080;
// console.log(`[DEBUG] Server will run on port: ${PORT}`);

// Mount payment routes under /payment
app.use("/payment", paymentRouter);
// console.log("[DEBUG] Payment routes mounted at /payment");

// Health-check endpoint
app.get("/", (req, res) => {
  console.log("[DEBUG] Health-check endpoint accessed");
  res.send("<h1 style='text-align:center;color:green'>Website is Running</h1>");
});

// Start the server
app.listen(PORT, () => console.log(`[DEBUG] Server running on port ${PORT}`));
