
import mongoose from "mongoose";
import Property from "../models/Property.js";
import PropertyDueDiligence from "../models/PropertyDueDiligence.js";

import {
  uploadToCloudinary,
  createPaymentEvidenceAccessUrl,
} from "../services/uploadService.js";

import {
  getDueDiligenceRequirements,
} from "../utils/dueDiligenceRequirements.js";

const DOCUMENT_FOLDER = "amanah-estates/due-diligence/documents";

const DOCUMENT_TYPES = [
  "title_deed",
  "deed_of_assignment",
  "survey_plan",
  "certificate_of_occupancy",
  "allocation_letter",
  "proof_of_ownership",
  "authority_to_let",
  "authority_to_lease",
  "property_condition_report",
  "tenancy_agreement",
  "lease_agreement",
  "management_authorization",
  "building_approval",
  "approved_building_plan",
  "governor_consent",
  "land_registry_search",
  "encumbrance_search",
  "other",
];

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

const isAdmin = (user) =>
  ["admin", "superadmin"].includes(user?.role);

const getOwnedProperty = async (propertyId, userId) => {
  if (!isValidId(propertyId)) return null;

  return Property.findOne({
    _id: propertyId,
    owner: userId,
  });
};

/**
 * Creates the initial case configuration from the actual Property record.
 * Members cannot choose their own property or transaction requirements.
 */
const buildCaseConfiguration = (property) => ({
  property: property._id,
  owner: property.owner,
  propertyType: property.propertyType,
  transactionType: property.transactionType,
  requiredDocuments: getDueDiligenceRequirements(
    property.propertyType,
    property.transactionType
  ),
});

/**
 * Backfills older cases created before property-specific checklists existed.
 * Existing uploaded documents and reviews are preserved.
 */
const ensureCaseConfiguration = (caseRecord, property) => {
  if (!property) return false;

  let changed = false;

  if (!caseRecord.propertyType) {
    caseRecord.propertyType = property.propertyType;
    changed = true;
  }

  if (!caseRecord.transactionType) {
    caseRecord.transactionType = property.transactionType;
    changed = true;
  }

  if (
    !caseRecord.requiredDocuments ||
    caseRecord.requiredDocuments.length === 0
  ) {
    caseRecord.requiredDocuments = getDueDiligenceRequirements(
      caseRecord.propertyType,
      caseRecord.transactionType
    );

    changed = true;
  }

  return changed;
};

const getCaseDocument = (caseRecord, documentId) =>
  caseRecord.documents.id(documentId);

/**
 * A required checklist item is satisfied only when at least one
 * matching document has been approved by an administrator.
 */
const updateCaseStatusFromDocuments = (caseRecord) => {
  const documents = caseRecord.documents || [];
  const requirements = caseRecord.requiredDocuments || [];

  if (!documents.length) {
    caseRecord.status = "documents_requested";
    return;
  }

  const requiredRequirements = requirements.filter(
    (item) => item.required
  );

  const requiredDocumentStates = requiredRequirements.map(
    (requirement) => {
      const matchingDocuments = documents.filter(
        (document) =>
          document.documentType === requirement.documentType
      );

      const approved = matchingDocuments.some(
        (document) => document.status === "approved"
      );

      const rejected = matchingDocuments.some(
        (document) => document.status === "rejected"
      );

      const needsCorrection = matchingDocuments.some(
        (document) => document.status === "needs_correction"
      );

      const pending = matchingDocuments.some(
        (document) => document.status === "submitted"
      );

      return {
        approved,
        rejected,
        needsCorrection,
        pending,
      };
    }
  );

  // A rejected required document remains unresolved unless
  // another upload of the same type has been approved.
  if (
    requiredDocumentStates.some(
      (item) => !item.approved && item.rejected
    )
  ) {
    caseRecord.status = "rejected";
    return;
  }

  if (
    requiredDocumentStates.some(
      (item) => !item.approved && item.needsCorrection
    )
  ) {
    caseRecord.status = "needs_correction";
    return;
  }

  // Pending documents, including optional documents, still need review.
  if (documents.some((document) => document.status === "submitted")) {
    caseRecord.status = "under_review";
    return;
  }

  const allRequiredApproved = requiredDocumentStates.every(
    (item) => item.approved
  );

  if (allRequiredApproved) {
    caseRecord.status = "verified";
    return;
  }

  caseRecord.status = "submitted";
};

