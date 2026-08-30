# Troubleshooting

The examples below use `ABSOLUTE_PATH_TO_REPO/dist/index.js`. Replace `ABSOLUTE_PATH_TO_REPO` with the absolute path to your clone.

## Enable debug logging

Set `LOG_LEVEL` in the MCP server environment:

```json
{
  "inputs": [
    {
      "id": "ado_org",
      "type": "promptString",
      "description": "Azure DevOps organization name (e.g. 'contoso')"
    }
  ],
  "servers": {
    "ado": {
      "type": "stdio",
      "command": "node",
      "args": ["ABSOLUTE_PATH_TO_REPO/dist/index.js", "${input:ado_org}"],
      "env": {
        "LOG_LEVEL": "debug"
      }
    }
  }
}
```

Logs are written to `stderr`, leaving `stdout` available for the MCP protocol.

## Server or tools do not appear

1. Confirm that Node.js 20 or later is installed with `node --version`.
2. Run `npm ci` and `npm run build` in the server repository.
3. Confirm that the configured path points to the generated `dist/index.js`.
4. Restart the MCP server and reload the client window.
5. Open the client's tool picker and select the tool names listed in [TOOLSET.md](./TOOLSET.md). Current tools do not share an `ado_` prefix.

If too many tools are loaded, enable only the domains you need with `-d`. The standard domains are `core`, `work`, `work-items`, `repositories`, `wiki`, `pipelines`, `search`, `test-plans`, and `advanced-security`. The diagnostic `mcp-apps` domain is enabled only when explicitly selected.

## Authentication

### Interactive authentication

Interactive authentication is the default. It requires an environment that can open a browser. If browser authentication fails because of tenant policy, use Azure CLI authentication.

### Bearer token authentication

The `envvar` method expects an Azure DevOps OAuth bearer access token, not a Personal Access Token:

```sh
export ADO_MCP_AUTH_TOKEN="<bearer-access-token>"
node ABSOLUTE_PATH_TO_REPO/dist/index.js myorg --authentication envvar
```

For an MCP configuration, pass the environment variable to the server and add `"--authentication", "envvar"` to its arguments.

### Personal Access Token authentication

The `pat` method expects `PERSONAL_ACCESS_TOKEN` to contain the base64 encoding of `<email>:<pat>`. The email may be any non-empty value.

On macOS or Linux:

```sh
export PERSONAL_ACCESS_TOKEN="$(printf '%s' '<email>:<pat>' | base64)"
node ABSOLUTE_PATH_TO_REPO/dist/index.js myorg --authentication pat
```

In PowerShell:

```powershell
$env:PERSONAL_ACCESS_TOKEN = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes('<email>:<pat>'))
node ABSOLUTE_PATH_TO_REPO/dist/index.js myorg --authentication pat
```

Do not commit bearer tokens, PATs, or encoded credentials to configuration files.

### Azure CLI authentication

Sign in with Azure CLI, then select the `azcli` authentication method:

```sh
az login
node ABSOLUTE_PATH_TO_REPO/dist/index.js myorg --authentication azcli
```

For headless environments such as WSL, remote SSH sessions, containers, and CI runners, use Azure CLI, bearer-token, or PAT authentication instead of the default interactive flow.

### Multi-tenant Azure CLI authentication

If Azure CLI works but the server returns an authorization error such as `TF400813`, identify the appropriate tenant ID:

```sh
az account list
```

Then pass both `--authentication azcli` and `--tenant`:

```json
{
  "inputs": [
    {
      "id": "ado_org",
      "type": "promptString",
      "description": "Azure DevOps organization name"
    },
    {
      "id": "ado_tenant",
      "type": "promptString",
      "description": "Azure tenant ID"
    }
  ],
  "servers": {
    "ado": {
      "type": "stdio",
      "command": "node",
      "args": ["ABSOLUTE_PATH_TO_REPO/dist/index.js", "${input:ado_org}", "--authentication", "azcli", "--tenant", "${input:ado_tenant}"]
    }
  }
}
```

## Project and team selection

Set `ado_mcp_project` or `ado_mcp_team` in the server environment to provide defaults. When a supported tool requires one of these values and no default or argument is available, the server asks the MCP client to present a selection form.

## Organization not found

If project retrieval reports that an API location cannot be found, confirm that:

- The organization name is spelled correctly.
- The organization exists and your account can access it.
- You supplied only the organization name, such as `contoso`, rather than `https://dev.azure.com/contoso`.

## Local cache

The server caches organization tenant IDs and refresh timestamps in `~/.ado_orgs.cache` for up to one week. The file does not contain access tokens or PATs. Delete it if tenant discovery appears stale; the server will recreate it on the next start.
