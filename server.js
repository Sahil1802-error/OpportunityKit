/**
 * server.js - OpportunityKit Backend Server & Static File Host.
 * 
 * Provides REST API and static frontend serving with Node's standard library.
 * Fully compatible with Node 22+ and zero external network dependencies.
 * 
 * Configurable via environment variables:
 * - PORT: default 3000
 * - DB_PATH: default ./opportunitykit.db
 * - MAX_UPLOAD_MB: default 5
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const db = require('./db.js');
const resume = require('./resume.js');

const PORT = parseInt(process.env.PORT || '3000', 10);
const MAX_UPLOAD_BYTES = (parseInt(process.env.MAX_UPLOAD_MB || '10', 10)) * 1024 * 1024;
const MAX_JSON_BYTES = 1 * 1024 * 1024; // 1MB for JSON payloads

// Initialize DB schema on startup
db.initDb();

// MIME type map for static files
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

// Security headers applied to all responses per OWASP standards
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), camera=(), microphone=()',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https:; connect-src 'self';",
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
};

// Strict whitelist of public static frontend files to prevent sensitive file leaks
const PUBLIC_STATIC_FILES = new Set([
  '/',
  '/index.html',
  '/app.js',
  '/extract.js',
  '/compare.js',
  '/score.js',
  '/effort.js',
  '/samples.js',
  '/favicon.ico'
]);

// Sliding window rate limiter to protect against DoS attacks
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 300;
const ipRequestCounts = new Map();

function checkRateLimit(ip) {
  if (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost') {
    return true; // Local test runner exemption
  }
  const now = Date.now();
  const record = ipRequestCounts.get(ip) || { count: 0, resetTime: now + RATE_LIMIT_WINDOW_MS };
  if (now > record.resetTime) {
    record.count = 1;
    record.resetTime = now + RATE_LIMIT_WINDOW_MS;
  } else {
    record.count++;
  }
  ipRequestCounts.set(ip, record);
  return record.count <= MAX_REQUESTS_PER_WINDOW;
}

/**
 * Sends a safe JSON response with security headers.
 */
function sendJson(res, statusCode, data) {
  const json = JSON.stringify(data);
  res.writeHead(statusCode, Object.assign({}, SECURITY_HEADERS, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(json),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-file-name, *'
  }));
  res.end(json);
}

/**
 * Sends a safe JSON error response (never exposes stack traces).
 */
function sendError(res, statusCode, message, details = null) {
  sendJson(res, statusCode, {
    error: message,
    details: details || undefined,
    status: statusCode
  });
}

/**
 * Parses raw request body with byte size limit.
 */
function parseRequestBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let received = 0;

    req.on('data', chunk => {
      received += chunk.length;
      if (received > maxBytes) {
        reject(new Error(`Payload exceeds maximum size limit of ${maxBytes} bytes.`));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      resolve(Buffer.concat(chunks));
    });

    req.on('error', err => {
      reject(err);
    });
  });
}

/**
 * Validates a profile payload against constraints.
 */
