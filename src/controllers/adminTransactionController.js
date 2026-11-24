
import mongoose from "mongoose";
import { randomBytes } from "node:crypto";
import Application from "../models/Application.js";
import Property from "../models/Property.js";
import Transaction from "../models/Transaction.js";
import TransactionAgreement from "../models/TransactionAgreement.js";

const allowedTransitions = {
  initiated: ["terms_pending", "cancelled", "disputed"],
  terms_pending: ["agreement_pending", "cancelled", "disputed"],
  agreement_pending: ["payment_pending", "in_progress", "cancelled", "disputed"],
  payment_pending: ["in_progress", "cancelled", "disputed"],
  in_progress: ["completed", "cancelled", "disputed"],
  disputed: ["in_progress", "completed", "cancelled"],
  completed: [],
  cancelled: []
};

function createTransactionReference() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = randomBytes(4).toString("hex").toUpperCase();

  return `AMN-${timestamp}-${random}`;
}

function sendError(res, status, message, code) {
  return res.status(status).json({
    success: false,
    ...(code ? { code } : {}),
    message
  });
}

export async function createAdminTransaction(req, res, next) {
  try {
    const { applicationId } = req.params;
    const { agreedAmount, currency = "NGN", note = "" } = req.body;

    if (!mongoose.isValidObjectId(applicationId)) {
      return sendError(res, 400, "Invalid application ID.");
    }

    const amount = Number(agreedAmount);

    if (!Number.isFinite(amount) || amount <= 0) {
      return sendError(res, 400, "Agreed amount must be greater than zero.");
    }

    const normalizedCurrency = String(currency).trim().toUpperCase();

    if (!/^[A-Z]{3}$/.test(normalizedCurrency)) {
      return sendError(res, 400, "Currency must be a valid three-letter code.");
    }

    if (typeof note !== "string" || note.trim().length > 2000) {
      return sendError(res, 400, "The transaction note is invalid.");
    }

    const application = await Application.findById(applicationId);

    if (!application) {
      return sendError(res, 404, "Application not found.");
    }

    if (application.status !== "approved") {
      return sendError(
        res,
        400,
        "Only approved applications can be converted into transactions."
      );
    }

    const existingTransaction = await Transaction.findOne({
      application: application._id
    });

    if (existingTransaction) {
      return sendError(
        res,
        409,
        "A transaction already exists for this application.",
        "TRANSACTION_ALREADY_EXISTS"
      );
    }

    const property = await Property.findById(application.property);

    if (!property) {
      return sendError(res, 404, "The associated property was not found.");
    }

    if (!property.owner) {
      return sendError(res, 400, "The property has no assigned owner.");
    }

    if (String(property.owner) === String(application.applicant)) {
      return sendError(
        res,
        400,
        "The applicant and property owner cannot be the same user."
      );
    }

    if (property.status !== "published") {
      return sendError(
        res,
        409,
        "This property is not currently available for a new transaction."
      );
    }

    const expectedPropertyType = {
      purchase: "sale",
      rent: "rent",
      lease: "lease"
    };

    if (
      expectedPropertyType[application.applicationType] !==
      property.transactionType
    ) {
      return sendError(
        res,
        400,
        "The application type does not match the property's transaction type."
      );
    }

    const transaction = await Transaction.create({
      transactionReference: createTransactionReference(),
      application: application._id,
      property: property._id,
      buyer: application.applicant,
      seller: property.owner,
      transactionType: application.applicationType,
      agreedAmount: amount,
      currency: normalizedCurrency,
      status: "initiated",
      createdBy: req.user._id,
      statusHistory: [
        {
          status: "initiated",
          note: note.trim() || "Transaction created by an administrator.",
          changedBy: req.user._id
        }
      ]
    });

    const populatedTransaction = await Transaction.findById(transaction._id)
      .populate("application")
      .populate("property")
      .populate("buyer", "firstName lastName email phone")
      .populate("seller", "firstName lastName email phone")
      .populate("createdBy", "firstName lastName");

    return res.status(201).json({
      success: true,
      message: "Transaction created successfully.",
      data: populatedTransaction
    });
  } catch (error) {
    if (error.code === 11000) {
      return sendError(
        res,
        409,
        "A transaction already exists for this application or the reference collided.",
        "DUPLICATE_TRANSACTION"
      );
    }

    next(error);
  }
}

// export async function getAllAdminTransactions(req, res, next) {
//   try {
//     const {
//       search = "",
//       status = "",
//       transactionType = "",
//       page = 1,
//       limit = 10
//     } = req.query;

//     const currentPage = Math.max(1, Number.parseInt(page, 10) || 1);
//     const pageSize = Math.min(
//       100,
//       Math.max(1, Number.parseInt(limit, 10) || 10)
//     );

//     const filter = {};

