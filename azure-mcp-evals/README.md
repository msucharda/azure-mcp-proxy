# Azure MCP Proxy — Tool Selection Evals (Harbor Dataset)

A Harbor dataset of 10 tasks that evaluate whether Copilot CLI correctly selects
the right Azure MCP tool given a natural-language user query.

## Coverage

| # | Task | Expected Tool | Key Parameters |
|---|------|---------------|----------------|
| 01 | VM listing | `compute` | resource-group |
| 02 | Blob container creation | `storage` | account, container |
| 03 | Key Vault secret retrieval | `keyvault` | vault-name, secret-name |
| 04 | AKS cluster details | `aks` | cluster, resource-group |
| 05 | Cosmos DB query | `cosmos` | account, database, container |
| 06 | Log Analytics KQL query | `monitor` | workspace |
| 07 | App Service settings | `appservice` | app-name |
| 08 | Container Apps listing | `containerapps` | resource-group |
| 09 | Resource group resources | `group_resource_list` | resource-group |
| 10 | Multi-tool (sub + compute) | `subscription_list` + `compute` | resource-group |

## Prerequisites

- [Harbor](https://harborframework.com) installed (`uv tool install harbor` or `pip install harbor`)
- Docker running locally
- `GITHUB_TOKEN` for Copilot CLI authentication
- `AZURE_MCP_URL` pointing to your Azure MCP proxy endpoint

## Quick Start

```bash
export GITHUB_TOKEN=<your-github-token>
export AZURE_MCP_URL=http://<azure-mcp-proxy>:8000/mcp

# Run all 10 evals
harbor run -p ./azure-mcp-evals -a copilot-cli -m claude-sonnet-4

# Run a single task
harbor run -p ./azure-mcp-evals/01-compute-vm-listing -a copilot-cli -m claude-sonnet-4

# Run with a different model
harbor run -p ./azure-mcp-evals -a copilot-cli -m gpt-4o
```

## How It Works

1. Harbor spins up a Docker container per task
2. Installs Copilot CLI in the container
3. Injects the Azure MCP server via `--additional-mcp-config`
4. Runs `copilot --prompt=<instruction> --yolo --output-format=json`
5. Captures JSONL trajectory with all `tool_use` events
6. `tests/test.sh` parses the trajectory and checks:
   - At least one `tool_use` event exists
   - Tool name matches expected pattern (regex)
   - Required parameter values appear in arguments
7. Writes reward (1=pass, 0=fail) to `/logs/verifier/reward.txt`

## Task Structure

Each task follows the Harbor task format:

```
<task-dir>/
├── instruction.md          # Natural language query for the agent
├── task.toml               # Task config (MCP servers, timeouts)
├── environment/
│   └── Dockerfile          # Container image (Ubuntu 24.04 + python3)
└── tests/
    └── test.sh             # Verifier script
```

## Customization

- **Azure MCP URL**: Set `AZURE_MCP_URL` env var to your proxy endpoint
- **Model**: Use `-m` flag to test different models
- **Timeout**: Edit `[agent] timeout_sec` in `task.toml` (default: 300s)
- **New tasks**: Run `harbor init --task "azure-mcp-evals/my-task"` and follow the pattern
