#!/usr/bin/env node

const { getHeroByName, saveToLocalDb } = require('./services/api');
const readline = require('readline');

// Configuração de cores para o terminal do Ubuntu
const colors = {
    reset: "\x1b[0m",
    bright: "\x1b[1m",
    cyan: "\x1b[36m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    red: "\x1b[31m",
    magenta: "\x1b[35m",
    blue: "\x1b[34m"
};

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Formata os atributos com cores (Verde para valores, Vermelho para N/A)
const formatStat = (label, value) => {
    const isInvalid = !value || value === "null" || value === "0";
    const displayValue = isInvalid ? `${colors.red}N/A${colors.reset}` : `${colors.green}${value}${colors.reset}`;
    return `${colors.bright}${label}:${colors.reset} ${displayValue}`;
};

// Função para desenhar a ficha do herói na tela
const exibirHeroi = (h) => {
      saveToLocalDb(h);
    console.log(`\n${colors.cyan}===================================================`);
    console.log(`${colors.bright}   FICHA TÉCNICA: ${h.name.toUpperCase()}${colors.reset}`);
    console.log(`${colors.cyan}===================================================${colors.reset}`);
    
    console.log(`${colors.bright}🆔 Nome Real:${colors.reset} ${h.biography['full-name'] || 'Não informado'}`);
    console.log(`${colors.bright}🌍 Editora:${colors.reset} ${h.biography.publisher}`);
    console.log(`${colors.bright}📍 Local de Nascimento:${colors.reset} ${h.biography['place-of-birth']}`);
    
    console.log(`\n${colors.yellow}--- POWERSTATS ---${colors.reset}`);
    console.log(formatStat("🧠 Inteligência", h.powerstats.intelligence));
    console.log(formatStat("💪 Força       ", h.powerstats.strength));
    console.log(formatStat("⚡ Velocidade  ", h.powerstats.speed));
    console.log(formatStat("🛡️  Durabilidade", h.powerstats.durability));
    console.log(formatStat("🔥 Poder       ", h.powerstats.power));
    console.log(formatStat("⚔️  Combate     ", h.powerstats.combat));
    
    console.log(`${colors.cyan}---------------------------------------------------${colors.reset}`);
    console.log(`${colors.bright}🖼️  IMAGEM:${colors.reset} ${colors.blue}${h.image.url}${colors.reset}\n`);
};

const iniciarCLI = () => {
    rl.question(`${colors.bright}🦸 Digite o nome do Herói (ou 'sair'): ${colors.reset}`, async (nome) => {
        
        if (nome.toLowerCase() === 'sair') {
            console.log(`${colors.yellow}\nEncerrando sistema... Até logo, João! 🖖${colors.reset}\n`);
            rl.close();
            return;
        }

        if (!nome.trim()) return iniciarCLI();

        console.log(`${colors.magenta}🔎 Consultando variantes para: ${nome}...${colors.reset}`);
        
        const resultado = await getHeroByName(nome);

        if (resultado.error) {
            console.log(`${colors.red}❌ ${resultado.message}${colors.reset}\n`);
            iniciarCLI();
        } else {
            // Se houver mais de um resultado, permite a escolha
            if (resultado.data.length > 1) {
                console.log(`\n${colors.yellow}⚠️  Encontrei ${resultado.data.length} variantes. Qual você deseja ver?${colors.reset}`);
                
                resultado.data.forEach((item, index) => {
                    console.log(` ${colors.bright}[${index + 1}]${colors.reset} ${item.name} (${item.biography['full-name'] || 'N/A'})`);
                });

                rl.question(`\n🎯 Escolha o número (1-${resultado.data.length}): `, (escolha) => {
                    const idx = parseInt(escolha) - 1;
                    if (resultado.data[idx]) {
                        exibirHeroi(resultado.data[idx]);
                    } else {
                        console.log(`${colors.red}❌ Opção inválida! Voltando ao menu...${colors.reset}`);
                    }
                    iniciarCLI();
                });
            } else {
                // Se só tiver um, exibe direto
                exibirHeroi(resultado.data[0]);
                iniciarCLI();
            }
        }
    });
};

// Limpa o terminal e exibe o cabeçalho
console.clear();
console.log(`${colors.bright}${colors.cyan}==========================================`);
console.log(`  SUPERHERO CLI - INTERACTIVE EDITION   `);
console.log(`==========================================${colors.reset}`);
iniciarCLI();
