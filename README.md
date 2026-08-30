# Azure DevOps MCP Safe

Azure DevOps MCP Safe is an independently maintained local Model Context Protocol (MCP) server for read-only access to Azure DevOps.

The server can download attachments and artifacts to local files, but it cannot create, update, delete, approve, queue, assign, comment on, or otherwise mutate Azure DevOps resources. It also caches Azure DevOps organization tenant IDs in `~/.ado_orgs.cache` for up to one week; the cache contains tenant IDs and timestamps, not credentials.

> [!IMPORTANT]
> This is an independent fork of [Microsoft's Azure DevOps MCP Server](https://github.com/microsoft/azure-devops-mcp). It is not affiliated with or endorsed by Microsoft.

## Table of Contents

1. [Overview](#overview)
2. [Design](#design)
3. [Supported Tools](#supported-tools)
4. [Installation](#installation)
5. [Using Domains](#using-domains)
6. [Project and Team Defaults](#project-and-team-defaults)
7. [Troubleshooting](#troubleshooting)
8. [Examples](#examples)
9. [Frequently Asked Questions](#frequently-asked-questions)

## Overview

Azure DevOps MCP Safe brings Azure DevOps context to your agents without exposing mutation tools. Try prompts like:

- "List my ADO projects"
- "List ADO Builds for 'Contoso'"
- "List ADO Repos for 'Contoso'"
- "List test plans for 'Contoso'"
- "List teams for project 'Contoso'"
- "List iterations for project 'Contoso'"
- "List my work items for project 'Contoso'"
- "List work items in current iteration for 'Contoso' project and 'Contoso Team'"
- "List all wikis in the 'Contoso' project"
- "Get the content of the wiki page '/API/Authentication' from the Documentation wiki"

## Design

Each tool handles a focused Azure DevOps task. The server provides a thin layer over the REST APIs, while the AI agent handles higher-level reasoning.

## Supported Tools

For the complete list of read-only tools, see [TOOLSET.md](./docs/TOOLSET.md).

## Installation

These steps use Visual Studio Code and GitHub Copilot. For other supported clients, including Visual Studio 2022, Codex, Claude Code, Cursor, OpenCode, and Kilo Code, see the [getting started guide](./docs/GETTINGSTARTED.md).

### Prerequisites

1. Install [VS Code](https://code.visualstudio.com/download) or [VS Code Insiders](https://code.visualstudio.com/insiders).
2. Install [Node.js 20 or later](https://nodejs.org/en/download).
3. Open your project in VS Code.

#### Run the alpha release from npm

Create `.vscode/mcp.json` in the project where you want to use the server:

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
      "command": "npx",
      "args": ["-y", "azure-devops-mcp-safe@alpha", "${input:ado_org}"]
    }
  }
}
```

Using the `alpha` tag opts into the newest alpha release without selecting a specific prerelease version.

#### Build from source

1. Clone and build this repository:

   ```sh
   git clone https://github.com/t0nyba11/azure-devops-mcp-safe.git
   cd azure-devops-mcp-safe
   npm ci
   npm run build
   ```

2. Create `.vscode/mcp.json` in the project where you want to use the server.
3. Add this configuration, replacing `ABSOLUTE_PATH_TO_REPO` with the absolute path to your clone:

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

4. Save the file, then start the `ado` server from the MCP view in VS Code.
5. Open GitHub Copilot Chat and switch to [Agent mode](https://code.visualstudio.com/blogs/2025/02/24/introducing-copilot-agent-mode).
6. Select the Azure DevOps tools, then try a prompt such as `List ADO projects`.
7. When prompted, sign in with a Microsoft account that has access to the selected Azure DevOps organization.

For better tool selection, add `.github/copilot-instructions.md` to your project with this instruction:

```text
This project uses Azure DevOps. Always check whether Azure DevOps MCP Safe has a relevant read-only tool.
```

## Using Domains

The local server includes many tools. Domains let you load only the tool groups you need, which keeps the tool list manageable and helps clients with tool limits. Standard domains are `core`, `work`, `work-items`, `search`, `test-plans`, `repositories`, `wiki`, `pipelines`, and `advanced-security`. The diagnostic `mcp-apps` domain is available only when explicitly selected.

Add `-d` followed by the domains to the server arguments. For example, this configuration loads only work item-related tools:

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
    "ado_with_filtered_domains": {
      "type": "stdio",
      "command": "node",
      "args": ["ABSOLUTE_PATH_TO_REPO/dist/index.js", "${input:ado_org}", "-d", "core", "work", "work-items"]
    }
  }
}
```

Always include `core` so the agent can retrieve project information.

> If you omit `-d`, the server loads all standard domains. The `mcp-apps` domain must be enabled explicitly with `-d mcp-apps`.

## Project and Team Defaults

Set default Azure DevOps project and team values in `.vscode/mcp.json` so tools can skip selection prompts.

### Example `.vscode/mcp.json`

```json
{
  "servers": {
    "ado": {
      "type": "stdio",
      "command": "node",
      "args": ["ABSOLUTE_PATH_TO_REPO/dist/index.js", "myorg", "--authentication", "azcli"],
      "env": {
        "ado_mcp_project": "Contoso",
        "ado_mcp_team": "Fabrikam Team"
      }
    }
  }
}
```

## Troubleshooting

See the [Troubleshooting guide](./docs/TROUBLESHOOTING.md) for help with common issues and logging.

## Examples

See the [examples](./docs/EXAMPLES.md) for sample prompts.

## Frequently Asked Questions

For answers to common questions about Azure DevOps MCP Safe, see the [Frequently Asked Questions](./docs/FAQ.md).

## License

Licensed under the [MIT License](./LICENSE.md).
