
import express from "express";
import {
  getMyTransactions,
  getMyTransaction
} from "../controllers/transactionController.js";

import {
  getMyTransactionAgreement,
  respondToTransactionAgreement
} from "../controllers/transactionAgreementController.js";

import { authenticate } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(authenticate);

// Get transactions belonging to the logged-in member
router.get("/mine", getMyTransactions);

// Get one transaction belonging to the logged-in member
router.get("/mine/:transactionId", getMyTransaction);
// Get the published agreement for a member's transaction
router.get(
  "/mine/:transactionId/agreement",
  getMyTransactionAgreement
);

// Submit the member's agreement decision
router.patch(
  "/mine/:transactionId/agreement/:agreementId/respond",
  respondToTransactionAgreement
);

export default router;
