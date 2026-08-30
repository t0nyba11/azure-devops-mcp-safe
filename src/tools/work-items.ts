// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as fs from "fs";
import * as path from "path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { WorkItemExpand } from "azure-devops-node-api/interfaces/WorkItemTrackingInterfaces.js";
import { QueryExpand } from "azure-devops-node-api/interfaces/WorkItemTrackingInterfaces.js";
import { z } from "zod";
import { getEnumKeys, safeEnumConvert } from "../utils.js";
import { elicitProject, elicitTeam } from "../shared/elicitations.js";
import { createExternalContentResponse } from "../shared/content-safety.js";

const WORKITEM_TOOLS = {
  wit_work_item: "wit_work_item",
  wit_query: "wit_query",
  wit_backlog: "wit_backlog",
  wit_work_item_attachment: "wit_work_item_attachment",
};

function configureWorkItemTools(server: McpServer, tokenProvider: () => Promise<string>, connectionProvider: () => Promise<WebApi>) {
  // --- wit_work_item ----------------------------------------------------------
  server.tool(
    WORKITEM_TOOLS.wit_work_item,
    "Retrieve work item data for a project. Use the action parameter to specify the operation.",
    {
      action: z
        .enum(["get", "get_batch", "list_comments", "my", "list_revisions", "list_for_iteration", "get_type"])
        .describe(
          "The action to perform. Options: get (get a single work item by ID), get_batch (get multiple work items by IDs), list_comments (list comments on a work item), my (get work items relevant to the authenticated user), list_revisions (list revisions of a work item), list_for_iteration (list work items for a team iteration), get_type (get metadata for a work item type)."
        ),
      project: z.string().optional().describe("The name or ID of the Azure DevOps project. Reuse from prior context if already known. If not provided, a project selection prompt will be shown."),
      id: z.coerce.number().min(1).optional().describe("Work item ID. Required for: get."),
      ids: z.array(z.coerce.number().min(1)).optional().describe("Work item IDs. Required for: get_batch."),
      workItemId: z.coerce.number().min(1).optional().describe("Work item ID. Required for: list_comments, list_revisions."),
      fields: z.array(z.string()).optional().describe("Field names to include in the response. Used for: get, get_batch. For get, cannot be combined with expand."),
      asOf: z.coerce.date().optional().describe("Retrieve the work item as of a specific date. Used for: get."),
      expand: z
        .enum(getEnumKeys(WorkItemExpand) as [string, ...string[]])
        .optional()
        .describe("Expand options (None, Fields, Relations, Links, All). Used for: get, list_revisions. For get, cannot be combined with fields."),
      top: z.coerce.number().optional().describe("Maximum number of results to return. Used for: list_comments, my, list_revisions. Defaults vary by action."),
      includeCompleted: z.boolean().optional().default(false).describe("Include completed work items. Used for: my. Defaults to false."),
      type: z.enum(["assignedtome", "myactivity"]).optional().describe("Type of work items to retrieve. Used for: my. Defaults to 'assignedtome'."),
      skip: z.coerce.number().optional().describe("Number of results to skip for pagination. Used for: list_revisions."),
      team: z.string().optional().describe("Team name or ID. Used for: list_for_iteration."),
      iterationId: z.string().optional().describe("Iteration ID. Required for: list_for_iteration."),
      workItemType: z.string().optional().describe("Work item type name. Required for: get_type."),
    },
    async ({ action, project, id, ids, workItemId, fields, asOf, expand, top, includeCompleted, type, skip, team, iterationId, workItemType }) => {
      try {
        const connection = await connectionProvider();

        let resolvedProject = project;

        if (action === "get") {
          if (!id) return { content: [{ type: "text", text: "id is required for get" }], isError: true };
          if (!resolvedProject) {
            const result = await elicitProject(server, connection, "Select the Azure DevOps project to retrieve the work item from.");
            if ("response" in result) return result.response;
            resolvedProject = result.resolved;
          }
          let effectiveExpand = expand;
          if (fields && fields.length > 0 && effectiveExpand != null) {
            effectiveExpand = "none";
          }
          const workItemApi = await connection.getWorkItemTrackingApi();
          const workItem = await workItemApi.getWorkItem(id, fields, asOf, effectiveExpand as unknown as WorkItemExpand, resolvedProject);
          return { content: [{ type: "text", text: JSON.stringify(workItem, null, 2) }] };
        }

        if (action === "get_batch") {
          if (!ids || ids.length === 0) return { content: [{ type: "text", text: "ids is required for get_batch" }], isError: true };
          if (!resolvedProject) {
            const result = await elicitProject(server, connection, "Select the Azure DevOps project to retrieve work items for.");
            if ("response" in result) return result.response;
            resolvedProject = result.resolved;
          }
          const workItemApi = await connection.getWorkItemTrackingApi();
          const defaultFields = ["System.Id", "System.WorkItemType", "System.Title", "System.State", "System.Parent", "System.Tags", "Microsoft.VSTS.Common.StackRank", "System.AssignedTo"];
          const fieldsToUse = !fields || fields.length === 0 ? defaultFields : fields;
          const workitems = await workItemApi.getWorkItemsBatch({ ids, fields: fieldsToUse }, resolvedProject);

          const identityFields = [
            "System.AssignedTo",
            "System.CreatedBy",
            "System.ChangedBy",
            "System.AuthorizedAs",
            "Microsoft.VSTS.Common.ActivatedBy",
            "Microsoft.VSTS.Common.ResolvedBy",
            "Microsoft.VSTS.Common.ClosedBy",
          ];

          if (workitems && Array.isArray(workitems)) {
            workitems.forEach((item) => {
              if (item.fields) {
                identityFields.forEach((fieldName) => {
                  if (item.fields && item.fields[fieldName] && typeof item.fields[fieldName] === "object") {
                    const identityField = item.fields[fieldName];
                    const name = identityField.displayName || "";
                    const email = identityField.uniqueName || "";
                    item.fields[fieldName] = `${name} <${email}>`.trim();
                  }
                });
              }
            });
          }
          return { content: [{ type: "text", text: JSON.stringify(workitems, null, 2) }] };
        }

        if (action === "list_comments") {
          if (!workItemId) return { content: [{ type: "text", text: "workItemId is required for list_comments" }], isError: true };
          if (!resolvedProject) {
            const result = await elicitProject(server, connection, "Select the Azure DevOps project to list work item comments for.");
            if ("response" in result) return result.response;
            resolvedProject = result.resolved;
          }
          const workItemApi = await connection.getWorkItemTrackingApi();
          const comments = await workItemApi.getComments(resolvedProject, workItemId, top ?? 50);
          return { content: [{ type: "text", text: JSON.stringify(comments, null, 2) }] };
        }

        if (action === "my") {
          if (!resolvedProject) {
            const result = await elicitProject(server, connection, "Select the Azure DevOps project to retrieve work items for.");
            if ("response" in result) return result.response;
            resolvedProject = result.resolved;
          }
          const workApi = await connection.getWorkApi();
          const workItems = await workApi.getPredefinedQueryResults(resolvedProject, type ?? "assignedtome", top ?? 50, includeCompleted ?? false);
          return { content: [{ type: "text", text: JSON.stringify(workItems, null, 2) }] };
        }

        if (action === "list_revisions") {
          if (!workItemId) return { content: [{ type: "text", text: "workItemId is required for list_revisions" }], isError: true };
          if (!resolvedProject) {
            const result = await elicitProject(server, connection, "Select the Azure DevOps project to list work item revisions for.");
            if ("response" in result) return result.response;
            resolvedProject = result.resolved;
          }
          const workItemApi = await connection.getWorkItemTrackingApi();
          const revisions = await workItemApi.getRevisions(workItemId, top ?? 50, skip, safeEnumConvert(WorkItemExpand, expand), resolvedProject);

          if (revisions && Array.isArray(revisions)) {
            revisions.forEach((revision) => {
              if (revision.fields) {
                const revFields = revision.fields;
                Object.keys(revFields).forEach((fieldName) => {
                  const fieldValue = revFields[fieldName];
                  if (
                    fieldValue &&
                    typeof fieldValue === "object" &&
                    !Array.isArray(fieldValue) &&
                    "displayName" in fieldValue &&
                    ("url" in fieldValue || "_links" in fieldValue || "uniqueName" in fieldValue)
                  ) {
                    delete fieldValue.url;
                    delete fieldValue._links;
                    delete fieldValue.id;
                    delete fieldValue.uniqueName;
                    delete fieldValue.imageUrl;
                    delete fieldValue.descriptor;
                  }
                });
              }
            });
          }
          return { content: [{ type: "text", text: JSON.stringify(revisions, null, 2) }] };
        }

        if (action === "list_for_iteration") {
          if (!iterationId) return { content: [{ type: "text", text: "iterationId is required for list_for_iteration" }], isError: true };
          if (!resolvedProject) {
            const result = await elicitProject(server, connection, "Select the Azure DevOps project to retrieve work items for iteration.");
            if ("response" in result) return result.response;
            resolvedProject = result.resolved;
          }
          const workApi = await connection.getWorkApi();
          const workItems = await workApi.getIterationWorkItems({ project: resolvedProject, team }, iterationId);
          return { content: [{ type: "text", text: JSON.stringify(workItems, null, 2) }] };
        }

        if (action === "get_type") {
          if (!workItemType) return { content: [{ type: "text", text: "workItemType is required for get_type" }], isError: true };
          if (!resolvedProject) {
            const result = await elicitProject(server, connection, "Select the Azure DevOps project to retrieve the work item type from.");
            if ("response" in result) return result.response;
            resolvedProject = result.resolved;
          }
          const workItemApi = await connection.getWorkItemTrackingApi();
          const workItemTypeInfo = await workItemApi.getWorkItemType(resolvedProject, workItemType);
          return { content: [{ type: "text", text: JSON.stringify(workItemTypeInfo, null, 2) }] };
        }

        return { content: [{ type: "text", text: `Unknown action: ${action}` }], isError: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        const msgs: Record<string, string> = {
          get: `Error retrieving work item: ${errorMessage}`,
          get_batch: `Error retrieving work items batch: ${errorMessage}`,
          list_comments: `Error listing work item comments: ${errorMessage}`,
          my: `Error retrieving work items: ${errorMessage}`,
          list_revisions: `Error listing work item revisions: ${errorMessage}`,
          list_for_iteration: `Error retrieving work items for iteration: ${errorMessage}`,
          get_type: `Error retrieving work item type: ${errorMessage}`,
        };
        return { content: [{ type: "text", text: msgs[action] ?? `Error: ${errorMessage}` }], isError: true };
      }
    }
  );

  // --- wit_query --------------------------------------------------------------
  server.tool(
    WORKITEM_TOOLS.wit_query,
    "Retrieve work item query data for a project. Use the action parameter to specify the operation.",
    {
      action: z
        .enum(["get", "get_results", "wiql"])
        .describe("The action to perform. Options: get (get a query by ID or path), get_results (run a saved query and return results), wiql (execute an ad-hoc WIQL query)."),
      project: z.string().optional().describe("The name or ID of the Azure DevOps project. Reuse from prior context if already known. If not provided, a project selection prompt will be shown."),
      query: z.string().optional().describe("The ID or path of the query. Required for: get."),
      expand: z
        .enum(getEnumKeys(QueryExpand) as [string, ...string[]])
        .optional()
        .describe("Expand parameter to include additional details. Used for: get."),
      depth: z.coerce.number().default(0).describe("Depth of expansion. Used for: get. Defaults to 0."),
      includeDeleted: z.boolean().default(false).describe("Include deleted items. Used for: get. Defaults to false."),
      useIsoDateFormat: z.boolean().default(false).describe("Use ISO date format in the response. Used for: get. Defaults to false."),
      id: z.string().optional().describe("The ID of the saved query. Required for: get_results."),
      team: z.string().optional().describe("Team name or ID. Used for: get_results, wiql."),
      timePrecision: z.boolean().optional().describe("Include time precision in date fields. Used for: get_results, wiql."),
      top: z.coerce.number().default(50).describe("Maximum number of results to return. Used for: get_results, wiql. Defaults to 50."),
      responseType: z.enum(["full", "ids"]).default("full").describe("Response type: 'full' returns complete results (default), 'ids' returns only work item IDs. Used for: get_results."),
      wiql: z.string().max(32768).optional().describe('The WIQL query string to execute. Required for: wiql. Example: "SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = @project".'),
    },
    async ({ action, project, query, expand, depth, includeDeleted, useIsoDateFormat, id, team, timePrecision, top, responseType, wiql }) => {
      try {
        const connection = await connectionProvider();

        let resolvedProject = project;
        if (!resolvedProject) {
          const result = await elicitProject(server, connection, `Select the Azure DevOps project for ${action}.`);
          if ("response" in result) return result.response;
          resolvedProject = result.resolved;
        }

        if (action === "get") {
          if (!query) return { content: [{ type: "text", text: "query is required for get" }], isError: true };
          const workItemApi = await connection.getWorkItemTrackingApi();
          const queryDetails = await workItemApi.getQuery(resolvedProject, query, safeEnumConvert(QueryExpand, expand), depth, includeDeleted, useIsoDateFormat);
          return { content: [{ type: "text", text: JSON.stringify(queryDetails, null, 2) }] };
        }

        if (action === "get_results") {
          if (!id) return { content: [{ type: "text", text: "id is required for get_results" }], isError: true };
          const workItemApi = await connection.getWorkItemTrackingApi();
          const teamContext = { project: resolvedProject, team };
          const queryResult = await workItemApi.queryById(id, teamContext, timePrecision, top);
          if (responseType === "ids") {
            const ids = queryResult.workItems?.map((workItem) => workItem.id).filter((wid): wid is number => wid !== undefined) || [];
            return { content: [{ type: "text", text: JSON.stringify({ ids, count: ids.length }, null, 2) }] };
          }
          return { content: [{ type: "text", text: JSON.stringify(queryResult, null, 2) }] };
        }

        if (action === "wiql") {
          if (!wiql) return { content: [{ type: "text", text: "wiql is required for wiql" }], isError: true };
          const workItemApi = await connection.getWorkItemTrackingApi();
          const teamContext = { project: resolvedProject, team };
          const queryResult = await workItemApi.queryByWiql({ query: wiql }, teamContext, timePrecision, top);
          return createExternalContentResponse(queryResult, "wiql query results");
        }

        return { content: [{ type: "text", text: `Unknown action: ${action}` }], isError: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        const msgs: Record<string, string> = {
          get: `Error retrieving query: ${errorMessage}`,
          get_results: `Error retrieving query results: ${errorMessage}`,
          wiql: `Error executing WIQL query: ${errorMessage}`,
        };
        return { content: [{ type: "text", text: msgs[action] ?? `Error: ${errorMessage}` }], isError: true };
      }
    }
  );

  // --- wit_backlog ------------------------------------------------------------
  server.tool(
    WORKITEM_TOOLS.wit_backlog,
    "Retrieve backlog data for a project and team. Use the action parameter to specify the operation.",
    {
      action: z.enum(["list", "list_work_items"]).describe("The action to perform. Options: list (list backlog levels for a team), list_work_items (list work items in a specific backlog level)."),
      project: z.string().optional().describe("The name or ID of the Azure DevOps project. Reuse from prior context if already known. If not provided, a project selection prompt will be shown."),
      team: z.string().optional().describe("The name or ID of the Azure DevOps team. Reuse from prior context if already known. If not provided, a team selection prompt will be shown."),
      backlogId: z.string().optional().describe("The ID of the backlog category to retrieve work items from. Required for: list_work_items."),
    },
    async ({ action, project, team, backlogId }) => {
      try {
        const connection = await connectionProvider();

        let resolvedProject = project;
        if (!resolvedProject) {
          const label = action === "list" ? "list backlogs" : "list backlog work items";
          const result = await elicitProject(server, connection, `Select the Azure DevOps project to ${label} for.`);
          if ("response" in result) return result.response;
          resolvedProject = result.resolved;
        }

        let resolvedTeam = team;
        if (!resolvedTeam) {
          const label = action === "list" ? "list backlogs" : "list backlog work items";
          const result = await elicitTeam(server, connection, resolvedProject, `Select the Azure DevOps team to ${label} for.`);
          if ("response" in result) return result.response;
          resolvedTeam = result.resolved;
        }

        const workApi = await connection.getWorkApi();
        const teamContext = { project: resolvedProject, team: resolvedTeam };

        if (action === "list") {
          const backlogs = await workApi.getBacklogs(teamContext);
          return { content: [{ type: "text", text: JSON.stringify(backlogs, null, 2) }] };
        }

        if (action === "list_work_items") {
          if (!backlogId) return { content: [{ type: "text", text: "backlogId is required for list_work_items" }], isError: true };
          const workItems = await workApi.getBacklogLevelWorkItems(teamContext, backlogId);
          return { content: [{ type: "text", text: JSON.stringify(workItems, null, 2) }] };
        }

        return { content: [{ type: "text", text: `Unknown action: ${action}` }], isError: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        const msgs: Record<string, string> = {
          list: `Error listing backlogs: ${errorMessage}`,
          list_work_items: `Error listing backlog work items: ${errorMessage}`,
        };
        return { content: [{ type: "text", text: msgs[action] ?? `Error: ${errorMessage}` }], isError: true };
      }
    }
  );

  // --- wit_work_item_attachment -----------------------------------------------
  server.tool(
    WORKITEM_TOOLS.wit_work_item_attachment,
    "Download a work item attachment by its ID. By default returns the content as a base64-encoded resource. If savePath is provided, saves the file locally to that directory and returns the file path instead. Useful for viewing images (e.g. screenshots) or other files attached to work items such as bugs. If a project is not specified, you will be prompted to select one.",
    {
      project: z.string().optional().describe("The name or ID of the Azure DevOps project. Reuse from prior context if already known. If not provided, a project selection prompt will be shown."),
      attachmentId: z.string().describe("The GUID of the attachment. Found in the attachment URL: https://dev.azure.com/{org}/{project}/_apis/wit/attachments/{attachmentId}"),
      fileName: z.string().optional().describe("The file name of the attachment, e.g. 'screenshot.png'. Used to determine the MIME type or the saved file's name."),
      savePath: z
        .string()
        .optional()
        .describe(
          "Optional local directory path where the file should be saved. Must be a relative path (e.g. 'temp' or 'downloads/attachments'); absolute paths and path traversals are not allowed. If provided, saves the attachment to this directory and returns the file path. If omitted, returns the content as a base64-encoded resource."
        ),
    },
    async ({ project, attachmentId, fileName, savePath }) => {
      const isAbsolutePath = (value: string) => path.posix.isAbsolute(value) || path.win32.isAbsolute(value);
      const hasDriveLetter = (value: string) => /^[a-zA-Z]:/.test(value);

      if (savePath !== undefined && (savePath.includes("..") || isAbsolutePath(savePath) || hasDriveLetter(savePath))) {
        throw new Error("Invalid savePath: absolute paths and path traversals are not allowed.");
      }

      if (fileName !== undefined && fileName.includes("..")) {
        throw new Error("Invalid fileName: path traversal is not allowed.");
      }

      try {
        const connection = await connectionProvider();

        let resolvedProject = project;
        if (!resolvedProject) {
          const result = await elicitProject(server, connection, "Select the Azure DevOps project to retrieve the work item attachment from.");
          if ("response" in result) return result.response;
          resolvedProject = result.resolved;
        }

        const workItemApi = await connection.getWorkItemTrackingApi();
        const stream = await workItemApi.getAttachmentContent(attachmentId, fileName, resolvedProject);

        const chunks: Buffer[] = [];
        await new Promise<void>((resolve, reject) => {
          stream.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
          stream.on("end", resolve);
          stream.on("error", reject);
        });

        const buffer = Buffer.concat(chunks);

        if (savePath) {
          const resolvedFileName = fileName ?? attachmentId;
          const localFilePath = path.join(savePath, resolvedFileName);

          if (fs.existsSync(localFilePath)) {
            throw new Error(`File already exists: ${localFilePath}`);
          }

          fs.writeFileSync(localFilePath, buffer);

          return {
            content: [{ type: "text", text: `Attachment saved to: ${localFilePath}` }],
          };
        }

        const mimeType = getMimeType(fileName);

        if (mimeType.startsWith("text/")) {
          return {
            content: [{ type: "text", text: buffer.toString("utf-8") }],
          };
        }

        const base64Data = buffer.toString("base64");
        return {
          content: [
            {
              type: "resource",
              resource: {
                uri: `data:${mimeType};base64,${base64Data}`,
                mimeType,
                blob: base64Data,
              },
            },
          ],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return {
          content: [{ type: "text", text: `Error retrieving work item attachment: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );
}

function getMimeType(fileName: string | undefined): string {
  const ext = fileName?.split(".").pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    bmp: "image/bmp",
    svg: "image/svg+xml",
    webp: "image/webp",
    pdf: "application/pdf",
    txt: "text/plain",
    md: "text/markdown",
    markdown: "text/markdown",
    csv: "text/csv",
    html: "text/html",
    htm: "text/html",
    xml: "text/xml",
    json: "application/json",
    yaml: "text/yaml",
    yml: "text/yaml",
    zip: "application/zip",
  };
  return (ext && mimeTypes[ext]) ?? "application/octet-stream";
}

export { WORKITEM_TOOLS, configureWorkItemTools };
