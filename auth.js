const jwt = require('jsonwebtoken');

// ────────────────────────────────────────────────────────────────────────────
// Standard JWT auth middleware suite
//
//   authenticate   – requires a valid `Authorization: Bearer <token>` header.
//                    Attaches decoded payload to req.user ({ userId, email, role }).
//   optionalAuth   – decodes the token when present, never blocks the request.
//   requireAdmin   – must run AFTER authenticate; allows only ADMIN role.
//
// Responses always use: { success: false, message }
// 401 = not authenticated (missing/expired/invalid token)
// 403 = authenticated but not allowed (role)
// ────────────────────────────────────────────────────────────────────────────

const extractToken = (req) => {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  return token || null;
};

const decodeToken = (req) => {
  const token = extractToken(req);
  if (!token) return { error: 'NO_TOKEN' };
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded || !decoded.userId) return { error: 'INVALID_TOKEN' };
    return { decoded };
  } catch (err) {
    return {
      error: err?.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN'
    };
  }
};

const authenticate = (req, res, next) => {
  const { decoded, error } = decodeToken(req);

  if (error === 'NO_TOKEN') {
    return res.status(401).json({ success: false, message: 'Access denied. Please login to continue.' });
  }
  if (error === 'TOKEN_EXPIRED') {
    return res.status(401).json({ success: false, message: 'Session expired. Please login again.' });
  }
  if (error) {
    return res.status(401).json({ success: false, message: 'Invalid or malformed token. Please login again.' });
  }

  req.user = decoded;
  req.userInfo = decoded; // backward compatibility with legacy code
  next();
};

const optionalAuth = (req, _res, next) => {
  const { decoded } = decodeToken(req);
  if (decoded) {
    req.user = decoded;
    req.userInfo = decoded;
  }
  next();
};

const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Access denied. Please login to continue.' });
  }
  if (String(req.user.role || '').toUpperCase() !== 'ADMIN') {
    return res.status(403).json({ success: false, message: 'Access denied. Admins only.' });
  }
  next();
};

// Legacy alias — some older code may import this name
exports.ensureAuthenticated = authenticate;
exports.authenticate = authenticate;
exports.optionalAuth = optionalAuth;
exports.requireAdmin = requireAdmin;
module.exports = exports;
