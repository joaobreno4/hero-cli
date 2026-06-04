# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Comandos principais

```bash
# Subir o ambiente completo (neo4j → dashboard → cli em ordem de dependência)
docker compose up

# Executar a CLI interativamente (requer neo4j healthy)
docker compose run --rm cli

# Subir apenas o dashboard em background
docker compose up -d dashboard

# Rebuild obrigatório após qualquer mudança em package.json
docker compose build

# Verificar estado de saúde de cada serviço
docker compose ps

# Ver logs de um serviço específico
docker compose logs dashboard
docker compose logs neo4j
```

## Arquitetura

Dois pontos de entrada independentes compartilham as mesmas camadas de config e serviço:

- **`src/index.js`** — entrypoint da CLI. Inicializa `dd-trace` como primeiro `require` (obrigatório para instrumentar todos os módulos subsequentes), exibe o logo e delega para `src/cli/interface.js`.
- **`src/server.js`** — entrypoint do dashboard Express. Inicializa `dd-trace`, expõe `/` (dashboard HTML), `/health` (healthcheck) e `/api/proxy-image` (proxy de imagens com cache em memória).

**Camada de configuração (`src/config/`)**
- `env.js` — carrega `.env` via dotenv e exporta `SUPERHERO_TOKEN`. Ponto único de acesso a variáveis de ambiente.
- `neo4j.js` — driver Neo4j singleton (`neo4j-driver`). Usar `require('../config/neo4j')` de qualquer módulo para reutilizar a mesma conexão.

**Camada de serviço (`src/services/api.js`)**
- `getHeroByName(name)` — consulta a SuperHero API e retorna `{ error, data }` ou `{ error, message }`.
- `saveToLocalDb(hero)` — persiste em paralelo via `Promise.allSettled`: JSON (`data/marvel_heroes.json`) é primário (falha propaga erro), Neo4j é best-effort (falha loga `[SRE WARN]` e continua).

**Fluxo de dados da CLI**
```
interface.js → getHeroByName() → SuperHero API
             ↓ usuário seleciona
             → saveToLocalDb() → JSON (primário) + Neo4j (best-effort)
```

## Modelo de dados Neo4j

```cypher
-- Nó Hero + nó Publisher + relacionamento BELONGS_TO
MERGE (h:Hero {id: $id})
SET h.name = $name, h.publisher = $publisher, h.thumbnail = $thumbnail
MERGE (p:Publisher {name: $publisher})
MERGE (h)-[:BELONGS_TO]->(p)

-- Para cada equipe em connections.group-affiliation (separadas por vírgula):
MATCH (h:Hero {id: $heroId})
MERGE (t:Team {name: $teamName})
MERGE (h)-[:MEMBER_OF]->(t)
```

Todas as operações usam `MERGE`, garantindo idempotência — salvar o mesmo herói duas vezes não cria duplicatas nem relacionamentos duplicados. As escritas ocorrem dentro de `session.executeWrite()` (transação atômica). A criação de nós `:Team` é opcional e depende do campo `connections.group-affiliation` retornado pela API.

## Ordem de boot e healthchecks

O Docker Compose respeita `depends_on: condition: service_healthy`:

1. `neo4j` sobe e passa o healthcheck (`wget --spider http://localhost:7474`)
2. `dashboard` e `cli` iniciam somente após o neo4j estar healthy

**Healthcheck do dashboard usa `127.0.0.1`, não `localhost`.** No Alpine Linux, `localhost` resolve para `::1` (IPv6), mas o Express escuta em `0.0.0.0` (IPv4). Manter `127.0.0.1` explícito para evitar regressão.

## Bind mount e node_modules

O docker-compose usa `.:/app` para hot-reload dos arquivos fonte, mas isso sobrescreveria o `node_modules` instalado na imagem com o do host. O volume anônimo `/app/node_modules` nos serviços `cli` e `dashboard` protege o diretório da imagem. **Não remover essa entrada** — sem ela, pacotes instalados no build ficam invisíveis em runtime.

Consequência: após qualquer mudança em `package.json`, é necessário `docker compose build` para o novo pacote ser incluído na imagem.

## Observabilidade (Datadog APM)

`dd-trace` deve ser o primeiro `require` em cada entrypoint. Os spans customizados existentes:

| Span | Arquivo | O que mede |
|------|---------|------------|
| `superhero.api.search` | `api.js` | Latência da chamada à SuperHero API |
| `db.write` | `api.js` | Tempo total de persistência (JSON + Neo4j) |
| `web.request.read_db` | `server.js` | Leitura do JSON no request do dashboard |
| `image.proxy.fetch` | `server.js` | Fetch + cache do proxy de imagens |

## Proxy de imagens

`GET /api/proxy-image?url=<url_encoded>` — aceita apenas `http://` e `https://`. Cache em memória com TTL de 24h e cap de 200 entradas (evicção FIFO). O header `X-Cache: HIT/MISS` indica o estado do cache.
