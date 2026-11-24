
import mongoose from "mongoose";
import Application from "../models/Application.js";
import Property from "../models/Property.js";

export async function createApplication(req, res, next) {
  try {
    const { propertyId } = req.params;
    const { applicationType, message } = req.body;

    if (!mongoose.isValidObjectId(propertyId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid property ID."
      });
    }

    if (!["purchase", "rent", "lease"].includes(applicationType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid application type."
      });
    }

    if (message && typeof message !== "string") {
      return res.status(400).json({
        success: false,
        message: "Application message must be text."
      });
    }

    const property = await Property.findOne({
      _id: propertyId,
      status: "published"
    });

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found or unavailable."
      });
    }

    if (property.owner.toString() === req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You cannot apply for your own property."
      });
    }

    const expectedType = {
      sale: "purchase",
      rent: "rent",
      lease: "lease"
    }[property.transactionType];

    if (applicationType !== expectedType) {
      return res.status(400).json({
        success: false,
        message: "Application type does not match this property's transaction type."
      });
    }

    const existingApplication = await Application.findOne({
      applicant: req.user._id,
      property: propertyId,
      status: { $in: ["pending", "under_review", "approved"] }
    });

    if (existingApplication) {
      return res.status(409).json({
        success: false,
        message: "You already have an active application for this property."
      });
    }

    const application = await Application.create({
      applicant: req.user._id,
      property: propertyId,
      applicationType,
      message: message?.trim() || "",
      applicantPhone: req.user.phone || ""
    });

    return res.status(201).json({
      success: true,
      message: "Your property application has been submitted.",
      application
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "You already have an active application for this property."
      });
    }

    next(error);
  }
}

export async function getMyApplications(req, res, next) {
  try {
    const applications = await Application.find({
      applicant: req.user._id
    })
      .populate("property", "title slug price currency transactionType propertyType location coverImage status")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: applications.length,
      applications
    });
  } catch (error) {
    next(error);
  }
}

export async function getMyApplication(req, res, next) {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid application ID."
      });
    }

    const application = await Application.findOne({
      _id: id,
      applicant: req.user._id
    })
      .populate("property", "title slug price currency transactionType propertyType location coverImage status owner")
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

export async function withdrawApplication(req, res, next) {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid application ID."
      });
    }

    const application = await Application.findOne({
      _id: id,
      applicant: req.user._id
    });

    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application not found."
      });
    }

    if (!["pending", "under_review"].includes(application.status)) {
      return res.status(400).json({
        success: false,
        message: "This application can no longer be withdrawn."
      });
    }

    application.status = "withdrawn";
    await application.save();

    return res.status(200).json({
      success: true,
      message: "Application withdrawn successfully.",
      application
    });
  } catch (error) {
    next(error);
  }
}
