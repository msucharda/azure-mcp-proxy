# Azure MCP Proxy — Tool Selection Evals

Promptfoo evals testing whether an LLM correctly selects the right Azure MCP tool given a natural-language user query.

## 10 Eval Scenarios

| # | Scenario | Expected Tool | Key Assertion |
|---|----------|---------------|---------------|
| 1 | VM listing | `compute` → `compute_vm_get` | Tool + resource-group param |
| 2 | Blob container creation | `storage` → `storage_blob_container_create` | Tool + account + container params |
| 3 | Key Vault secret retrieval | `keyvault` → `keyvault_secret_get` | Tool + vault-name + secret-name |
| 4 | AKS cluster details | `aks` → `aks_cluster_get` | Tool + cluster + resource-group |
| 5 | Cosmos DB query | `cosmos` → `cosmos_database_container_item_query` | Tool + account + db + container |
| 6 | Log Analytics KQL query | `monitor` → `monitor_workspace_log_query` | Tool + workspace |
| 7 | App Service settings | `appservice` → `appservice_webapp_settings_get-appsettings` | Tool + app-name |
| 8 | Container Apps listing | `containerapps` → `containerapps_list` | Tool + resource-group |
| 9 | Resource group resources | `group_resource_list` | Tool + resource-group |
| 10 | Multi-tool (subscription + compute) | `subscription_list` + `compute` | `tool-call-f1` ≥ 0.5 |

## Azure MCP Coverage

15 tools defined (10 targets + 5 distractors): compute, storage, keyvault, aks, cosmos, monitor, appservice, containerapps, subscription\_list, group\_list, group\_resource\_list, postgres, redis, acr, search.

## Quick Start

```bash
npm install
npx promptfoo eval
npx promptfoo view   # opens results in browser
```

## Configuration

- **Provider**: Edit `promptfooconfig.yaml` to change the model (default: `openai:chat:gpt-4o`)
- **Tools**: Azure MCP tool definitions in `tools/azure-mcp-tools.yaml`
- **Tests**: 10 eval cases in `tests/tool-selection.yaml`
- **Assertions**: Custom TypeScript helpers in `src/assertions/toolSelection.ts`

## Project Structure

```
├── promptfooconfig.yaml            # Main Promptfoo config
├── prompts/
│   └── system-prompt.txt           # Azure assistant system prompt
├── tools/
│   └── azure-mcp-tools.yaml        # 15 OpenAI-style tool definitions
├── tests/
│   └── tool-selection.yaml         # 10 eval test cases
└── src/
    └── assertions/
        └── toolSelection.ts        # Reusable assertion helpers
```
