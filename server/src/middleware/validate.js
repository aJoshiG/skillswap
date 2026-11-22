const ApiError = require('../utils/ApiError');

/**
 * Validates request parts with zod schemas.
 * Parsed (coerced, defaulted) values are stored on req.valid.{body,query,params}
 * because Express 5 exposes req.query as a read-only getter.
 */
function validate(schemas) {
  return (req, _res, next) => {
    req.valid = req.valid || {};
    for (const part of ['body', 'query', 'params']) {
      if (!schemas[part]) continue;
      const result = schemas[part].safeParse(req[part] ?? {});
      if (!result.success) {
        const details = result.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        }));
        return next(ApiError.badRequest('Validation failed', details));
      }
      req.valid[part] = result.data;
    }
    next();
  };
}

module.exports = { validate };
