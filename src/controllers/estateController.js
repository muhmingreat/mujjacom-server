
import mongoose from "mongoose";
import Estate from "../models/Estate.js";

const DEVELOPMENT_STATUSES = [
  "under_construction",
  "completed",
  "paused"
];

const PUBLICATION_STATUSES = [
  "draft",
  "published",
  "archived"
];

const ESTATE_TYPES = [
  "residential",
  "commercial",
  "mixed_use"
];

function createSlug(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function getUniqueSlug(value, excludeId = null) {
  const baseSlug = createSlug(value);

  if (!baseSlug) return "";

  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const filter = { slug };

    if (excludeId) {
      filter._id = { $ne: excludeId };
    }

    const existing = await Estate.findOne(filter)
      .select("_id")
      .lean();

    if (!existing) return slug;

    counter += 1;
    slug = `${baseSlug}-${counter}`;
  }
}

function handleControllerError(error, res, next) {
  if (error.code === 11000) {
    return res.status(409).json({
      success: false,
      message: "An estate with this name or slug already exists."
    });
  }

  if (error.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }

  return next(error);
}

// Get all estates for administrative management.
export async function getAllAdminEstates(req, res, next) {
  try {
    const {
      search = "",
      estateType = "",
      developmentStatus = "",
      publicationStatus = "",
      page = 1,
      limit = 12,
      sort = "newest"
    } = req.query;

    if (estateType && !ESTATE_TYPES.includes(estateType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid estate type."
      });
    }

    if (
      developmentStatus &&
      !DEVELOPMENT_STATUSES.includes(developmentStatus)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid development status."
      });
    }

    if (
      publicationStatus &&
      !PUBLICATION_STATUSES.includes(publicationStatus)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid publication status."
      });
    }

    const currentPage = Math.max(
      1,
      Number.parseInt(page, 10) || 1
    );

    const pageLimit = Math.min(
      50,
      Math.max(1, Number.parseInt(limit, 10) || 12)
    );

    const filter = {};

    if (estateType) {
      filter.estateType = estateType;
    }

    if (developmentStatus) {
      filter.developmentStatus = developmentStatus;
    }

    if (publicationStatus) {
      filter.publicationStatus = publicationStatus;
    }

    if (typeof search === "string" && search.trim()) {
      const safeSearch = search.trim().slice(0, 100);

      const escapedSearch = safeSearch.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );

      const searchRegex = new RegExp(escapedSearch, "i");

      filter.$or = [
        { name: searchRegex },
        { slug: searchRegex },
        { description: searchRegex },
        { "location.city": searchRegex },
        { "location.state": searchRegex },
        { "location.area": searchRegex }
      ];
    }

    const sortOption =
      sort === "oldest"
        ? { createdAt: 1 }
        : { createdAt: -1 };

    const [estates, total] = await Promise.all([
      Estate.find(filter)
        .populate("createdBy", "firstName lastName email")
        .sort(sortOption)
        .skip((currentPage - 1) * pageLimit)
        .limit(pageLimit)
        .lean(),

      Estate.countDocuments(filter)
    ]);

    return res.status(200).json({
      success: true,
      data: estates,
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

// Get one estate for administrative inspection.
export async function getAdminEstate(req, res, next) {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid estate ID."
      });
    }

    const estate = await Estate.findById(id)
      .populate("createdBy", "firstName lastName email")
      .populate("updatedBy", "firstName lastName email");

    if (!estate) {
      return res.status(404).json({
        success: false,
        message: "Estate not found."
      });
    }

    return res.status(200).json({
      success: true,
      data: estate
    });
  } catch (error) {
    next(error);
  }
}

// Create a new estate.
export async function createEstate(req, res, next) {
  try {
    const {
      name,
      slug,
      description,
      estateType,
      location,
      developmentStatus,
      coverImage,
      gallery,
      construction,
      milestones,
      amenities,
      highlights
    } = req.body || {};

    if (
      typeof name !== "string" ||
      !name.trim() ||
      typeof description !== "string" ||
      !description.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Estate name and description are required."
      });
    }

    if (
      !location ||
      typeof location.city !== "string" ||
      !location.city.trim() ||
      typeof location.state !== "string" ||
      !location.state.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Estate city and state are required."
      });
    }

    if (estateType && !ESTATE_TYPES.includes(estateType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid estate type."
      });
    }

    if (
      developmentStatus &&
      !DEVELOPMENT_STATUSES.includes(developmentStatus)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid development status."
      });
    }

    const estateSlug = await getUniqueSlug(slug || name);

    if (!estateSlug) {
      return res.status(400).json({
        success: false,
        message: "A valid estate name or slug is required."
      });
    }

    const estate = await Estate.create({
      name: name.trim(),
      slug: estateSlug,
      description: description.trim(),
      estateType,
      location,
      developmentStatus,
      coverImage,
      gallery,
      construction,
      milestones,
      amenities,
      highlights,
      createdBy: req.user._id
    });

    return res.status(201).json({
      success: true,
      message: "Estate created successfully.",
      data: estate
    });
  } catch (error) {
    handleControllerError(error, res, next);
  }
}

