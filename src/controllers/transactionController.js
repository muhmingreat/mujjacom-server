
import mongoose from "mongoose";
import Transaction from "../models/Transaction.js";

export async function getMyTransactions(req, res, next) {
  try {
    const userId = req.user._id;

    const {
      status = "",
      page = 1,
      limit = 10
    } = req.query;

    const currentPage = Math.max(1, Number.parseInt(page, 10) || 1);
    const pageSize = Math.min(
      50,
      Math.max(1, Number.parseInt(limit, 10) || 10)
    );

    const filter = {
      $or: [
        { buyer: userId },
        { seller: userId }
      ]
    };

    if (status) {
      const validStatuses = [
        "initiated",
        "terms_pending",
        "agreement_pending",
        "payment_pending",
        "in_progress",
        "completed",
        "cancelled",
        "disputed"
      ];

      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid transaction status."
        });
      }

      filter.status = status;
    }

    const [transactions, total] = await Promise.all([
      Transaction.find(filter)
        .populate("property", "title slug transactionType location media")
        .populate("buyer", "firstName lastName")
        .populate("seller", "firstName lastName")
        .sort({ createdAt: -1 })
        .skip((currentPage - 1) * pageSize)
        .limit(pageSize),

      Transaction.countDocuments(filter)
    ]);

    return res.status(200).json({
      success: true,
      data: transactions,
      pagination: {
        total,
        page: currentPage,
        limit: pageSize,
        pages: Math.ceil(total / pageSize)
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function getMyTransaction(req, res, next) {
  try {
    const { transactionId } = req.params;

    if (!mongoose.isValidObjectId(transactionId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid transaction ID."
      });
    }

    const transaction = await Transaction.findOne({
      _id: transactionId,
      $or: [
        { buyer: req.user._id },
        { seller: req.user._id }
      ]
    })
      .populate("property", "title slug transactionType location media")
      .populate("buyer", "firstName lastName")
      .populate("seller", "firstName lastName")
      .populate("statusHistory.changedBy", "firstName lastName");

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found."
      });
    }

    return res.status(200).json({
      success: true,
      data: transaction
    });
  } catch (error) {
    next(error);
  }
}
