const jwt = require('jsonwebtoken');

// ────────────────────────────────────────────────────────────────────────────
// Standard JWT auth middleware suite
//
//   authenticate   – requires a valid JWT. Reads `Authorization: Bearer <t>`,
//                    falling back to the `token` cookie the login flow writes.
//                    Attaches decoded payload to req.user ({ userId, email, role }).
//   optionalAuth   – decodes the token when present, never blocks the request.
//   requireAdmin   – must run AFTER authenticate; allows only ADMIN role.
//
// Responses always use: { success: false, message, reason }
// 401 = not authenticated (missing/expired/invalid token)
// 403 = authenticated but not allowed (role)
//
// The cookie fallback exists because this app authenticates with a JS-readable
// cookie: if anything strips the Authorization header in transit (proxy, CDN,
// extension, or a request made without the axios interceptor) the header is the
// only place the token can be lost, and the header alone was returning
// "Access denied" for users who were demonstrably logged in. The cookie is not
// httpOnly, so this grants no privilege a browser script did not already have.
// ────────────────────────────────────────────────────────────────────────────

const TOKEN_COOKIE = 'token';

/** Minimal Cookie-header parser — avoids taking a dependency for 6 lines. */
const readCookie = (req, name) => {
  const header = req.headers?.cookie;
  if (!header) return null;

  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() !== name) continue;

    const raw = part.slice(eq + 1).trim();
    try {
      return decodeURIComponent(raw) || null;
    } catch {
      return raw || null;
    }
  }
  return null;
};

const extractToken = (req) => {
  const header = req.headers?.authorization || '';
  if (header.startsWith('Bearer ')) {
    const token = header.slice(7).trim();
    if (token) return token;
  }
  // Header absent (or malformed) — fall back to the cookie the client set.
  return readCookie(req, TOKEN_COOKIE);
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
  const {decoded, error} = decodeToken(req);

  if (error) {
    const copy = {
      NO_TOKEN: ['Access denied. Please login to continue.', 'NO_TOKEN'],
      TOKEN_EXPIRED: ['Session expired. Please login again.', 'TOKEN_EXPIRED'],
      INVALID_TOKEN: ['Invalid or malformed token. Please login again.', 'INVALID_TOKEN']
    }[error] || ['Access denied. Please login to continue.', error];

    return res.status(401).json({success: false, message: copy[0], reason: copy[1]});
  }

  req.user = decoded;
  req.userInfo = decoded; // backward compatibility with legacy code
  next();
};

const optionalAuth = (req, _res, next) => {
  const {decoded} = decodeToken(req);
  if (decoded) {
    req.user = decoded;
    req.userInfo = decoded;
  }
  next();
};

const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. Please login to continue.',
      reason: 'NO_TOKEN'
    });
  }
  if (String(req.user.role || '').toUpperCase() !== 'ADMIN') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admins only.',
      reason: 'FORBIDDEN_ROLE'
    });
  }
  next();
};

/**
 * GET /api/auth/me — reports whether the browser's session is actually valid.
 *
 * The client used to decide "logged in" purely from the presence of the `token`
 * cookie and never re-checked it, so an expired or half-written cookie rendered
 * a fully working-looking dashboard whose every API call 401'd. This endpoint
 * gives the client ground truth, and `reason` lets it say *why* it failed.
 */
const describeSession = (req, res) => {
  const {decoded, error} = decodeToken(req);

  if (error) {
    const reason = error || 'NO_TOKEN';
    return res.status(401).json({
      success: false,
      loggedIn: false,
      reason,
      message: 'Your session is no longer valid. Please login again.'
    });
  }

  const role = String(decoded.role || 'USER').toUpperCase();
  return res.json({
    success: true,
    loggedIn: true,
    user: {userId: decoded.userId, email: decoded.email || null, role},
    isAdmin: role === 'ADMIN',
    // Frontend can pre-empt a needless request once the JWT is within 60s of expiry.
    expiresAt: decoded.exp ? decoded.exp * 1000 : null
  });
};

// Legacy alias — some older code may import this name
exports.ensureAuthenticated = authenticate;
exports.authenticate = authenticate;
exports.optionalAuth = optionalAuth;
exports.requireAdmin = requireAdmin;
exports.describeSession = describeSession;
module.exports = exports;
