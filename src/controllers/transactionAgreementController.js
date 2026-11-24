
import mongoose from "mongoose";
import Transaction from "../models/Transaction.js";
import TransactionAgreement from "../models/TransactionAgreement.js";

function sendError(res, status, message) {
  return res.status(status).json({
    success: false,
    message
  });
}

// Get the latest published agreement for the logged-in buyer or seller.
export async function getMyTransactionAgreement(req, res, next) {
  try {
    const { transactionId } = req.params;

    if (!mongoose.isValidObjectId(transactionId)) {
      return sendError(res, 400, "Invalid transaction ID.");
    }

    const transaction = await Transaction.findOne({
      _id: transactionId,
      $or: [
        { buyer: req.user._id },
        { seller: req.user._id }
      ]
    });

    if (!transaction) {
      return sendError(res, 404, "Transaction not found.");
    }

    const agreement = await TransactionAgreement.findOne({
      transaction: transaction._id,
      status: { $in: ["pending_review", "accepted", "rejected"] }
    })
      .sort({ version: -1 })
      .populate("createdBy", "firstName lastName")
      .populate("buyerResponse.respondedBy", "firstName lastName")
      .populate("sellerResponse.respondedBy", "firstName lastName");

    if (!agreement) {
      return res.status(200).json({
        success: true,
        message: "No published agreement is available yet.",
        data: null
      });
    }

    return res.status(200).json({
      success: true,
      data: agreement
    });
  } catch (error) {
    next(error);
  }
}


export async function respondToTransactionAgreement(req, res, next) {
  try {
    const { transactionId, agreementId } = req.params;
    const { decision, note = "" } = req.body;

    if (
      !mongoose.isValidObjectId(transactionId) ||
      !mongoose.isValidObjectId(agreementId)
    ) {
      return sendError(res, 400, "Invalid transaction or agreement ID.");
    }

    if (!["accepted", "rejected"].includes(decision)) {
      return sendError(res, 400, "Decision must be accepted or rejected.");
    }

    if (
      typeof note !== "string" ||
      note.trim().length > 2000
    ) {
      return sendError(res, 400, "Response note is invalid.");
    }

    const transaction = await Transaction.findOne({
      _id: transactionId,
      $or: [
        { buyer: req.user._id },
        { seller: req.user._id }
      ]
    });

    if (!transaction) {
      return sendError(res, 404, "Transaction not found.");
    }

    if (
      ["completed", "cancelled", "disputed"].includes(
        transaction.status
      )
    ) {
      return sendError(
        res,
        409,
        "This transaction is not accepting agreement responses."
      );
    }

    const isBuyer =
      String(transaction.buyer) === String(req.user._id);

    const responseField = isBuyer
      ? "buyerResponse"
      : "sellerResponse";

    const otherResponseField = isBuyer
      ? "sellerResponse"
      : "buyerResponse";

    const now = new Date();

    // Atomically record the response and update agreement status.
    const updatedAgreement = await TransactionAgreement.findOneAndUpdate(
      {
        _id: agreementId,
        transaction: transaction._id,
        status: "pending_review",
        [`${responseField}.decision`]: "pending"
      },
      [
        {
          $set: {
            [`${responseField}.decision`]: {
              $literal: decision
            },
            [`${responseField}.note`]: {
              $literal: note.trim()
            },
            [`${responseField}.respondedAt`]: {
              $literal: now
            },
            [`${responseField}.respondedBy`]: {
              $literal: req.user._id
            },
            status:
              decision === "rejected"
                ? { $literal: "rejected" }
                : {
                    $cond: [
                      {
                        $eq: [
                          `$${otherResponseField}.decision`,
                          "accepted"
                        ]
                      },
                      "accepted",
                      "pending_review"
                    ]
                  }
          }
        }
      ],
      {
        new: true
      }
    );

    if (!updatedAgreement) {
      const existingAgreement =
        await TransactionAgreement.findOne({
          _id: agreementId,
          transaction: transaction._id
        });

      if (!existingAgreement) {
        return sendError(res, 404, "Agreement not found.")
      }

      return sendError(
        res,
        409,
        "You have already responded or this agreement is no longer open for review."
      );
    }

    const populatedAgreement =
      await TransactionAgreement.findById(updatedAgreement._id)
        .populate("createdBy", "firstName lastName")
        .populate("buyerResponse.respondedBy", "firstName lastName")
        .populate("sellerResponse.respondedBy", "firstName lastName");

    return res.status(200).json({
      success: true,
      message:
        decision === "accepted"
          ? "Your acknowledgement has been recorded."
          : "Your rejection has been recorded.",
      data: populatedAgreement
    });
  } catch (error) {
    next(error);
  }
}
