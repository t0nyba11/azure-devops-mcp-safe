// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { z } from "zod";
import { TreeNodeStructureType, WorkItemClassificationNode } from "azure-devops-node-api/interfaces/WorkItemTrackingInterfaces.js";
import { elicitProject, elicitTeam } from "../shared/elicitations.js";

const WORK_TOOLS = {
  work: "work",
};

function configureWorkTools(server: McpServer, _: () => Promise<string>, connectionProvider: () => Promise<WebApi>) {
  server.tool(
    WORK_TOOLS.work,
    "Retrieve work-related data for a project or team. Use the action parameter to specify the operation.",
    {
      action: z
        .enum(["list_iterations", "list_team_iterations", "get_team_settings", "get_team_capacity", "get_iteration_capacities"])
        .describe(
          "The action to perform. Options: list_iterations (list all iterations in a project), list_team_iterations (list iterations assigned to a team), get_team_settings (get team settings including default iteration and area path), get_team_capacity (get team capacity for an iteration), get_iteration_capacities (get capacity for all teams in an iteration)."
        ),
      project: z.string().optional().describe("The name or ID of the Azure DevOps project. Reuse from prior context if already known. If not provided, a project selection prompt will be shown."),
      team: z
        .string()
        .optional()
        .describe("The name or ID of the Azure DevOps team. Required for list_team_iterations, get_team_settings, and get_team_capacity. Reuse from prior context if already known."),
      iterationId: z.string().optional().describe("The Iteration ID. Required for get_team_capacity and get_iteration_capacities."),
      timeframe: z.enum(["current"]).optional().describe("The timeframe for list_team_iterations. Only 'current' is supported."),
      depth: z.coerce.number().default(2).describe("Depth of children to fetch. Used for list_iterations. Defaults to 2."),
      excludedIds: z.array(z.coerce.number().min(1)).optional().describe("An optional array of iteration IDs, and their children, to exclude from results. Used for list_iterations."),
    },
    async ({ action, project, team, iterationId, timeframe, depth, excludedIds }) => {
      try {
        const connection = await connectionProvider();
        let resolvedProject = project;

        if (action === "list_team_iterations") {
          if (!resolvedProject) {
            const result = await elicitProject(server, connection, "Select the Azure DevOps project to list team iterations for.");
            if ("response" in result) return result.response;
            resolvedProject = result.resolved;
          }

          let resolvedTeam = team;
          if (!resolvedTeam) {
            const result = await elicitTeam(server, connection, resolvedProject, "Select the Azure DevOps team to list iterations for.");
            if ("response" in result) return result.response;
            resolvedTeam = result.resolved;
          }

          const workApi = await connection.getWorkApi();
          const iterations = await workApi.getTeamIterations({ project: resolvedProject, team: resolvedTeam }, timeframe);

          if (!iterations) {
            return { content: [{ type: "text", text: "No iterations found" }], isError: true };
          }

          return {
            content: [
              { type: "text", text: `Project: ${resolvedProject}, Team: ${resolvedTeam}` },
              { type: "text", text: JSON.stringify(iterations, null, 2) },
            ],
          };
        }

        if (action === "list_iterations") {
          if (!resolvedProject) {
            const result = await elicitProject(server, connection, "Select the Azure DevOps project to list iterations for.");
            if ("response" in result) return result.response;
            resolvedProject = result.resolved;
          }

          const workItemTrackingApi = await connection.getWorkItemTrackingApi();
          const effectiveDepth = depth ?? 1;
          const results = await workItemTrackingApi.getClassificationNodes(resolvedProject, [], effectiveDepth);

          if (!results) {
            return { content: [{ type: "text", text: "No iterations were found" }], isError: true };
          }

          let filteredResults = results.filter((node) => node.structureType === TreeNodeStructureType.Iteration);

          if (excludedIds && excludedIds.length > 0) {
            const filterOutIds = (nodes: WorkItemClassificationNode[]): WorkItemClassificationNode[] => {
              return nodes
                .filter((node) => !node.id || !excludedIds.includes(node.id))
                .map((node) => {
                  if (node.children && node.children.length > 0) {
                    return {
                      ...node,
                      children: filterOutIds(node.children),
                    };
                  }
                  return node;
                });
            };

            filteredResults = filterOutIds(filteredResults);
          }

          if (filteredResults.length === 0) {
            return { content: [{ type: "text", text: "No iterations were found" }], isError: true };
          }

          return {
            content: [{ type: "text", text: JSON.stringify(filteredResults, null, 2) }],
          };
        }

        if (action === "get_team_settings") {
          if (!resolvedProject) {
            const result = await elicitProject(server, connection, "Select the Azure DevOps project to get team settings for.");
            if ("response" in result) return result.response;
            resolvedProject = result.resolved;
          }

          let resolvedTeam = team;
          if (!resolvedTeam) {
            const result = await elicitTeam(server, connection, resolvedProject, "Select the Azure DevOps team to get settings for.");
            if ("response" in result) return result.response;
            resolvedTeam = result.resolved;
          }

          const workApi = await connection.getWorkApi();
          const teamContext = { project: resolvedProject, team: resolvedTeam };
          const teamSettings = await workApi.getTeamSettings(teamContext);

          if (!teamSettings) {
            return { content: [{ type: "text", text: "No team settings found" }], isError: true };
          }

          const teamFieldValues = await workApi.getTeamFieldValues(teamContext);

          const settingsResult = {
            backlogIteration: teamSettings.backlogIteration,
            defaultIteration: teamSettings.defaultIteration,
            defaultIterationMacro: teamSettings.defaultIterationMacro,
            backlogVisibilities: teamSettings.backlogVisibilities,
            bugsBehavior: teamSettings.bugsBehavior,
            workingDays: teamSettings.workingDays,
            defaultAreaPath: teamFieldValues?.defaultValue,
            areaPathField: teamFieldValues?.field,
            areaPaths: teamFieldValues?.values,
          };

          return {
            content: [
              { type: "text", text: `Project: ${resolvedProject}, Team: ${resolvedTeam}` },
              { type: "text", text: JSON.stringify(settingsResult, null, 2) },
            ],
          };
        }

        if (action === "get_team_capacity") {
          if (!resolvedProject) {
            const result = await elicitProject(server, connection, "Select the Azure DevOps project to get team capacity for.");
            if ("response" in result) return result.response;
            resolvedProject = result.resolved;
          }

          if (!team) {
            return { content: [{ type: "text", text: "Team is required for get_team_capacity" }], isError: true };
          }

          if (!iterationId) {
            return { content: [{ type: "text", text: "iterationId is required for get_team_capacity" }], isError: true };
          }

          const workApi = await connection.getWorkApi();
          const teamContext = { project: resolvedProject, team };

          const rawResults = await workApi.getCapacitiesWithIdentityRefAndTotals(teamContext, iterationId);

          if (!rawResults || rawResults.teamMembers?.length === 0) {
            return { content: [{ type: "text", text: "No team capacity assigned to the team" }], isError: true };
          }

          const simplifiedResults = {
            ...rawResults,
            teamMembers: (rawResults.teamMembers || []).map((member) => {
              const { url, ...rest } = member;
              return {
                ...rest,
                teamMember: member.teamMember
                  ? {
                      displayName: member.teamMember.displayName,
                      id: member.teamMember.id,
                      uniqueName: member.teamMember.uniqueName,
                    }
                  : undefined,
              };
            }),
          };

          return {
            content: [{ type: "text", text: JSON.stringify(simplifiedResults, null, 2) }],
          };
        }

        if (action === "get_iteration_capacities") {
          if (!resolvedProject) {
            const result = await elicitProject(server, connection, "Select the Azure DevOps project to get iteration capacities for.");
            if ("response" in result) return result.response;
            resolvedProject = result.resolved;
          }

          if (!iterationId) {
            return { content: [{ type: "text", text: "iterationId is required for get_iteration_capacities" }], isError: true };
          }

          const workApi = await connection.getWorkApi();
          const rawResults = await workApi.getTotalIterationCapacities(resolvedProject, iterationId);

          if (!rawResults || !rawResults.teams || rawResults.teams.length === 0) {
            return { content: [{ type: "text", text: "No iteration capacity assigned to the teams" }], isError: true };
          }

          return {
            content: [{ type: "text", text: JSON.stringify(rawResults, null, 2) }],
          };
        }

        return { content: [{ type: "text", text: `Unknown action: ${action}` }], isError: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

        const actionErrorMessages: Record<string, string> = {
          list_team_iterations: `Error fetching team iterations: ${errorMessage}`,
          list_iterations: `Error fetching iterations: ${errorMessage}`,
          get_team_settings: `Error fetching team settings: ${errorMessage}`,
          get_team_capacity: `Error getting team capacity: ${errorMessage}`,
          get_iteration_capacities: `Error getting iteration capacities: ${errorMessage}`,
        };

        return {
          content: [{ type: "text", text: actionErrorMessages[action] ?? `Error: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );
}

export { WORK_TOOLS, configureWorkTools };
