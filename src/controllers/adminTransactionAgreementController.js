
import mongoose from "mongoose";
import Transaction from "../models/Transaction.js";
import TransactionAgreement from "../models/TransactionAgreement.js";

function sendError(res, status, message, code) {
  return res.status(status).json({
    success: false,
    ...(code ? { code } : {}),
    message
  });
}

const VALID_PAYMENT_FREQUENCIES = [
  "monthly",
  "quarterly",
  "biannually",
  "annually"
];

const VALID_RENEWAL_OPTIONS = [
  "renewable",
  "not_renewable",
  "subject_to_agreement"
];

function validateTenancyTerms(tenancyTerms) {
  if (
    !tenancyTerms ||
    typeof tenancyTerms !== "object" ||
    Array.isArray(tenancyTerms)
  ) {
    return {
      error: "Tenancy terms are required for rent and lease transactions."
    };
  }

  const {
    startDate,
    endDate,
    paymentFrequency,
    nextPaymentDate,
    renewalOption = "subject_to_agreement"
  } = tenancyTerms;

  if (
    typeof startDate !== "string" ||
    !startDate.trim() ||
    typeof endDate !== "string" ||
    !endDate.trim()
  ) {
    return {
      error: "Tenancy start and end dates are required."
    };
  }

  // Date inputs should use YYYY-MM-DD.
  const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;

  if (
    !dateOnlyPattern.test(startDate) ||
    !dateOnlyPattern.test(endDate)
  ) {
    return {
      error: "Tenancy dates must use the YYYY-MM-DD format."
    };
  }

  const parsedStartDate = new Date(`${startDate}T00:00:00.000Z`);
  const parsedEndDate = new Date(`${endDate}T00:00:00.000Z`);

  // Reject invalid calendar dates such as 2026-02-31.
  if (
    Number.isNaN(parsedStartDate.getTime()) ||
    parsedStartDate.toISOString().slice(0, 10) !== startDate ||
    Number.isNaN(parsedEndDate.getTime()) ||
    parsedEndDate.toISOString().slice(0, 10) !== endDate
  ) {
    return {
      error: "Enter valid tenancy calendar dates."
    };
  }

  if (parsedEndDate <= parsedStartDate) {
    return {
      error: "The tenancy end date must be after the start date."
    };
  }

  if (!VALID_PAYMENT_FREQUENCIES.includes(paymentFrequency)) {
    return {
      error: "Select a valid tenancy payment frequency."
    };
  }

  if (!VALID_RENEWAL_OPTIONS.includes(renewalOption)) {
    return {
      error: "Select a valid tenancy renewal arrangement."
    };
  }

  let parsedNextPaymentDate = null;

  if (nextPaymentDate !== undefined && nextPaymentDate !== null && nextPaymentDate !== "") {
    if (
      typeof nextPaymentDate !== "string" ||
      !dateOnlyPattern.test(nextPaymentDate)
    ) {
      return {
        error: "The next payment date must use the YYYY-MM-DD format."
      };
    }

    parsedNextPaymentDate = new Date(
      `${nextPaymentDate}T00:00:00.000Z`
    );

    if (
      Number.isNaN(parsedNextPaymentDate.getTime()) ||
      parsedNextPaymentDate.toISOString().slice(0, 10) !== nextPaymentDate
    ) {
      return {
        error: "Enter a valid next payment date."
      };
    }

    if (
      parsedNextPaymentDate < parsedStartDate ||
      parsedNextPaymentDate > parsedEndDate
    ) {
      return {
        error: "The next payment date must fall within the tenancy period."
      };
    }
  }

  return {
    data: {
      startDate: parsedStartDate,
      endDate: parsedEndDate,
      paymentFrequency,
      nextPaymentDate: parsedNextPaymentDate,
      renewalOption
    }
  };
}

async function getPopulatedAgreement(agreementId) {
  return TransactionAgreement.findById(agreementId)
    .populate(
      "transaction",
      "transactionReference transactionType agreedAmount currency status buyer seller property"
    )
    .populate("createdBy", "firstName lastName")
    .populate("buyerResponse.respondedBy", "firstName lastName")
    .populate("sellerResponse.respondedBy", "firstName lastName");
}

