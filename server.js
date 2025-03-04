const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const bodyParser = require("body-parser"); // Import body-parser
const paymentRouter = require("./routes/paymentRoute");

dotenv.config();

const app = express();
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true })); // ✅ Add this to handle form-data

process.env.environment === "development"
  ? app.use(
      cors({
        origin: "*",
        credentials: true,
        methods: ["GET", "POST"],
      })
    )
  : app.use(
      cors({
        origin: "https://dpay-dev.netlify.app",
        credentials: true,
        methods: ["GET", "POST"],
      })
    );

const PORT = process.env.PORT || 8080;
app.use("/payment", paymentRouter);

app.get("/", (req, res) => {
  res.send("<h1 style='text-align:center;color:green'>Website is Running</h1>");
});

app.listen(PORT, () => console.log(`[DEBUG] Server running on port ${PORT}`));
