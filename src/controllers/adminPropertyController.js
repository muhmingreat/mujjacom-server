
import mongoose from "mongoose";
import Property from "../models/Property.js";

const REVIEW_STATUSES = ["pending_review", "under_review"];
const ARCHIVE_BLOCKED_STATUSES = ["reserved", "sold", "leased", "rented"];

function isValidPropertyId(id) {
  return mongoose.isValidObjectId(id);
}

async function findPropertyForAdmin(id, res) {
  if (!isValidPropertyId(id)) {
    res.status(400).json({
      success: false,
      message: "Invalid property ID."
    });
    return null;
  }

  const property = await Property.findById(id);

  if (!property) {
    res.status(404).json({
      success: false,
      message: "Property not found."
    });
    return null;
  }

  return property;
}

function hasRequiredMedia(property) {
  const media = Array.isArray(property.media) ? property.media : [];
  const images = media.filter(item => item.type === "image");
  const videos = media.filter(item => item.type === "video");

  return {
    valid: images.length >= 5 && videos.length >= 2,
    imageCount: images.length,
    videoCount: videos.length
  };
}

// Get properties awaiting administrative review.
export async function getPendingProperties(req, res, next) {
  try {
    const properties = await Property.find({
      verificationStatus: { $in: REVIEW_STATUSES }
    })
      .populate("owner", "firstName lastName email phone")
      .sort({ createdAt: 1 });

    return res.json({
      success: true,
      count: properties.length,
      data: properties
    });
  } catch (error) {
    next(error);
  }
}

// Get one property for administrative inspection.
export async function getAdminProperty(req, res, next) {
  try {
    const { id } = req.params;

    if (!isValidPropertyId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid property ID."
      });
    }

    const property = await Property.findById(id)
      .populate("owner", "firstName lastName email phone");

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found."
      });
    }

    return res.json({
      success: true,
      data: property
    });
  } catch (error) {
    next(error);
  }
}

// Approve and publish a property.
export async function approveProperty(req, res, next) {
  try {
    const { id } = req.params;
    const property = await findPropertyForAdmin(id, res);

    if (!property) return;

    if (!REVIEW_STATUSES.includes(property.verificationStatus)) {
      return res.status(400).json({
        success: false,
        message: "This property is not awaiting review."
      });
    }

    const mediaCheck = hasRequiredMedia(property);

    if (!mediaCheck.valid) {
      return res.status(400).json({
        success: false,
        message:
          "This property must have at least 5 images and 2 videos before approval.",
        media: mediaCheck
      });
    }

    property.verificationStatus = "verified";
    property.status = "published";
    property.reviewedBy = req.user._id;
    property.reviewedAt = new Date();
    property.reviewNote = "";
    property.publishedAt = new Date();

    await property.save();

    return res.json({
      success: true,
      message: "Property approved and published successfully.",
      data: property
    });
  } catch (error) {
    next(error);
  }
}

// Reject a property submission with an explanation.
export async function rejectProperty(req, res, next) {
  try {
    const { id } = req.params;
    const { reviewNote } = req.body;

    if (!isValidPropertyId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid property ID."
      });
    }

    if (typeof reviewNote !== "string" || !reviewNote.trim()) {
      return res.status(400).json({
        success: false,
        message: "Please provide a reason for rejecting this property."
      });
    }

    if (reviewNote.trim().length > 2000) {
      return res.status(400).json({
        success: false,
        message: "The rejection reason cannot exceed 2000 characters."
      });
    }

    const property = await findPropertyForAdmin(id, res);

    if (!property) return;

    if (!REVIEW_STATUSES.includes(property.verificationStatus)) {
      return res.status(400).json({
        success: false,
        message: "This property is not awaiting review."
      });
    }

    property.verificationStatus = "rejected";
    property.status = "draft";
    property.reviewedBy = req.user._id;
    property.reviewedAt = new Date();
    property.reviewNote = reviewNote.trim();
    property.publishedAt = null;

    await property.save();

    return res.json({
      success: true,
      message: "Property rejected successfully.",
      data: property
    });
  } catch (error) {
    next(error);
  }
}