//     if (status) {
//       if (!allowedTransitions[status]) {
//         return sendError(res, 400, "Invalid transaction status.");
//       }

//       filter.status = status;
//     }

//     if (transactionType) {
//       if (!["purchase", "rent", "lease"].includes(transactionType)) {
//         return sendError(res, 400, "Invalid transaction type.");
//       }

//       filter.transactionType = transactionType;
//     }

//     if (search.trim()) {
//       const matchingProperties = await Property.find({
//         title: { $regex: search.trim(), $options: "i" }
//       }).select("_id");

//       const matchingUsers = await mongoose.model("User").find({
//         $or: [
//           { firstName: { $regex: search.trim(), $options: "i" } },
//           { lastName: { $regex: search.trim(), $options: "i" } },
//           { email: { $regex: search.trim(), $options: "i" } }
//         ]
//       }).select("_id");

//       filter.$or = [
//         { transactionReference: { $regex: search.trim(), $options: "i" } },
//         { property: { $in: matchingProperties.map((item) => item._id) } },
//         { buyer: { $in: matchingUsers.map((item) => item._id) } },
//         { seller: { $in: matchingUsers.map((item) => item._id) } }
//       ];
//     }

//     const [transactions, total] = await Promise.all([
//       Transaction.find(filter)
//         .populate("property", "title slug transactionType location")
//         .populate("buyer", "firstName lastName email")
//         .populate("seller", "firstName lastName email")
//         .populate("createdBy", "firstName lastName")
//         .sort({ createdAt: -1 })
//         .skip((currentPage - 1) * pageSize)
//         .limit(pageSize),

//       Transaction.countDocuments(filter)
//     ]);

//     return res.status(200).json({
//       success: true,
//       data: transactions,
//       pagination: {
//         total,
//         page: currentPage,
//         limit: pageSize,
//         pages: Math.ceil(total / pageSize)
//       }
//     });
//   } catch (error) {
//     next(error);
//   }
// }