function validateProfile(data) {
  const errors = [];
  if (!data || typeof data !== 'object') {
    return ["Invalid profile payload; expected a JSON object."];
  }

  // Name length bounds check
  if (data.name !== undefined && data.name !== null && typeof data.name === 'string') {
    if (data.name.length > 120) {
      errors.push("Name cannot exceed 120 characters.");
    }
  }

  // Degree & Branch length bounds check
  if (data.degree !== undefined && data.degree !== null && typeof data.degree === 'string') {
    if (data.degree.length > 100) {
      errors.push("Degree cannot exceed 100 characters.");
    }
  }

  if (data.branch !== undefined && data.branch !== null && typeof data.branch === 'string') {
    if (data.branch.length > 100) {
      errors.push("Branch cannot exceed 100 characters.");
    }
  }

  // CGPA validation: 0–10
  if (data.cgpa !== undefined && data.cgpa !== null && data.cgpa !== '') {
    const num = Number(data.cgpa);
    if (isNaN(num) || num < 0 || num > 10) {
      errors.push("CGPA must be a valid number between 0 and 10.");
    }
  }

  // Year validation: 1–8 if supplied
  if (data.year !== undefined && data.year !== null && data.year !== '') {
    const num = Number(data.year);
    if (isNaN(num) || num < 1 || num > 8) {
      errors.push("Year of study must be a number between 1 and 8.");
    }
  }

  // Availability validation
  if (data.availabilityWeeks !== undefined && data.availabilityWeeks !== null && data.availabilityWeeks !== '') {
    const num = Number(data.availabilityWeeks);
    if (isNaN(num) || num < 0 || num > 52) {
      errors.push("Availability must be between 0 and 52 weeks.");
    }
  }

  // Skills validation: array of bounded strings
  if (data.skills !== undefined && data.skills !== null) {
    if (!Array.isArray(data.skills)) {
      errors.push("Skills must be an array of strings.");
    } else if (data.skills.length > 100) {
      errors.push("Skills list cannot exceed 100 items.");
    } else {
      for (const s of data.skills) {
        if (typeof s !== 'string' || s.length > 80) {
          errors.push("Each skill must be a string up to 80 characters.");
          break;
        }
      }
    }
  }

  // Links validation: URLs must use http:// or https:// if provided (blocks javascript: and data: schemes)
  if (data.links && typeof data.links === 'object') {
    const urlPattern = /^https?:\/\//i;
    for (const [key, url] of Object.entries(data.links)) {
      if (url && typeof url === 'string' && url.trim().length > 0) {
        if (!urlPattern.test(url.trim())) {
          errors.push(`Invalid URL for ${key}. URL must begin with http:// or https://.`);
        }
      }
    }
  }

  // Notes length bounds check
  if (data.notes !== undefined && data.notes !== null && typeof data.notes === 'string') {
    if (data.notes.length > 5000) {
      errors.push("Notes cannot exceed 5000 characters.");
    }
  }

  return errors;
}

/**
 * Serves static frontend files safely with strict whitelisting and path traversal defense.
 */
function serveStaticFile(req, res, pathname) {
  let decodedPath = '';
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch (e) {
    return sendError(res, 400, "Bad Request: Malformed URI sequence.");
  }

  // Normalize path using POSIX style
  const normalized = path.posix.normalize(decodedPath);

  // 1. Block directory traversal attempts
  if (normalized.includes('..') || normalized.includes('\\') || decodedPath.includes('..') || decodedPath.includes('\\')) {
    return sendError(res, 403, "Access denied: Path traversal is forbidden.");
  }

  // 2. Strict whitelist check: Only allow explicitly public frontend assets
  let publicTarget = normalized;
  if (publicTarget === '/') publicTarget = '/index.html';

  if (!PUBLIC_STATIC_FILES.has(publicTarget)) {
    // Blocks internal/backend files (.db, .env, server.js, tests, etc.)
    return sendError(res, 403, "Access denied.");
  }

  const publicDirTarget = path.join(__dirname, 'public', publicTarget);
  const filePath = fs.existsSync(publicDirTarget) ? publicDirTarget : path.join(__dirname, publicTarget);

  // 3. Verification that resolved path is inside __dirname
  const normalizedBase = path.resolve(__dirname);
  const resolvedPath = path.resolve(filePath);
  if (!resolvedPath.startsWith(normalizedBase + path.sep) && resolvedPath !== normalizedBase) {
    return sendError(res, 403, "Access denied.");
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      return sendError(res, 404, `File not found: ${pathname}`);
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, fileBuffer) => {
      if (readErr) {
        return sendError(res, 500, "Error reading static file.");
      }

      res.writeHead(200, Object.assign({}, SECURITY_HEADERS, {
        'Content-Type': contentType,
        'Content-Length': fileBuffer.length,
        'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600'
      }));
      res.end(fileBuffer);
    });
  });
}

/**
 * Main HTTP request dispatcher.
 */
