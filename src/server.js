const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const port = 3000;

// O servidor lê o arquivo que a CLI alimenta
const dbPath = path.join(process.cwd(), 'data', 'heroes.json');

app.get('/', (req, res) => {
    let heroes = [];
    if (fs.existsSync(dbPath)) {
        const fileContent = fs.readFileSync(dbPath, 'utf-8');
        heroes = fileContent ? JSON.parse(fileContent) : [];
    }

    // Dashboard HTML
    const html = `
    <!DOCTYPE html>
    <html lang="pt-br">
    <head>
        <meta charset="UTF-8">
        <title>SRE Hero Dashboard</title>
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #0f172a; color: #f8fafc; padding: 40px; }
            h1 { text-align: center; color: #38bdf8; text-transform: uppercase; letter-spacing: 2px; }
            .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 25px; margin-top: 30px; }
            .card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; overflow: hidden; transition: transform 0.2s; }
            .card:hover { transform: translateY(-5px); border-color: #38bdf8; }
            .hero-img { width: 100%; height: 320px; object-fit: cover; }
            .content { padding: 20px; }
            .name { font-size: 1.5rem; font-weight: bold; margin-bottom: 5px; color: #fff; }
            .real-name { color: #94a3b8; font-style: italic; margin-bottom: 15px; }
            .stats { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 0.9rem; }
            .stat-item { background: #0f172a; padding: 5px 10px; border-radius: 6px; border-left: 3px solid #38bdf8; }
        </style>
    </head>
    <body>
        <h1>🦸 SRE Hero Dashboard</h1>
        <p style="text-align:center">Visualizando dados persistidos via CLI no Docker</p>
        <div class="grid">
            ${heroes.map(h => `
                <div class="card">
                    <img src="${h.image.url}" class="hero-img">
                    <div class="content">
                        <div class="name">${h.name}</div>
                        <div class="real-name">${h.biography['full-name']}</div>
                        <div class="stats">
                            <div class="stat-item">🧠 Inteligência: ${h.powerstats.intelligence}</div>
                            <div class="stat-item">💪 Força: ${h.powerstats.strength}</div>
                            <div class="stat-item">⚡ Velocidade: ${h.powerstats.speed}</div>
                            <div class="stat-item">🛡️ Defesa: ${h.powerstats.durability}</div>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    </body>
    </html>
    `;
    res.send(html);
});

app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 Dashboard SRE rodando em http://localhost:${port}`);
});
