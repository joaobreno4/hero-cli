# Política de Confiabilidade — Hero CLI (SRE / Datadog)

## SLOs Definidos

### SLO 1 — Disponibilidade do Proxy de Imagens

| Atributo | Valor |
|---|---|
| **Descrição** | Requisições a `GET /api/proxy-image` devem retornar HTTP 200 |
| **Meta** | 99,5% das requisições em janela de 30 dias |
| **Error budget** | 0,5% → ~3h 36min de degradação por mês |
| **Span de referência** | `image.proxy.fetch` |
| **Sinal de falha** | `http.status_code >= 500` ou timeout no fetch da imagem de origem |

**Definição Datadog (SLO baseado em métricas):**
```
Numerador:   sum:trace.express.request.hits{resource_name:/api/proxy-image,http.status_code:200}.as_count()
Denominador: sum:trace.express.request.hits{resource_name:/api/proxy-image}.as_count()
```

---

### SLO 2 — Latência de Busca na SuperHero API

| Atributo | Valor |
|---|---|
| **Descrição** | 90% das buscas (`superhero.api.search`) devem completar em < 500 ms |
| **Meta** | p90 ≤ 500 ms em janela de 30 dias |
| **Error budget** | 10% das requisições pode exceder o threshold |
| **Span de referência** | `superhero.api.search` |
| **Sinal de falha** | `duration > 500ms` no percentil 90 |

**Definição Datadog (SLO baseado em métricas):**
```
Numerador:   sum:trace.superhero.api.search.hits{env:production,@duration:<=500000000}.as_count()
Denominador: sum:trace.superhero.api.search.hits{env:production}.as_count()
```

> **Nota:** durações em APM são em nanosegundos — 500 ms = 500 000 000 ns.

---

## Monitor: Alerta de Taxa de Erros — `superhero.api.search`

Dispara quando mais de 5% das buscas registram `error=true` nos últimos 5 minutos.

### Payload JSON (Datadog Monitors API)

```json
{
  "name": "[Hero CLI] Alta taxa de erros em superhero.api.search",
  "type": "metric alert",
  "query": "sum(last_5m):( sum:trace.superhero.api.search.errors{env:production}.as_count() / sum:trace.superhero.api.search.hits{env:production}.as_count() ) * 100 > 5",
  "message": "## Alerta: Taxa de Erros > 5% em superhero.api.search\n\n**Taxa atual:** {{value}}%\n**Threshold:** 5%\n**Janela:** últimos 5 minutos\n\n### Possíveis causas\n- SuperHero API instável ou rate-limited\n- Token `SUPERHERO_TOKEN` inválido ou expirado\n- Timeout de rede no container `cli`\n\n### Ações imediatas\n1. Verificar logs: `docker compose logs cli`\n2. Checar status da SuperHero API\n3. Validar variável de ambiente `SUPERHERO_TOKEN`\n\n@slack-hero-cli-alerts @pagerduty-hero-cli-oncall",
  "tags": [
    "service:hero-cli",
    "env:production",
    "team:sre",
    "slo:latency"
  ],
  "options": {
    "thresholds": {
      "critical": 5,
      "warning": 2
    },
    "notify_no_data": false,
    "no_data_timeframe": 10,
    "renotify_interval": 30,
    "include_tags": true,
    "evaluation_delay": 60,
    "new_host_delay": 300,
    "notify_audit": false,
    "require_full_window": false,
    "escalation_message": "Alerta ainda ativo após 30 min. Escalar para líder de plantão."
  },
  "priority": 2
}
```

### Destinos de Notificação

| Canal | Trigger |
|---|---|
| `#hero-cli-alerts` (Slack) | Warning (≥ 2%) e Critical (≥ 5%) |
| PagerDuty `hero-cli-oncall` | Apenas Critical (≥ 5%) |

### Como provisionar (quando houver acesso à conta Datadog)

```bash
# Via Datadog API
curl -X POST "https://api.datadoghq.com/api/v1/monitor" \
  -H "DD-API-KEY: ${DD_API_KEY}" \
  -H "DD-APPLICATION-KEY: ${DD_APP_KEY}" \
  -H "Content-Type: application/json" \
  -d @datadog_monitor_search_errors.json

# Via Terraform (recomendado para IaC)
# resource "datadog_monitor" "hero_cli_search_errors" { ... }
```

---

## Resumo dos Spans Instrumentados

| Span | Onde | SLO associado |
|---|---|---|
| `superhero.api.search` | `api.js` | Latência p90 ≤ 500 ms |
| `db.write` | `api.js` | — (interno) |
| `web.request.read_db` | `server.js` | — (interno) |
| `image.proxy.fetch` | `server.js` | Disponibilidade ≥ 99,5% |
