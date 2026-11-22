const mongoose = require('mongoose');
const ApiError = require('../utils/ApiError');
const env = require('../config/env');

function notFound(req, _res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

function toApiError(err) {
  if (err instanceof ApiError) return err;
  if (err instanceof mongoose.Error.CastError) return ApiError.badRequest(`Invalid ${err.path}`);
  if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
    return ApiError.badRequest('Validation failed', details);
  }
  if (err?.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'Field';
    return ApiError.conflict(`${field} already exists`);
  }
  if (err?.type === 'entity.parse.failed') return ApiError.badRequest('Malformed JSON body');

  if (!env.isTest) console.error(err);
  return new ApiError(500, 'Something went wrong', 'INTERNAL_ERROR');
}

// Express recognises error handlers by their 4-argument signature.
function errorHandler(err, _req, res, _next) {
  const error = toApiError(err);
  const body = { success: false, error: { code: error.code, message: error.message } };
  if (error.details) body.error.details = error.details;
  res.status(error.status).json(body);
}

module.exports = { notFound, errorHandler };