// Create a new draft agreement.
export async function createAdminTransactionAgreement(req, res, next) {
  try {
    const { transactionId } = req.params;

    const {
      title,
      terms,
      documentUrl = "",
      tenancyTerms
    } = req.body;

    if (!mongoose.isValidObjectId(transactionId)) {
      return sendError(res, 400, "Invalid transaction ID.");
    }

    if (
      typeof title !== "string" ||
      !title.trim() ||
      title.trim().length > 200
    ) {
      return sendError(res, 400, "A valid agreement title is required.");
    }

    if (
      typeof terms !== "string" ||
      !terms.trim() ||
      terms.trim().length > 20000
    ) {
      return sendError(
        res,
        400,
        "Agreement terms are required and must not exceed 20,000 characters."
      );
    }

    if (
      typeof documentUrl !== "string" ||
      documentUrl.trim().length > 2000
    ) {
      return sendError(res, 400, "The agreement document URL is invalid.");
    }

    const transaction = await Transaction.findById(transactionId);

    if (!transaction) {
      return sendError(res, 404, "Transaction not found.");
    }

    if (
      ["completed", "cancelled", "disputed"].includes(transaction.status)
    ) {
      return sendError(
        res,
        409,
        "An agreement cannot be created for a completed, cancelled, or disputed transaction."
      );
    }

    let validatedTenancyTerms;

    if (["rent", "lease"].includes(transaction.transactionType)) {
      const validation = validateTenancyTerms(tenancyTerms);

      if (validation.error) {
        return sendError(res, 400, validation.error);
      }

      validatedTenancyTerms = validation.data;
    } else if (
      tenancyTerms !== undefined &&
      tenancyTerms !== null
    ) {
      return sendError(
        res,
        400,
        "Tenancy terms are only allowed for rent and lease transactions."
      );
    }

    const latestAgreement = await TransactionAgreement.findOne({
      transaction: transaction._id
    }).sort({ version: -1 });

    if (latestAgreement && latestAgreement.status !== "superseded") {
      return sendError(
        res,
        409,
        "A current agreement already exists. Create a revised version after superseding the previous agreement."
      );
    }

    const agreement = await TransactionAgreement.create({
      transaction: transaction._id,
      version: latestAgreement ? latestAgreement.version + 1 : 1,
      title: title.trim(),
      terms: terms.trim(),
      documentUrl: documentUrl.trim(),
      ...(validatedTenancyTerms
        ? { tenancyTerms: validatedTenancyTerms }
        : {}),
      status: "draft",
      createdBy: req.user._id
    });

    const populatedAgreement = await getPopulatedAgreement(agreement._id);

    return res.status(201).json({
      success: true,
      message: "Agreement draft created successfully.",
      data: populatedAgreement
    });
  } catch (error) {
    next(error);
  }
}

// Publish a draft agreement for buyer and seller review.
export async function publishAdminTransactionAgreement(req, res, next) {
  try {
    const { transactionId, agreementId } = req.params;

    if (
      !mongoose.isValidObjectId(transactionId) ||
      !mongoose.isValidObjectId(agreementId)
    ) {
      return sendError(res, 400, "Invalid transaction or agreement ID.");
    }

    const agreement = await TransactionAgreement.findOne({
      _id: agreementId,
      transaction: transactionId
    });

    if (!agreement) {
      return sendError(res, 404, "Agreement not found.");
    }

    if (agreement.status !== "draft") {
      return sendError(res, 409, "Only draft agreements can be published.");
    }

    const transaction = await Transaction.findById(transactionId);

    if (!transaction) {
      return sendError(res, 404, "Transaction not found.");
    }

    if (
      ["completed", "cancelled", "disputed"].includes(transaction.status)
    ) {
      return sendError(
        res,
        409,
        "This transaction cannot receive a new agreement."
      );
    }

    // Ensure rental and lease drafts still have valid tenancy terms.
    if (["rent", "lease"].includes(transaction.transactionType)) {
      const validation = validateTenancyTerms({
        startDate: agreement.tenancyTerms?.startDate
          ? new Date(agreement.tenancyTerms.startDate).toISOString().slice(0, 10)
          : "",
        endDate: agreement.tenancyTerms?.endDate
          ? new Date(agreement.tenancyTerms.endDate).toISOString().slice(0, 10)
          : "",
        paymentFrequency: agreement.tenancyTerms?.paymentFrequency,
        nextPaymentDate: agreement.tenancyTerms?.nextPaymentDate
          ? new Date(agreement.tenancyTerms.nextPaymentDate).toISOString().slice(0, 10)
          : "",
        renewalOption: agreement.tenancyTerms?.renewalOption
      });

      if (validation.error) {
        return sendError(
          res,
          400,
          `This tenancy agreement cannot be published: ${validation.error}`
        );
      }
    }

    agreement.status = "pending_review";
    agreement.publishedAt = new Date();

    await agreement.save();

    const populatedAgreement = await getPopulatedAgreement(agreement._id);

    return res.status(200).json({
      success: true,
      message: "Agreement published for buyer and seller review.",
      data: populatedAgreement
    });
  } catch (error) {
    next(error);
  }
}

