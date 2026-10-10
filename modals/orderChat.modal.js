const mongoose = require("mongoose");

const orderChatMessageSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Orders",
      required: true,
      index: true,
    },
    productOrderId: {
      type: String,
      trim: true,
      index: true,
    },
    senderRole: {
      type: String,
      enum: ["user", "admin"],
      required: true,
    },
    senderName: {
      type: String,
      trim: true,
      default: "",
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    readByUser: {
      type: Boolean,
      default: false,
    },
    readByAdmin: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

orderChatMessageSchema.index({ orderId: 1, createdAt: 1 });

const OrderChatMessage =
  mongoose.models.OrderChatMessage ||
  mongoose.model("OrderChatMessage", orderChatMessageSchema);

module.exports = OrderChatMessage;
