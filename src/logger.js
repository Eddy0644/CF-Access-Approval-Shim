/**
 * Structured logging utility with timestamps
 */

const formatTimestamp = () => {
  return new Date().toISOString();
};

const formatMessage = (tag, message, data = null) => {
  const timestamp = formatTimestamp();
  let output = `[${timestamp}] [${tag}] ${message}`;
  if (data) {
    if (typeof data === 'object') {
      output += ` | ${JSON.stringify(data)}`;
    } else {
      output += ` | ${data}`;
    }
  }
  return output;
};

export const logger = {
  newRequest: (ip, reason, id) => {
    console.log(formatMessage('NEW_REQ', `IP: ${ip}, Reason: "${reason || '(none)'}", ID: ${id}`));
  },

  barkSent: (url) => {
    console.log(formatMessage('BARK_SENT', `To: ${url}`));
  },

  barkError: (error) => {
    console.error(formatMessage('BARK_ERROR', `Failed to send notification`, error.message));
  },

  adminAction: (requestId, action, admin = 'admin') => {
    console.log(formatMessage('ADMIN_ACTION', `Request ${requestId} ${action} by ${admin}`));
  },

  loginSuccess: (requestId) => {
    console.log(formatMessage('LOGIN_SUCCESS', `Request ${requestId} session restored and logged in`));
  },

  requestCancelled: (requestId, ip) => {
    console.log(formatMessage('REQ_CANCELLED', `Request ${requestId} cancelled by user from IP: ${ip}`));
  },

  interactionStart: (uid, ip) => {
    console.log(formatMessage('INTERACTION', `Started interaction ${uid} from IP: ${ip}`));
  },

  adminLogin: (success, ip) => {
    const status = success ? 'SUCCESS' : 'FAILED';
    console.log(formatMessage('ADMIN_LOGIN', `Login ${status} from IP: ${ip}`));
  },

  dbInit: () => {
    console.log(formatMessage('DB', 'Database initialized'));
  },

  serverStart: (port, issuer) => {
    console.log(formatMessage('SERVER', `Started on port ${port}, Issuer: ${issuer}`));
  },

  error: (context, error) => {
    const errorInfo = error instanceof Error
      ? { message: error.message, stack: error.stack }
      : error;
    console.error(formatMessage('ERROR', context, errorInfo));
  },

  warn: (message, data = null) => {
    console.warn(formatMessage('WARN', message, data));
  },

  info: (message, data = null) => {
    console.log(formatMessage('INFO', message, data));
  },

  debug: (message, data = null) => {
    if (process.env.DEBUG) {
      console.log(formatMessage('DEBUG', message, data));
    }
  },

  db: (operation, params = null) => {
    if (process.env.DEBUG) {
      console.log(formatMessage('DB_OP', operation, params));
    }
  },
};

export default logger;
