const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const paymentRouter = require("./routes/paymentRoute");

dotenv.config();

const app = express();
app.use(express.json());
app.use(
  cors({
    origin: "*",
    credentials: true,
    methods: ["GET", "POST"],
  })
);

const PORT = process.env.PORT || 8080;

// Mount payment routes
app.use("/payment", paymentRouter);

// Health-check endpoint
app.get("/", (req, res) => {
  res.send("<h1 style='text-align:center;color:green'>Website is Running</h1>");
});

// Start the server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
