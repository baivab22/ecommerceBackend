const Coupon = require("../modals/coupon.modal");
const SiteSetting = require("../modals/siteSetting.modal");

const normalizeCouponCode = (rawCode) =>
  String(rawCode || "").trim().toUpperCase();

// Returns the discount in NPR, never exceeding the subtotal.
const calculateCouponDiscount = (coupon, subtotal) => {
  const safeSubtotal = Number(subtotal) || 0;
  let discount = 0;

  if (coupon.discountType === "percentage") {
    discount = Math.round((safeSubtotal * (coupon.discountValue || 0)) / 100);
  } else {
    discount = Math.round(coupon.discountValue || 0);
  }

  if (
    coupon.discountType === "percentage" &&
    coupon.maxDiscountAmount &&
    discount > coupon.maxDiscountAmount
  ) {
    discount = Math.round(coupon.maxDiscountAmount);
  }

  if (discount > safeSubtotal) {
    discount = safeSubtotal;
  }

  return Math.max(0, discount);
};

// Expiry comparator with sensible semantics:
// - date-only strings ("YYYY-MM-DD") are valid until the END of that day (local time)
// - unparseable dates never expire rather than instantly failing
const getCouponExpiryTime = (expiresAt) => {
  if (!expiresAt) return null;
  const raw = String(expiresAt);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return new Date(`${raw}T23:59:59`).getTime();
  }
  const time = new Date(expiresAt).getTime();
  return Number.isNaN(time) ? null : time;
};

// Validates a coupon against an order subtotal and (optionally) a user.
// Returns { ok, message, coupon, discountAmount } — never throws.
const validateCouponForOrder = async (rawCode, subtotal, userId) => {
  const code = normalizeCouponCode(rawCode);
  const safeSubtotal = Number(subtotal) || 0;

  if (!code) {
    return { ok: false, message: "Coupon code is required", coupon: null, discountAmount: 0 };
  }

  // Feature flag — coupons can be turned off from the admin dashboard
  try {
    const settings = await SiteSetting.getSettings();
    if (!settings.couponsEnabled) {
      return { ok: false, message: "Coupon codes are currently disabled", coupon: null, discountAmount: 0 };
    }
  } catch (settingsError) {
    console.error("Failed to check coupon feature flag:", settingsError?.message);
  }

  const coupon = await Coupon.findOne({ code });
  if (!coupon) {
    return { ok: false, message: "Invalid coupon code", coupon: null, discountAmount: 0 };
  }
  if (!coupon.isActive) {
    return { ok: false, message: "This coupon is no longer active", coupon: null, discountAmount: 0 };
  }
  const expiryTime = getCouponExpiryTime(coupon.expiresAt);
  if (expiryTime !== null && expiryTime < Date.now()) {
    return { ok: false, message: "This coupon has expired", coupon: null, discountAmount: 0 };
  }
  if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) {
    return { ok: false, message: "This coupon has reached its usage limit", coupon: null, discountAmount: 0 };
  }
  if (safeSubtotal < (coupon.minOrderAmount || 0)) {
    return {
      ok: false,
      message: `Minimum order amount of NPR ${coupon.minOrderAmount} required for this coupon`,
      coupon: null,
      discountAmount: 0,
    };
  }
  if (
    userId &&
    coupon.usageLimitPerUser > 0 &&
    Array.isArray(coupon.usedByUsers)
  ) {
    const userUsageCount = coupon.usedByUsers.filter(
      (entry) => String(entry?.userId || "") === String(userId)
    ).length;
    if (userUsageCount >= coupon.usageLimitPerUser) {
      return { ok: false, message: "You have already used this coupon", coupon: null, discountAmount: 0 };
    }
  }

  const discountAmount = calculateCouponDiscount(coupon, safeSubtotal);

  return { ok: true, message: "Coupon applied successfully", coupon, discountAmount };
};

