const fs = require('fs');
const path = require('path');

// Candidate paths, first existing one wins. server/assets/logo.png ships with
// the deployed server folder (cPanel), the client path covers local dev.
const LOGO_CANDIDATES = [
  path.join(__dirname, '../assets/logo.png'),
  path.join(__dirname, '../../client/public/assets/images/logosss.png'),
];

let _logoDataUriCache = null;

const getLogoPath = () =>
  LOGO_CANDIDATES.find((p) => {
    try {
      return fs.existsSync(p);
    } catch {
      return false;
    }
  }) || null;

const getLogoBuffer = () => {
  const p = getLogoPath();
  return p ? fs.readFileSync(p) : null;
};

const getLogoDataUri = () => {
  if (_logoDataUriCache !== null) return _logoDataUriCache;
  try {
    const buf = getLogoBuffer();
    _logoDataUriCache = buf ? `data:image/png;base64,${buf.toString('base64')}` : '';
  } catch {
    _logoDataUriCache = '';
  }
  return _logoDataUriCache;
};

module.exports = { getLogoPath, getLogoBuffer, getLogoDataUri };
