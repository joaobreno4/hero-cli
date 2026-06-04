const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { SUPERHERO_TOKEN } = require('../config/env');

const DB_PATH = path.join(process.cwd(), 'data', 'marvel_heroes.json');
const IMAGES_DIR = path.join(process.cwd(), 'data', 'images');

// ─── normalização de editora ───────────────────────────────────────────────

const KNOWN_PUBLISHERS = new Set([
    'Marvel Comics', 'DC Comics', 'Dark Horse Comics', 'Image Comics',
    'IDW Publishing', 'Valiant Comics', 'Wildstorm', 'Vertigo',
    'Boom! Studios', 'Archie Comics', 'Icon Comics',
]);

const MARVEL_SIGNALS = [
    'marvel', 'thor', 'hulk', 'avenger', 'x-men', 'spider', 'stark',
    'shield', 's.h.i.e.l.d', 'asgard', 'fantastic four', 'iron man',
];

const DC_SIGNALS = [
    'dc', 'superman', 'batman', 'justice league', 'gotham', 'metropolis',
    'green lantern', 'wonder woman', 'flash', 'aquaman',
];

const normalizePublisher = (raw) => {
    if (!raw) return 'Desconhecida';

    // Remove espaços extras e caracteres de controle
    const cleaned = raw.replace(/\s+/g, ' ').trim();

    // Editora já reconhecida — retorna sem alteração
    if (KNOWN_PUBLISHERS.has(cleaned)) return cleaned;

    const lower = cleaned.toLowerCase();

    if (MARVEL_SIGNALS.some(s => lower.includes(s))) return 'Marvel Comics';
    if (DC_SIGNALS.some(s => lower.includes(s))) return 'DC Comics';

    // Mantém o valor limpo original para editoras desconhecidas
    return cleaned;
};

// ─── download de imagem ───────────────────────────────────────────────────

const downloadImage = async (hero) => {
    const localFile = path.join(IMAGES_DIR, `${hero.id}.jpg`);
    if (fs.existsSync(localFile)) return `/images/${hero.id}.jpg`;

    try {
        fs.mkdirSync(IMAGES_DIR, { recursive: true });
        const response = await axios.get(hero.thumbnail, {
            responseType: 'stream',
            timeout: 8000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
        });
        await new Promise((resolve, reject) => {
            const writer = fs.createWriteStream(localFile);
            response.data.pipe(writer);
            writer.on('finish', resolve);
            writer.on('error', reject);
        });
        return `/images/${hero.id}.jpg`;
    } catch (err) {
        console.warn(`[SRE WARN] Download de imagem falhou para ${hero.name}: ${err.message}`);
        return null;
    }
};

// ─── helpers de escrita ────────────────────────────────────────────────────

const writeToJson = async (hero) => {
    let heroes = [];
    if (fs.existsSync(DB_PATH) && fs.statSync(DB_PATH).size > 0) {
        heroes = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
    }
    // Upsert: atualiza entrada existente ou insere nova (comportamento idêntico ao MERGE do Neo4j)
    const idx = heroes.findIndex(h => h.id === hero.id);
    if (idx === -1) {
        heroes.push(hero);
    } else {
        heroes[idx] = hero;
    }
    fs.writeFileSync(DB_PATH, JSON.stringify(heroes, null, 2));
};

const writeToNeo4j = async (hero) => {
    const driver = require('../config/neo4j');
    const session = driver.session();
    const publisher = hero.biography.publisher || 'Desconhecida';

    try {
        await session.executeWrite(async (tx) => {
            // Herói + nó Publisher + relacionamento BELONGS_TO
            await tx.run(
                `MERGE (h:Hero {id: $id})
                 SET h.name = $name, h.publisher = $publisher, h.thumbnail = $thumbnail
                 MERGE (p:Publisher {name: $publisher})
                 MERGE (h)-[:BELONGS_TO]->(p)`,
                { id: hero.id, name: hero.name, publisher, thumbnail: hero.thumbnail }
            );

            // Nós :Team + relacionamento MEMBER_OF (best-effort, dados opcionais)
            const affiliation = hero.connections?.groupAffiliation || '';
            if (affiliation && affiliation !== '-') {
                const teams = affiliation
                    .split(',')
                    .map(t => t.trim())
                    .filter(t => t.length > 0 && t !== '-');

                for (const team of teams) {
                    await tx.run(
                        `MATCH (h:Hero {id: $heroId})
                         MERGE (t:Team {name: $teamName})
                         MERGE (h)-[:MEMBER_OF]->(t)`,
                        { heroId: hero.id, teamName: team }
                    );
                }
            }
        });
    } finally {
        await session.close();
    }
};

// ─── API pública ───────────────────────────────────────────────────────────

const getHeroByName = async (name) => {
    const tracer = require('dd-trace');
    const span = tracer.startSpan('superhero.api.search');
    span.setTag('hero.query', name);

    try {
        const url = `https://superheroapi.com/api/${SUPERHERO_TOKEN}/search/${name}`;
        const response = await axios.get(url);

        if (response.data.response === 'error') {
            span.finish();
            return { error: true, message: `Nenhum herói encontrado para: "${name}"` };
        }

        const data = response.data.results.map(hero => {
            const publisher = normalizePublisher(hero.biography.publisher);
            return {
                id: hero.id,
                name: hero.name,
                description: `Editora: ${publisher} | Identidade: ${hero.biography['full-name'] || 'Secreta'}`,
                thumbnail: hero.image.url,
                powerstats: {
                    intelligence: hero.powerstats.intelligence,
                    strength: hero.powerstats.strength,
                    speed: hero.powerstats.speed,
                },
                biography: {
                    publisher,
                },
                connections: {
                    groupAffiliation: hero.connections?.['group-affiliation'] || '',
                },
            };
        });

        span.setTag('hero.results_count', data.length);
        span.finish();
        return { error: false, data };

    } catch (error) {
        span.setTag('error', true);
        span.log({ event: 'error', message: error.message, stack: error.stack });
        span.finish();
        return { error: true, message: error.message };
    }
};

const saveToLocalDb = async (hero) => {
    const tracer = require('dd-trace');
    const span = tracer.startSpan('db.write');
    span.setTag('hero.id', hero.id);
    span.setTag('hero.name', hero.name);

    try {
        // Tenta baixar a imagem localmente; se falhar, mantém a URL original
        const localThumb = await downloadImage(hero);
        const heroToSave = localThumb ? { ...hero, thumbnail: localThumb } : hero;

        // Escrita paralela: JSON (primário) + Neo4j (secundário)
        const [jsonResult, neo4jResult] = await Promise.allSettled([
            writeToJson(heroToSave),
            writeToNeo4j(heroToSave),
        ]);

        // JSON é obrigatório — propaga o erro se falhar
        if (jsonResult.status === 'rejected') {
            throw jsonResult.reason;
        }

        // Neo4j é best-effort — loga mas não derruba o fluxo
        if (neo4jResult.status === 'rejected') {
            console.warn(`[SRE WARN] Neo4j indisponível: ${neo4jResult.reason.message}`);
            span.setTag('neo4j.skipped', true);
        }

        span.finish();
    } catch (error) {
        span.setTag('error', true);
        span.log({ event: 'error', message: error.message, stack: error.stack });
        span.finish();
        throw error;
    }
};

module.exports = { getHeroByName, saveToLocalDb };