export const getMyDueDiligenceCases = async (req, res, next) => {
  try {
    const cases = await PropertyDueDiligence.find({
      owner: req.user._id,
    })
      .populate(
        "property",
        "title slug propertyType transactionType location"
      )
      .sort({ updatedAt: -1 });

    res.json({
      success: true,
      data: cases,
    });
  } catch (error) {
    next(error);
  }
};

export const getMyPropertyDueDiligence = async (req, res, next) => {
  try {
    const property = await getOwnedProperty(
      req.params.propertyId,
      req.user._id
    );

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found or you do not own this property.",
      });
    }

    let caseRecord = await PropertyDueDiligence.findOne({
      property: property._id,
      owner: req.user._id,
    });

    if (!caseRecord) {
      caseRecord = new PropertyDueDiligence(
        buildCaseConfiguration(property)
      );

      await caseRecord.save();
    } else {
      const changed = ensureCaseConfiguration(caseRecord, property);

      if (changed) {
        await caseRecord.save();
      }
    }

    await caseRecord.populate(
      "property",
      "title slug propertyType transactionType location"
    );

    res.json({
      success: true,
      data: caseRecord,
    });
  } catch (error) {
    next(error);
  }
};

export const uploadMyDueDiligenceDocument = async (
  req,
  res,
  next
) => {
  try {
    const { propertyId } = req.params;
    const { documentType, note = "" } = req.body;

    if (!DOCUMENT_TYPES.includes(documentType)) {
      return res.status(400).json({
        success: false,
        message: "Please select a valid document type.",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please select a document to upload.",
      });
    }

    const property = await getOwnedProperty(
      propertyId,
      req.user._id
    );

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found or you do not own this property.",
      });
    }

    let caseRecord = await PropertyDueDiligence.findOne({
      property: property._id,
      owner: req.user._id,
    });

    if (!caseRecord) {
      caseRecord = new PropertyDueDiligence(
        buildCaseConfiguration(property)
      );
    } else {
      ensureCaseConfiguration(caseRecord, property);
    }

    // Only checklist document types and the general supporting
    // document category can be uploaded.
    const isChecklistDocument = caseRecord.requiredDocuments.some(
      (item) => item.documentType === documentType
    );

    if (!isChecklistDocument && documentType !== "other") {
      return res.status(400).json({
        success: false,
        message:
          "This document type is not part of this property's due-diligence checklist.",
      });
    }

    if (caseRecord.documents.length >= 15) {
      return res.status(400).json({
        success: false,
        message: "This property has reached the document upload limit.",
      });
    }

    const resourceType = req.file.mimetype.startsWith("image/")
      ? "image"
      : "raw";

    const uploaded = await uploadToCloudinary(
      req.file.buffer,
      resourceType,
      DOCUMENT_FOLDER,
      {
        type: "authenticated",
      }
    );

    caseRecord.documents.push({
      documentType,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      // format: uploaded.format,
      format: uploaded.format || ({
    "application/pdf": "pdf",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  }[req.file.mimetype] || "pdf"),
      resourceType: uploaded.resourceType || resourceType,
      publicId: uploaded.publicId,
      bytes: req.file.size,
      note: String(note).slice(0, 1000),
      status: "submitted",
    });

    updateCaseStatusFromDocuments(caseRecord);

    await caseRecord.save();

    res.status(201).json({
      success: true,
      message: "Document uploaded successfully.",
      data: caseRecord,
    });
  } catch (error) {
    next(error);
  }
};

