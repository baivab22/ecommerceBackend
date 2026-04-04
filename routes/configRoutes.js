const express = require('express');
const configController = require('../controllers/configController');
const router = express.Router();

router.get('/config', configController.getConfig);
router.post('/config', configController.setConfig);

module.exports = router;