// Get every agreement version belonging to a transaction.
export async function getAdminTransactionAgreements(req, res, next) {
  try {
    const { transactionId } = req.params;

    if (!mongoose.isValidObjectId(transactionId)) {
      return sendError(res, 400, "Invalid transaction ID.");
    }

    const transactionExists = await Transaction.exists({
      _id: transactionId
    });

    if (!transactionExists) {
      return sendError(res, 404, "Transaction not found.");
    }

    const agreements = await TransactionAgreement.find({
      transaction: transactionId
    })
      .populate("createdBy", "firstName lastName")
      .populate("buyerResponse.respondedBy", "firstName lastName")
      .populate("sellerResponse.respondedBy", "firstName lastName")
      .sort({ version: -1 });

    return res.status(200).json({
      success: true,
      data: agreements
    });
  } catch (error) {
    next(error);
  }
}

// Supersede the current published agreement so a revised version can be created.
export async function supersedeAdminTransactionAgreement(req, res, next) {
  try {
    const { transactionId, agreementId } = req.params;

    if (
      !mongoose.isValidObjectId(transactionId) ||
      !mongoose.isValidObjectId(agreementId)
    ) {
      return sendError(res, 400, "Invalid transaction or agreement ID.");
    }

    const transaction = await Transaction.findById(transactionId);

    if (!transaction) {
      return sendError(res, 404, "Transaction not found.");
    }

    if (
      ["completed", "cancelled", "disputed"].includes(transaction.status)
    ) {
      return sendError(
        res,
        409,
        "Agreements cannot be superseded for completed, cancelled, or disputed transactions."
      );
    }

    const latestAgreement = await TransactionAgreement.findOne({
      transaction: transaction._id
    }).sort({ version: -1 });

    if (!latestAgreement) {
      return sendError(res, 404, "No agreement exists for this transaction.");
    }

    if (String(latestAgreement._id) !== String(agreementId)) {
      return sendError(
        res,
        409,
        "Only the latest agreement version can be superseded."
      );
    }

    if (
      !["pending_review", "accepted", "rejected"].includes(
        latestAgreement.status
      )
    ) {
      return sendError(
        res,
        409,
        "Only a published agreement can be superseded."
      );
    }

    const supersededAgreement =
      await TransactionAgreement.findOneAndUpdate(
        {
          _id: agreementId,
          transaction: transaction._id,
          status: latestAgreement.status
        },
        {
          $set: {
            status: "superseded"
          }
        },
        {
          new: true,
          runValidators: true
        }
      );

    if (!supersededAgreement) {
      return sendError(
        res,
        409,
        "The agreement has already been changed. Refresh and try again."
      );
    }

    const populatedAgreement = await getPopulatedAgreement(
      supersededAgreement._id
    );

    return res.status(200).json({
      success: true,
      message:
        "Agreement superseded successfully. You can now create a revised version.",
      data: populatedAgreement
    });
  } catch (error) {
    next(error);
  }
}

