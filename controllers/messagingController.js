const {
  verifyWebhook,
  verifySignature,
  processWebhookEvent,
  sendReply,
  getConversations,
  getMessages,
  markRead,
} = require('../services/metaMessaging.service')
const { Conversation, Message } = require('../modals/message.modal')

// ---------------------------------------------------------------------------
// Webhook endpoints
// ---------------------------------------------------------------------------

/** GET /api/webhook — Meta verification handshake */
exports.webhookVerify = (req, res) => verifyWebhook(req, res)

/** POST /api/webhook — receive incoming messages */
exports.webhookEvent = async (req, res) => {
  // Always respond 200 quickly so Meta doesn't retry
  res.sendStatus(200)

  try {
    // Verify signature in production
    if (process.env.NODE_ENV === 'production' && !verifySignature(req)) {
      console.warn('[Messaging] Invalid signature — ignoring event')
      return
    }
    await processWebhookEvent(req.body)
  } catch (err) {
    console.error('[Messaging] webhookEvent error:', err.message)
  }
}

// ---------------------------------------------------------------------------
// Dashboard API endpoints
// ---------------------------------------------------------------------------

/** GET /api/messaging/conversations */
exports.listConversations = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1)
    const limit = Math.min(100, parseInt(req.query.limit, 10) || 20)
    const search = (req.query.search || '').trim()

    const result = await getConversations({ page, limit, search })
    res.json(result)
  } catch (err) {
    console.error('[Messaging] listConversations error:', err.message)
    res.status(500).json({ error: 'Failed to fetch conversations' })
  }
}

/** GET /api/messaging/conversations/:conversationId/messages */
exports.listMessages = async (req, res) => {
  try {
    const { conversationId } = req.params
    const page = Math.max(1, parseInt(req.query.page, 10) || 1)
    const limit = Math.min(200, parseInt(req.query.limit, 10) || 50)

    const result = await getMessages(conversationId, { page, limit })

    // Also mark as read
    await markRead(conversationId)

    res.json(result)
  } catch (err) {
    console.error('[Messaging] listMessages error:', err.message)
    res.status(500).json({ error: 'Failed to fetch messages' })
  }
}

/** POST /api/messaging/conversations/:conversationId/reply */
exports.replyToConversation = async (req, res) => {
  try {
    const { conversationId } = req.params
    const { text } = req.body

    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Message text is required' })
    }

    const conversation = await Conversation.findById(conversationId)
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' })
    }

    // Send via Meta API
    const result = await sendReply(conversation.senderId, text.trim())

    // Persist the admin message
    const msg = await Message.create({
      conversationId: conversation._id,
      direction: 'admin',
      type: 'text',
      text: text.trim(),
    })

    // Update conversation preview
    conversation.lastMessage = text.trim()
    conversation.lastMessageAt = new Date()
    conversation.unreadCount = 0
    await conversation.save()

    res.json({ success: true, message: msg })
  } catch (err) {
    console.error('[Messaging] reply error:', err.message)
    res.status(500).json({ error: err.message || 'Failed to send reply' })
  }
}

/** GET /api/messaging/stats — unread counts for badge */
exports.getStats = async (_req, res) => {
  try {
    const totalConversations = await Conversation.countDocuments()
    const totalUnread = await Conversation.aggregate([
      { $group: { _id: null, total: { $sum: '$unreadCount' } } },
    ])
    const facebook = await Conversation.countDocuments({ platform: 'facebook' })
    const instagram = await Conversation.countDocuments({ platform: 'instagram' })

    res.json({
      totalConversations,
      totalUnread: totalUnread[0]?.total || 0,
      facebook,
      instagram,
    })
  } catch (err) {
    console.error('[Messaging] getStats error:', err.message)
    res.status(500).json({ error: 'Failed to fetch stats' })
  }
}
