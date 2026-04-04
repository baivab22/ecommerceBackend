const fs = require('fs');
const path = require('path');

const LOGO_PATH = path.join(__dirname, '../uploads/logo.png');

exports.uploadLogo = (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }
  // Save as logo.png (overwrite)
  const tempPath = req.file.path;
  fs.rename(tempPath, LOGO_PATH, (err) => {
    if (err) {
      return res.status(500).json({ message: 'Error saving logo', error: err });
    }
    res.json({ message: 'Logo uploaded successfully', logoUrl: '/uploads/logo.png' });
  });
};

exports.getLogo = (req, res) => {
  if (fs.existsSync(LOGO_PATH)) {
    res.sendFile(LOGO_PATH);
  } else {
    res.status(404).json({ message: 'Logo not found' });
  }
};
