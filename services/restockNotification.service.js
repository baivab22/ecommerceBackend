const mongoose = require("mongoose");
const RestockNotification = require("../modals/restockNotification.modal");
const { Product } = require("../modals/product.modal");
const User = require("../modals/userModal");
const { sendRestockAvailableEmail } = require("./emailServices");

// Safety cap per restock event; the SMTP pool is rate-limited anyway.
const MAX_SUBSCRIBERS_PER_EVENT = 500;

/**
 * Register a user for a one-time restock notification of a product.
 * Idempotent: subscribing twice within the same stockout cycle is a no-op.
 *
 * @returns {{ subscribed: boolean, alreadySubscribed: boolean }}
 */
const subscribeUserToRestock = async ({ userId, productId }) => {
  if (!userId || !productId || !mongoose.isValidObjectId(productId)) {
    return { subscribed: false, alreadySubscribed: false };
  }

  const [user, product] = await Promise.all([
    User.findById(userId).select("email status"),
    Product.findById(productId).select("_id"),
  ]);

  if (!user || user.status !== "active" || !user.email) {
    return { subscribed: false, alreadySubscribed: false };
  }
  if (!product) {
    return { subscribed: false, alreadySubscribed: false };
  }

  const filter = {
    userId: user._id,
    productId: product._id,
    status: "pending", // an old "sent" record must never block a new cycle
  };

  const existing = await RestockNotification.findOne(filter).lean();
  if (existing) {
    return { subscribed: true, alreadySubscribed: true };
  }

  try {
    await RestockNotification.create({
      userId: user._id,
      productId: product._id,
      email: String(user.email).toLowerCase().trim(),
    });
    return { subscribed: true, alreadySubscribed: false };
  } catch (error) {
    // Concurrent subscribe hit the partial unique index → someone else just
    // created the same pending record; that is still a successful opt-in.
    if (error?.code === 11000) {
      return { subscribed: true, alreadySubscribed: true };
    }
    throw error;
  }
};

/**
 * Cancel a pending subscription (e.g. user changed their mind).
 */
const cancelRestockSubscription = async ({ userId, productId }) => {
  const result = await RestockNotification.updateOne(
    { userId, productId, status: "pending" },
    { $set: { status: "cancelled" } }
  );
  return result.modifiedCount > 0;
};

/**
 * Notify every pending subscriber that a product is back in stock.
 * Uses claim-then-send (atomic pending→sent transition per document) so each
 * subscriber receives AT MOST ONE email per restock, even if restock events
 * fire concurrently or the server runs multiple instances.
 *
 * Failed sends are reverted to "pending" so the next restock retries them.
 *
 * @returns {{ skipped?: string, notified: number, failed: number }} summary
 */
const notifySubscribersOfRestock = async (productId) => {
  const product = await Product.findById(productId)
    .select("name price discountedPrice originalPrice images")
    .lean();

  if (!product) {
    return { skipped: "PRODUCT_NOT_FOUND", notified: 0, failed: 0 };
  }

  // Re-read live stock — never announce availability we cannot back up.
  const currentStock = Number(
    (
      await Product.findById(productId).select("stockQuantity").lean()
    )?.stockQuantity ?? 0
  );
  if (currentStock <= 0) {
    return { skipped: "OUT_OF_STOCK", notified: 0, failed: 0 };
  }

  const pending = await RestockNotification.find({
    productId,
    status: "pending",
  })
    .select("_id")
    .limit(MAX_SUBSCRIBERS_PER_EVENT)
    .lean();

  let notified = 0;
  let failed = 0;

  for (const { _id } of pending) {
    // Atomic claim: only ONE caller can flip a document pending→sent.
    const claimed = await RestockNotification.findOneAndUpdate(
      { _id, status: "pending" },
      { $set: { status: "sent", notifiedAt: new Date() } },
      { new: true }
    );
    if (!claimed) continue;

    try {
      await sendRestockAvailableEmail(claimed.email, product);
      notified += 1;
    } catch (error) {
      failed += 1;
      console.error(
        `[Restock] Failed to notify ${claimed.email} for product ${productId}:`,
        error.message
      );
      // Release the claim so the next restock event retries this subscriber.
      await RestockNotification.updateOne(
        { _id, status: "sent", notifiedAt: claimed.notifiedAt },
        { $set: { status: "pending" }, $unset: { notifiedAt: "" } }
      ).catch(() => {});
    }
  }

  console.log(
    `[Restock] Product ${productId}: ${notified} subscriber(s) notified, ${failed} failed.`
  );
  return { notified, failed };
};

module.exports = {
  subscribeUserToRestock,
  cancelRestockSubscription,
  notifySubscribersOfRestock,
};
