const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { SUPERHERO_TOKEN } = require('../config/env');

const DB_PATH = path.join(process.cwd(), 'data', 'marvel_heroes.json');

// ─── helpers de escrita ────────────────────────────────────────────────────

const writeToJson = async (hero) => {
    let heroes = [];
    if (fs.existsSync(DB_PATH) && fs.statSync(DB_PATH).size > 0) {
        heroes = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
    }
    if (!heroes.some(h => h.id === hero.id)) {
        heroes.push(hero);
        fs.writeFileSync(DB_PATH, JSON.stringify(heroes, null, 2));
    }
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

        const data = response.data.results.map(hero => ({
            id: hero.id,
            name: hero.name,
            description: `Editora: ${hero.biography.publisher || 'Desconhecida'} | Identidade: ${hero.biography['full-name'] || 'Secreta'}`,
            thumbnail: hero.image.url,
            powerstats: {
                intelligence: hero.powerstats.intelligence,
                strength: hero.powerstats.strength,
                speed: hero.powerstats.speed,
            },
            biography: {
                publisher: hero.biography.publisher,
            },
            connections: {
                groupAffiliation: hero.connections?.['group-affiliation'] || '',
            },
        }));

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
        // Escrita paralela: JSON (primário) + Neo4j (secundário)
        const [jsonResult, neo4jResult] = await Promise.allSettled([
            writeToJson(hero),
            writeToNeo4j(hero),
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
