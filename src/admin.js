import { Router } from 'express';
import jwt from 'jsonwebtoken';
import config from './config.js';
import logger from './logger.js';
import { RequestStore } from './store.js';

const ADMIN_COOKIE = 'admin_token';

/**
 * Helper to get client IP
 */
const getClientIp = (req) => {
  return req.headers['cf-connecting-ip'] ||
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.ip ||
    'unknown';
};

/**
 * JWT authentication middleware
 */
const requireAuth = (req, res, next) => {
  const token = req.cookies[ADMIN_COOKIE];

  if (!token) {
    // Store the original URL to redirect after login
    res.cookie('admin_redirect', req.originalUrl, {
      maxAge: 5 * 60 * 1000, // 5 minutes
      httpOnly: true,
    });
    return res.redirect('/admin/login');
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    req.admin = decoded;
    next();
  } catch (err) {
    res.clearCookie(ADMIN_COOKIE);
    res.cookie('admin_redirect', req.originalUrl, {
      maxAge: 5 * 60 * 1000,
      httpOnly: true,
    });
    return res.redirect('/admin/login');
  }
};

export const createAdminRouter = () => {
  const router = Router();

  // Calculate session duration from config
  const sessionMs = config.adminSessionHours * 60 * 60 * 1000;
  const jwtExpiry = `${config.adminSessionHours}h`;

  /**
   * Admin login page
   */
  router.get('/admin/login', (req, res) => {
    // Check if already logged in
    const token = req.cookies[ADMIN_COOKIE];
    if (token) {
      try {
        jwt.verify(token, config.jwtSecret);
        const redirect = req.cookies.admin_redirect || '/admin';
        res.clearCookie('admin_redirect');
        return res.redirect(redirect);
      } catch (err) {
        res.clearCookie(ADMIN_COOKIE);
      }
    }

    res.render('admin-login', {
      title: 'Admin Login',
      error: null,
    });
  });

  /**
   * Admin login handler
   */
  router.post('/admin/login', (req, res) => {
    const { username, password } = req.body;
    const clientIp = getClientIp(req);

    if (username === config.adminUser && password === config.adminPass) {
      logger.adminLogin(true, clientIp);

      const token = jwt.sign(
        { user: username, ip: clientIp },
        config.jwtSecret,
        { expiresIn: jwtExpiry }
      );

      res.cookie(ADMIN_COOKIE, token, {
        maxAge: sessionMs,
        httpOnly: true,
        secure: config.issuerUrl.startsWith('https'),
        sameSite: 'lax',
      });

      const redirect = req.cookies.admin_redirect || '/admin';
      res.clearCookie('admin_redirect');
      return res.redirect(redirect);
    }

    logger.adminLogin(false, clientIp);
    res.render('admin-login', {
      title: 'Admin Login',
      error: 'Invalid credentials',
    });
  });

  /**
   * Admin logout
   */
  router.get('/admin/logout', (req, res) => {
    res.clearCookie(ADMIN_COOKIE);
    res.redirect('/admin/login');
  });

  /**
   * Admin dashboard - list pending requests
   */
  router.get('/admin', requireAuth, (req, res) => {
    const pending = RequestStore.listPending();
    const recent = RequestStore.listRecent(20);

    res.render('admin-dashboard', {
      title: 'Admin Dashboard',
      pending,
      recent,
      admin: req.admin,
    });
  });

  /**
   * Review specific request
   */
  router.get('/admin/review/:requestId', requireAuth, (req, res) => {
    const { requestId } = req.params;
    const request = RequestStore.get(requestId);

    if (!request) {
      return res.status(404).render('admin-error', {
        title: 'Not Found',
        message: `Request ${requestId} not found`,
      });
    }

    res.render('admin-review', {
      title: 'Review Request',
      request,
      admin: req.admin,
      sessionDurations: config.sessionDurations,
      sessionDurationDefault: config.sessionDurationDefault,
    });
  });

  /**
   * Approve request
   */
  router.post('/admin/approve/:requestId', requireAuth, (req, res) => {
    const { requestId } = req.params;
    const { duration } = req.body;
    const request = RequestStore.get(requestId);

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ error: `Request already ${request.status}` });
    }

    // Use provided duration or default
    const sessionDuration = duration || config.sessionDurationDefault;
    const success = RequestStore.approve(requestId, sessionDuration);

    if (success) {
      logger.adminAction(requestId, `APPROVED (duration: ${sessionDuration})`, req.admin.user);
    }

    // Check if this is an API call or form submission
    if (req.headers.accept?.includes('application/json')) {
      return res.json({ success, status: 'approved', sessionDuration });
    }

    return res.redirect('/admin');
  });

  /**
   * Reject request
   */
  router.post('/admin/reject/:requestId', requireAuth, (req, res) => {
    const { requestId } = req.params;
    const { reason } = req.body;
    const request = RequestStore.get(requestId);

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ error: `Request already ${request.status}` });
    }

    const success = RequestStore.reject(requestId, reason || '');

    if (success) {
      logger.adminAction(requestId, 'REJECTED', req.admin.user);
    }

    if (req.headers.accept?.includes('application/json')) {
      return res.json({ success, status: 'rejected' });
    }

    return res.redirect('/admin');
  });

  /**
   * API: Get request status (for AJAX polling)
   */
  router.get('/api/request/:requestId/status', (req, res) => {
    const { requestId } = req.params;
    const request = RequestStore.get(requestId);

    if (!request) {
      return res.status(404).json({ error: 'Not found' });
    }

    res.json({
      id: request.id,
      status: request.status,
      rejectReason: request.rejectReason,
    });
  });

  /**
   * Update admin note for a request
   */
  router.post('/admin/note/:requestId', requireAuth, (req, res) => {
    const { requestId } = req.params;
    const { note } = req.body;
    const request = RequestStore.get(requestId);

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const success = RequestStore.updateNote(requestId, note || '');

    if (success) {
      logger.adminAction(requestId, 'NOTE_UPDATED', req.admin.user);
    }

    if (req.headers.accept?.includes('application/json')) {
      return res.json({ success });
    }

    return res.redirect(`/admin/review/${requestId}`);
  });

  return router;
};

export default createAdminRouter;
