// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { z } from "zod";
import { apiVersion } from "../utils.js";

const TEST_PLAN_TOOLS = {
  testplan: "testplan",
  test_results_from_build_id: "testplan_show_test_results_from_build_id",
};

function configureTestPlanTools(server: McpServer, tokenProvider: () => Promise<string>, connectionProvider: () => Promise<WebApi>, userAgentProvider?: () => string) {
  // â”€â”€â”€ testplan (read-only) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  server.tool(
    TEST_PLAN_TOOLS.testplan,
    "Retrieve paginated test plan, suite, and case data for a project. Use the action parameter to specify the operation. When a response includes a continuationToken, pass it back with the same action and query parameters to fetch the next batch; null token indicates the last batch.",
    {
      action: z
        .enum(["list_plans", "list_suites", "list_cases"])
        .describe("The action to perform. Options: list_plans (list test plans in a project), list_suites (list test suites under a test plan), list_cases (list test cases under a test suite)."),
      project: z.string().describe("The unique identifier (ID or name) of the Azure DevOps project."),
      filterActivePlans: z.boolean().default(true).describe("Filter to include only active test plans. Used for: list_plans. Defaults to true."),
      includePlanDetails: z.boolean().default(false).describe("Include detailed information about each test plan. Used for: list_plans."),
      planId: z.coerce.number().min(1).optional().describe("The ID of the test plan. Required for: list_suites, list_cases."),
      suiteId: z.coerce.number().min(1).optional().describe("The ID of the test suite. Required for: list_cases."),
      continuationToken: z.string().optional().describe("Token to continue fetching results from a previous request. Used for: list_plans, list_suites, list_cases."),
    },
    async ({ action, project, filterActivePlans, includePlanDetails, planId, suiteId, continuationToken }) => {
      try {
        const connection = await connectionProvider();
        const accessToken = await tokenProvider();

        const headers: Record<string, string> = {
          Authorization: `Bearer ${accessToken}`,
        };

        const userAgent = userAgentProvider?.();

        if (userAgent) {
          headers["User-Agent"] = userAgent;
        }

        if (action === "list_plans") {
          const params = new URLSearchParams({ "api-version": apiVersion });
          if (filterActivePlans) params.append("filterActivePlans", "true");
          if (includePlanDetails) params.append("includePlanDetails", "true");
          if (continuationToken) params.append("continuationToken", continuationToken);
          const url = `${connection.serverUrl}/${encodeURIComponent(project)}/_apis/testplan/Plans?${params.toString()}`;

          const response = await fetch(url, { method: "GET", headers });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to list test plans (${response.status}): ${errorText}`);
          }

          const body = await response.json();
          const testPlans = body.value ?? [];
          const nextToken = response.headers.get("x-ms-continuationtoken") ?? undefined;

          const result: { testPlans: typeof testPlans; continuationToken?: string } = { testPlans };
          if (nextToken) result.continuationToken = nextToken;

          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        } else if (action === "list_suites") {
          if (!planId) return { content: [{ type: "text", text: "planId is required for list_suites" }], isError: true };

          const params = new URLSearchParams({ "api-version": apiVersion, "expand": "children" });
          if (continuationToken) params.append("continuationToken", continuationToken);
          const url = `${connection.serverUrl}/${encodeURIComponent(project)}/_apis/testplan/Plans/${planId}/Suites?${params.toString()}`;

          const response = await fetch(url, { method: "GET", headers });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to list test suites (${response.status}): ${errorText}`);
          }

          const body = await response.json();
          const testSuites = body.value ?? [];
          const nextToken = response.headers.get("x-ms-continuationtoken") ?? undefined;

          const suiteMap = new Map();
          testSuites.forEach((suite: any) => {
            suiteMap.set(suite.id, {
              id: suite.id,
              name: suite.name,
              parentSuiteId: suite.parentSuite?.id,
              children: [] as any[],
            });
          });

          const roots: any[] = [];
          suiteMap.forEach((suite: any) => {
            if (suite.parentSuiteId && suiteMap.has(suite.parentSuiteId)) {
              suiteMap.get(suite.parentSuiteId).children.push(suite);
            } else {
              roots.push(suite);
            }
          });

          const cleanSuite = (suite: any): any => {
            const cleaned: any = { id: suite.id, name: suite.name };
            if (suite.children && suite.children.length > 0) {
              cleaned.children = suite.children.map((child: any) => cleanSuite(child));
            }
            return cleaned;
          };

          const cleanedSuites = roots.map((root: any) => cleanSuite(root));
          const result: { testSuites: typeof cleanedSuites; continuationToken?: string } = { testSuites: cleanedSuites };
          if (nextToken) result.continuationToken = nextToken;

          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        } else if (action === "list_cases") {
          if (!planId) return { content: [{ type: "text", text: "planId is required for list_cases" }], isError: true };
          if (!suiteId) return { content: [{ type: "text", text: "suiteId is required for list_cases" }], isError: true };

          const params = new URLSearchParams({ "api-version": "7.2-preview.3" });
          if (continuationToken) params.append("continuationToken", continuationToken);
          const url = `${connection.serverUrl}/${encodeURIComponent(project)}/_apis/testplan/Plans/${planId}/Suites/${suiteId}/TestCase?${params.toString()}`;

          const response = await fetch(url, { method: "GET", headers });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to list test cases (${response.status}): ${errorText}`);
          }

          const body = await response.json();
          const testcases = body.value ?? [];
          const nextToken = response.headers.get("x-ms-continuationtoken") ?? undefined;

          const result: { testCases: typeof testcases; continuationToken?: string } = { testCases: testcases };
          if (nextToken) result.continuationToken = nextToken;

          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }
        return { content: [{ type: "text", text: `Unknown action: ${action}` }], isError: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        const prefix = action === "list_plans" ? "Error listing test plans" : action === "list_suites" ? "Error listing test suites" : "Error listing test cases";
        return {
          content: [{ type: "text", text: `${prefix}: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  // â”€â”€â”€ testplan_show_test_results_from_build_id â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  server.tool(
    TEST_PLAN_TOOLS.test_results_from_build_id,
    "Gets a list of test results for a given project and build ID. Can filter by test outcome (e.g. Failed, Passed, Aborted). Returns test case titles, error messages, stack traces, and outcomes. Efficiently handles builds with large numbers of test runs.",
    {
      project: z.string().describe("The unique identifier (ID or name) of the Azure DevOps project."),
      buildid: z.coerce.number().min(1).describe("The ID of the build."),
      outcomes: z.array(z.string()).optional().describe("Filter results by test outcome, e.g. ['Failed', 'Passed', 'Aborted']."),
    },
    async ({ project, buildid, outcomes }) => {
      try {
        const connection = await connectionProvider();
        const testResultsApi = await connection.getTestResultsApi();

        const outcomeFilter = outcomes?.length ? `Outcome eq ${outcomes.join(",")}` : undefined;

        const testResultDetails = await testResultsApi.getTestResultDetailsForBuild(project, buildid, undefined, undefined, outcomeFilter, undefined, true);

        const allResults: any[] = [];
        if (testResultDetails.resultsForGroup) {
          for (const group of testResultDetails.resultsForGroup) {
            if (group.results) {
              for (const result of group.results) {
                allResults.push(result);
              }
            }
          }
        }

        const formattedResults = allResults.map((r) => ({
          id: r.id,
          testCaseTitle: r.testCaseTitle,
          outcome: r.outcome,
          errorMessage: r.errorMessage,
          stackTrace: r.stackTrace,
          automatedTestName: r.automatedTestName,
          automatedTestStorage: r.automatedTestStorage,
          durationInMs: r.durationInMs,
          runId: r.testRun?.id,
        }));

        return {
          content: [{ type: "text", text: JSON.stringify(formattedResults, null, 2) }],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return {
          content: [{ type: "text", text: `Error fetching test results: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );
}

export { TEST_PLAN_TOOLS, configureTestPlanTools };
