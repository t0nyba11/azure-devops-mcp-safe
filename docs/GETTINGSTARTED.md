# Getting Started

This guide explains how to run Azure DevOps MCP Safe with supported MCP clients.

- [Prerequisites](#prerequisites)
- [Build from Source](#build-from-source)
- [Authentication](#authentication)
- [Visual Studio Code](#visual-studio-code)
- [Visual Studio](#visual-studio)
- [GitHub Copilot CLI](#github-copilot-cli)
- [Codex](#codex)
- [Claude Code](#claude-code)
- [Claude Desktop](#claude-desktop)
- [Cursor](#cursor)
- [OpenCode](#opencode)
- [Kilo Code](#kilo-code)

## Prerequisites

All local setups require:

1. [Node.js 20 or later](https://nodejs.org/en/download).
2. [Git](https://git-scm.com/downloads).
3. Access to an Azure DevOps organization.
4. An MCP client listed below.

Visual Studio Code users need [VS Code](https://code.visualstudio.com/download) or [VS Code Insiders](https://code.visualstudio.com/insiders). Visual Studio users need [Visual Studio 2022 version 17.14 or later](https://learn.microsoft.com/en-us/visualstudio/releases/2022/release-history).

## Build from Source

Clone and build the server before configuring an MCP client:

```sh
git clone https://github.com/t0nyba11/azure-devops-mcp-safe.git
cd azure-devops-mcp-safe
npm ci
npm run build
```

The examples below use `ABSOLUTE_PATH_TO_REPO/dist/index.js`. Replace `ABSOLUTE_PATH_TO_REPO` with the absolute path to your clone, such as `C:/src/azure-devops-mcp-safe` on Windows or `/home/user/src/azure-devops-mcp-safe` on macOS or Linux. Re-run `npm run build` after pulling source changes.

## Authentication

Interactive authentication is the default. To use another method, add `--authentication <value>` or `-a <value>` to the server arguments.

| Method                   | Value         | Required setup             |
| ------------------------ | ------------- | -------------------------- |
| Interactive (default)    | `interactive` | Microsoft account sign-in  |
| Azure CLI                | `azcli`       | Active `az login` session  |
| Azure credential chain   | `env`         | Azure Identity environment |
| Bearer token environment | `envvar`      | `ADO_MCP_AUTH_TOKEN`       |
| Personal Access Token    | `pat`         | `PERSONAL_ACCESS_TOKEN`    |

### Interactive

This method opens a browser for Microsoft account sign-in. Omit the authentication argument to use it:

```json
{
  "servers": {
    "ado": {
      "type": "stdio",
      "command": "node",
      "args": ["ABSOLUTE_PATH_TO_REPO/dist/index.js", "<your-org>"]
    }
  }
}
```

### Azure CLI

Uses the token from an active `az login` session. Requires the [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli) to be installed and signed in.

```json
{
  "servers": {
    "ado": {
      "type": "stdio",
      "command": "node",
      "args": ["ABSOLUTE_PATH_TO_REPO/dist/index.js", "<your-org>", "--authentication", "azcli"]
    }
  }
}
```

### Azure Credential Chain

Use `env` to authenticate through `DefaultAzureCredential`. Configure a supported Azure Identity credential, then use this argument list:

```json
["ABSOLUTE_PATH_TO_REPO/dist/index.js", "<your-org>", "--authentication", "env"]
```

### Bearer Token Environment Variable

Use `envvar` to read a bearer token from `ADO_MCP_AUTH_TOKEN`. Set the variable in the environment that starts your MCP client, then add `"--authentication", "envvar"` to the server arguments.

```bash
export ADO_MCP_AUTH_TOKEN="<bearer-token>"
```

### Personal Access Token

Use `pat` to authenticate with an Azure DevOps [Personal Access Token](https://learn.microsoft.com/en-us/azure/devops/organizations/accounts/use-personal-access-tokens-to-authenticate). `PERSONAL_ACCESS_TOKEN` must contain the base64 encoding of `<email>:<pat>`. The email can be any non-empty value.

For example:

```bash
export PERSONAL_ACCESS_TOKEN="$(printf '%s' '<email>:<pat>' | base64)"
```

Then add `"--authentication", "pat"` to the server arguments.

> [!IMPORTANT]
> Do not commit tokens to an MCP configuration file. Set them outside the file or use a secrets manager.

## Visual Studio Code

1. Create `.vscode/mcp.json` in your project.
2. Add this configuration:

```json
{
  "inputs": [
    {
      "id": "ado_org",
      "type": "promptString",
      "description": "Azure DevOps organization name  (e.g. 'contoso')"
    }
  ],
  "servers": {
    "ado": {
      "type": "stdio",
      "command": "node",
      "args": ["ABSOLUTE_PATH_TO_REPO/dist/index.js", "${input:ado_org}"]
    }
  }
}
```

3. Save the file and start `ado` from the MCP view.
4. Open GitHub Copilot Chat and switch to [Agent mode](https://code.visualstudio.com/blogs/2025/02/24/introducing-copilot-agent-mode).
5. Select the Azure DevOps tools and try `List ADO projects`.
6. Sign in with an account that can access the selected organization.

> [!NOTE]
> VS Code's Agent Host does not support MCP configurations that require `${input:...}` prompts. If you use Agent Host, replace `${input:ado_org}` with your organization name or move the configuration to a workspace `.mcp.json` file.

## Visual Studio

Use Visual Studio 2022 version 17.14 or later, or Visual Studio 2026.

1. Create `.mcp.json` in the solution folder.
2. Add this configuration:

```json
{
  "inputs": [
    {
      "id": "ado_org",
      "type": "promptString",
      "description": "Azure DevOps organization name  (e.g. 'contoso')"
    }
  ],
  "servers": {
    "ado": {
      "type": "stdio",
      "command": "node",
      "args": ["ABSOLUTE_PATH_TO_REPO/dist/index.js", "${input:ado_org}"]
    }
  }
}
```

3. Save the file and enter your organization name when prompted.
4. Open Copilot Chat and select **Agent** from the mode selector.
5. Open the tool picker, select the `ado` tools, and try `List ADO projects`.

See the [Visual Studio MCP server documentation](https://learn.microsoft.com/en-us/visualstudio/ide/mcp-servers?view=vs-2022) for more details.

## GitHub Copilot CLI

Use the Copilot CLI to interactively add the MCP server:

```bash
/mcp add
```

Alternatively, create or edit the configuration file `~/.copilot/mcp-config.json` and add:

```json
{
  "mcpServers": {
    "ado": {
      "command": "node",
      "args": ["ABSOLUTE_PATH_TO_REPO/dist/index.js", "{Contoso}"],
      "tools": ["*"]
    }
  }
}
```

Replace `{Contoso}` with your Azure DevOps organization name.

For more information, see the [Copilot CLI documentation](https://docs.github.com/en/copilot/concepts/agents/about-copilot-cli).

## Codex

Codex can run Azure DevOps MCP Safe as a local stdio MCP server from either the Codex CLI or IDE extension. The configuration is shared through `~/.codex/config.toml`.

### Interactive Authentication

For local development, start with the default interactive authentication flow:

```bash
codex mcp add azure-devops-safe -- node ABSOLUTE_PATH_TO_REPO/dist/index.js Contoso
```

Replace `Contoso` with your Azure DevOps organization name.

Verify that Codex can see the server:

```bash
codex mcp list
```

On first use of an Azure DevOps tool, the MCP server opens a browser window for Microsoft account sign-in. Use an account that has access to the selected Azure DevOps organization.

### Azure CLI Authentication

If your workstation already uses Azure CLI sign-in, authenticate first and configure the MCP server with `azcli`:

```bash
az login
codex mcp add azure-devops-safe -- node ABSOLUTE_PATH_TO_REPO/dist/index.js Contoso --authentication azcli
```

### Manual Configuration

You can also edit `~/.codex/config.toml` directly:

```toml
[mcp_servers.azure-devops]
command = "node"
args = ["ABSOLUTE_PATH_TO_REPO/dist/index.js", "Contoso"]
```

Restart Codex after editing the config manually, then ask for a simple read-only operation such as `List ADO projects`.

## Claude Code

See the [Claude Code MCP documentation](https://docs.anthropic.com/en/docs/claude-code/mcp) for general guidance.

For Azure DevOps MCP Safe, use the following command:

```bash
claude mcp add --transport stdio azure-devops-safe -- node ABSOLUTE_PATH_TO_REPO/dist/index.js Contoso
```

Replace `Contoso` with your organization name, then verify the connection:

```bash
claude mcp list
```

## Claude Desktop

1. Open **File > Settings > Developer** in Claude Desktop.
2. Select **Edit Config** and add this configuration:

```json
{
  "mcpServers": {
    "ado": {
      "command": "node",
      "args": ["ABSOLUTE_PATH_TO_REPO/dist/index.js", "{Contoso}"]
    }
  }
}
```

3. Replace `{Contoso}` with your organization name, save the file, completely quit Claude Desktop, and restart it.
4. Start a chat, select **Add files, connectors, and more > Connectors**, confirm that `ado` is available, and try `List ADO projects`.

For additional guidance on Claude Desktop, see the [Quickstart](https://modelcontextprotocol.io/quickstart/user#installing-the-filesystem-server).

## Cursor

Create `.cursor/mcp.json` in your project and add:

```json
{
  "mcpServers": {
    "ado": {
      "command": "node",
      "args": ["ABSOLUTE_PATH_TO_REPO/dist/index.js", "{Contoso}"]
    }
  }
}
```

Replace `{Contoso}` with your organization name and save the file. Open **Cursor Settings > Tools & Integrations**, confirm that the `ado` MCP server is enabled, and use its tools in Agent chat.

See the [Cursor MCP documentation](https://cursor.com/docs/context/mcp) for global configuration and server management options.

## OpenCode

Add Azure DevOps MCP Safe to your OpenCode configuration file.

On macOS or Linux, edit `~/.config/opencode/opencode.json` and add the `azure-devops` entry under `mcp`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "azure-devops": {
      "type": "local",
      "command": ["node", "ABSOLUTE_PATH_TO_REPO/dist/index.js", "<your-org>"],
      "enabled": true
    }
  }
}
```

Replace `<your-org>` with your Azure DevOps organization name.

> [!NOTE]
> OpenCode starts the interactive Microsoft account sign-in on first use.

> **Tip:** Limit loaded tools using domain filtering by appending `-d` flags to the command:
>
> ```json
> ["node", "ABSOLUTE_PATH_TO_REPO/dist/index.js", "<your-org>", "-d", "core", "work", "work-items"]
> ```
>
> Standard domains: `core`, `work`, `work-items`, `repositories`, `wiki`, `pipelines`, `search`, `test-plans`, `advanced-security`. The diagnostic `mcp-apps` domain is available only when explicitly selected.

For more on OpenCode MCP configuration, see the [OpenCode MCP documentation](https://opencode.ai/docs/mcp-servers/).

## Kilo Code

Kilo Code supports global configuration for all workspaces and project configuration for one repository.

### Global Configuration

1. Open **Agent Behaviour > MCP Servers** in the Kilo Code pane.
2. Select **Edit Global MCP** to open `mcp_settings.json`.
3. Add the `azure-devops` entry:

```json
{
  "mcpServers": {
    "azure-devops": {
      "command": "node",
      "args": ["ABSOLUTE_PATH_TO_REPO/dist/index.js", "<your-org>"]
    }
  }
}
```

### Project Configuration

Create `.kilocode/mcp.json` in your project root with the same content as above. This file can be committed to version control to share the setup with your team.

Replace `<your-org>` with your Azure DevOps organization name. On first use, a browser window will open for Microsoft account login.

For more on Kilo Code MCP configuration, see the [Kilo Code MCP documentation](https://kilo.ai/docs/automate/mcp/using-in-kilo-code).