// Public — used by the cart page before placing an order
exports.validateCoupon = async (req, res) => {
  try {
    const { code, subtotal, userId } = req.body;
    const result = await validateCouponForOrder(code, subtotal, userId);

    if (!result.ok) {
      return res.status(400).json({ error: result.message });
    }

    res.status(200).json({
      data: {
        code: result.coupon.code,
        description: result.coupon.description,
        discountType: result.coupon.discountType,
        discountValue: result.coupon.discountValue,
        maxDiscountAmount: result.coupon.maxDiscountAmount,
        minOrderAmount: result.coupon.minOrderAmount,
        discountAmount: result.discountAmount,
      },
      success: result.message,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Admin — list coupons with pagination + search
exports.getAllCouponsAdmin = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search ? String(req.query.search).trim() : "";

    const query = search ? { code: new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") } : {};

    const total = await Coupon.countDocuments(query);
    const coupons = await Coupon.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      data: coupons,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      success: "Successfully retrieved coupons",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Admin — create a coupon
exports.createCoupon = async (req, res) => {
  try {
    const {
      code,
      description,
      discountType,
      discountValue,
      maxDiscountAmount,
      minOrderAmount,
      expiresAt,
      usageLimit,
      usageLimitPerUser,
      isActive,
    } = req.body;

    const normalizedCode = normalizeCouponCode(code);
    if (!normalizedCode) {
      return res.status(400).json({ error: "Coupon code is required" });
    }
    if (!["percentage", "fixed"].includes(discountType)) {
      return res.status(400).json({ error: "Discount type must be either percentage or fixed" });
    }
    const numericValue = Number(discountValue);
    if (!numericValue || numericValue <= 0) {
      return res.status(400).json({ error: "Discount value must be greater than 0" });
    }
    if (discountType === "percentage" && numericValue > 100) {
      return res.status(400).json({ error: "Percentage discount cannot exceed 100" });
    }

    const existing = await Coupon.findOne({ code: normalizedCode });
    if (existing) {
      return res.status(409).json({ error: `Coupon "${normalizedCode}" already exists` });
    }

    const couponData = {
      code: normalizedCode,
      description: String(description || "").trim(),
      discountType,
      discountValue: numericValue,
      isActive: isActive !== false,
    };

    if (maxDiscountAmount !== undefined && maxDiscountAmount !== null && maxDiscountAmount !== "") {
      couponData.maxDiscountAmount = Number(maxDiscountAmount) || null;
    }
    if (minOrderAmount !== undefined && minOrderAmount !== null && minOrderAmount !== "") {
      couponData.minOrderAmount = Number(minOrderAmount) || 0;
    }
    if (expiresAt) {
      couponData.expiresAt = new Date(expiresAt);
    }
    if (usageLimit !== undefined && usageLimit !== null && usageLimit !== "") {
      couponData.usageLimit = Number(usageLimit) || 0;
    }
    if (usageLimitPerUser !== undefined && usageLimitPerUser !== null && usageLimitPerUser !== "") {
      couponData.usageLimitPerUser = Number(usageLimitPerUser);
      if (Number.isNaN(couponData.usageLimitPerUser)) couponData.usageLimitPerUser = 1;
    }

    const createdCoupon = await Coupon.create(couponData);

    res.status(201).json({
      data: createdCoupon,
      success: "Coupon created successfully",
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ error: "A coupon with this code already exists" });
    }
    res.status(500).json({ error: error.message });
  }
};

// Admin — update a coupon
exports.updateCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await Coupon.findById(id);
    if (!existing) {
      return res.status(404).json({ error: "Coupon not found" });
    }

    const updates = {};
    const body = req.body || {};

    if (body.code !== undefined) {
      const normalizedCode = normalizeCouponCode(body.code);
      if (!normalizedCode) {
        return res.status(400).json({ error: "Coupon code cannot be empty" });
      }
      const duplicate = await Coupon.findOne({ code: normalizedCode, _id: { $ne: id } });
      if (duplicate) {
        return res.status(409).json({ error: `Coupon "${normalizedCode}" already exists` });
      }
      updates.code = normalizedCode;
    }
    if (body.description !== undefined) updates.description = String(body.description || "").trim();
    if (body.discountType !== undefined) {
      if (!["percentage", "fixed"].includes(body.discountType)) {
        return res.status(400).json({ error: "Discount type must be either percentage or fixed" });
      }
      updates.discountType = body.discountType;
    }
    if (body.discountValue !== undefined) {
      const numericValue = Number(body.discountValue);
      if (!numericValue || numericValue <= 0) {
        return res.status(400).json({ error: "Discount value must be greater than 0" });
      }
      if ((updates.discountType || existing.discountType) === "percentage" && numericValue > 100) {
        return res.status(400).json({ error: "Percentage discount cannot exceed 100" });
      }
      updates.discountValue = numericValue;
    }
    if (body.maxDiscountAmount !== undefined) {
      updates.maxDiscountAmount = body.maxDiscountAmount === null || body.maxDiscountAmount === "" ? null : Number(body.maxDiscountAmount) || null;
    }
    if (body.minOrderAmount !== undefined) {
      updates.minOrderAmount = Number(body.minOrderAmount) || 0;
    }
    if (body.expiresAt !== undefined) {
      updates.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
    }
    if (body.usageLimit !== undefined) {
      updates.usageLimit = Number(body.usageLimit) || 0;
    }
    if (body.usageLimitPerUser !== undefined) {
      const perUser = Number(body.usageLimitPerUser);
      updates.usageLimitPerUser = Number.isNaN(perUser) ? 1 : perUser;
    }
    if (body.isActive !== undefined) updates.isActive = Boolean(body.isActive);

    const updatedCoupon = await Coupon.findByIdAndUpdate(id, updates, { new: true });

    res.status(200).json({
      data: updatedCoupon,
      success: "Coupon updated successfully",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Admin — delete a coupon
exports.deleteCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedCoupon = await Coupon.findByIdAndDelete(id);

    if (!deletedCoupon) {
      return res.status(404).json({ error: "Coupon not found" });
    }

    res.status(200).json({
      data: deletedCoupon,
      success: "Coupon deleted successfully",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.normalizeCouponCode = normalizeCouponCode;
exports.calculateCouponDiscount = calculateCouponDiscount;
exports.validateCouponForOrder = validateCouponForOrder;
