# SuperHero CLI & Dashboard (SRE Edition)

Ferramenta de linha de comando interativa e dashboard web distribuído para consultar e persistir dados de heróis via [SuperHero API](https://superheroapi.com). Construído com foco em práticas de SRE: infraestrutura imutável com Docker, persistência dual (JSON + Neo4j), observabilidade com Datadog APM e proxy de imagens com cache em memória.

## Arquitetura

```
SuperHero API
     │
     ▼
src/services/api.js
     │
     ├── data/marvel_heroes.json  (persistência primária via volume Docker)
     └── Neo4j :7687              (persistência em grafo, best-effort)

src/index.js   → CLI interativa  (docker compose run --rm cli)
src/server.js  → Dashboard web   (http://localhost:3000)
```

**Serviços Docker:**

| Serviço | Porta | Descrição |
|---------|-------|-----------|
| `neo4j` | 7474 (HTTP), 7687 (Bolt) | Banco de grafos. Sobe primeiro — cli e dashboard aguardam seu healthcheck. |
| `dashboard` | 3000 | Servidor Express com dashboard HTML e proxy de imagens. |
| `cli` | — | Container interativo (TTY). Executado sob demanda. |

## Pré-requisitos

- Docker e Docker Compose
- Token da [SuperHero API](https://superheroapi.com)

## Configuração

```bash
git clone https://github.com/joaobreno4/hero-cli.git
cd hero-cli

cp .env.example .env
# Edite .env e preencha SUPERHERO_TOKEN
```

`.env.example`:
```
SUPERHERO_TOKEN=seu_token_aqui

NEO4J_URI=bolt://neo4j:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password123
```

## Como executar

```bash
# Ambiente completo (neo4j + dashboard + cli)
docker compose up

# Apenas o dashboard em background
docker compose up -d dashboard
# Acesse: http://localhost:3000
# Painel Neo4j: http://localhost:7474

# CLI interativa (busca e salva heróis)
docker compose run --rm cli
```

### Uso da CLI

```
> Nome do herói: hulk

Resultados para "hulk":
1. Hulk                 | Marvel Comics
2. Hulk                 | Marvel Comics (2099)
3. She-Hulk             | Marvel Comics

# Selecione o número (ou digite "nova" para reiniciar): 1
[SRE] Confirmado: Hulk
✔ Dados sincronizados com sucesso!
```

O herói selecionado é salvo simultaneamente no JSON local e como nó `:Hero` no Neo4j.

## Tecnologias

- **Runtime:** Node.js 20 (Alpine)
- **Infraestrutura:** Docker & Docker Compose
- **Servidor Web:** Express.js 5
- **API externa:** SuperHero API (agnóstica — Marvel, DC, etc.)
- **Persistência:** JSON local + Neo4j (grafo)
- **Observabilidade:** Datadog APM via `dd-trace`
- **HTTP client:** Axios

## Roadmap SRE

- [x] Dockerização e orquestração com Compose
- [x] Persistência de dados via Docker Volumes
- [x] Normalização de dados (Data Cleaning)
- [x] Healthchecks de serviço com `depends_on: service_healthy`
- [x] Integração com banco de grafos Neo4j
- [x] Proxy de imagens com cache em memória (resolve Mixed Content)
- [x] Observabilidade com Datadog APM (spans customizados por camada)
- [ ] Relacionamentos entre heróis no grafo Neo4j
- [ ] Alertas e SLOs no Datadog

---

Desenvolvido por João Breno da Silva | DevOps & SRE Intern @ Deal Group.
