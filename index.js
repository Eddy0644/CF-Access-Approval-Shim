import express from 'express';
import cookieParser from 'cookie-parser';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import Provider from 'oidc-provider';

import config from './src/config.js';
import { initDatabase } from './src/database.js';
import SqliteAdapter from './src/oidc-adapter.js';
import { RequestStore } from './src/store.js';
import { createInteractionRouter } from './src/interaction.js';
import { createAdminRouter } from './src/admin.js';
import logger from './src/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize database first
initDatabase();

// Generate JWKS keys for signing tokens
const generateJWKS = () => {
  const { privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
  });

  const jwk = privateKey.export({ format: 'jwk' });
  jwk.use = 'sig';
  jwk.alg = 'RS256';
  jwk.kid = crypto.randomBytes(16).toString('hex');

  return { keys: [jwk] };
};

const jwks = generateJWKS();

// OIDC Provider configuration
const oidcConfig = {
  // Use SQLite adapter for persistence
  adapter: SqliteAdapter,

  // Client configuration for Cloudflare Access
  clients: [
    {
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'client_secret_post',
      id_token_signed_response_alg: 'RS256',
      redirect_uris: [config.redirectUri],
    },
  ],

  // Allow any redirect URI (for Cloudflare Access dynamic team names)
  extraClientMetadata: {
    properties: ['redirect_uris'],
  },

  // Skip redirect URI validation for our client
  clientBasedCORS: () => true,

  // Cookie configuration
  cookies: {
    keys: config.cookieKeys,
    long: { signed: true, maxAge: 24 * 60 * 60 * 1000 }, // 1 day
    short: { signed: true },
  },

  // Enable proxy support (for cloudflared)
  proxy: true,

  // Claims configuration - what claims are available for each scope
  claims: {
    openid: ['sub'],
    email: ['email', 'email_verified'],
    profile: ['name', 'nickname', 'preferred_username'],
  },

  // Scopes supported
  scopes: ['openid', 'email', 'profile', 'offline_access'],

  // Features configuration
  features: {
    devInteractions: { enabled: false }, // We provide our own
    resourceIndicators: { enabled: false },
    revocation: { enabled: true },
    userinfo: { enabled: true }, // Enable userinfo endpoint
  },

  // IMPORTANT: Include claims directly in ID Token (not just via userinfo)
  // This is needed for Cloudflare Access to receive claims
  conformIdTokenClaims: false,

  // Allow dynamic redirect URIs for Cloudflare Access
  redirectUriAllowed: (redirectUri, client) => {
    // Allow any cloudflareaccess.com callback
    if (redirectUri.match(/^https:\/\/[^/]+\.cloudflareaccess\.com\/cdn-cgi\/access\/callback$/)) {
      return true;
    }
    // Also allow localhost for testing
    if (redirectUri.startsWith('http://localhost') || redirectUri.startsWith('http://127.0.0.1')) {
      return true;
    }
    return false;
  },

  // Interaction URL
  interactions: {
    url: (ctx, interaction) => `/interaction/${interaction.uid}`,
  },

  // Token TTL configuration
  ttl: {
    AccessToken: 60 * 60, // 1 hour
    AuthorizationCode: 10 * 60, // 10 minutes
    IdToken: 60 * 60, // 1 hour
    RefreshToken: 24 * 60 * 60, // 1 day
    Interaction: 60 * 60, // 1 hour
    Session: 24 * 60 * 60, // 1 day
    Grant: 24 * 60 * 60, // 1 day
  },

  // JWKS - generated keys for signing
  jwks,

  // Account/claims finding
  findAccount: async (ctx, id) => {
    // Look up the request to get approval time
    const request = RequestStore.get(id);
    const approvedAt = request?.approvedAt || Date.now();

    // Format date for email based on config format
    const formatDate = (ts, format) => {
      const d = new Date(ts);
      const pad = (n) => n.toString().padStart(2, '0');

      const replacements = {
        'YYYY': d.getFullYear(),
        'MM': pad(d.getMonth() + 1),
        'DD': pad(d.getDate()),
        'HH': pad(d.getHours()),
        'mm': pad(d.getMinutes()),
        'ss': pad(d.getSeconds()),
      };

      let result = format;
      for (const [key, value] of Object.entries(replacements)) {
        result = result.replace(key, value);
      }
      return result;
    };

    const emailPrefix = formatDate(approvedAt, config.emailFormat);
    const email = `${emailPrefix}@${config.emailDomain}`;
    const name = `Guest ${id.substring(0, 8)}`;

    return {
      accountId: id,
      // claims function receives: use (id_token/userinfo), scope, claims, rejected
      async claims(use, scope, claims, rejected) {
        logger.debug('Claims requested', { use, scope, claims: Object.keys(claims || {}) });

        // Return all claims - oidc-provider will filter based on scope
        return {
          sub: id,
          email: email,
          email_verified: true,
          name: name,
          nickname: name,
          preferred_username: emailPrefix,
          updated_at: Math.floor(approvedAt / 1000),
        };
      },
    };
  },

  // Extra params to accept from clients
  extraParams: ['login_hint', 'ui_locales'],

  // Render errors nicely
  renderError: async (ctx, out, error) => {
    ctx.type = 'html';
    ctx.body = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Error</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
    .error { background: #fee; border: 1px solid #fcc; padding: 20px; border-radius: 8px; }
    pre { background: #f5f5f5; padding: 10px; overflow: auto; }
  </style>
</head>
<body>
  <div class="error">
    <h1>Authentication Error</h1>
    <p>${out.error}: ${out.error_description || 'An error occurred'}</p>
  </div>
</body>
</html>`;
  },
};

// Create OIDC Provider
const oidc = new Provider(config.issuerUrl, oidcConfig);

// Handle proxy headers
oidc.proxy = true;

// Create Express app
const app = express();

// Trust proxy (for cloudflared)
app.set('trust proxy', true);

// View engine setup
app.set('view engine', 'ejs');
app.set('views', join(__dirname, 'views'));

// Middleware
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Mount interaction routes (before OIDC provider)
app.use(createInteractionRouter(oidc));

// Mount admin routes
app.use(createAdminRouter());

// Mount OIDC provider
app.use(oidc.callback());

// Error handler
app.use((err, req, res, next) => {
  logger.error('Express', err);
  res.status(500).render('error', {
    title: 'Error',
    message: err.message || 'Internal server error',
  });
});

// Start server
const server = app.listen(config.port, () => {
  logger.serverStart(config.port, config.issuerUrl);
  logger.info('OIDC Discovery', `${config.issuerUrl}/.well-known/openid-configuration`);
  logger.info('Admin Portal', `${config.issuerUrl}/admin`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('Shutting down...');
  server.close(() => {
    process.exit(0);
  });
});

// Periodic cleanup (every hour)
setInterval(() => {
  const cleaned = SqliteAdapter.cleanup();
  const requestsCleaned = RequestStore.cleanup(7);
  if (cleaned > 0 || requestsCleaned > 0) {
    logger.info('Cleanup', { oidcModels: cleaned, requests: requestsCleaned });
  }
}, 60 * 60 * 1000);

export default app;
