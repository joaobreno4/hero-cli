// src/index.js
// SRE: Inicialização do Datadog para monitorar a ingestão de dados
require('dd-trace').init({
  service: 'marvel-cli',
  env: 'development'
});

const { iniciarCLI } = require('./cli/interface.js');

// Cores temáticas da Marvel para o terminal (Vermelho e Branco)
const ui = {
    red: '\x1b[31m',
    white: '\x1b[37m',
    bold: '\x1b[1m',
    reset: '\x1b[0m'
};

const logo = `
${ui.red}${ui.bold}
  ███╗   ███╗ █████╗ ██████╗ ██╗   ██╗███████╗██╗     
  ████╗ ████║██╔══██╗██╔══██╗██║   ██║██╔════╝██║     
  ██╔████╔██║███████║██████╔╝██║   ██║█████╗  ██║     
  ██║╚██╔╝██║██╔══██║██╔══██╗╚██╗ ██╔╝██╔══╝  ██║     
  ██║ ╚═╝ ██║██║  ██║██║  ██║ ╚████╔╝ ███████╗███████╗
  ╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝  ╚═══╝  ╚══════╝╚══════╝
${ui.white}         SRE INGESTION TOOL - API EDITION
${ui.reset}`;

console.clear();
console.log(logo);

// Inicia a interface de linha de comando
iniciarCLI();
