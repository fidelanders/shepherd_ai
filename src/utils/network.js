'use strict';

const https = require('https');

/**
 * Checks real internet connectivity by making a lightweight HEAD request
 * to a known reliable endpoint. DNS lookup alone can succeed even when
 * the target service (OpenAI) is unreachable.
 */
function hasInternet(timeout = 3000) {
  return new Promise(resolve => {
    const req = https.request(
      { hostname: 'api.openai.com', method: 'HEAD', path: '/', port: 443 },
      () => resolve(true)
    );
    req.on('error', () => resolve(false));
    req.setTimeout(timeout, () => { req.destroy(); resolve(false); });
    req.end();
  });
}

module.exports = { hasInternet };
