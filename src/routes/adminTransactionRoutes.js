import express from "express";
import {
  createAdminTransaction,
  getAllAdminTransactions,
  getAdminTransaction,
  updateAdminTransactionStatus,
} from "../controllers/adminTransactionController.js";
import {
  createAdminTransactionAgreement,
  publishAdminTransactionAgreement,
  getAdminTransactionAgreements,
  supersedeAdminTransactionAgreement
} from "../controllers/adminTransactionAgreementController.js";

import {
  getAdminTransactionPayments,
  reviewTransactionPayment
} from "../controllers/transactionPaymentController.js";

import { authenticate, authorizeRoles } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(authenticate, authorizeRoles("admin", "superadmin"));

// List all transactions
router.get("/", getAllAdminTransactions);

// Create an agreement draft
router.post("/:transactionId/agreement", createAdminTransactionAgreement);

// Publish an agreement for buyer and seller review
router.patch(
  "/:transactionId/agreement/:agreementId/publish",
  publishAdminTransactionAgreement,
);

// Get all agreement versions for a transaction
router.get("/:transactionId/agreements", getAdminTransactionAgreements);

// Create a transaction from an approved application
router.post("/application/:applicationId", createAdminTransaction);

// Get one transaction
router.get("/:transactionId", getAdminTransaction);

// Update transaction status
router.patch("/:transactionId/status", updateAdminTransactionStatus);
router.patch(
  "/:transactionId/agreement/:agreementId/supersede",
  supersedeAdminTransactionAgreement,

);
router.get(
  "/:transactionId/payments",
  getAdminTransactionPayments
);

router.patch(
  "/:transactionId/payments/:paymentId/review",
  reviewTransactionPayment
);

export default router;
