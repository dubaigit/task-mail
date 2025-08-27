const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  // Proxy for API routes
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://localhost:8000',
      changeOrigin: true,
      secure: false,
      logLevel: 'debug',
      onProxyReq: function(proxyReq, req, res) {
        // Proxying API request to: ${proxyReq.path}
      },
      onError: function(err, req, res) {
        // API Proxy error: ${err}
        res.status(500).send('API Proxy error');
      }
    })
  );

  // Proxy for direct endpoints (tasks, statistics, etc.)
  app.use(
    ['/tasks', '/statistics', '/sync-status', '/user'],
    createProxyMiddleware({
      target: 'http://localhost:8000',
      changeOrigin: true,
      secure: false,
      logLevel: 'debug',
      onProxyReq: function(proxyReq, req, res) {
        // Proxying direct request to: ${proxyReq.path}
      },
      onError: function(err, req, res) {
        // Direct Proxy error: ${err}
        res.status(500).send('Direct Proxy error');
      }
    })
  );
};