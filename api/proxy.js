/**
 * Vercel Serverless Function: /api/proxy
 * Universal image proxy — bypasses CORS for any panorama URL.
 * Usage: /api/proxy?url=https://example.com/image.jpg
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

module.exports = function handler(req, res) {
    // Allow preflight
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const { url } = req.query;

    if (!url) {
        res.status(400).send('Missing ?url= parameter');
        return;
    }

    let parsedUrl;
    try {
        parsedUrl = new URL(url);
    } catch {
        res.status(400).send('Invalid URL');
        return;
    }

    // Security: only http/https
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        res.status(403).send('Only http/https URLs are allowed');
        return;
    }

    const client = parsedUrl.protocol === 'https:' ? https : http;

    const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'image/*,*/*;q=0.8',
            'Accept-Encoding': 'identity',
            'Referer': parsedUrl.origin,
        }
    };

    const proxyReq = client.request(options, (proxyRes) => {
        res.setHeader('Content-Type', proxyRes.headers['content-type'] || 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.status(proxyRes.statusCode || 200);
        proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
        console.error('[proxy] Error:', err.message);
        if (!res.headersSent) {
            res.status(502).send('Proxy error: ' + err.message);
        }
    });

    proxyReq.setTimeout(15000, () => {
        proxyReq.destroy();
        if (!res.headersSent) {
            res.status(504).send('Proxy timeout');
        }
    });

    proxyReq.end();
};
