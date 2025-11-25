import config from './config.js';
import logger from './logger.js';

/**
 * Send notification via Bark
 * Supports customizable URL template with {body} and {url} placeholders
 */
export const sendBarkNotification = async (request) => {
  const { id, clientIp, clientReason, deviceInfo } = request;

  // Build the notification body
  const body = [
    `ID: ${id.substring(0, 8)}...`,
    `IP: ${clientIp}`,
    clientReason ? `Reason: ${clientReason}` : 'No reason provided',
    `Device: ${(deviceInfo || 'Unknown').substring(0, 50)}...`,
  ].join('\\n');

  // Build the admin review URL
  const reviewUrl = `${config.issuerUrl}/admin/review/${id}`;

  // Replace placeholders in the template
  let barkUrl = config.barkUrlTemplate
    .replace('{body}', encodeURIComponent(body))
    .replace('{url}', encodeURIComponent(reviewUrl));

  try {
    const response = await fetch(barkUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'CF-Access-Approval-Shim/1.0',
      },
    });

    if (!response.ok) {
      throw new Error(`Bark responded with status: ${response.status}`);
    }

    logger.barkSent(barkUrl.substring(0, 80) + '...');
    return true;
  } catch (error) {
    logger.barkError(error);
    return false;
  }
};

export default { sendBarkNotification };
