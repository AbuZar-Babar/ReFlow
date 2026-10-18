#!/usr/bin/env node
/**
 * Tiny static server for the ReFlow test portal.
 *
 * Serves this directory on 127.0.0.1 only. PDFs are sent with
 * `Content-Disposition: attachment`, so Chrome downloads them
 * (which is what the ReFlow worker collects as run artifacts).
 *
 * Usage:  node tools/test-portal/server.js [port]   (default 8090)
 */
"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const HOST = "127.0.0.1";
const PORT = Number(process.argv[2] || process.env.PORT || 8090);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".txt": "text/plain; charset=utf-8",
};

const server = http.createServer((req, res) => {
  let pathname = "/";
  try {
    pathname = decodeURIComponent(new URL(req.url, `http://${HOST}`).pathname);
  } catch {
    res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" }).end("bad request");
    return;
  }
  if (pathname === "/") pathname = "/index.html";

  const filePath = path.normalize(path.join(ROOT, pathname));
  if (!filePath.startsWith(ROOT + path.sep)) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" }).end("forbidden");
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("not found");
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const headers = { "Content-Type": MIME[ext] || "application/octet-stream" };
    if (ext === ".pdf") headers["Content-Disposition"] = `attachment; filename="${path.basename(filePath)}"`;
    if (ext === ".html") headers["Cache-Control"] = "no-store";
    res.writeHead(200, headers).end(data);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`ReFlow test portal running at http://${HOST}:${PORT}/`);
  console.log("Press Ctrl+C to stop.");
});
