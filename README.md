# Azure MCP Proxy — Evals for Copilot CLI

Evaluate whether Copilot CLI correctly selects Azure MCP tools using [Harbor](https://harborframework.com) containerized evals.

## Architecture

```
Copilot CLI ──▶ azure-proxy/server.mjs ──▶ @azure/mcp@latest ──▶ Azure APIs
                (1 "azure" tool)            (61 real tools)
```

The proxy collapses 61 Azure MCP tools into a single progressive-discovery "azure" tool.
Supports **stdio** (local/Copilot CLI) and **HTTP** (Docker/Harbor) transports.

## Quick Start

### Option 1: Local / WSL (stdio mode)

```bash
# Clone and install
git clone https://github.com/msucharda/azure-mcp-proxy.git
cd azure-mcp-proxy/azure-proxy && npm install

# Use with Copilot CLI (stdio — default)
copilot --additional-mcp-config='{"mcpServers":{"azure":{"type":"stdio","command":"node","args":["azure-proxy/server.mjs"]}}}'
```

### Option 2: Harbor Evals (Docker sidecar)

```bash
# Start the Azure MCP sidecar
az login
docker compose -f docker-compose.azure-mcp.yaml up -d

# Run all 10 evals
export GITHUB_TOKEN=<your-token>
harbor run -p ./azure-mcp-evals -a copilot-cli -m claude-sonnet-4

# Or run a single task
harbor run -p ./azure-mcp-evals/01-compute-vm-listing -a copilot-cli
```

### Option 3: HTTP mode (standalone)

```bash
cd azure-proxy && npm install
node server.mjs --http 8080

# Health check
curl http://localhost:8080/health
# → {"status":"ok","tools":61}
```

## Eval Coverage (10 Harbor Tasks)

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
| 10 | Multi-tool scenario | `subscription_list` + `compute` | resource-group |

## Project Structure

```
├── azure-proxy/                     # MCP proxy (stdio + HTTP)
│   ├── server.mjs                   # Proxy server (progressive tool discovery)
│   ├── package.json                 # @modelcontextprotocol/sdk
│   └── Dockerfile                   # Docker image for sidecar
│
├── docker-compose.azure-mcp.yaml    # Sidecar for Harbor tasks
│
├── azure-mcp-evals/                 # Harbor dataset (10 tasks)
│   ├── 01-compute-vm-listing/
│   │   ├── instruction.md           # Natural language query
│   │   ├── task.toml                # Task config + MCP server
│   │   ├── environment/Dockerfile
│   │   └── tests/test.sh            # Verifier script
│   ├── ... (02-10)
│   └── shared/verify_tool.py        # Common trajectory parser
│
├── promptfooconfig.yaml             # Promptfoo static evals (offline alternative)
├── tools/azure-mcp-tools.yaml       # Static tool definitions (15 tools)
└── tests/tool-selection.yaml        # Promptfoo test cases
```

## Authentication

The proxy inherits Azure credentials from the environment:

- **Local**: `az login` (Azure CLI credential)
- **Docker**: Mount `~/.azure` volume or pass `AZURE_*` env vars
- **CI**: Service principal via `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`
