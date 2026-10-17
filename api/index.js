const { handleRequest } = require('../server.js');

module.exports = async (req, res) => {
  try {
    // In Vercel serverless environment, handle rewrite path restoration safely.
    // If req.url is the destination function path (/api/index, /api/index.js, or /),
    // retrieve the original requested URI from Vercel's edge forwarding headers.
    if (!req.url || req.url === '/' || req.url.startsWith('/api/index')) {
      const originalUri = req.headers['x-forwarded-uri'] || 
                          req.headers['x-real-url'] || 
                          (req.headers['x-matched-path'] && !req.headers['x-matched-path'].includes('index') ? req.headers['x-matched-path'] : null);
      if (originalUri && originalUri.startsWith('/api')) {
        req.url = originalUri;
      }
    }
    await handleRequest(req, res);
  } catch (err) {
    console.error('Serverless API Error:', err);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal Server Error', message: err.message }));
    }
  }
};
