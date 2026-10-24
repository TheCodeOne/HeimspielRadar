#!/usr/bin/env node
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3333;
const DOCS_DIR = path.resolve(__dirname, '../docs/api');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.yaml': 'text/yaml; charset=utf-8',
  '.yml': 'text/yaml; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

const server = http.createServer((req, res) => {
  const urlPath = req.url ? req.url.split('?')[0] : '/';
  let safePath = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, '');

  if (safePath === '/' || safePath === '') {
    safePath = '/index.html';
  }

  const filePath = path.join(DOCS_DIR, safePath);

  if (!filePath.startsWith(DOCS_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');

    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end(`Not Found: ${urlPath}`);

      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache',
    });

    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🏀 DBB Interactive OpenAPI Documentation Viewer`);
  console.log(`📡 URL: http://localhost:${PORT}`);
  console.log(`📁 Serving: ${DOCS_DIR}`);
  console.log(`======================================================\n`);
});
