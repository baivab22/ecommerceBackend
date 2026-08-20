const crypto = require('crypto')
const { Conversation, Message } = require('../modals/message.modal')

// ---------------------------------------------------------------------------
// Config helpers
// ---------------------------------------------------------------------------
const PAGE_ACCESS_TOKEN = () => process.env.META_PAGE_ACCESS_TOKEN || ''
const APP_SECRET = () => process.env.META_APP_SECRET || ''
const VERIFY_TOKEN = () => process.env.META_VERIFY_TOKEN || ''

const GRAPH_API = 'https://graph.facebook.com/v19.0'

// ---------------------------------------------------------------------------
// Webhook verification (GET /api/webhook)
// ---------------------------------------------------------------------------
const verifyWebhook = (req, res) => {
  const mode = req.query['hub.mode']
  const token = req.query['hub.verify_token']
  const challenge = req.query['hub.challenge']

  if (mode === 'subscribe' && token === VERIFY_TOKEN()) {
    console.log('[Messaging] Webhook verified')
    return res.status(200).send(challenge)
  }
  console.warn('[Messaging] Webhook verification failed')
  return res.sendStatus(403)
}

// ---------------------------------------------------------------------------
// Signature verification (used by the POST handler)
// ---------------------------------------------------------------------------
const verifySignature = (req) => {
  const signature = req.headers['x-hub-signature-256']
  if (!signature || !APP_SECRET()) return false

  const rawBody = typeof req.rawBody === 'string' ? req.rawBody : JSON.stringify(req.body)
  const expected =
    'sha256=' + crypto.createHmac('sha256', APP_SECRET()).update(rawBody).digest('hex')
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
}

// ---------------------------------------------------------------------------
// Process incoming messages (POST /api/webhook)
// ---------------------------------------------------------------------------
const processWebhookEvent = async (body) => {
  if (body.object !== 'page') return

  const entries = body.entry || []
  for (const entry of entries) {
    const events = entry.messaging || []
    for (const event of events) {
      await handleMessagingEvent(event)
    }
  }
}

const handleMessagingEvent = async (event) => {
  const senderId = event.sender?.id
  if (!senderId) return

  // Determine platform from the webhook field
  const pageId = event.recipient?.id
  const platform = pageId ? 'facebook' : 'instagram' // fallback; refined below

  // Only handle text messages for now
  const messageText = event.message?.text
  const attachmentUrl = event.message?.attachments?.[0]?.payload?.url || ''
  const mid = event.message?.mid || ''

  if (!messageText && !attachmentUrl) return

  try {
    // Upsert conversation
    let conversation = await Conversation.findOne({ senderId })
    if (!conversation) {
      // Try to fetch the user profile
      const profile = await fetchUserProfile(senderId)
      conversation = await Conversation.create({
        senderId,
        platform,
        userName: profile?.name || 'Unknown',
        userAvatar: profile?.profile_pic || '',
        lastMessage: messageText || '[Image]',
        lastMessageAt: new Date(),
        unreadCount: 1,
      })
    } else {
      conversation.lastMessage = messageText || '[Attachment]'
      conversation.lastMessageAt = new Date()
      conversation.unreadCount = (conversation.unreadCount || 0) + 1
      await conversation.save()
    }

    // Save message
    await Message.create({
      conversationId: conversation._id,
      direction: 'user',
      type: attachmentUrl ? 'image' : 'text',
      text: messageText || '',
      attachmentUrl,
      mid,
    })

    console.log(`[Messaging] Received from ${senderId}: ${messageText || '[attachment]'}`)
  } catch (err) {
    console.error('[Messaging] Error processing event:', err.message)
  }
}

// ---------------------------------------------------------------------------
// Fetch user profile from Graph API
// ---------------------------------------------------------------------------
const fetchUserProfile = async (psid) => {
  const token = PAGE_ACCESS_TOKEN()
  if (!token) return null

  try {
    const url = `${GRAPH_API}/${psid}?fields=name,profile_pic&access_token=${token}`
    const res = await fetch(url)
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Send reply via Graph API
// ---------------------------------------------------------------------------
const sendReply = async (recipientId, text) => {
  const token = PAGE_ACCESS_TOKEN()
  if (!token) throw new Error('META_PAGE_ACCESS_TOKEN not configured')

  const url = `${GRAPH_API}/me/messages?access_token=${token}`
  const body = {
    recipient: { id: recipientId },
    message: { text },
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `Meta API returned ${res.status}`)
  }

  return await res.json()
}

// ---------------------------------------------------------------------------
// Helpers used by the controller
// ---------------------------------------------------------------------------
const getConversations = async ({ page = 1, limit = 20, search = '' } = {}) => {
  const query = {}
  if (search) {
    query.userName = { $regex: search, $options: 'i' }
  }

  const skip = (page - 1) * limit
  const [data, total] = await Promise.all([
    Conversation.find(query).sort({ lastMessageAt: -1 }).skip(skip).limit(limit).lean(),
    Conversation.countDocuments(query),
  ])

  return { data, total, page, limit, totalPages: Math.ceil(total / limit) }
}

const getMessages = async (conversationId, { page = 1, limit = 50 } = {}) => {
  const skip = (page - 1) * limit
  const [data, total] = await Promise.all([
    Message.find({ conversationId }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Message.countDocuments({ conversationId }),
  ])

  return { data: data.reverse(), total, page, limit }
}

const markRead = async (conversationId) => {
  await Conversation.findByIdAndUpdate(conversationId, { unreadCount: 0 })
}

module.exports = {
  verifyWebhook,
  verifySignature,
  processWebhookEvent,
  sendReply,
  getConversations,
  getMessages,
  markRead,
}
