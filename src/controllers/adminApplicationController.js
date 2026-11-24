
import mongoose from "mongoose";
import Application from "../models/Application.js";

export async function getAllAdminApplications(req, res, next) {
  try {
    const {
      search = "",
      status = "",
      applicationType = "",
      page = 1,
      limit = 12,
      sort = "newest"
    } = req.query;

    const filter = {};

    if (status) {
      const allowedStatuses = [
        "pending",
        "under_review",
        "approved",
        "rejected",
        "withdrawn"
      ];

      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid application status."
        });
      }

      filter.status = status;
    }

    if (applicationType) {
      if (!["purchase", "rent", "lease"].includes(applicationType)) {
        return res.status(400).json({
          success: false,
          message: "Invalid application type."
        });
      }

      filter.applicationType = applicationType;
    }

    if (search.trim()) {
      const safeSearch = search.trim().slice(0, 100);
      const escapedSearch = safeSearch.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );

      const matchingProperties = await mongoose.model("Property").find({
        $or: [
          { title: { $regex: escapedSearch, $options: "i" } },
          { slug: { $regex: escapedSearch, $options: "i" } }
        ]
      }).select("_id").lean();

      const matchingApplicants = await mongoose.model("User").find({
        $or: [
          { firstName: { $regex: escapedSearch, $options: "i" } },
          { lastName: { $regex: escapedSearch, $options: "i" } },
          { email: { $regex: escapedSearch, $options: "i" } }
        ]
      }).select("_id").lean();

      filter.$or = [
        { property: { $in: matchingProperties.map(item => item._id) } },
        { applicant: { $in: matchingApplicants.map(item => item._id) } }
      ];
    }

    const currentPage = Math.max(1, Number.parseInt(page, 10) || 1);
    const pageSize = Math.min(
      50,
      Math.max(1, Number.parseInt(limit, 10) || 12)
    );

    const sortOrder = sort === "oldest" ? 1 : -1;

    const [applications, total] = await Promise.all([
      Application.find(filter)
        .populate("applicant", "firstName lastName email phone")
        .populate(
          "property",
          "title slug price currency transactionType propertyType location coverImage"
        )
        .sort({ createdAt: sortOrder })
        .skip((currentPage - 1) * pageSize)
        .limit(pageSize)
        .lean(),

      Application.countDocuments(filter)
    ]);

    const totalPages = Math.ceil(total / pageSize);

    return res.status(200).json({
      success: true,
      data: applications,
      pagination: {
        total,
        page: currentPage,
        limit: pageSize,
        totalPages,
        hasNextPage: currentPage < totalPages,
        hasPreviousPage: currentPage > 1
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function getAdminApplication(req, res, next) {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid application ID."
      });
    }

    const application = await Application.findById(id)
      .populate("applicant", "firstName lastName email phone createdAt")
      .populate(
        "property",
        "title slug description price currency transactionType propertyType location coverImage media status verificationStatus owner"
      )
      .lean();

    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application not found."
      });
    }

    return res.status(200).json({
      success: true,
      application
    });
  } catch (error) {
    next(error);
  }
}

export async function updateAdminApplication(req, res, next) {
  try {
    const { id } = req.params;
    const { status, reviewNote } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid application ID."
      });
    }

    if (!["under_review", "approved", "rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid application status update."
      });
    }

    if (
      reviewNote !== undefined &&
      (typeof reviewNote !== "string" || reviewNote.length > 2000)
    ) {
      return res.status(400).json({
        success: false,
        message: "Review note must be text and cannot exceed 2000 characters."
      });
    }

    const application = await Application.findById(id);

    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application not found."
      });
    }

    if (!["pending", "under_review"].includes(application.status)) {
      return res.status(400).json({
        success: false,
        message: "Only pending or under-review applications can be updated."
      });
    }

    application.status = status;

    if (reviewNote !== undefined) {
      application.reviewNote = reviewNote.trim();
    }

    application.reviewedAt = new Date();

    await application.save();

    return res.status(200).json({
      success: true,
      message: "Application updated successfully.",
      application
    });
  } catch (error) {
    next(error);
  }
}
