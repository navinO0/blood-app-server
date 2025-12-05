const logger = require('../utils/logger');

const loggerMiddleware = (req, res, next) => {
  const { method, url, headers, body } = req;
  const startTime = Date.now();
  
  // Build cURL command for the request
  let curl = `curl -X ${method} "${req.protocol}://${req.get('host')}${url}"`;

  // Add headers
  Object.keys(headers).forEach(key => {
    if (key !== 'content-length') { // Skip content-length as it's calculated automatically
      curl += ` -H "${key}: ${headers[key]}"`;
    }
  });

  // Add body
  if (body && Object.keys(body).length > 0) {
    curl += ` -d '${JSON.stringify(body)}'`;
  }

  // Store original methods
  const originalSend = res.send;
  const originalJson = res.json;
  
  // Intercept response to log errors
  const logResponse = (responseBody) => {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;
    
    // Only log error responses (4xx and 5xx)
    if (statusCode >= 400) {
      logger.error(`Error Response [${statusCode}] - ${method} ${url} - ${duration}ms\n` +
        `Request (cURL):\n${curl}\n` +
        `Response Body:\n${JSON.stringify(responseBody, null, 2)}`
      );
    }
  };

  // Override res.send
  res.send = function(data) {
    logResponse(data);
    return originalSend.call(this, data);
  };

  // Override res.json
  res.json = function(data) {
    logResponse(data);
    return originalJson.call(this, data);
  };

  // Log incoming request (info level)
  logger.info(`${method} ${url}`);
  
  next();
};

module.exports = loggerMiddleware;
