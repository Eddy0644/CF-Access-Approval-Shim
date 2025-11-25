import { Router } from 'express';
import config from './config.js';
import logger from './logger.js';
import { RequestStore } from './store.js';
import { sendBarkNotification } from './bark.js';

export const createInteractionRouter = (oidc) => {
  const router = Router();

  /**
   * Helper to get client IP (handles proxy)
   */
  const getClientIp = (req) => {
    return req.headers['cf-connecting-ip'] ||
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.ip ||
      'unknown';
  };

  /**
   * Format date for email generation
   */
  const formatDateForEmail = (timestamp) => {
    const date = new Date(timestamp);
    const pad = (n) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
      `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  };

  /**
   * Main interaction endpoint
   */
  router.get('/interaction/:uid', async (req, res, next) => {
    try {
      const { uid } = req.params;
      const clientIp = getClientIp(req);

      logger.interactionStart(uid, clientIp);

      // Get the OIDC interaction details
      const interactionDetails = await oidc.interactionDetails(req, res);
      const { prompt, params, session } = interactionDetails;

      logger.debug('Interaction prompt', { name: prompt.name, details: prompt.details });

      // Handle consent prompt - auto-approve for our flow
      if (prompt.name === 'consent') {
        const grant = interactionDetails.grantId
          ? await oidc.Grant.find(interactionDetails.grantId)
          : new oidc.Grant({
              accountId: session.accountId,
              clientId: params.client_id,
            });

        if (prompt.details.missingOIDCScope) {
          grant.addOIDCScope(prompt.details.missingOIDCScope.join(' '));
        }
        if (prompt.details.missingOIDCClaims) {
          grant.addOIDCClaims(prompt.details.missingOIDCClaims);
        }
        if (prompt.details.missingResourceScopes) {
          for (const [indicator, scopes] of Object.entries(prompt.details.missingResourceScopes)) {
            grant.addResourceScope(indicator, scopes.join(' '));
          }
        }

        const grantId = await grant.save();

        logger.info('Consent auto-granted', { grantId, accountId: session.accountId });

        return await oidc.interactionFinished(req, res, {
          consent: { grantId },
        }, { mergeWithLastSubmission: true });
      }

      // For login prompt, check our approval flow
      // Check for existing request ID in cookie
      const requestId = req.cookies[config.cookieName];
      const existingRequest = requestId ? RequestStore.get(requestId) : null;

      // Scenario A: No cookie or cookie invalid - show apply page
      if (!existingRequest) {
        return res.render('apply', {
          uid,
          clientIp,
          title: 'Request Access',
        });
      }

      // Scenario B: Has cookie & status is Pending - show waiting page
      if (existingRequest.status === 'pending') {
        return res.render('waiting', {
          uid,
          request: existingRequest,
          title: 'Awaiting Approval',
        });
      }

      // Scenario C: Has cookie & status is Approved - auto login!
      if (existingRequest.status === 'approved') {
        logger.loginSuccess(requestId);

        // Clear the auth request cookie after successful login
        res.clearCookie(config.cookieName);

        // Complete the OIDC login interaction
        const result = {
          login: {
            accountId: requestId,
            remember: true,
          },
        };

        return await oidc.interactionFinished(req, res, result, {
          mergeWithLastSubmission: false,
        });
      }

      // Scenario D: Has cookie & status is Rejected - show rejected page
      if (existingRequest.status === 'rejected') {
        return res.render('rejected', {
          uid,
          request: existingRequest,
          title: 'Access Denied',
        });
      }

      // Fallback - shouldn't reach here
      res.clearCookie(config.cookieName);
      return res.redirect(`/interaction/${uid}`);

    } catch (err) {
      logger.error('Interaction GET', err);
      return next(err);
    }
  });

  /**
   * Submit new access request
   */
  router.post('/interaction/:uid/apply', async (req, res, next) => {
    try {
      const { uid } = req.params;
      const { reason } = req.body;
      const clientIp = getClientIp(req);
      const deviceInfo = req.headers['user-agent'] || 'Unknown';

      // Create new request
      const request = RequestStore.create({
        clientReason: reason,
        clientIp,
        deviceInfo,
      });

      logger.newRequest(clientIp, reason, request.id);

      // Set cookie for session tracking
      res.cookie(config.cookieName, request.id, {
        maxAge: config.cookieMaxAge,
        httpOnly: true,
        secure: config.issuerUrl.startsWith('https'),
        sameSite: 'lax',
      });

      // Send Bark notification
      await sendBarkNotification(request);

      // Redirect to waiting page
      return res.redirect(`/interaction/${uid}`);

    } catch (err) {
      logger.error('Apply POST', err);
      return next(err);
    }
  });

  /**
   * Cancel/withdraw request and reapply
   */
  router.post('/interaction/:uid/cancel', async (req, res, next) => {
    try {
      const { uid } = req.params;
      const requestId = req.cookies[config.cookieName];
      const clientIp = getClientIp(req);

      if (requestId) {
        RequestStore.delete(requestId);
        logger.requestCancelled(requestId, clientIp);
      }

      // Clear cookie
      res.clearCookie(config.cookieName);

      // Redirect back to apply page
      return res.redirect(`/interaction/${uid}`);

    } catch (err) {
      logger.error('Cancel POST', err);
      return next(err);
    }
  });

  /**
   * Refresh/check status (just redirects to main interaction)
   */
  router.post('/interaction/:uid/refresh', async (req, res) => {
    const { uid } = req.params;
    return res.redirect(`/interaction/${uid}`);
  });

  return router;
};

export default createInteractionRouter;
