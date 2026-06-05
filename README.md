# Marvel & DC SRE Dashboard & CLI Ecosystem

Plataforma de linha de comando e dashboard web para buscar, limpar e persistir dados de super-heróis com foco em práticas de SRE: infraestrutura imutável com Docker, observabilidade com Prometheus + Grafana, persistência dual em grafo (Neo4j) + JSON, entrega de mídias via CDN global e pipeline de CI/CD com GitHub Actions.

---

## Arquitetura do Sistema

```
SuperHero API
      │
      ▼
src/services/api.js
      │  normalizePublisher()   → Data Cleaning (editora)
      │  toSlug()               → CDN URL determinística (akabab / jsDelivr)
      │  downloadImage()        → cache local em data/images/
      │
      ├── data/marvel_heroes.json   (persistência primária via bind mount)
      └── Neo4j :7687               (grafo de relacionamentos, best-effort)
              │
              ├── (:Hero)-[:BELONGS_TO]→(:Publisher)
              └── (:Hero)-[:MEMBER_OF]→(:Team)

src/index.js   → CLI interativa   (docker compose run --rm cli)
src/server.js  → Dashboard web    (http://localhost:3000)
                      │
                      ├── GET /            dashboard HTML
                      ├── GET /metrics     Prometheus scrape endpoint
                      ├── GET /images/*    arquivos locais (express.static)
                      ├── GET /api/proxy-image  proxy com cache em memória
                      └── GET /health      healthcheck
```

**Serviços Docker:**

| Serviço | Porta | Descrição |
|---|---|---|
| `neo4j` | 7474 (HTTP), 7687 (Bolt) | Banco de grafos. Sobe primeiro — cli e dashboard aguardam seu healthcheck. |
| `dashboard` | 3000 | Express com dashboard HTML, proxy de imagens e endpoint `/metrics`. |
| `cli` | — | Container interativo (TTY). Executado sob demanda. |
| `prometheus` | 9090 | Coleta métricas do dashboard a cada 15 s. |
| `grafana` | 4000 | Visualização de métricas. Datasource Prometheus provisionado automaticamente. |

---

## CLI Interativa

A CLI faz busca, limpeza e ingestão de heróis em uma única sessão interativa.

### Funcionalidades

**Data Cleaning — `normalizePublisher()`**
Heróis com variações inconsistentes de editora (ex: `"Rune King Thor"` como publisher) são normalizados antes de qualquer persistência:

| Sinal detectado | Publisher normalizado |
|---|---|
| `"marvel"`, `"thor"`, `"hulk"`, `"avenger"`, `"x-men"`… | `"Marvel Comics"` |
| `"dc"`, `"superman"`, `"batman"`, `"justice league"`… | `"DC Comics"` |
| `"Dark Horse Comics"`, `"Image Comics"`… | passthrough (já reconhecida) |
| Nenhum sinal | valor limpo original |

**Exibição de Alter Ego**
O menu de seleção exibe identidade real para resolver ambiguidades entre personagens de mesmo nome:

```
Resultados para "Spider-Man":
1. Spider-Man (Peter Parker)    | Marvel Comics
2. Spider-Man (Miles Morales)   | Marvel Comics
3. Spider-Man (Miguel O'Hara)   | Marvel Comics
```

**Pipeline de Ingestão de Imagens**
Ao salvar um herói, a CLI tenta baixar a imagem localmente (volume compartilhado `./data/images`). Em caso de falha, o campo `thumbnail` é atualizado com a URL autenticada da SuperHero API para carregamento direto no browser.

---

## Entrega de Mídias — CDN jsDelivr (akabab)

O servidor de imagens original (`superherodb.com`) bloqueia requisições de servidores por IP (HTTP 403). A solução definitiva migrou para a CDN pública do projeto open-source **akabab/superhero-api** via jsDelivr:

```
https://cdn.jsdelivr.net/gh/akabab/superhero-api@0.3.0/api/images/sm/{id}-{slug}.jpg
```

- **IDs idênticos** entre superheroapi.com e akabab — mapeamento determinístico sem lookups extras
- **`toSlug(name)`** converte o nome em kebab-case: `"Spider-Man"` → `"spider-man"`
- jsDelivr é uma CDN global sem autenticação, sem bloqueio de IP e sem CORS restrictions
- O `onerror` no card mantém o avatar SVG como fallback caso o arquivo não exista na CDN

---

## Camada de Persistência

### Neo4j (Grafo)

```cypher
-- Nó Hero + Publisher + relacionamento
MERGE (h:Hero {id: $id})
SET h.name = $name, h.publisher = $publisher, h.thumbnail = $thumbnail
MERGE (p:Publisher {name: $publisher})
MERGE (h)-[:BELONGS_TO]->(p)

-- Equipes (quando disponível em connections.group-affiliation)
MERGE (t:Team {name: $teamName})
MERGE (h)-[:MEMBER_OF]->(t)
```

Todas as operações usam `MERGE` — idempotência garantida. As escritas ocorrem em `session.executeWrite()` (transação atômica). Neo4j é **best-effort**: falha loga `[SRE WARN]` e não interrompe o fluxo.

