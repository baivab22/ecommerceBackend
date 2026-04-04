const express = require('express');
const multer = require('multer');
const path = require('path');
const logoController = require('../controllers/logoController');

const router = express.Router();

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: function (req, file, cb) {
    cb(null, 'logo.png'); // Always overwrite as logo.png
  },
});

const upload = multer({ storage });

router.post('/logo', upload.single('logo'), logoController.uploadLogo);
router.get('/logo', logoController.getLogo);

module.exports = router;
