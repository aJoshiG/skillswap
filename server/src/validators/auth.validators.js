const { z } = require('./common');

const email = z.string().trim().toLowerCase().pipe(z.email('Enter a valid email'));

const register = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
  email,
  // bcrypt only uses the first 72 bytes of a password.
  password: z.string().min(8, 'Password must be at least 8 characters').max(72),
});

const login = z.object({
  email,
  password: z.string().min(1, 'Password is required'),
});

module.exports = { register, login };
