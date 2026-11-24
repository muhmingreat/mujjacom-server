import AdminMemberAudit from "../models/AdminMemberAudit.js";
import mongoose from "mongoose";
import User from "../models/User.js";

const MEMBER_ROLES = ["user", "agent", "developer"];
const ACCOUNT_STATUSES = ["active", "suspended", "deactivated"];

export async function getAllAdminMembers(req, res, next) {
  try {
    const {
      search = "",
      role = "",
      status = "",
      emailVerified = "",
      page = 1,
      limit = 12,
      sort = "newest"
    } = req.query;

    const filter = {};

    if (role) {
      if (!MEMBER_ROLES.includes(role)) {
        return res.status(400).json({
          success: false,
          message: "Invalid member role."
        });
      }

      filter.role = role;
    } else {
      filter.role = { $in: MEMBER_ROLES };
    }

    if (status) {
      if (!ACCOUNT_STATUSES.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid account status."
        });
      }

      filter.accountStatus = status;
    }

    if (emailVerified !== "") {
      if (!["true", "false"].includes(emailVerified)) {
        return res.status(400).json({
          success: false,
          message: "Invalid email verification filter."
        });
      }

      filter.isEmailVerified = emailVerified === "true";
    }

    if (search.trim()) {
      const safeSearch = search.trim().slice(0, 100);
      const escapedSearch = safeSearch.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );

      filter.$or = [
        { firstName: { $regex: escapedSearch, $options: "i" } },
        { lastName: { $regex: escapedSearch, $options: "i" } },
        { email: { $regex: escapedSearch, $options: "i" } },
        { phone: { $regex: escapedSearch, $options: "i" } }
      ];
    }

    const currentPage = Math.max(1, Number.parseInt(page, 10) || 1);
    const pageSize = Math.min(
      50,
      Math.max(1, Number.parseInt(limit, 10) || 12)
    );

    const sortOrder = sort === "oldest" ? 1 : -1;

    const [members, total] = await Promise.all([
      User.find(filter)
        .select(
          "firstName lastName email phone role accountStatus isEmailVerified createdAt lastLoginAt"
        )
        .sort({ createdAt: sortOrder })
        .skip((currentPage - 1) * pageSize)
        .limit(pageSize)
        .lean(),

      User.countDocuments(filter)
    ]);

    const totalPages = Math.ceil(total / pageSize);

    return res.status(200).json({
      success: true,
      data: members,
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

export async function getAdminMemberStats(req, res, next) {
  try {
    const [total, active, suspended, deactivated, unverified] =
      await Promise.all([
        User.countDocuments({ role: { $in: MEMBER_ROLES } }),
        User.countDocuments({
          role: { $in: MEMBER_ROLES },
          accountStatus: "active"
        }),
        User.countDocuments({
          role: { $in: MEMBER_ROLES },
          accountStatus: "suspended"
        }),
        User.countDocuments({
          role: { $in: MEMBER_ROLES },
          accountStatus: "deactivated"
        }),
        User.countDocuments({
          role: { $in: MEMBER_ROLES },
          isEmailVerified: false
        })
      ]);

    return res.status(200).json({
      success: true,
      stats: {
        total,
        active,
        suspended,
        deactivated,
        unverified
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function getAdminMember(req, res, next) {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid member ID."
      });
    }

    const member = await User.findOne({
      _id: id,
      role: { $in: MEMBER_ROLES }
    })
      .select(
        "firstName lastName email phone role accountStatus isEmailVerified createdAt updatedAt lastLoginAt"
      )
      .lean();

    if (!member) {
      return res.status(404).json({
        success: false,
        message: "Member not found."
      });
    }

    return res.status(200).json({
      success: true,
      member
    });
  } catch (error) {
    next(error);
  }
}

export async function updateAdminMemberStatus(req, res, next) {
  const session = await mongoose.startSession();

  try {
    const { id } = req.params;
    const { accountStatus, reason = "" } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid member ID."
      });
    }

    if (!["active", "suspended"].includes(accountStatus)) {
      return res.status(400).json({
        success: false,
        message: "Only active or suspended status can be assigned."
      });
    }

    if (typeof reason !== "string" || reason.trim().length > 1000) {
      return res.status(400).json({
        success: false,
        message: "The reason must be text and cannot exceed 1000 characters."
      });
    }

    if (String(req.user._id) === id) {
      return res.status(403).json({
        success: false,
        message: "You cannot change your own account status."
      });
    }

    let updatedMember;

    await session.withTransaction(async () => {
      const member = await User.findById(id)
        .select("firstName lastName email role accountStatus tokenVersion")
        .session(session);

      if (!member || !MEMBER_ROLES.includes(member.role)) {
        const error = new Error("Eligible member not found.");
        error.status = 404;
        throw error;
      }

      if (member.accountStatus === accountStatus) {
        const error = new Error(
          `This member is already ${accountStatus}.`
        );
        error.status = 400;
        throw error;
      }

      const previousStatus = member.accountStatus;

      member.accountStatus = accountStatus;

      if (accountStatus === "suspended") {
        member.tokenVersion = (member.tokenVersion ?? 0) + 1;
      }

      await member.save({ session });

      await AdminMemberAudit.create(
        [
          {
            admin: req.user._id,
            member: member._id,
            action:
              accountStatus === "suspended"
                ? "suspended"
                : "reactivated",
            previousStatus,
            newStatus: accountStatus,
            reason: reason.trim()
          }
        ],
        { session }
      );

      updatedMember = {
        _id: member._id,
        firstName: member.firstName,
        lastName: member.lastName,
        email: member.email,
        role: member.role,
        accountStatus: member.accountStatus
      };
    });

    return res.status(200).json({
      success: true,
      message: `Member account ${accountStatus} successfully.`,
      member: updatedMember
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  } finally {
    await session.endSession();
  }
}

export async function getAdminMemberAuditHistory(req, res, next) {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid member ID."
      });
    }

    const memberExists = await User.exists({
      _id: id,
      role: { $in: MEMBER_ROLES }
    });

    if (!memberExists) {
      return res.status(404).json({
        success: false,
        message: "Member not found."
      });
    }

    const page = Math.max(
      1,
      Number.parseInt(req.query.page, 10) || 1
    );

    const limit = Math.min(
      50,
      Math.max(1, Number.parseInt(req.query.limit, 10) || 10)
    );

    const filter = { member: id };

    const [records, total] = await Promise.all([
      AdminMemberAudit.find(filter)
        .populate("admin", "firstName lastName email")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),

      AdminMemberAudit.countDocuments(filter)
    ]);

    const totalPages = Math.ceil(total / limit);

    return res.status(200).json({
      success: true,
      data: records,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      }
    });
  } catch (error) {
    next(error)
  }
}