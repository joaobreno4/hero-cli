// src/cli/interface.js
const readline = require('readline');
const { getHeroByName, saveToLocalDb } = require('../services/api');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Cores para manter o padrão visual no terminal
const ui = {
    cyan: '\x1b[36m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    bold: '\x1b[1m',
    reset: '\x1b[0m'
};

let heroisEncontrados = [];

const iniciarCLI = () => {
    // UX: O prompt muda conforme o contexto da busca
    const prompt = heroisEncontrados.length > 0 
        ? `${ui.yellow}${ui.bold}# Selecione o número (ou digite "nova" para reiniciar):${ui.reset} ` 
        : `${ui.cyan}${ui.bold}> Nome do herói:${ui.reset} `;

    rl.question(prompt, async (input) => {
        const query = input.trim().toLowerCase();

        if (query === 'sair') {
            console.log(`${ui.red}Encerrando operação...${ui.reset}`);
            process.exit(0);
        }

        if (query === 'nova') {
            heroisEncontrados = [];
            console.clear();
            console.log(`${ui.cyan}=== Nova Busca Iniciada ===${ui.reset}`);
            iniciarCLI();
            return;
        }

        // LÓGICA DE SELEÇÃO (UX: Mais intuitiva)
        if (heroisEncontrados.length > 0 && !isNaN(query)) {
            const index = parseInt(query) - 1;
            
            if (index >= 0 && index < heroisEncontrados.length) {
                const selecionado = heroisEncontrados[index];
                
                console.log(`\n${ui.green}${ui.bold}[SRE] Confirmado: ${selecionado.name}${ui.reset}`);
                
                // UX: Tratamento de valores nulos antes da persistência
                if (selecionado.powerstats.intelligence === "null") selecionado.powerstats.intelligence = "??";
                if (selecionado.powerstats.strength === "null") selecionado.powerstats.strength = "??";

                await saveToLocalDb(selecionado);
                
                console.log(`${ui.green}✔ Dados sincronizados com sucesso!${ui.reset}`);
                heroisEncontrados = []; // Limpa para a próxima busca
            } else {
                console.log(`${ui.red}Número inválido! Escolha entre 1 e ${heroisEncontrados.length}${ui.reset}`);
            }
            iniciarCLI();
            return;
        }

        // LÓGICA DE BUSCA
        console.log(`${ui.yellow}Consultando API externa...${ui.reset}`);
        const result = await getHeroByName(input);

        if (result.error) {
            console.log(`${ui.red}Erro: ${result.message}${ui.reset}`);
            heroisEncontrados = [];
        } else {
            heroisEncontrados = result.data;
            console.log(`\n${ui.bold}Resultados para "${input}":${ui.reset}`);
            
            heroisEncontrados.forEach((h, i) => {
                const publisher = h.biography.publisher || 'Desconhecida';
                const alterEgo = h.biography.fullName ? ` (${h.biography.fullName})` : '';
                console.log(`${ui.cyan}${i + 1}.${ui.reset} ${ui.bold}${h.name}${alterEgo}${ui.reset} | ${publisher}`);
            });
        }

        iniciarCLI();
    });
};

module.exports = { iniciarCLI };