### JSON (`data/marvel_heroes.json`)

Persistência primária via bind mount Docker. O `writeToJson` é **upsert** — re-salvar o mesmo herói atualiza o registro existente (equivalente ao `MERGE` do Neo4j).

---

## Observabilidade — Prometheus + Grafana

O dashboard expõe um endpoint `/metrics` via **prom-client** com métricas prefixadas `hero_`.

### Métricas customizadas de negócio

| Métrica | Tipo | O que mede |
|---|---|---|
| `hero_http_request_duration_seconds` | Histogram | Latência HTTP por `method`, `route` e `status` |
| `hero_image_cache_hits_total` | Counter | Hits no cache em memória do proxy de imagens |
| `hero_image_cache_misses_total` | Counter | Misses (fetch externo disparado) |

Além dessas, as métricas padrão do Node.js runtime são coletadas automaticamente: heap, GC, event-loop lag, CPU, handles ativos.

### URLs de acesso local

| Serviço | URL | Credenciais |
|---|---|---|
| Dashboard | http://localhost:3000 | — |
| Prometheus | http://localhost:9090 | — |
| Grafana | http://localhost:4000 | `admin` / `admin` |

### Queries PromQL prontas para Grafana

```promql
# Taxa de requisições por rota (req/s nos últimos 1m)
rate(hero_http_request_duration_seconds_count[1m])

# Latência p95 por rota
histogram_quantile(0.95, rate(hero_http_request_duration_seconds_bucket[5m]))

# Cache hit rate do proxy de imagens
hero_image_cache_hits_total / (hero_image_cache_hits_total + hero_image_cache_misses_total)

# Heap Node.js em MB
hero_nodejs_heap_size_used_bytes / 1024 / 1024
```

O Grafana inicia com o datasource Prometheus provisionado automaticamente via `grafana/provisioning/datasources/prometheus.yml` — sem configuração manual.

---

## Infraestrutura como Código — Terraform (AWS)

O diretório `terraform/` contém a definição completa para provisionar a stack em AWS usando ECS Fargate:

```
terraform/
├── main.tf        VPC, subnets, IGW, SGs, ECR, ECS cluster + task, ALB
├── variables.tf   Região, portas, segredos (sensitive = true)
└── outputs.tf     alb_dns_name, ecr_repository_url, IDs de recursos
```

**Topologia de rede:**

- VPC `10.0.0.0/16` com 2 subnets públicas (AZs a e b)
- Security Group `alb` — aceita 80/tcp da internet
- Security Group `dashboard` — aceita `dashboard_port` apenas do SG do ALB
- Security Group `neo4j` — aceita 7474 da VPC CIDR, Bolt (7687) apenas do SG do dashboard
- ALB com target group e health check em `/health`
- ECS task definition Fargate (256 CPU / 512 MB) com CloudWatch Logs (`/ecs/hero-cli/dashboard`, retenção 7 dias)

```bash
cd terraform
terraform init
terraform plan -var="neo4j_password=..." -var="superhero_token=..." -var="dashboard_image=<ECR_URI>"
terraform apply
```

---

## CI/CD — GitHub Actions

O workflow `.github/workflows/ci.yml` executa a cada `push` ou `pull_request` na branch `main`:

```
lint  ──────────────────────►  docker-build
  npm ci                           docker build -t hero-cli:ci .
  node --check src/**/*.js         node --check src/server.js   (smoke)
                                   node --check src/index.js    (smoke)
```

- O job `docker-build` depende do `lint` — imagem só é construída se a sintaxe estiver válida
- Usa `secrets.SUPERHERO_TOKEN` para o `.env` de build (com fallback `ci-placeholder`)

---

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

## Guia de Execução Rápida

```bash
# Sobe todo o ecossistema (Neo4j → Dashboard → Prometheus → Grafana)
docker compose up -d

# Verifica o estado de saúde de cada serviço
docker compose ps

# CLI interativa — busca, limpa e persiste heróis
docker compose run --rm cli

# Rebuild obrigatório após mudanças em package.json
docker compose build

# Logs de um serviço específico
docker compose logs dashboard
docker compose logs prometheus
```

## Roadmap SRE

- [x] Dockerização e orquestração com Compose
- [x] Persistência de dados via Docker Volumes
- [x] Normalização de dados (Data Cleaning)
- [x] Healthchecks de serviço com `depends_on: service_healthy`
- [x] Integração com banco de grafos Neo4j
- [x] Relacionamentos entre heróis no grafo Neo4j (`BELONGS_TO` Publisher, `MEMBER_OF` Team)
- [x] Proxy de imagens com cache em memória
- [x] Observabilidade com Datadog APM (spans customizados por camada)
- [x] Observabilidade local com Prometheus + Grafana (métricas de negócio)
- [x] Pipeline de ingestão de imagens locais com CDN jsDelivr (akabab)
- [x] Alertas e SLOs documentados (ver `DATADOG_SRE.md`)
- [x] Infraestrutura como Código com Terraform (AWS ECS Fargate)
- [x] CI/CD com GitHub Actions (lint + docker build)

---

Desenvolvido por João Breno da Silva | DevOps & SRE Intern @ Deal Group.
