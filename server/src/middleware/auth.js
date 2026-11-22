const ApiError = require('../utils/ApiError');
const { verifyAccessToken } = require('../utils/tokens');

function requireAuth(req, _res, next) {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) return next(ApiError.unauthorized());

  try {
    req.userId = verifyAccessToken(token).sub;
    next();
  } catch {
    next(new ApiError(401, 'Access token is invalid or expired', 'TOKEN_EXPIRED'));
  }
}

module.exports = { requireAuth };
