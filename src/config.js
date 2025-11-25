import crypto from 'crypto';

// Generate a stable key based on a seed or use random
const generateKey = () => {
  return crypto.randomBytes(32).toString('base64url');
};

export const config = {
  port: parseInt(process.env.PORT || '47700', 10),
  issuerUrl: process.env.ISSUER_URL || `http://localhost:47700`,

  // OIDC Client configuration
  clientId: process.env.CLIENT_ID || 'cloudflare-access',
  clientSecret: process.env.CLIENT_SECRET || '4Eg3LtsPpS6t7i4Eg3LtsPpS6t7i',
  redirectUri: process.env.REDIRECT_URI || 'https://placeholder.cloudflareaccess.com/cdn-cgi/access/callback',

  // Email format for approved users
  emailDomain: process.env.EMAIL_DOMAIN || 'access-granted.com',
  emailFormat: process.env.EMAIL_FORMAT || 'YYYYMMDDHHmmss', // Date format for email prefix

  // Bark notification
  barkUrlTemplate: process.env.BARK_URL_TEMPLATE || 'https://api.day.app/YOUR_KEY/AuthRequest/{body}?url={url}',

  // Admin credentials
  adminUser: process.env.ADMIN_USER || 'a',
  adminPass: process.env.ADMIN_PASS || 'aaa',
  adminSessionHours: parseInt(process.env.ADMIN_SESSION_HOURS || '2160', 10), // Default 3 months (90 days)

  // JWT secret for admin sessions (MUST be set in production for persistence)
  jwtSecret: process.env.JWT_SECRET || 'change-me-in-production-for-session-persistence',

  // Cookie settings
  cookieName: 'auth_request_id',
  cookieMaxAge: 24 * 60 * 60 * 1000, // 24 hours in ms

  // Database
  dbPath: process.env.DB_PATH || './data.db',

  // OIDC Provider cookie keys (should be stable in production)
  cookieKeys: [
    process.env.COOKIE_KEY_1 || generateKey(),
    process.env.COOKIE_KEY_2 || generateKey(),
  ],
};

export default config;