export const getDueDiligenceDocumentAccess = async (
  req,
  res,
  next
) => {
  try {
    if (!isValidId(req.params.caseId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid due-diligence case ID.",
      });
    }

    const caseRecord = await PropertyDueDiligence.findById(
      req.params.caseId
    );

    if (!caseRecord) {
      return res.status(404).json({
        success: false,
        message: "Due-diligence case not found.",
      });
    }

    const ownerAccess =
      String(caseRecord.owner) === String(req.user._id);

    if (!ownerAccess && !isAdmin(req.user)) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to access this document.",
      });
    }

    const document = getCaseDocument(
      caseRecord,
      req.params.documentId
    );

    if (!document) {
      return res.status(404).json({
        success: false,
        message: "Document not found.",
      });
    }

    const url = await createPaymentEvidenceAccessUrl(
      document.publicId,
      document.format,
      document.resourceType
    );

    res.json({
      success: true,
      data: {
        url,
        expiresInSeconds: 300,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getAdminDueDiligenceCases = async (
  req,
  res,
  next
) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(
      Math.max(Number(req.query.limit) || 10, 1),
      50
    );

    const filter = {};

    if (req.query.status) {
      filter.status = req.query.status;
    }

    const [cases, total] = await Promise.all([
      PropertyDueDiligence.find(filter)
        .populate(
          "property",
          "title slug propertyType transactionType location"
        )
        .populate("owner", "name email")
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),

      PropertyDueDiligence.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: cases,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getAdminDueDiligenceCase = async (
  req,
  res,
  next
) => {
  try {
    if (!isValidId(req.params.caseId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid due-diligence case ID.",
      });
    }

    const caseRecord = await PropertyDueDiligence.findById(
      req.params.caseId
    )
      .populate("property")
      .populate("owner", "name email");

    if (!caseRecord) {
      return res.status(404).json({
        success: false,
        message: "Due-diligence case not found.",
      });
    }

    res.json({
      success: true,
      data: caseRecord,
    });
  } catch (error) {
    next(error);
  }
};

export const reviewDueDiligenceDocument = async (
  req,
  res,
  next
) => {
  try {
    const { caseId, documentId } = req.params;
    const { status, reviewNote = "" } = req.body;

    const allowedStatuses = [
      "approved",
      "needs_correction",
      "rejected",
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid document review status.",
      });
    }

    if (!isValidId(caseId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid due-diligence case ID.",
      });
    }

    const caseRecord = await PropertyDueDiligence.findById(caseId);

    if (!caseRecord) {
      return res.status(404).json({
        success: false,
        message: "Due-diligence case not found.",
      });
    }

    // Backfill older cases before saving them with the updated schema.
    const property = await Property.findById(caseRecord.property);

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "The property linked to this case could not be found.",
      });
    }

    ensureCaseConfiguration(caseRecord, property);

    const document = getCaseDocument(
      caseRecord,
      documentId
    );

    if (!document) {
      return res.status(404).json({
        success: false,
        message: "Document not found.",
      });
    }

    document.status = status;
    document.reviewNote = String(reviewNote).slice(0, 2000);
    document.reviewedBy = req.user._id;
    document.reviewedAt = new Date();

    caseRecord.reviewedBy = req.user._id;
    caseRecord.reviewedAt = new Date();
    caseRecord.adminNote = String(reviewNote).slice(0, 3000);

    updateCaseStatusFromDocuments(caseRecord);

    await caseRecord.save();

    res.json({
      success: true,
      message: "Document review saved.",
      data: caseRecord,
    });
  } catch (error) {
    next(error);
  }
};


// import mongoose from "mongoose";
// import Property from "../models/Property.js";
// import PropertyDueDiligence from "../models/PropertyDueDiligence.js";
// import {
//   uploadToCloudinary,
//   createPaymentEvidenceAccessUrl,
// } from "../services/uploadService.js";

// const DOCUMENT_FOLDER = "amanah-estates/due-diligence/documents";

// const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

// const isAdmin = (user) =>
//   ["admin", "superadmin"].includes(user?.role);

// const getOwnedProperty = async (propertyId, userId) => {
//   if (!isValidId(propertyId)) return null;

//   return Property.findOne({
//     _id: propertyId,
//     owner: userId,
//   });
// };

// const getCaseDocument = (caseRecord, documentId) =>
//   caseRecord.documents.id(documentId);

// const updateCaseStatusFromDocuments = (caseRecord) => {
//   const documents = caseRecord.documents;