export async function getAllAdminTransactions(req, res, next) {
  try {
    const {
      search = "",
      status = "",
      transactionType = "",
      page = 1,
      limit = 10
    } = req.query;

    const currentPage = Math.max(1, Number.parseInt(page, 10) || 1);
    const pageSize = Math.min(
      100,
      Math.max(1, Number.parseInt(limit, 10) || 10)
    );

    const filter = {};

    if (status) {
      if (!allowedTransitions[status]) {
        return sendError(res, 400, "Invalid transaction status.");
      }

      filter.status = status;
    }

    if (transactionType) {
      if (!["purchase", "rent", "lease"].includes(transactionType)) {
        return sendError(res, 400, "Invalid transaction type.");
      }

      filter.transactionType = transactionType;
    }

    if (search.trim()) {
      const matchingProperties = await Property.find({
        title: { $regex: search.trim(), $options: "i" }
      }).select("_id");

      const matchingUsers = await mongoose.model("User").find({
        $or: [
          { firstName: { $regex: search.trim(), $options: "i" } },
          { lastName: { $regex: search.trim(), $options: "i" } },
          { email: { $regex: search.trim(), $options: "i" } }
        ]
      }).select("_id");

      filter.$or = [
        { transactionReference: { $regex: search.trim(), $options: "i" } },
        { property: { $in: matchingProperties.map((item) => item._id) } },
        { buyer: { $in: matchingUsers.map((item) => item._id) } },
        { seller: { $in: matchingUsers.map((item) => item._id) } }
      ];
    }

    const [transactions, total] = await Promise.all([
      Transaction.find(filter)
        .populate("property", "title slug transactionType location")
        .populate("buyer", "firstName lastName email")
        .populate("seller", "firstName lastName email")
        .populate("createdBy", "firstName lastName")
        .sort({ createdAt: -1 })
        .skip((currentPage - 1) * pageSize)
        .limit(pageSize),

      Transaction.countDocuments(filter)
    ]);

    // Only rent and lease transactions need tenancy lifecycle information.
    const tenancyTransactions = transactions.filter((transaction) =>
      ["rent", "lease"].includes(transaction.transactionType)
    );

    const tenancyIds = tenancyTransactions.map(
      (transaction) => transaction._id
    );

    let agreementsByTransaction = new Map();

    if (tenancyIds.length > 0) {
      const agreements = await TransactionAgreement.find({
        transaction: { $in: tenancyIds }
      })
        .select(
          "transaction version status tenancyTerms buyerResponse sellerResponse"
        )
        .sort({ version: -1 });

      for (const agreement of agreements) {
        const transactionId = String(agreement.transaction);

        if (!agreementsByTransaction.has(transactionId)) {
          agreementsByTransaction.set(transactionId, []);
        }

        agreementsByTransaction.get(transactionId).push(agreement);
      }
    }

    const todayUtc = new Date();
    todayUtc.setUTCHours(0, 0, 0, 0);

    const enrichedTransactions = transactions.map((transaction) => {
      const transactionData = transaction.toObject();

      if (!["rent", "lease"].includes(transaction.transactionType)) {
        return transactionData;
      }

      const transactionAgreements =
        agreementsByTransaction.get(String(transaction._id)) || [];

      // An agreement is accepted only when both parties have accepted it.
      // This also recognises an accepted agreement whose status later became
      // "superseded" while a newer version was being prepared.
      const acceptedAgreement = transactionAgreements.find((agreement) =>
        agreement.tenancyTerms?.endDate &&
        agreement.buyerResponse?.decision === "accepted" &&
        agreement.sellerResponse?.decision === "accepted"
      );

      const pendingAgreement = transactionAgreements.find((agreement) =>
        agreement.status === "pending_review" &&
        (
          !acceptedAgreement ||
          agreement.version > acceptedAgreement.version
        )
      );

      if (!acceptedAgreement) {
        transactionData.tenancyLifecycle = {
          status: pendingAgreement ? "agreement_pending" : "not_started",
          endDate: null,
          daysRemaining: null,
          acceptedAgreementVersion: null,
          pendingAgreementVersion: pendingAgreement?.version || null
        };

        return transactionData;
      }

      const endDate = new Date(acceptedAgreement.tenancyTerms.endDate);
      const expiryUtc = new Date(endDate);
      expiryUtc.setUTCHours(0, 0, 0, 0);

      const daysRemaining = Math.ceil(
        (expiryUtc.getTime() - todayUtc.getTime()) /
        (1000 * 60 * 60 * 24)
      );

      let lifecycleStatus;

      if (pendingAgreement) {
        lifecycleStatus = "renewal_pending";
      } else if (daysRemaining < 0) {
        lifecycleStatus = "expired";
      } else if (daysRemaining <= 30) {
        lifecycleStatus = "expiring_soon";
      } else {
        lifecycleStatus = "active";
      }

      transactionData.tenancyLifecycle = {
        status: lifecycleStatus,
        endDate,
        daysRemaining,
        acceptedAgreementVersion: acceptedAgreement.version,
        pendingAgreementVersion: pendingAgreement?.version || null
      };

      return transactionData;
    });

    return res.status(200).json({
      success: true,
      data: enrichedTransactions,
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


export async function getAdminTransaction(req, res, next) {
  try {
    const { transactionId } = req.params;

    if (!mongoose.isValidObjectId(transactionId)) {
      return sendError(res, 400, "Invalid transaction ID.");
    }

    const transaction = await Transaction.findById(transactionId)
      .populate("application")
      .populate("property")
      .populate("buyer", "firstName lastName email phone")
      .populate("seller", "firstName lastName email phone")
      .populate("createdBy", "firstName lastName")
      .populate("statusHistory.changedBy", "firstName lastName");

    if (!transaction) {
      return sendError(res, 404, "Transaction not found.");
    }

    return res.status(200).json({
      success: true,
      data: transaction
    });
  } catch (error) {
    next(error);
  }
}

export async function updateAdminTransactionStatus(req, res, next) {
  try {
    const { transactionId } = req.params;
    const { status, note = "" } = req.body;

    if (!mongoose.isValidObjectId(transactionId)) {
      return sendError(res, 400, "Invalid transaction ID.");
    }

    if (!Object.hasOwn(allowedTransitions, status)) {
      return sendError(res, 400, "Invalid transaction status.");
    }

    if (typeof note !== "string" || note.trim().length > 2000) {
      return sendError(res, 400, "The status note is invalid.");
    }

    const transaction = await Transaction.findById(transactionId);

    if (!transaction) {
      return sendError(res, 404, "Transaction not found.");
    }

    const permittedNextStatuses = allowedTransitions[transaction.status] || [];

    if (!permittedNextStatuses.includes(status)) {
      return sendError(
        res,
        400,
        `A transaction cannot move from ${transaction.status} to ${status}.`
      );
    }

    transaction.status = status;

    transaction.statusHistory.push({
      status,
      note: note.trim(),
      changedBy: req.user._id
    });

    if (status === "completed") {
      transaction.completedAt = new Date();
    }

    if (status === "cancelled") {
      transaction.cancelledAt = new Date();
    }

    await transaction.save();

    const populatedTransaction = await Transaction.findById(transaction._id)
      .populate("property", "title slug transactionType location")
      .populate("buyer", "firstName lastName email")
      .populate("seller", "firstName lastName email")
      .populate("statusHistory.changedBy", "firstName lastName");

    return res.status(200).json({
      success: true,
      message: "Transaction status updated successfully.",
      data: populatedTransaction
    });
  } catch (error) {
    next(error);
  }
}
