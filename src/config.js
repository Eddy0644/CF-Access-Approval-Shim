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
  // {duration} placeholder in emailDomain will be replaced with session duration
  emailDomain: process.env.EMAIL_DOMAIN || '{duration}.access-granted.com',
  emailFormat: process.env.EMAIL_FORMAT || 'YYYYMMDDHHmmss', // Date format for email prefix

  // Session duration options (for admin to select during approval)
  sessionDurations: (process.env.SESSION_DURATIONS || '30m,1h,12h,1d,7d,30d,long').split(',').map(s => s.trim()),
  sessionDurationDefault: process.env.SESSION_DURATION_DEFAULT || '1d',

  // Bark notification
  barkUrlTemplate: process.env.BARK_URL_TEMPLATE || 'https://api.day.app/YOUR_KEY/AuthRequest/{body}?url={url}',
  // Bark body template with available variables: {id}, {id_short}, {ip}, {reason}, {device}, {time}
  barkBodyTemplate: process.env.BARK_BODY_TEMPLATE || null, // null means use default

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
