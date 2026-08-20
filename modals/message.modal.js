const mongoose = require('mongoose')

/**
 * Conversation – one per unique user (sender PSID).
 * Holds the user profile snapshot and the latest message preview
 * so the dashboard conversation list can render without joining.
 */
const conversationSchema = new mongoose.Schema(
  {
    /** Meta Page-Scoped User ID (unique per page) */
    senderId: { type: String, required: true, index: true, unique: true },

    /** Platform: 'facebook' | 'instagram' */
    platform: { type: String, enum: ['facebook', 'instagram'], required: true },

    /** Snapshot of the user's profile from the first webhook */
    userName: { type: String, default: '' },
    userAvatar: { type: String, default: '' },

    /** Denormalised preview for the list view */
    lastMessage: { type: String, default: '' },
    lastMessageAt: { type: Date, default: Date.now },

    /** How many messages the user sent that haven't been replied to */
    unreadCount: { type: Number, default: 0 },
  },
  { timestamps: true }
)

/**
 * Message – individual message inside a conversation.
 */
const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },

    /** 'user' = customer message, 'admin' = our reply */
    direction: { type: String, enum: ['user', 'admin'], required: true },

    /** Message type from Meta */
    type: { type: String, default: 'text' },

    /** Text content */
    text: { type: String, default: '' },

    /** Attachment URL (image, etc.) if present */
    attachmentUrl: { type: String, default: '' },

    /** Meta message ID for dedup */
    mid: { type: String, default: '' },
  },
  { timestamps: true }
)

const Conversation =
  mongoose.models.Conversation || mongoose.model('Conversation', conversationSchema)

const Message = mongoose.models.Message || mongoose.model('Message', messageSchema)

module.exports = { Conversation, Message }
