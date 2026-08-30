# Frequently Asked Questions

Before you get started, ensure you follow the steps in the `README.md` file. This will help you get up and running and connected to your Azure DevOps organization.

## Does Azure DevOps MCP Safe support both Azure DevOps Services and on-premises deployments?

Azure DevOps MCP Safe supports only Azure DevOps Services. Several required API endpoints are not available for on-premises deployments.

## Can I connect to more than one organization at a time?

No, you can connect to only one organization at a time. However, you can switch organizations as needed.

## Can I set a default project instead of fetching the list every time?

Yes. Set `ado_mcp_project` in the MCP server environment to a project name or ID. Set `ado_mcp_team` to provide a default team. When a required project or team is not supplied and no default is configured, supported tools ask the MCP client to present a selection form.

## Are PAT's supported?

Yes. Personal Access Tokens (PATs) are supported through the `pat` authentication type. See [Authentication](./GETTINGSTARTED.md#authentication) for setup instructions, including the required base64 encoding format.

## Is there a remote version of Azure DevOps MCP Safe?

No. This project provides only the local stdio server.

## Are personal accounts supported?

Unfortunately, personal accounts are not supported. To maintain a higher level of authentication and security, your account must be backed by Entra ID. If you receive an error message like this, it means you are using a personal account.

![image of login error for personal accounts](./media/personal-accounts-error.png)