async function handleRequest(req, res) {
  const clientIp = req.socket?.remoteAddress || req.headers['x-forwarded-for'] || '127.0.0.1';
  if (!checkRateLimit(clientIp)) {
    return sendError(res, 429, "Too many requests. Please slow down.");
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;
  const method = req.method.toUpperCase();

  // CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, Object.assign({}, SECURITY_HEADERS, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-file-name, *',
      'Access-Control-Max-Age': '86400'
    }));
    return res.end();
  }

  try {
    // --- REST API ROUTES ---

    // GET /api/health or /api
    if (method === 'GET' && (pathname === '/api/health' || pathname === '/api' || pathname === '/api/index.js')) {
      return sendJson(res, 200, {
        status: "ok",
        uptime: process.uptime(),
        database: "sqlite",
        timestamp: new Date().toISOString(),
        version: "1.0.0"
      });
    }

    // GET /api/profile
    if (method === 'GET' && pathname === '/api/profile') {
      const profile = db.getProfile('demo_user');
      if (!profile) {
        return sendJson(res, 200, {
          profile: null,
          message: "No saved profile found. Complete and save your profile to persist it."
        });
      }
      return sendJson(res, 200, { profile });
    }

    // PUT /api/profile
    if (method === 'PUT' && pathname === '/api/profile') {
      const bodyBuffer = await parseRequestBody(req, MAX_JSON_BYTES);
      let payload;
      try {
        payload = JSON.parse(bodyBuffer.toString('utf-8'));
      } catch (e) {
        return sendError(res, 400, "Malformed JSON request body.");
      }

      const validationErrors = validateProfile(payload);
      if (validationErrors.length > 0) {
        return sendError(res, 422, "Validation failed", validationErrors);
      }

      const updated = db.saveProfile(payload, 'demo_user');
      return sendJson(res, 200, {
        status: "success",
        message: "Profile saved successfully to SQLite database.",
        profile: updated
      });
    }

    // DELETE /api/profile
    if (method === 'DELETE' && pathname === '/api/profile') {
      db.deleteProfile('demo_user');
      return sendJson(res, 200, {
        status: "deleted",
        message: "Profile and all associated personal data have been completely deleted."
      });
    }

    // GET /api/checks
    if (method === 'GET' && pathname === '/api/checks') {
      const checks = db.getChecks(20);
      return sendJson(res, 200, { checks });
    }

    // POST /api/checks
    if (method === 'POST' && pathname === '/api/checks') {
      const bodyBuffer = await parseRequestBody(req, MAX_JSON_BYTES);
      let payload;
      try {
        payload = JSON.parse(bodyBuffer.toString('utf-8'));
      } catch (e) {
        return sendError(res, 400, "Malformed JSON request body.");
      }

      const saved = db.saveCheck(payload);
      return sendJson(res, 201, { status: "saved", check: saved });
    }

    // POST /api/resume/extract
    if (method === 'POST' && pathname === '/api/resume/extract') {
      const bodyBuffer = await parseRequestBody(req, MAX_UPLOAD_BYTES);
      const contentType = req.headers['content-type'] || '';
      let fileBuffer = bodyBuffer;
      let fileName = req.headers['x-file-name'] || '';
      let fileContentType = contentType;

      // If multipart form data, parse out file boundary
      if (contentType.includes('multipart/form-data')) {
        const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
        if (boundaryMatch) {
          const boundary = (boundaryMatch[1] || boundaryMatch[2]).trim();
          const parts = parseMultipartBuffer(bodyBuffer, boundary);
          const filePart = parts.find(p => p.filename || (p.data && p.data.length > 0));
          if (filePart) {
            fileBuffer = filePart.data;
            if (filePart.filename) fileName = filePart.filename;
            if (filePart.contentType) fileContentType = filePart.contentType;
          }
        }
      }

      if (!fileBuffer || fileBuffer.length === 0) {
        return sendError(res, 400, "No resume file data received.");
      }

      const result = await resume.processResumeBuffer(fileBuffer, fileName, fileContentType);
      if (!result.success) {
        return sendError(res, 422, result.error || "Failed to parse resume.");
      }

      return sendJson(res, 200, {
        status: "success",
        message: "Resume extracted in-memory. File discarded with zero disk retention.",
        ...result
      });
    }

    // POST /api/opportunity/extract-file or /api/opportunity/extract-pdf
    if (method === 'POST' && (pathname === '/api/opportunity/extract-file' || pathname === '/api/opportunity/extract-pdf')) {
      const bodyBuffer = await parseRequestBody(req, MAX_UPLOAD_BYTES);
      const contentType = req.headers['content-type'] || '';
      let fileBuffer = bodyBuffer;
      let fileName = req.headers['x-file-name'] || '';
      let fileContentType = contentType;

      // If multipart form data, parse out file boundary
      if (contentType.includes('multipart/form-data')) {
        const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
        if (boundaryMatch) {
          const boundary = (boundaryMatch[1] || boundaryMatch[2]).trim();
          const parts = parseMultipartBuffer(bodyBuffer, boundary);
          const filePart = parts.find(p => p.filename || (p.data && p.data.length > 0));
          if (filePart) {
            fileBuffer = filePart.data;
            if (filePart.filename) fileName = filePart.filename;
            if (filePart.contentType) fileContentType = filePart.contentType;
          }
        }
      }

      if (!fileBuffer || fileBuffer.length === 0) {
        return sendError(res, 400, "No opportunity file data received.");
      }

      const result = await resume.extractTextFromFileBuffer(fileBuffer, fileName, fileContentType);
      if (!result.success) {
        return sendError(res, 422, result.error || "Failed to extract text from opportunity document.");
      }

      return sendJson(res, 200, {
        status: "success",
        message: "Opportunity document text extracted in-memory. File discarded with zero disk retention.",
        text: result.text,
        textLength: result.textLength,
        fileName: fileName
      });
    }

    // --- STATIC FILES ---
    if (method === 'GET') {
      return serveStaticFile(req, res, pathname);
    }

    // Method not allowed
    return sendError(res, 405, `Method ${method} not allowed for ${pathname}`);

  } catch (err) {
    console.error('Server error:', err.message);
    return sendError(res, 500, "Internal server error occurred.");
  }
}

