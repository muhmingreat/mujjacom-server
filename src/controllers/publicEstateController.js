
import mongoose from "mongoose";
import Estate from "../models/Estate.js";

const ESTATE_TYPES = ["residential", "commercial", "mixed_use"];

const DEVELOPMENT_STATUSES = [
  "under_construction",
  "completed",
  "paused"
];

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Public listing: published estates only.
export async function getPublicEstates(req, res, next) {
  try {
    const {
      search = "",
      estateType = "",
      developmentStatus = "",
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

    const currentPage = Math.max(1, Number.parseInt(page, 10) || 1);
    const pageLimit = Math.min(
      50,
      Math.max(1, Number.parseInt(limit, 10) || 12)
    );

    const filter = {
      publicationStatus: "published"
    };

    if (estateType) filter.estateType = estateType;

    if (developmentStatus) {
      filter.developmentStatus = developmentStatus;
    }

    if (typeof search === "string" && search.trim()) {
      const searchRegex = new RegExp(
        escapeRegex(search.trim().slice(0, 100)),
        "i"
      );

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
        ? { publishedAt: 1, createdAt: 1 }
        : { publishedAt: -1, createdAt: -1 };

    const [estates, total] = await Promise.all([
      Estate.find(filter)
        .select(
          "name slug description estateType location developmentStatus coverImage gallery construction milestones amenities highlights publishedAt createdAt"
        )
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

// Public details: published estates only.
export async function getPublicEstateBySlug(req, res, next) {
  try {
    const { slug } = req.params;

    if (!slug || typeof slug !== "string") {
      return res.status(400).json({
        success: false,
        message: "A valid estate slug is required."
      });
    }

    const estate = await Estate.findOne({
      slug: slug.toLowerCase().trim(),
      publicationStatus: "published"
    })
      .select(
        "name slug description estateType location developmentStatus coverImage gallery construction milestones amenities highlights publishedAt createdAt"
      )
      .lean();

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