// Update an existing estate.
export async function updateEstate(req, res, next) {
  try {
    const { id } = req.params;
    const body = req.body || {};

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid estate ID."
      });
    }

    const estate = await Estate.findById(id);

    if (!estate) {
      return res.status(404).json({
        success: false,
        message: "Estate not found."
      });
    }

    if (estate.publicationStatus === "archived") {
      return res.status(400).json({
        success: false,
        message: "Restore this estate before editing it."
      });
    }

 const allowedFields = [
  "name",
  "description",
  "estateType",
  "developmentStatus",
  "milestones",
  "amenities",
  "highlights"
];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        estate[field] = body[field];
      }
    }

    // Preserve existing location and construction values.
    const currentEstateData = estate.toObject();

    if (body.location !== undefined) {
      estate.location = {
        ...(currentEstateData.location || {}),
        ...body.location,
        coordinates: {
          ...(currentEstateData.location?.coordinates || {}),
          ...(body.location.coordinates || {})
        }
      };
    }

    if (body.construction !== undefined) {
      estate.construction = {
        ...(currentEstateData.construction || {}),
        ...body.construction
      };
    }

    if (body.slug !== undefined || body.name !== undefined) {
      const requestedSlug = body.slug || estate.name;

      estate.slug = await getUniqueSlug(
        requestedSlug,
        estate._id
      );
    }

    estate.updatedBy = req.user._id;

    await estate.save();

    return res.status(200).json({
      success: true,
      message: "Estate updated successfully.",
      data: estate
    });
  } catch (error) {
    handleControllerError(error, res, next);
  }
}

// Publish an estate on the public website.
export async function publishEstate(req, res, next) {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid estate ID."
      });
    }

    const estate = await Estate.findById(id);

    if (!estate) {
      return res.status(404).json({
        success: false,
        message: "Estate not found."
      });
    }

    if (estate.publicationStatus === "archived") {
      return res.status(400).json({
        success: false,
        message: "Restore this estate before publishing it."
      });
    }

    if (!estate.coverImage) {
      return res.status(400).json({
        success: false,
        message: "Add an estate cover image before publishing."
      });
    }

    estate.publicationStatus = "published";
    estate.publishedAt = estate.publishedAt || new Date();
    estate.updatedBy = req.user._id;

    await estate.save();

    return res.status(200).json({
      success: true,
      message: "Estate published successfully.",
      data: estate
    });
  } catch (error) {
    handleControllerError(error, res, next);
  }
}

// Archive an estate without deleting its history.
export async function archiveEstate(req, res, next) {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid estate ID."
      });
    }

    const estate = await Estate.findById(id);

    if (!estate) {
      return res.status(404).json({
        success: false,
        message: "Estate not found."
      });
    }

    if (estate.publicationStatus === "archived") {
      return res.status(400).json({
        success: false,
        message: "This estate is already archived."
      });
    }

    estate.publicationStatus = "archived";
    estate.updatedBy = req.user._id;

    await estate.save();

    return res.status(200).json({
      success: true,
      message: "Estate archived successfully.",
      data: estate
    });
  } catch (error) {
    handleControllerError(error, res, next);
  }
}

// Restore an archived estate as a draft.
export async function restoreEstate(req, res, next) {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid estate ID."
      });
    }

    const estate = await Estate.findById(id);

    if (!estate) {
      return res.status(404).json({
        success: false,
        message: "Estate not found."
      });
    }

    if (estate.publicationStatus !== "archived") {
      return res.status(400).json({
        success: false,
        message: "Only archived estates can be restored."
      });
    }

    estate.publicationStatus = "draft";
    estate.updatedBy = req.user._id;

    await estate.save();

    return res.status(200).json({
      success: true,
      message: "Estate restored as a draft successfully.",
      data: estate
    });
  } catch (error) {
    handleControllerError(error, res, next);
  }
}
