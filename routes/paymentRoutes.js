const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const { markOrderAsPaid } = require("../controllers/orderController");

router.post("/pay", protect, (req, res) => {
  const { amount, method } = req.body;

  if (!amount || !method) {
    return res.status(400).json({
      message: "Payment amount and method are required",
    });
  }

  res.status(200).json({
    success: true,
    message: "Payment processed successfully (simulation)",
    transactionId: Date.now(),
  });
});

router.post("/mark-paid", protect, markOrderAsPaid);

module.exports = router;
