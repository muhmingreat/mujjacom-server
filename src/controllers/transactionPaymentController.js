import mongoose from "mongoose";
import Transaction from "../models/Transaction.js";
import TransactionPayment from "../models/TransactionPayment.js";

import {
  uploadPaymentEvidence,
  createPaymentEvidenceAccessUrl,
} from "../services/uploadService.js";

function sendError(res, status, message, code) {
  return res.status(status).json({
    success: false,
    ...(code ? { code } : {}),
    message,
  });
}

// Member submits a payment record
// export async function submitTransactionPayment(req, res) {
//   try {
//     const { transactionId } = req.params;
//     const {
//       amount,
//       paymentType,
//       paymentMethod,
//       paymentReference,
//       evidenceUrl,
//       note
//     } = req.body;

//     if (!mongoose.isValidObjectId(transactionId)) {
//       return sendError(res, 400, "Invalid transaction ID.");
//     }

//     const transaction = await Transaction.findById(transactionId);

//     if (!transaction) {
//       return sendError(res, 404, "Transaction not found.");
//     }

//     if (String(transaction.buyer) !== String(req.user._id)) {
//       return sendError(
//         res,
//         403,
//         "Only the transaction buyer can submit a payment."
//       );
//     }

//     if (!["payment_pending", "in_progress"].includes(transaction.status)) {
//       return sendError(
//         res,
//         409,
//         "Payments can only be submitted when the transaction is awaiting payment or in progress."
//       );
//     }

//     if (
//       !Number.isFinite(Number(amount)) ||
//       Number(amount) <= 0 ||
//       Number(amount) > transaction.agreedAmount
//     ) {
//       return sendError(res, 400, "Enter a valid payment amount.");
//     }

//     const allowedPaymentTypes = [
//       "deposit",
//       "installment",
//       "balance",
//       "other"
//     ];

//     const allowedPaymentMethods = [
//       "bank_transfer",
//       "cash",
//       "other"
//     ];

//     if (!allowedPaymentTypes.includes(paymentType)) {
//       return sendError(res, 400, "Invalid payment type.");
//     }

//     if (!allowedPaymentMethods.includes(paymentMethod)) {
//       return sendError(res, 400, "Invalid payment method.");
//     }

//     if (
//       paymentReference &&
//       String(paymentReference).trim().length > 150
//     ) {
//       return sendError(res, 400, "Payment reference is too long.");
//     }

//     if (note && String(note).trim().length > 2000) {
//       return sendError(res, 400, "Payment note is too long.");
//     }

//     if (evidenceUrl) {
//       try {
//         const parsedUrl = new URL(evidenceUrl);

//         if (!["http:", "https:"].includes(parsedUrl.protocol)) {
//           return sendError(res, 400, "Invalid payment evidence URL.");
//         }
//       } catch {
//         return sendError(res, 400, "Invalid payment evidence URL.");
//       }
//     }

//     const payment = await TransactionPayment.create({
//       transaction: transaction._id,
//       payer: req.user._id,
//       amount: Number(amount),
//       currency: transaction.currency,
//       paymentType,
//       paymentMethod,
//       paymentReference: paymentReference?.trim() || "",
//       evidenceUrl: evidenceUrl?.trim() || "",
//       note: note?.trim() || ""
//     });

