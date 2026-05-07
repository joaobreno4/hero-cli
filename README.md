# SuperHero CLI & Dashboard (SRE Edition)

Este projeto é uma ferramenta de linha de comando (CLI) interativa e um dashboard web distribuído, projetado para consultar e gerenciar dados da SuperHero API. Foi construído com foco em boas práticas de SRE (Site Reliability Engineering), utilizando Docker para isolamento, volumes para persistência de dados e normalização de dados em tempo real.

## Arquitetura do Sistema

O projeto utiliza uma arquitetura de microserviços simplificada:

1. CLI (Terminal): Interface interativa para busca de heróis e seleção de variantes.
2. Dashboard (Web): Servidor Express que lê os dados persistidos e exibe em uma interface visual moderna com suporte a Mixed Content (Upgrade de HTTP para HTTPS).
3. Data Persistence: Camada de persistência em JSON que atua como um banco de dados local compartilhado via Docker Volumes.
4. Data Cleaning: Camada lógica que normaliza nomes de editoras (ex: transformando variantes de Thor/Spider em "Marvel Comics").

## Tecnologias Utilizadas

* Runtime: Node.js (v20-alpine)
* Infraestrutura: Docker & Docker Compose
* Servidor Web: Express.js
* Comunicação: Axios (Consumo de API REST)
* Persistência: JSON Local (Preparado para expansão em Neo4j)

## Como Rodar o Projeto

### Pré-requisitos
* Docker e Docker Compose instalados.
* Token da SuperHero API.

### Configuração
1. Clone o repositório:
   git clone https://github.com/seu-usuario/hero-cli.git
   cd hero-cli

2. Variáveis de Ambiente:
   Crie um arquivo .env na raiz:
   SUPERHERO_TOKEN=seu_token_aqui

### Execução

Para buscar heróis (CLI):
docker compose run --rm cli

Para visualizar o Dashboard:
docker compose up -d dashboard
Acesse: http://localhost:3000

## Roadmap de Evolução (SRE focus)
- [x] Dockerização e Orquestração com Compose.
- [x] Persistência de dados via Volumes.
- [x] Normalização de dados (Data Cleaning).
- [ ] Implementação de Healthchecks de serviço.
- [ ] Integração com banco de grafos Neo4j.

---
Desenvolvido por João Breno da Silva | DevOps & SRE Intern @ Deal Group.
