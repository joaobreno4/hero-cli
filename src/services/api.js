// src/services/api.js
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { baseUrl } = require('../config/env');

// SRE Tip: process.cwd() garante que o Docker encontre a pasta /app/data corretamente
const dbPath = path.join(process.cwd(), 'data', 'heroes.json');

const api = axios.create({
    baseURL: baseUrl
});

/**
 * Persistência e Normalização: Limpa e salva os dados no volume compartilhado
 */
const saveToLocalDb = (hero) => {
    try {
        // --- ETAPA DE NORMALIZAÇÃO (Data Cleaning) ---
        let publisher = hero.biography.publisher || "";

        // Regra para Marvel: Se contiver Thor ou Spider (casos comuns de erro na API)
        if (publisher.includes('Thor') || publisher.includes('Spider')) {
            hero.biography.publisher = "Marvel Comics";
            console.log(`\n\x1b[33m[DATA CLEANING]\x1b[0m Editora "${publisher}" normalizada para: Marvel Comics`);
        } 
        // Regra para DC: Padroniza variantes como "Batman II" ou apenas "DC"
        else if (publisher.includes('Batman') || publisher === 'DC') {
            hero.biography.publisher = "DC Comics";
            console.log(`\n\x1b[33m[DATA CLEANING]\x1b[0m Editora "${publisher}" normalizada para: DC Comics`);
        }

        // --- ETAPA DE PERSISTÊNCIA ---
        // 1. Garante que o diretório data existe
        const dir = path.dirname(dbPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        // 2. Lê o estado atual do banco JSON
        let heroes = [];
        if (fs.existsSync(dbPath)) {
            const fileContent = fs.readFileSync(dbPath, 'utf-8');
            heroes = (fileContent && fileContent.trim() !== "") ? JSON.parse(fileContent) : [];
        }

        // 3. Verifica duplicidade pelo ID antes de salvar
        const alreadyExists = heroes.find(h => h.id === hero.id);
        
        if (!alreadyExists) {
            heroes.push(hero);
            // Escrita síncrona para garantir integridade no sistema de arquivos do Docker
            fs.writeFileSync(dbPath, JSON.stringify(heroes, null, 2), 'utf-8');
            console.log(`\n\x1b[32m[SRE LOG]\x1b[0m Hero "${hero.name}" persistido com sucesso.`);
        }
    } catch (err) {
        console.error("\x1b[31m[ERROR]\x1b[0m Falha na persistência/normalização:", err.message);
    }
};

/**
 * Busca na SuperHero API por nome
 */
const getHeroByName = async (name) => {
    try {
        const encodedName = encodeURIComponent(name.trim());
        const response = await api.get(`/search/${encodedName}`);
        
        if (response.data.response === 'error') {
            return { 
                error: true, 
                message: "Herói não encontrado na base externa." 
            };
        }

        return { 
            error: false, 
            data: response.data.results 
        };
    } catch (err) {
        return { 
            error: true, 
            message: `Erro de conexão: ${err.message}` 
        };
    }
};

module.exports = { getHeroByName, saveToLocalDb };
