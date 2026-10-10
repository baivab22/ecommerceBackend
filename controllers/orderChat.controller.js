const mongoose = require("mongoose");
const Orders = require("../modals/orderModal");
const OrderChatMessage = require("../modals/orderChat.modal");

const normalizeRole = (value) => (value === "admin" ? "admin" : "user");

const getOrderForChat = async (orderId) => {
  const safeOrderId = String(orderId || "").trim();
  if (!safeOrderId) return null;

  if (mongoose.Types.ObjectId.isValid(safeOrderId)) {
    const byId = await Orders.findById(safeOrderId);
    if (byId) return byId;
  }

  return Orders.findOne({ productOrderId: safeOrderId });
};

const canAccessOrderChat = (order, role, userId) => {
  if (role === "admin") return true;
  const orderUserId = order?.userId ? String(order.userId) : "";
  return !!orderUserId && !!userId && orderUserId === String(userId);
};

const buildChatSummary = async (orderId) => {
  const [lastMessage, unreadForAdmin, unreadForUser] = await Promise.all([
    OrderChatMessage.findOne({ orderId }).sort({ createdAt: -1 }).lean(),
    OrderChatMessage.countDocuments({
      orderId,
      senderRole: "user",
      readByAdmin: false,
    }),
    OrderChatMessage.countDocuments({
      orderId,
      senderRole: "admin",
      readByUser: false,
    }),
  ]);

  return {
    lastMessage,
    unreadForAdmin,
    unreadForUser,
  };
};

exports.listOrderChatMessages = async (req, res) => {
  try {
    const role = normalizeRole(req.query.role);
    const userId = req.query.userId;
    const order = await getOrderForChat(req.params.orderId);

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (!canAccessOrderChat(order, role, userId)) {
      return res.status(403).json({ error: "You cannot access this order chat" });
    }

    const markReadPatch = role === "admin" ? { readByAdmin: true } : { readByUser: true };

    await OrderChatMessage.updateMany(
      {
        orderId: order._id,
        senderRole: role === "admin" ? "user" : "admin",
      },
      markReadPatch
    );

    const messages = await OrderChatMessage.find({ orderId: order._id })
      .sort({ createdAt: 1 })
      .lean();

    const summary = await buildChatSummary(order._id);

    return res.json({
      order: {
        _id: order._id,
        productOrderId: order.productOrderId,
      },
      messages,
      summary,
    });
  } catch (error) {
    console.error("[order-chat] list failed:", error?.message || error);
    return res.status(500).json({ error: "Failed to fetch order chat" });
  }
};

exports.createOrderChatMessage = async (req, res) => {
  try {
    const role = normalizeRole(req.body?.senderRole);
    const userId = req.body?.userId;
    const message = String(req.body?.message || "").replace(/\s+/g, " ").trim();
    const senderName = String(req.body?.senderName || "").trim().slice(0, 120);

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    const order = await getOrderForChat(req.params.orderId);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (!canAccessOrderChat(order, role, userId)) {
      return res.status(403).json({ error: "You cannot access this order chat" });
    }

    const created = await OrderChatMessage.create({
      orderId: order._id,
      productOrderId: order.productOrderId,
      senderRole: role,
      senderName,
      message,
      readByUser: role === "user",
      readByAdmin: role === "admin",
    });

    const summary = await buildChatSummary(order._id);

    return res.status(201).json({
      message: created,
      summary,
    });
  } catch (error) {
    console.error("[order-chat] create failed:", error?.message || error);
    return res.status(500).json({ error: "Failed to send message" });
  }
};

exports.getOrderChatSummary = async (req, res) => {
  try {
    const role = normalizeRole(req.query.role);
    const userId = req.query.userId;
    const order = await getOrderForChat(req.params.orderId);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (!canAccessOrderChat(order, role, userId)) {
      return res.status(403).json({ error: "You cannot access this order chat" });
    }

    const summary = await buildChatSummary(order._id);
    return res.json({ summary });
  } catch (error) {
    console.error("[order-chat] summary failed:", error?.message || error);
    return res.status(500).json({ error: "Failed to fetch order chat summary" });
  }
};