/**
 * Minimal multipart/form-data buffer parser for in-memory uploads without disk writes.
 */
function parseMultipartBuffer(buffer, boundary) {
  const parts = [];
  const boundaryMarker = Buffer.from(`--${boundary}`);
  let startIndex = 0;

  while ((startIndex = buffer.indexOf(boundaryMarker, startIndex)) !== -1) {
    startIndex += boundaryMarker.length;
    // Check for trailing -- (end marker)
    if (buffer[startIndex] === 0x2d && buffer[startIndex + 1] === 0x2d) break;

    // Skip \r\n or \n
    if (buffer[startIndex] === 0x0d && buffer[startIndex + 1] === 0x0a) startIndex += 2;
    else if (buffer[startIndex] === 0x0a || buffer[startIndex] === 0x0d) startIndex += 1;

    const headersEnd = buffer.indexOf(Buffer.from('\r\n\r\n'), startIndex);
    if (headersEnd === -1) break;

    const headerText = buffer.subarray(startIndex, headersEnd).toString('utf-8');
    const dataStart = headersEnd + 4;
    const nextBoundary = buffer.indexOf(boundaryMarker, dataStart);
    if (nextBoundary === -1) break;

    let dataEnd = nextBoundary;
    if (dataEnd >= 2 && buffer[dataEnd - 2] === 0x0d && buffer[dataEnd - 1] === 0x0a) {
      dataEnd -= 2;
    } else if (dataEnd >= 1 && (buffer[dataEnd - 1] === 0x0a || buffer[dataEnd - 1] === 0x0d)) {
      dataEnd -= 1;
    }

    const data = buffer.subarray(dataStart, dataEnd);

    let filename = '';
    const fnMatch = headerText.match(/filename="([^"]+)"/i);
    if (fnMatch) filename = fnMatch[1];

    let partContentType = '';
    const ctMatch = headerText.match(/content-type:\s*([^\r\n;]+)/i);
    if (ctMatch) partContentType = ctMatch[1].trim();

    parts.push({ headers: headerText, filename, contentType: partContentType, data });
    startIndex = nextBoundary;
  }

  return parts;
}

const server = http.createServer(handleRequest);

server.on('error', (err) => {
  console.error('Server error event:', err.message);
});

server.on('clientError', (err, socket) => {
  if (err.code === 'ECONNRESET' || !socket.writable) {
    return;
  }
  socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err.message);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

// Start listening if run directly
if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`OpportunityKit server listening at http://localhost:${PORT}`);
    console.log(`Persistent SQLite profile store active at ${process.env.DB_PATH || path.join(__dirname, 'opportunitykit.db')}`);
  });
}

module.exports = { server, handleRequest, PORT };