//   if (!documents.length) {
//     caseRecord.status = "documents_requested";
//     return;
//   }

//   if (documents.some((doc) => doc.status === "rejected")) {
//     caseRecord.status = "rejected";
//     return;
//   }

//   if (documents.some((doc) => doc.status === "needs_correction")) {
//     caseRecord.status = "needs_correction";
//     return;
//   }

//   if (documents.every((doc) => doc.status === "approved")) {
//     caseRecord.status = "verified";
//     return;
//   }

//   caseRecord.status = "under_review";
// };

// export const getMyDueDiligenceCases = async (req, res, next) => {
//   try {
//     const cases = await PropertyDueDiligence.find({
//       owner: req.user._id,
//     })
//       .populate("property", "title slug propertyType transactionType location")
//       .sort({ updatedAt: -1 });

//     res.json({
//       success: true,
//       data: cases,
//     });
//   } catch (error) {
//     next(error);
//   }
// };

// export const getMyPropertyDueDiligence = async (req, res, next) => {
//   try {
//     const property = await getOwnedProperty(
//       req.params.propertyId,
//       req.user._id
//     );

//     if (!property) {
//       return res.status(404).json({
//         success: false,
//         message: "Property not found or you do not own this property.",
//       });
//     }

//     let caseRecord = await PropertyDueDiligence.findOne({
//       property: property._id,
//       owner: req.user._id,
//     });

//     if (!caseRecord) {
//       caseRecord = await PropertyDueDiligence.create({
//         property: property._id,
//         owner: req.user._id,
//       });
//     }

//     await caseRecord.populate(
//       "property",
//       "title slug propertyType transactionType location"
//     );

//     res.json({
//       success: true,
//       data: caseRecord,
//     });
//   } catch (error) {
//     next(error);
//   }
// };

// export const uploadMyDueDiligenceDocument = async (req, res, next) => {
//   try {
//     const { propertyId } = req.params;
//     const { documentType, note = "" } = req.body;

//     const allowedDocumentTypes = [
//       "title_deed",
//       "deed_of_assignment",
//       "survey_plan",
//       "certificate_of_occupancy",
//       "allocation_letter",
//       "other",
//     ];

//     if (!allowedDocumentTypes.includes(documentType)) {
//       return res.status(400).json({
//         success: false,
//         message: "Please select a valid document type.",
//       });
//     }

//     if (!req.file) {
//       return res.status(400).json({
//         success: false,
//         message: "Please select a document to upload.",
//       });
//     }

//     const property = await getOwnedProperty(propertyId, req.user._id);

//     if (!property) {
//       return res.status(404).json({
//         success: false,
//         message: "Property not found or you do not own this property.",
//       });
//     }

//     let caseRecord = await PropertyDueDiligence.findOne({
//       property: property._id,
//       owner: req.user._id,
//     });

//     if (!caseRecord) {
//       caseRecord = new PropertyDueDiligence({
//         property: property._id,
//         owner: req.user._id,
//       });
//     }

//     if (caseRecord.documents.length >= 15) {
//       return res.status(400).json({
//         success: false,
//         message: "This property has reached the document upload limit.",
//       });
//     }

//     const resourceType = req.file.mimetype.startsWith("image/")
//       ? "image"
//       : "raw";

//     const uploaded = await uploadToCloudinary(
//       req.file.buffer,
//       resourceType,
//       DOCUMENT_FOLDER,
//       {
//         type: "authenticated",
//       }
//     );

//     caseRecord.documents.push({
//       documentType,
//       originalName: req.file.originalname,
//       mimeType: req.file.mimetype,
//       format: uploaded.format,
//       resourceType: uploaded.resourceType || resourceType,
//       publicId: uploaded.publicId,
//       bytes: req.file.size,
//       note: String(note).slice(0, 1000),
//       status: "submitted",
//     });

//     updateCaseStatusFromDocuments(caseRecord);

//     await caseRecord.save();

//     res.status(201).json({
//       success: true,
//       message: "Document uploaded successfully.",
//       data: caseRecord,
//     });
//   } catch (error) {
//     next(error);
//   }
// };

