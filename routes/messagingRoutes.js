const express = require('express')
const router = express.Router()
const {
  webhookVerify,
  webhookEvent,
  listConversations,
  listMessages,
  replyToConversation,
  getStats,
} = require('../controllers/messagingController')

// Webhook
router.get('/webhook', webhookVerify)

router.post(
  '/webhook',
  express.json({ verify: (req, _res, buf) => { req.rawBody = buf.toString() } }),
  webhookEvent
)

// Dashboard API
router.get('/messaging/conversations', listConversations)
router.get('/messaging/conversations/:conversationId/messages', listMessages)
router.post('/messaging/conversations/:conversationId/reply', replyToConversation)
router.get('/messaging/stats', getStats)

module.exports = router
