import config from './config.js';
import logger from './logger.js';

/**
 * Build notification body from template
 * Available variables:
 *   {id}       - Full request ID (UUID)
 *   {id_short} - Short request ID (first 8 chars)
 *   {ip}       - Client IP address
 *   {reason}   - Reason provided by user (or "No reason provided")
 *   {device}   - Device/User-Agent info (truncated to 50 chars)
 *   {time}     - Request submission time
 */
const buildNotificationBody = (request) => {
  const { id, clientIp, clientReason, deviceInfo, createdAt } = request;

  const variables = {
    '{id}': id,
    '{id_short}': id.substring(0, 8),
    '{ip}': clientIp || 'Unknown',
    '{reason}': clientReason || 'No reason provided',
    '{device}': (deviceInfo || 'Unknown').substring(0, 50),
    '{time}': new Date(createdAt || Date.now()).toLocaleString(),
  };

  // Use custom template if provided, otherwise use default
  if (config.barkBodyTemplate) {
    let body = config.barkBodyTemplate;
    for (const [key, value] of Object.entries(variables)) {
      body = body.split(key).join(value);
    }
    // Handle \n escape sequences
    body = body.replace(/\\n/g, '\n');
    return body;
  }

  // Default template
  return [
    `ID: ${variables['{id_short}']}...`,
    `IP: ${variables['{ip}']}`,
    clientReason ? `Reason: ${clientReason}` : 'No reason provided',
    `Device: ${variables['{device}']}...`,
  ].join('\n');
};

/**
 * Send notification via Bark
 * Supports customizable URL template with {body} and {url} placeholders
 */
export const sendBarkNotification = async (request) => {
  const { id } = request;

  // Build the notification body
  const body = buildNotificationBody(request);

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
