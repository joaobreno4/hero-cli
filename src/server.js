// 1. Inicialização do Tracer (Capturando o objeto para uso manual)
const tracer = require('dd-trace').init({ 
    service: 'marvel-dashboard',
    env: 'production',
    logInjection: true 
});

const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const port = 3001; 

const dbPath = path.join(process.cwd(), 'data', 'marvel_heroes.json');

app.get('/', (req, res) => {
    // Iniciamos um "span" manual para monitorar o tempo de leitura do banco
    const span = tracer.startSpan('web.request.read_db');
    let heroes = [];
    
    try {
        if (fs.existsSync(dbPath)) {
            const stats = fs.statSync(dbPath);
            if (stats.size > 0) {
                const fileContent = fs.readFileSync(dbPath, 'utf-8');
                heroes = JSON.parse(fileContent);
            }
        }
        span.finish(); // Finaliza o span com sucesso
    } catch (err) {
        // PROTEÇÃO ATIVA: Se der erro, avisamos o Datadog com detalhes
        span.setTag('error', true);
        span.setTag('resource.name', 'json_parse_error');
        span.log({
            event: 'error',
            'error.kind': err.name,
            'error.object': err,
            message: err.message,
            stack: err.stack
        });
        
        console.error(`[SRE ERROR] Falha crítica no banco: ${err.message}`);
        span.finish();
        heroes = []; // Mantém o app vivo
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
            .hero-img { width: 100%; height: 280px; object-fit: cover; }
            .content { padding: 15px; }
        </style>
    </head>
    <body>
        <h1>Marvel SRE Dashboard</h1>
        <div class="grid">
            ${heroes.length > 0 ? heroes.reverse().map(h => `
                <div class="card">
                    <img src="${h.thumbnail}" class="hero-img" referrerpolicy="no-referrer" onerror="this.src='https://via.placeholder.com/400?text=Marvel+Hero'">
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
    console.log(`🚀 [DATADOG ACTIVE] Dashboard Marvel na porta ${port}`);
});
