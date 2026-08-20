// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { describe, expect, it, jest } from "@jest/globals";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { configurePipelineTools } from "../../../src/tools/pipelines";
import { configureRepoTools } from "../../../src/tools/repositories";
import { configureTestPlanTools } from "../../../src/tools/test-plans";
import { configureWikiTools } from "../../../src/tools/wiki";
import { configureWorkItemTools } from "../../../src/tools/work-items";
import { configureWorkTools } from "../../../src/tools/work";

jest.mock("../../../src/index", () => ({ orgName: "test-org" }));

const forbiddenTools = [
  "work_iteration_write",
  "work_capacity_write",
  "wit_work_item_write",
  "wit_work_item_comment_write",
  "wit_work_item_link_write",
  "repo_pull_request_write",
  "repo_pull_request_thread_write",
  "repo_create_branch",
  "pipelines_write",
  "testplan_test_plan_write",
  "testplan_test_suite_write",
  "testplan_test_case_write",
  "wiki_upsert_page",
];

const expectedTools = [
  "pipelines_artifact",
  "pipelines_build",
  "pipelines_build_log",
  "pipelines_definition",
  "pipelines_run",
  "repo_branch",
  "repo_file",
  "repo_pull_request",
  "repo_pull_request_thread",
  "repo_repository",
  "repo_search_commits",
  "testplan",
  "testplan_show_test_results_from_build_id",
  "wiki",
  "wit_backlog",
  "wit_query",
  "wit_work_item",
  "wit_work_item_attachment",
  "work",
];

function registerReadOnlyTools() {
  const server = { tool: jest.fn() } as unknown as McpServer;
  const tokenProvider = jest.fn<() => Promise<string>>().mockResolvedValue("token");
  const connectionProvider = jest.fn<() => Promise<WebApi>>();
  const userAgentProvider = () => "test-agent";

  configureWorkTools(server, tokenProvider, connectionProvider);
  configureWorkItemTools(server, tokenProvider, connectionProvider);
  configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);
  configurePipelineTools(server, connectionProvider);
  configureTestPlanTools(server, tokenProvider, connectionProvider, userAgentProvider);
  configureWikiTools(server, tokenProvider, connectionProvider, userAgentProvider);

  return server.tool as jest.Mock;
}

describe("read-only Azure DevOps tool surface", () => {
  it("does not register any Azure DevOps mutation tools", () => {
    const tool = registerReadOnlyTools();
    const registeredNames = tool.mock.calls.map(([name]) => name).sort();

    expect(registeredNames).not.toEqual(expect.arrayContaining(forbiddenTools));
    expect(registeredNames).toEqual(expectedTools);
  });

  it("limits wit_backlog to read actions", () => {
    const tool = registerReadOnlyTools();
    const call = tool.mock.calls.find(([name]) => name === "wit_backlog");
    expect(call).toBeDefined();

    const shape = call?.[2];
    expect(shape.action.safeParse("list").success).toBe(true);
    expect(shape.action.safeParse("list_work_items").success).toBe(true);
    expect(shape.action.safeParse("reorder").success).toBe(false);
  });

  it("preserves local attachment and artifact file destinations", () => {
    const tool = registerReadOnlyTools();
    const attachment = tool.mock.calls.find(([name]) => name === "wit_work_item_attachment");
    const artifact = tool.mock.calls.find(([name]) => name === "pipelines_artifact");

    expect(attachment?.[2].savePath).toBeDefined();
    expect(artifact?.[2].destinationPath).toBeDefined();
    expect(artifact?.[2].action.safeParse("download").success).toBe(true);
  });

  it("contains no known Azure DevOps mutation calls or mutating HTTP verbs", () => {
    const toolsDirectory = join(process.cwd(), "src", "tools");
    const source = readdirSync(toolsDirectory)
      .filter((name) => name.endsWith(".ts"))
      .map((name) => readFileSync(join(toolsDirectory, name), "utf8"))
      .join("\n");

    const mutationMethod =
      /\.(?:createWorkItem|updateWorkItem|createPullRequest|updatePullRequest|createPullRequestReviewer|deletePullRequestReviewer|createThread|createComment|updateThread|updateRefs|createPipeline|updateDefinition|runPipeline|createTestPlan|createTestSuite|addTestCasesToSuite|createOrUpdateClassificationNode|postTeamIteration|updateCapacityWithIdentityRef|reorderIterationWorkItems|reorderBacklogWorkItems)\s*\(/;

    expect(source).not.toMatch(mutationMethod);
    expect(source).not.toMatch(/method:\s*"(?:PUT|PATCH|DELETE)"/);
  });
});
