# CF-Access-Approval-Shim

A custom OIDC Identity Provider for Cloudflare Access with async human approval workflow via Bark notifications.

## Features

- **Async Approval Flow**: Visitors can close their browser after submitting a request; admins can approve hours later
- **Session Recovery**: Visitors return anytime to check status and complete login automatically when approved
- **Bark Notifications**: Instant push notifications to admin's device with one-tap review
- **SQLite Persistence**: All data survives server restarts
- **Simple Admin Portal**: JWT-authenticated dashboard for managing requests

## How It Works

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Visitor   │────▶│  IdP Server  │────▶│    Admin    │
│             │     │              │     │   (Bark)    │
│  1. Submit  │     │  2. Store &  │     │ 3. Review & │
│   Request   │     │    Notify    │     │   Approve   │
│             │     │              │     │             │
│  4. Return  │◀────│  5. Auto     │     │             │
│  & Login    │     │    Login     │     │             │
└─────────────┘     └──────────────┘     └─────────────┘
```

## Quick Start

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your settings

# Start server
npm start
```

## Configuration

Key environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `47700` |
| `ISSUER_URL` | Public URL of this IdP | Required |
| `CLIENT_SECRET` | OIDC client secret | Required |
| `REDIRECT_URI` | Cloudflare callback URL | Required |
| `BARK_URL_TEMPLATE` | Bark notification URL with `{body}` and `{url}` placeholders | Required |
| `ADMIN_USER` / `ADMIN_PASS` | Admin credentials | `a` / `aaa` |
| `JWT_SECRET` | Secret for admin sessions (required for persistence) | Auto-generated |
| `EMAIL_FORMAT` | Date format for generated emails | `YYYYMMDDHHmmss` |

See [.env.example](.env.example) for full configuration options.

## Project Structure

```
├── index.js                 # Main entry, OIDC Provider setup
├── package.json
├── .env.example             # Environment template
├── CLOUDFLARE_SETUP.md      # Cloudflare configuration guide
│
├── src/
│   ├── config.js            # Configuration loader
│   ├── database.js          # SQLite initialization
│   ├── oidc-adapter.js      # OIDC Provider SQLite adapter
│   ├── store.js             # Request store (pending/approved/rejected)
│   ├── interaction.js       # OIDC interaction routes (visitor flow)
│   ├── admin.js             # Admin portal routes (JWT auth)
│   ├── bark.js              # Bark notification sender
│   └── logger.js            # Structured logging
│
└── views/
    ├── apply.ejs            # Request submission page
    ├── waiting.ejs          # Pending status page
    ├── rejected.ejs         # Rejection notice page
    ├── admin-login.ejs      # Admin login
    ├── admin-dashboard.ejs  # Request management
    ├── admin-review.ejs     # Single request review
    └── error.ejs            # Error pages
```

## Cloudflare Access Setup

See [CLOUDFLARE_SETUP.md](CLOUDFLARE_SETUP.md) for detailed integration instructions.

## API Endpoints

### Public
- `GET /.well-known/openid-configuration` - OIDC discovery
- `GET /health` - Health check
- `GET /api/request/:id/status` - Check request status (for polling)

### Admin (JWT Protected)
- `GET /admin` - Dashboard
- `GET /admin/review/:id` - Review request
- `POST /admin/approve/:id` - Approve request
- `POST /admin/reject/:id` - Reject request

## Requirements

- Node.js >= 20.0.0
- SQLite3 (via better-sqlite3)

## License

MIT
