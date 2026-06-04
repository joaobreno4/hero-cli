const tracer = require('dd-trace').init({
    service: 'marvel-dashboard',
    env: 'production',
    logInjection: true
});

const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;
const dbPath = path.join(process.cwd(), 'data', 'marvel_heroes.json');

app.use('/images', express.static(path.join(__dirname, '..', 'data', 'images')));

// ─── Cache de imagens em memória ──────────────────────────────────────────
// Evita latência e erros de Mixed Content ao referenciar URLs externas
const imageCache = new Map();
const MAX_CACHE_ENTRIES = 200;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

app.get('/api/proxy-image', async (req, res) => {
    const { url } = req.query;

    if (!url || !/^https?:\/\//i.test(url)) {
        return res.status(400).send('URL inválida');
    }

    const span = tracer.startSpan('image.proxy.fetch');
    span.setTag('image.url', url);

    const cached = imageCache.get(url);
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
        span.setTag('cache.hit', true);
        span.finish();
        res.setHeader('Content-Type', cached.contentType);
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.setHeader('X-Cache', 'HIT');
        return res.send(cached.buffer);
    }

    try {
        const response = await axios.get(url, {
            responseType: 'arraybuffer',
            timeout: 3000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
        });
        const buffer = Buffer.from(response.data);
        const contentType = response.headers['content-type'] || 'image/jpeg';

        // Evicção FIFO simples para manter o cap de memória
        if (imageCache.size >= MAX_CACHE_ENTRIES) {
            imageCache.delete(imageCache.keys().next().value);
        }
        imageCache.set(url, { buffer, contentType, cachedAt: Date.now() });

        span.setTag('cache.hit', false);
        span.finish();
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.setHeader('X-Cache', 'MISS');
        res.send(buffer);
    } catch (error) {
        span.setTag('error', true);
        span.log({ event: 'error', message: error.message });
        span.finish();
        res.redirect('https://via.placeholder.com/400x400?text=Hero');
    }
});

// ─── Dashboard ────────────────────────────────────────────────────────────

app.get('/', (req, res) => {
    const span = tracer.startSpan('web.request.read_db');
    let heroes = [];

    try {
        if (fs.existsSync(dbPath)) {
            const stats = fs.statSync(dbPath);
            if (stats.size > 0) {
                heroes = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
            }
        }
        span.finish();
    } catch (err) {
        span.setTag('error', true);
        span.setTag('resource.name', 'json_parse_error');
        span.log({ event: 'error', 'error.kind': err.name, message: err.message, stack: err.stack });
        console.error(`[SRE ERROR] Falha crítica no banco: ${err.message}`);
        span.finish();
        heroes = [];
    }

    const html = `
    <!DOCTYPE html>
    <html lang="pt-br">
    <head>
        <meta charset="UTF-8">
        <title>Marvel SRE Dashboard</title>
        <style>
            body { font-family: 'Segoe UI', sans-serif; background: #121212; color: #fff; padding: 40px; margin: 0; }
            h1 { text-align: center; color: #ed1d24; text-transform: uppercase; letter-spacing: 2px; }
            .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; max-width: 1200px; margin: 0 auto; }
            .card { background: #1e1e1e; border-radius: 8px; border-bottom: 4px solid #ed1d24; overflow: hidden; }
            .hero-avatar { width: 100%; height: 280px; background: #222; display: flex; align-items: center; justify-content: center; position: relative; overflow: hidden; }
            .hero-avatar img { width: 100%; height: 100%; object-fit: cover; position: absolute; top: 0; left: 0; }
            .hero-avatar svg { width: 80px; height: 80px; opacity: 0.15; }
            .content { padding: 15px; }
        </style>
    </head>
    <body>
        <h1>Marvel SRE Dashboard</h1>
        <div class="grid">
            ${heroes.length > 0 ? heroes.reverse().map(h => `
                <div class="card">
                    <div class="hero-avatar">
                        <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M12 2a5 5 0 1 0 0 10A5 5 0 0 0 12 2z"/>
                            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
                        </svg>
                        ${h.thumbnail ? `<img src="${h.thumbnail}" alt="${h.name}" onerror="this.remove()">` : ''}
                    </div>
                    <div class="content">
                        <strong style="color:#ed1d24">${h.name}</strong>
                        <p style="font-size: 0.8rem; color:#aaa">${h.description || 'Ficha técnica confidencial.'}</p>
                    </div>
                </div>
            `).join('') : '<p style="text-align:center; width:100%; color:#666">Nenhum herói detectado pelos sensores.</p>'}
        </div>
    </body>
    </html>`;
    res.send(html);
});

app.get('/health', (req, res) => res.status(200).send('OK'));

app.listen(port, '0.0.0.0', () => {
    console.log(`[DATADOG ACTIVE] Dashboard Marvel na porta ${port}`);
});