// export const getDueDiligenceDocumentAccess = async (req, res, next) => {
//   try {
//     if (!isValidId(req.params.caseId)) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid due-diligence case ID.",
//       });
//     }

//     const caseRecord = await PropertyDueDiligence.findById(
//       req.params.caseId
//     );

//     if (!caseRecord) {
//       return res.status(404).json({
//         success: false,
//         message: "Due-diligence case not found.",
//       });
//     }

//     const ownerAccess =
//       String(caseRecord.owner) === String(req.user._id);

//     if (!ownerAccess && !isAdmin(req.user)) {
//       return res.status(403).json({
//         success: false,
//         message: "You are not authorized to access this document.",
//       });
//     }

//     const document = getCaseDocument(
//       caseRecord,
//       req.params.documentId
//     );

//     if (!document) {
//       return res.status(404).json({
//         success: false,
//         message: "Document not found.",
//       });
//     }

//     const url = await createPaymentEvidenceAccessUrl(
//       document.publicId,
//       document.format,
//       document.resourceType
//     );

//     res.json({
//       success: true,
//       data: {
//         url,
//         expiresInSeconds: 300,
//       },
//     });
//   } catch (error) {
//     next(error);
//   }
// };

// export const getAdminDueDiligenceCases = async (req, res, next) => {
//   try {
//     const page = Math.max(Number(req.query.page) || 1, 1);
//     const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 50);

//     const filter = {};

//     if (req.query.status) {
//       filter.status = req.query.status;
//     }

//     const [cases, total] = await Promise.all([
//       PropertyDueDiligence.find(filter)
//         .populate("property", "title slug propertyType location")
//         .populate("owner", "name email")
//         .sort({ updatedAt: -1 })
//         .skip((page - 1) * limit)
//         .limit(limit),

//       PropertyDueDiligence.countDocuments(filter),
//     ]);

//     res.json({
//       success: true,
//       data: cases,
//       pagination: {
//         page,
//         limit,
//         total,
//         pages: Math.ceil(total / limit),
//       },
//     });
//   } catch (error) {
//     next(error);
//   }
// };

// export const getAdminDueDiligenceCase = async (req, res, next) => {
//   try {
//     if (!isValidId(req.params.caseId)) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid due-diligence case ID.",
//       });
//     }

//     const caseRecord = await PropertyDueDiligence.findById(
//       req.params.caseId
//     )
//       .populate("property")
//       .populate("owner", "name email");

//     if (!caseRecord) {
//       return res.status(404).json({
//         success: false,
//         message: "Due-diligence case not found.",
//       });
//     }

//     res.json({
//       success: true,
//       data: caseRecord,
//     });
//   } catch (error) {
//     next(error);
//   }
// };

// export const reviewDueDiligenceDocument = async (req, res, next) => {
//   try {
//     const { caseId, documentId } = req.params;
//     const { status, reviewNote = "" } = req.body;

//     const allowedStatuses = [
//       "approved",
//       "needs_correction",
//       "rejected",
//     ];

//     if (!allowedStatuses.includes(status)) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid document review status.",
//       });
//     }

//     if (!isValidId(caseId)) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid due-diligence case ID.",
//       });
//     }

//     const caseRecord = await PropertyDueDiligence.findById(caseId);

//     if (!caseRecord) {
//       return res.status(404).json({
//         success: false,
//         message: "Due-diligence case not found.",
//       });
//     }

//     const document = getCaseDocument(caseRecord, documentId);

//     if (!document) {
//       return res.status(404).json({
//         success: false,
//         message: "Document not found.",
//       });
//     }

//     document.status = status;
//     document.reviewNote = String(reviewNote).slice(0, 2000);
//     document.reviewedBy = req.user._id;
//     document.reviewedAt = new Date();

//     caseRecord.reviewedBy = req.user._id;
//     caseRecord.reviewedAt = new Date();
//     caseRecord.adminNote = String(reviewNote).slice(0, 3000);

//     updateCaseStatusFromDocuments(caseRecord);

//     await caseRecord.save();

//     res.json({
//       success: true,
//       message: "Document review saved.",
//       data: caseRecord,
//     });
//   } catch (error) {
//     next(error);
//   }
// };