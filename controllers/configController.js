const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '../uploads/site-config.json');

exports.getConfig = (req, res) => {
  if (fs.existsSync(CONFIG_PATH)) {
    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    res.json(config);
  } else {
    res.json({});
  }
};

exports.setConfig = (req, res) => {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(req.body, null, 2));
  res.json({ message: 'Config saved' });
};
