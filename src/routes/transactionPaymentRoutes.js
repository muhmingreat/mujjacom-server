
import express from "express";
import { uploadPaymentEvidence } from "../middleware/uploadMiddleware.js";
import {
  submitTransactionPayment,
  getMyTransactionPayments
} from "../controllers/transactionPaymentController.js";

import { authenticate } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(authenticate);

// router.post(
//   "/:transactionId",
//   submitTransactionPayment
// );
router.post(
  "/:transactionId",
  uploadPaymentEvidence,
  submitTransactionPayment
);

router.get(
  "/:transactionId",
  getMyTransactionPayments
);

export default router;
