/**
 * Middleware to log API endpoint calls and responses
 * Logs:
 * 1. When an endpoint is called (method, path, timestamp)
 * 2. When an endpoint successfully returns a response (status code, timestamp)
 */

module.exports = (req, res, next) => {
  // Only log API routes, skip static files and other non-API routes
  if (!req.path.startsWith('/api')) {
    return next();
  }

  const timestamp = new Date().toISOString();
  const method = req.method;
  const path = req.path;
  
  // Log when endpoint is called
  console.log(`[${timestamp}] API CALL: ${method} ${path}`);

  // Listen for the 'finish' event which fires when the response is sent
  res.on('finish', () => {
    const responseTimestamp = new Date().toISOString();
    console.log(`[${responseTimestamp}] API RESPONSE: ${method} ${path} - Status: ${res.statusCode}`);
  });

  next();
};