//     return res.status(201).json({
//       success: true,
//       message: "Payment record submitted successfully. It is awaiting admin review.",
//       data: payment
//     });
//   } catch (error) {
//     console.error("Submit transaction payment error:", error);
//     return sendError(res, 500, "Unable to submit payment record.");
//   }
// }
// Member submits a payment record
export async function submitTransactionPayment(req, res) {
  try {
    const { transactionId } = req.params;

    const { amount, paymentType, paymentMethod, paymentReference, note } =
      req.body;

    if (!mongoose.isValidObjectId(transactionId)) {
      return sendError(res, 400, "Invalid transaction ID.");
    }

    const transaction = await Transaction.findById(transactionId);

    if (!transaction) {
      return sendError(res, 404, "Transaction not found.");
    }

    if (String(transaction.buyer) !== String(req.user._id)) {
      return sendError(
        res,
        403,
        "Only the transaction buyer can submit a payment.",
      );
    }

    if (!["payment_pending", "in_progress"].includes(transaction.status)) {
      return sendError(
        res,
        409,
        "Payments can only be submitted when the transaction is awaiting payment or in progress.",
      );
    }

    if (
      !Number.isFinite(Number(amount)) ||
      Number(amount) <= 0 ||
      Number(amount) > transaction.agreedAmount
    ) {
      return sendError(res, 400, "Enter a valid payment amount.");
    }

    const allowedPaymentTypes = ["deposit", "installment", "balance", "other"];

    const allowedPaymentMethods = ["bank_transfer", "cash", "other"];

    if (!allowedPaymentTypes.includes(paymentType)) {
      return sendError(res, 400, "Invalid payment type.");
    }

    if (!allowedPaymentMethods.includes(paymentMethod)) {
      return sendError(res, 400, "Invalid payment method.");
    }

    if (paymentReference && String(paymentReference).trim().length > 150) {
      return sendError(res, 400, "Payment reference is too long.");
    }

    if (note && String(note).trim().length > 2000) {
      return sendError(res, 400, "Payment note is too long.");
    }

    let evidence = null;

    if (req.file) {
      evidence = await uploadPaymentEvidence(
        req.file.buffer,
        req.file.mimetype,
      );
    }

    const payment = await TransactionPayment.create({
      transaction: transaction._id,
      payer: req.user._id,
      amount: Number(amount),
      currency: transaction.currency,
      paymentType,
      paymentMethod,
      paymentReference: paymentReference?.trim() || "",
      evidenceUrl: "",
      evidencePublicId: evidence?.publicId || "",
      evidenceResourceType: evidence?.resourceType || null,
      evidenceFormat: evidence?.format || "",
      note: note?.trim() || "",
    });

    return res.status(201).json({
      success: true,
      message:
        "Payment record submitted successfully. It is awaiting admin review.",
      data: payment,
    });
  } catch (error) {
    console.error("Submit transaction payment error:", error);

    return sendError(
      res,
      500,
      "Unable to submit payment record. Please try again.",
    );
  }
}

// Member views their payment records
export async function getMyTransactionPayments(req, res) {
  try {
    const { transactionId } = req.params;

    if (!mongoose.isValidObjectId(transactionId)) {
      return sendError(res, 400, "Invalid transaction ID.");
    }

    const transaction = await Transaction.findOne({
      _id: transactionId,
      $or: [{ buyer: req.user._id }, { seller: req.user._id }],
    });

    if (!transaction) {
      return sendError(res, 404, "Transaction not found.");
    }

    // const payments = await TransactionPayment.find({
    //   transaction: transaction._id
    // })
    //   .populate("payer", "firstName lastName")
    //   .populate("verifiedBy", "firstName lastName")
    //   .sort({ submittedAt: -1 });

    const payments = await TransactionPayment.find({
      transaction: transaction._id,
    })
      .populate("payer", "firstName lastName")
      .populate("verifiedBy", "firstName lastName")
      .sort({ submittedAt: -1 });

    const paymentsWithEvidence = await Promise.all(
      payments.map(async (payment) => {
        const paymentData = payment.toObject();

        if (
          payment.evidencePublicId &&
          payment.evidenceFormat &&
          payment.evidenceResourceType
        ) {
          paymentData.evidenceUrl = createPaymentEvidenceAccessUrl(
            payment.evidencePublicId,
            payment.evidenceFormat,
            payment.evidenceResourceType,
          );
        }

        return paymentData;
      }),
    );

    const verifiedAmount = payments
      .filter((payment) => payment.status === "verified")
      .reduce((total, payment) => total + payment.amount, 0);

    return res.status(200).json({
      success: true,
      data: {
        payments,
        agreedAmount: transaction.agreedAmount,
        currency: transaction.currency,
        verifiedAmount,
        outstandingBalance: Math.max(
          0,
          transaction.agreedAmount - verifiedAmount,
        ),
      },
    });
  } catch (error) {
    console.error("Get member transaction payments error:", error);
    return sendError(res, 500, "Unable to retrieve payment records.");
  }
}

// Admin views payment records for a transaction
export async function getAdminTransactionPayments(req, res) {
  try {
    const { transactionId } = req.params;

    if (!mongoose.isValidObjectId(transactionId)) {
      return sendError(res, 400, "Invalid transaction ID.");
    }

    const transaction = await Transaction.findById(transactionId);

    if (!transaction) {
      return sendError(res, 404, "Transaction not found.");
    }

    const payments = await TransactionPayment.find({
      transaction: transaction._id,
    })
      .populate("payer", "firstName lastName email")
      .populate("verifiedBy", "firstName lastName")
      .sort({ submittedAt: -1 });

    const paymentsWithEvidence = await Promise.all(
      payments.map(async (payment) => {
        const paymentData = payment.toObject();

        if (
          payment.evidencePublicId &&
          payment.evidenceFormat &&
          payment.evidenceResourceType
        ) {
          paymentData.evidenceUrl = createPaymentEvidenceAccessUrl(
            payment.evidencePublicId,
            payment.evidenceFormat,
            payment.evidenceResourceType,
          );
        }

        return paymentData;
      }),
    );

    const verifiedAmount = payments
      .filter((payment) => payment.status === "verified")
      .reduce((total, payment) => total + payment.amount, 0);

    return res.status(200).json({
      success: true,
      data: {
        transaction,
        payments: paymentsWithEvidence,
        verifiedAmount,
        outstandingBalance: Math.max(
          0,
          transaction.agreedAmount - verifiedAmount,
        ),
      },
    });
  } catch (error) {
    console.error("Get admin transaction payments error:", error);
    return sendError(res, 500, "Unable to retrieve transaction payments.");
  }
}