// Archive a property without changing its verification history.
export async function archiveProperty(req, res, next) {
  try {
    const { id } = req.params;
    const property = await findPropertyForAdmin(id, res);

    if (!property) return;

    if (ARCHIVE_BLOCKED_STATUSES.includes(property.status)) {
      return res.status(400).json({
        success: false,
        message:
          "This property cannot be archived because it is reserved, sold, leased, or rented."
      });
    }

    if (!["draft", "published"].includes(property.status)) {
      return res.status(400).json({
        success: false,
        message: "Only Draft or Published properties can be archived."
      });
    }

    property.status = "archived";
    property.publishedAt = null;

    await property.save();

    return res.json({
      success: true,
      message: "Property archived successfully.",
      data: property
    });
  } catch (error) {
    next(error);
  }
}

// Restore an archived property to Draft.
export async function restoreArchivedProperty(req, res, next) {
  try {
    const { id } = req.params;
    const property = await findPropertyForAdmin(id, res);

    if (!property) return;

    if (property.status !== "archived") {
      return res.status(400).json({
        success: false,
        message: "Only archived properties can be restored."
      });
    }

    property.status = "draft";
    property.publishedAt = null;

    await property.save();

    return res.json({
      success: true,
      message: "Property restored to Draft successfully.",
      data: property
    });
  } catch (error) {
    next(error);
  }
}

// Unpublish a published property and return it to Draft.
export async function unpublishProperty(req, res, next) {
  try {
    const { id } = req.params;
    const property = await findPropertyForAdmin(id, res);

    if (!property) return;

    if (property.status !== "published") {
      return res.status(400).json({
        success: false,
        message: "Only published properties can be unpublished."
      });
    }

    property.status = "draft";
    property.publishedAt = null;

    await property.save();

    return res.json({
      success: true,
      message: "Property unpublished and moved to Draft successfully.",
      data: property
    });
  } catch (error) {
    next(error);
  }
}

// Republish a verified Draft property.
export async function republishProperty(req, res, next) {
  try {
    const { id } = req.params;
    const property = await findPropertyForAdmin(id, res);

    if (!property) return;

    if (property.status !== "draft") {
      return res.status(400).json({
        success: false,
        message: "Only Draft properties can be republished."
      });
    }

    if (property.verificationStatus !== "verified") {
      return res.status(400).json({
        success: false,
        message: "Only verified properties can be republished."
      });
    }

    const mediaCheck = hasRequiredMedia(property);

    if (!mediaCheck.valid) {
      return res.status(400).json({
        success: false,
        message:
          "This property must have at least 5 images and 2 videos before it can be republished.",
        media: mediaCheck
      });
    }

    property.status = "published";
    property.publishedAt = new Date();

    await property.save();

    return res.json({
      success: true,
      message: "Property republished successfully.",
      data: property
    });
  } catch (error) {
    next(error);
  }
}

// Get all properties with search, filters and pagination.
export async function getAllAdminProperties(req, res, next) {
  try {
    const {
      search = "",
      propertyType,
      transactionType,
      status,
      verificationStatus,
      page = 1,
      limit = 12,
      sort = "newest"
    } = req.query;

    const currentPage = Math.max(1, Number.parseInt(page, 10) || 1);
    const pageLimit = Math.min(
      50,
      Math.max(1, Number.parseInt(limit, 10) || 12)
    );

    const filter = {};

    if (propertyType) filter.propertyType = propertyType;
    if (transactionType) filter.transactionType = transactionType;
    if (status) filter.status = status;
    if (verificationStatus) {
      filter.verificationStatus = verificationStatus;
    }

    if (typeof search === "string" && search.trim()) {
      const searchRegex = new RegExp(
        search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "i"
      );

      filter.$or = [
        { title: searchRegex },
        { "location.address": searchRegex },
        { "location.area": searchRegex },
        { "location.city": searchRegex },
        { "location.state": searchRegex },
        { slug: searchRegex }
      ];
    }

    const sortOption =
      sort === "oldest"
        ? { createdAt: 1 }
        : { createdAt: -1 };

    const [properties, total] = await Promise.all([
      Property.find(filter)
        .populate("owner", "firstName lastName email phone")
        .sort(sortOption)
        .skip((currentPage - 1) * pageLimit)
        .limit(pageLimit)
        .lean(),

      Property.countDocuments(filter)
    ]);

    return res.json({
      success: true,
      data: properties,
      pagination: {
        total,
        page: currentPage,
        limit: pageLimit,
        totalPages: Math.ceil(total / pageLimit),
        hasNextPage: currentPage * pageLimit < total,
        hasPreviousPage: currentPage > 1
      }
    });
  } catch (error) {
    next(error);
  }
}