// Admin verifies or rejects a submitted payment

export async function reviewTransactionPayment(req, res) {
  let session;

  try {
    const { transactionId, paymentId } = req.params;
    const { decision, reviewNote } = req.body;

    if (
      !mongoose.isValidObjectId(transactionId) ||
      !mongoose.isValidObjectId(paymentId)
    ) {
      return sendError(res, 400, "Invalid transaction or payment ID.");
    }

    if (!["verified", "rejected"].includes(decision)) {
      return sendError(res, 400, "Invalid payment review decision.");
    }

    if (reviewNote && String(reviewNote).trim().length > 2000) {
      return sendError(res, 400, "Review note is too long.");
    }

    const transaction = await Transaction.findById(transactionId);

    if (!transaction) {
      return sendError(res, 404, "Transaction not found.");
    }

    session = await mongoose.startSession();

    let updatedPaymentId = null;

    await session.withTransaction(async () => {
      // Serialize payment reviews for this transaction.
      // Incrementing __v forces concurrent reviews to conflict
      // and retry instead of using the same outdated payment total.
      const lockResult = await Transaction.collection.updateOne(
        { _id: transaction._id },
        { $inc: { __v: 1 } },
        { session },
      );

      if (lockResult.matchedCount !== 1) {
        const error = new Error("Transaction not found.");
        error.statusCode = 404;
        throw error;
      }

      const currentTransaction = await Transaction.findById(
        transaction._id,
      ).session(session);

      if (!currentTransaction) {
        const error = new Error("Transaction not found.");
        error.statusCode = 404;
        throw error;
      }

      const payment = await TransactionPayment.findOne({
        _id: paymentId,
        transaction: currentTransaction._id,
        status: "pending",
      }).session(session);

      if (!payment) {
        const error = new Error(
          "Pending payment record not found. It may already have been reviewed.",
        );
        error.statusCode = 404;
        throw error;
      }

      if (decision === "verified") {
        const result = await TransactionPayment.aggregate([
          {
            $match: {
              transaction: currentTransaction._id,
              status: "verified",
            },
          },
          {
            $group: {
              _id: null,
              total: { $sum: "$amount" },
            },
          },
        ]).session(session);

        const alreadyVerified = result[0]?.total || 0;

        if (
          alreadyVerified + payment.amount >
          currentTransaction.agreedAmount
        ) {
          const error = new Error(
            "Verifying this payment would exceed the agreed transaction amount.",
          );
          error.statusCode = 409;
          throw error;
        }
      }

      const updatedPayment = await TransactionPayment.findOneAndUpdate(
        {
          _id: paymentId,
          transaction: currentTransaction._id,
          status: "pending",
        },
        {
          $set: {
            status: decision,
            reviewNote: reviewNote?.trim() || "",
            verifiedBy: req.user._id,
            verifiedAt: decision === "verified" ? new Date() : null,
          },
        },
        {
          new: true,
          runValidators: true,
          session,
        },
      );

      if (!updatedPayment) {
        const error = new Error("This payment has already been reviewed.");
        error.statusCode = 409;
        throw error;
      }

      updatedPaymentId = updatedPayment._id;
    });

    const updatedPayment = await TransactionPayment.findById(updatedPaymentId)
      .populate("payer", "firstName lastName email")
      .populate("verifiedBy", "firstName lastName");

    return res.status(200).json({
      success: true,
      message: `Payment ${decision} successfully.`,
      data: updatedPayment,
    });
  } catch (error) {
    console.error("Review transaction payment error:", error);

    if (error.statusCode) {
      return sendError(res, error.statusCode, error.message);
    }

    return sendError(res, 500, "Unable to review payment.");
  } finally {
    if (session) {
      await session.endSession();
    }
  }
}
