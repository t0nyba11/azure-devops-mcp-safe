// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { describe, expect, it } from "@jest/globals";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { configureTestPlanTools } from "../../../src/tools/test-plans";
import { ITestPlanApi } from "azure-devops-node-api/TestPlanApi";
import { ITestResultsApi } from "azure-devops-node-api/TestResultsApi";
import { IWorkItemTrackingApi } from "azure-devops-node-api/WorkItemTrackingApi";
import { ITestApi } from "azure-devops-node-api/TestApi";

type TokenProviderMock = () => Promise<string>;
type ConnectionProviderMock = () => Promise<WebApi>;
type UserAgentProviderMock = () => string;

describe("configureTestPlanTools", () => {
  let server: McpServer;
  let tokenProvider: TokenProviderMock;
  let connectionProvider: ConnectionProviderMock;
  let userAgentProvider: UserAgentProviderMock;
  let mockConnection: {
    getTestPlanApi: () => Promise<ITestPlanApi>;
    getTestResultsApi: () => Promise<ITestResultsApi>;
    getWorkItemTrackingApi: () => Promise<IWorkItemTrackingApi>;
    getTestApi: () => Promise<ITestApi>;
    serverUrl: string;
  };
  let mockTestPlanApi: ITestPlanApi;
  let mockTestResultsApi: ITestResultsApi;
  let mockWitApi: IWorkItemTrackingApi;
  let mockTestApi: ITestApi;

  beforeEach(() => {
    server = { tool: jest.fn() } as unknown as McpServer;
    tokenProvider = jest.fn().mockResolvedValue("test-token");
    userAgentProvider = jest.fn().mockReturnValue("test-agent");
    mockTestPlanApi = {
      getTestPlans: jest.fn(),
      createTestPlan: jest.fn(),
      createTestSuite: jest.fn(),
      addTestCasesToSuite: jest.fn(),
      getTestCaseList: jest.fn(),
    } as unknown as ITestPlanApi;
    mockTestResultsApi = {
      getTestResultDetailsForBuild: jest.fn(),
      getTestRuns: jest.fn(),
      getTestResults: jest.fn(),
    } as unknown as ITestResultsApi;
    mockWitApi = {
      createWorkItem: jest.fn(),
      updateWorkItem: jest.fn(),
    } as unknown as IWorkItemTrackingApi;
    mockTestApi = {
      addTestCasesToSuite: jest.fn(),
    } as unknown as ITestApi;
    mockConnection = {
      getTestPlanApi: jest.fn().mockResolvedValue(mockTestPlanApi),
      getTestResultsApi: jest.fn().mockResolvedValue(mockTestResultsApi),
      getWorkItemTrackingApi: jest.fn().mockResolvedValue(mockWitApi),
      getTestApi: jest.fn().mockResolvedValue(mockTestApi),
      serverUrl: "https://dev.azure.com/testorg",
    };
    connectionProvider = jest.fn().mockResolvedValue(mockConnection);
  });

  describe("list_test_plans tool", () => {
    function mockFetchPlansResponse(value: any[], continuationToken?: string, ok = true, status = 200, errorText = "Not Found") {
      const headers = new Map<string, string>();
      if (continuationToken) {
        headers.set("x-ms-continuationtoken", continuationToken);
      }
      (global.fetch as jest.Mock) = jest.fn().mockResolvedValue({
        ok,
        status,
        statusText: ok ? "OK" : "Not Found",
        json: jest.fn().mockResolvedValue({ value }),
        text: jest.fn().mockResolvedValue(errorText),
        headers: { get: (key: string) => headers.get(key) ?? null },
      });
    }

    it("should fetch test plans and return the expected result", async () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testplan");
      if (!call) throw new Error("testplan tool not registered");
      const [, , , handler] = call;

      mockFetchPlansResponse([{ id: 1, name: "Test Plan 1" }]);
      const params = {
        action: "list_plans" as const,
        project: "proj1",
        filterActivePlans: true,
        includePlanDetails: false,
        continuationToken: undefined,
      };
      const result = await handler(params);

      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining("proj1/_apis/testplan/Plans?"), expect.objectContaining({ method: "GET" }));
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.testPlans).toEqual([{ id: 1, name: "Test Plan 1" }]);
    });

    it("should handle API errors when listing test plans", async () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testplan");
      if (!call) throw new Error("testplan tool not registered");
      const [, , , handler] = call;

      (global.fetch as jest.Mock) = jest.fn().mockRejectedValue(new Error("API Error"));

      const params = {
        action: "list_plans" as const,
        project: "proj1",
        filterActivePlans: true,
        includePlanDetails: false,
      };

      const result = await handler(params);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error listing test plans");
      expect(result.content[0].text).toContain("API Error");
    });

    it("should pass continuation token in URL when provided", async () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testplan");
      if (!call) throw new Error("testplan tool not registered");
      const [, , , handler] = call;

      mockFetchPlansResponse([{ id: 1, name: "Test Plan 1" }], "nextPageToken");

      const result = await handler({ action: "list_plans" as const, project: "proj1", filterActivePlans: true, includePlanDetails: false, continuationToken: "token123" });

      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining("continuationToken=token123"), expect.anything());
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.continuationToken).toBe("nextPageToken");
    });

    it("should handle non-ok response with status and error text", async () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testplan");
      if (!call) throw new Error("testplan tool not registered");
      const [, , , handler] = call;

      mockFetchPlansResponse([], undefined, false, 404, "Resource not found");

      const result = await handler({ action: "list_plans" as const, project: "proj1", filterActivePlans: true, includePlanDetails: false });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Failed to list test plans (404)");
      expect(result.content[0].text).toContain("Resource not found");
    });

    it("should not set User-Agent header when userAgentProvider is omitted", async () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testplan");
      if (!call) throw new Error("testplan tool not registered");
      const [, , , handler] = call;

      (global.fetch as jest.Mock) = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ value: [] }),
        headers: { get: () => null },
      });

      await handler({ action: "list_plans" as const, project: "proj1", filterActivePlans: true, includePlanDetails: false });

      expect(global.fetch).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ headers: expect.not.objectContaining({ "User-Agent": expect.anything() }) }));
    });

    it("should not append filterActivePlans when false", async () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testplan");
      if (!call) throw new Error("testplan tool not registered");
      const [, , , handler] = call;

      (global.fetch as jest.Mock) = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ value: [] }),
        headers: { get: () => null },
      });

      await handler({ action: "list_plans" as const, project: "proj1", filterActivePlans: false, includePlanDetails: false });

      expect(global.fetch).toHaveBeenCalledWith(expect.not.stringContaining("filterActivePlans"), expect.anything());
    });

    it("should append includePlanDetails when true", async () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testplan");
      if (!call) throw new Error("testplan tool not registered");
      const [, , , handler] = call;

      (global.fetch as jest.Mock) = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ value: [] }),
        headers: { get: () => null },
      });

      await handler({ action: "list_plans" as const, project: "proj1", filterActivePlans: false, includePlanDetails: true });

      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining("includePlanDetails=true"), expect.anything());
    });

    it("should return empty testPlans array when body.value is null", async () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testplan");
      if (!call) throw new Error("testplan tool not registered");
      const [, , , handler] = call;

      (global.fetch as jest.Mock) = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ value: null }),
        headers: { get: () => null },
      });

      const result = await handler({ action: "list_plans" as const, project: "proj1", filterActivePlans: false, includePlanDetails: false });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.testPlans).toEqual([]);
    });

    it("should handle non-Error throws and return fallback message", async () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testplan");
      if (!call) throw new Error("testplan tool not registered");
      const [, , , handler] = call;

      (global.fetch as jest.Mock) = jest.fn().mockRejectedValue("plain string error");

      const result = await handler({ action: "list_plans" as const, project: "proj1", filterActivePlans: false, includePlanDetails: false });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Unknown error occurred");
    });
  });

  describe("list_test_suites tool", () => {
    function mockFetchSuitesResponse(value: any[], continuationToken?: string, ok = true, status = 200, errorText = "Not Found") {
      const headers = new Map<string, string>();
      if (continuationToken) {
        headers.set("x-ms-continuationtoken", continuationToken);
      }
      (global.fetch as jest.Mock) = jest.fn().mockResolvedValue({
        ok,
        status,
        statusText: ok ? "OK" : "Not Found",
        json: jest.fn().mockResolvedValue({ value }),
        text: jest.fn().mockResolvedValue(errorText),
        headers: { get: (key: string) => headers.get(key) ?? null },
      });
    }

    it("should fetch test suites and return properly nested hierarchy", async () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testplan");
      if (!call) throw new Error("testplan tool not registered");
      const [, , , handler] = call;

      mockFetchSuitesResponse([
        {
          id: 100,
          name: "Root Suite",
          hasChildren: true,
          children: [
            { id: 101, name: "Child Suite 1", parentSuite: { id: 100 } },
            { id: 102, name: "Child Suite 2", parentSuite: { id: 100 } },
          ],
        },
        {
          id: 101,
          name: "Child Suite 1",
          hasChildren: true,
          parentSuite: { id: 100 },
          children: [{ id: 103, name: "Grandchild Suite", parentSuite: { id: 101 } }],
        },
        {
          id: 102,
          name: "Child Suite 2",
          parentSuite: { id: 100 },
        },
        {
          id: 103,
          name: "Grandchild Suite",
          parentSuite: { id: 101 },
        },
      ]);

      const params = {
        action: "list_suites" as const,
        project: "proj1",
        planId: 1,
      };
      const result = await handler(params);

      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining("proj1/_apis/testplan/Plans/1/Suites?"), expect.objectContaining({ method: "GET" }));
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.testSuites).toHaveLength(1);
      expect(parsed.testSuites[0]).toMatchObject({
        id: 100,
        name: "Root Suite",
        children: [
          {
            id: 101,
            name: "Child Suite 1",
            children: [
              {
                id: 103,
                name: "Grandchild Suite",
              },
            ],
          },
          {
            id: 102,
            name: "Child Suite 2",
          },
        ],
      });
    });

    it("should handle test suite with no children", async () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testplan");
      if (!call) throw new Error("testplan tool not registered");
      const [, , , handler] = call;

      mockFetchSuitesResponse([{ id: 200, name: "Single Suite", hasChildren: false }]);

      const params = {
        action: "list_suites" as const,
        project: "proj1",
        planId: 2,
      };
      const result = await handler(params);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.testSuites).toHaveLength(1);
      expect(parsed.testSuites[0]).toEqual({ id: 200, name: "Single Suite" });
    });

    it("should handle empty test suite list", async () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testplan");
      if (!call) throw new Error("testplan tool not registered");
      const [, , , handler] = call;

      mockFetchSuitesResponse([]);

      const params = {
        action: "list_suites" as const,
        project: "proj1",
        planId: 3,
      };
      const result = await handler(params);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.testSuites).toEqual([]);
    });

    it("should handle deeply nested suite hierarchy", async () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testplan");
      if (!call) throw new Error("testplan tool not registered");
      const [, , , handler] = call;

      mockFetchSuitesResponse([
        {
          id: 300,
          name: "Root",
          hasChildren: true,
          children: [{ id: 301, name: "Level 1", parentSuite: { id: 300 } }],
        },
        {
          id: 301,
          name: "Level 1",
          hasChildren: true,
          parentSuite: { id: 300 },
          children: [{ id: 302, name: "Level 2", parentSuite: { id: 301 } }],
        },
        {
          id: 302,
          name: "Level 2",
          hasChildren: true,
          parentSuite: { id: 301 },
          children: [{ id: 303, name: "Level 3", parentSuite: { id: 302 } }],
        },
        {
          id: 303,
          name: "Level 3",
          parentSuite: { id: 302 },
        },
      ]);

      const params = {
        action: "list_suites" as const,
        project: "proj1",
        planId: 4,
      };
      const result = await handler(params);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.testSuites[0]).toMatchObject({
        id: 300,
        name: "Root",
        children: [
          {
            id: 301,
            name: "Level 1",
            children: [
              {
                id: 302,
                name: "Level 2",
                children: [
                  {
                    id: 303,
                    name: "Level 3",
                  },
                ],
              },
            ],
          },
        ],
      });
    });

    it("should handle API errors when listing test suites", async () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testplan");
      if (!call) throw new Error("testplan tool not registered");
      const [, , , handler] = call;

      (global.fetch as jest.Mock) = jest.fn().mockRejectedValue(new Error("API Error"));

      const params = {
        action: "list_suites" as const,
        project: "proj1",
        planId: 5,
      };
      const result = await handler(params);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error listing test suites: API Error");
    });

    it("should pass continuation token in URL when provided", async () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testplan");
      if (!call) throw new Error("testplan tool not registered");
      const [, , , handler] = call;

      mockFetchSuitesResponse([{ id: 400, name: "Suite with Token" }], "nextSuiteToken");

      const params = {
        action: "list_suites" as const,
        project: "proj1",
        planId: 6,
        continuationToken: "token123",
      };
      const result = await handler(params);

      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining("continuationToken=token123"), expect.anything());
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.continuationToken).toBe("nextSuiteToken");
    });

    it("should not include empty children arrays in output", async () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testplan");
      if (!call) throw new Error("testplan tool not registered");
      const [, , , handler] = call;

      mockFetchSuitesResponse([
        {
          id: 500,
          name: "Parent",
          hasChildren: true,
          children: [{ id: 501, name: "Child with no children", parentSuite: { id: 500 } }],
        },
        {
          id: 501,
          name: "Child with no children",
          parentSuite: { id: 500 },
          hasChildren: false,
        },
      ]);

      const params = {
        action: "list_suites" as const,
        project: "proj1",
        planId: 7,
      };
      const result = await handler(params);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.testSuites[0].children[0]).toEqual({ id: 501, name: "Child with no children" });
      expect(parsed.testSuites[0].children[0].children).toBeUndefined();
    });

    it("should handle non-ok response with status and error text", async () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testplan");
      if (!call) throw new Error("testplan tool not registered");
      const [, , , handler] = call;

      mockFetchSuitesResponse([], undefined, false, 404, "Suite not found");

      const result = await handler({ action: "list_suites" as const, project: "proj1", planId: 1 });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Failed to list test suites (404)");
      expect(result.content[0].text).toContain("Suite not found");
    });

    it("should return error when planId is missing for list_suites", async () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testplan");
      if (!call) throw new Error("testplan tool not registered");
      const [, , , handler] = call;

      const result = await handler({ action: "list_suites" as const, project: "proj1" } as any);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("planId is required for list_suites");
    });

    it("should return empty testSuites array when body.value is null", async () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testplan");
      if (!call) throw new Error("testplan tool not registered");
      const [, , , handler] = call;

      (global.fetch as jest.Mock) = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ value: null }),
        headers: { get: () => null },
      });

      const result = await handler({ action: "list_suites" as const, project: "proj1", planId: 1 });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.testSuites).toEqual([]);
    });
  });

  describe("list_test_cases tool", () => {
    function mockFetchResponse(value: any[], continuationToken?: string, ok = true, status = 200, errorText = "Not Found") {
      const headers = new Map<string, string>();
      if (continuationToken) {
        headers.set("x-ms-continuationtoken", continuationToken);
      }
      (global.fetch as jest.Mock) = jest.fn().mockResolvedValue({
        ok,
        status,
        statusText: ok ? "OK" : "Not Found",
        json: jest.fn().mockResolvedValue({ value }),
        text: jest.fn().mockResolvedValue(errorText),
        headers: { get: (key: string) => headers.get(key) ?? null },
      });
    }

    it("should fetch test cases and return the expected result", async () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testplan");
      if (!call) throw new Error("testplan tool not registered");
      const [, , , handler] = call;

      mockFetchResponse([{ id: 1, name: "Test Case 1" }]);

      const result = await handler({ action: "list_cases" as const, project: "proj1", planId: 1, suiteId: 2 });

      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining("proj1/_apis/testplan/Plans/1/Suites/2/TestCase"), expect.objectContaining({ method: "GET" }));
      expect(result.content[0].text).toBe(JSON.stringify({ testCases: [{ id: 1, name: "Test Case 1" }] }, null, 2));
    });

    it("should handle API errors when listing test cases", async () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testplan");
      if (!call) throw new Error("testplan tool not registered");
      const [, , , handler] = call;

      (global.fetch as jest.Mock) = jest.fn().mockRejectedValue(new Error("API Error"));

      const result = await handler({ action: "list_cases" as const, project: "proj1", planId: 1, suiteId: 2 });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error listing test cases");
      expect(result.content[0].text).toContain("API Error");
    });

    it("should pass continuation token when provided", async () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testplan");
      if (!call) throw new Error("testplan tool not registered");
      const [, , , handler] = call;

      mockFetchResponse([{ id: 1, name: "Test Case 1" }], "nextToken456");

      const result = await handler({ action: "list_cases" as const, project: "proj1", planId: 1, suiteId: 2, continuationToken: "token123" });

      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining("continuationToken=token123"), expect.anything());
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.continuationToken).toBe("nextToken456");
      expect(parsed.testCases).toEqual([{ id: 1, name: "Test Case 1" }]);
    });

    it("should not include continuationToken when API does not return one", async () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testplan");
      if (!call) throw new Error("testplan tool not registered");
      const [, , , handler] = call;

      mockFetchResponse([{ id: 1, name: "Test Case 1" }]);

      const result = await handler({ action: "list_cases" as const, project: "proj1", planId: 1, suiteId: 2 });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.continuationToken).toBeUndefined();
      expect(parsed.testCases).toEqual([{ id: 1, name: "Test Case 1" }]);
    });

    it("should handle non-ok response with status and error text", async () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testplan");
      if (!call) throw new Error("testplan tool not registered");
      const [, , , handler] = call;

      mockFetchResponse([], undefined, false, 404, "Test case not found");

      const result = await handler({ action: "list_cases" as const, project: "proj1", planId: 1, suiteId: 2 });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Failed to list test cases (404)");
      expect(result.content[0].text).toContain("Test case not found");
    });

    it("should return error when planId is missing for list_cases", async () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testplan");
      if (!call) throw new Error("testplan tool not registered");
      const [, , , handler] = call;

      const result = await handler({ action: "list_cases" as const, project: "proj1", suiteId: 2 } as any);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("planId is required for list_cases");
    });

    it("should return error when suiteId is missing for list_cases", async () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testplan");
      if (!call) throw new Error("testplan tool not registered");
      const [, , , handler] = call;

      const result = await handler({ action: "list_cases" as const, project: "proj1", planId: 1 } as any);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("suiteId is required for list_cases");
    });

    it("should return empty testCases array when body.value is null", async () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testplan");
      if (!call) throw new Error("testplan tool not registered");
      const [, , , handler] = call;

      (global.fetch as jest.Mock) = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ value: null }),
        headers: { get: () => null },
      });

      const result = await handler({ action: "list_cases" as const, project: "proj1", planId: 1, suiteId: 2 });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.testCases).toEqual([]);
    });

    it("should return error for unknown action", async () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testplan");
      if (!call) throw new Error("testplan tool not registered");
      const [, , , handler] = call;

      const result = await handler({ action: "unknown_action" as any, project: "proj1", filterActivePlans: true, includePlanDetails: false });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Unknown action: unknown_action");
    });
  });

  describe("test_results_from_build_id tool", () => {
    it("should fetch test result details for build and return formatted output", async () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testplan_show_test_results_from_build_id");
      if (!call) throw new Error("testplan_show_test_results_from_build_id tool not registered");
      const [, , , handler] = call;

      (mockTestResultsApi.getTestResultDetailsForBuild as jest.Mock).mockResolvedValue({
        resultsForGroup: [
          {
            results: [
              {
                id: 1,
                testCaseTitle: "TestHello",
                outcome: "Failed",
                errorMessage: "Assert.Equal() failed",
                stackTrace: "at TestClass.TestHello() line 42",
                automatedTestName: "Namespace.TestClass.TestHello",
                automatedTestStorage: "test.dll",
                durationInMs: 1500,
                testRun: { id: "100" },
              },
              {
                id: 2,
                testCaseTitle: "TestWorld",
                outcome: "Passed",
                automatedTestName: "Namespace.TestClass.TestWorld",
                automatedTestStorage: "test.dll",
                durationInMs: 200,
                testRun: { id: "200" },
              },
            ],
          },
        ],
      });

      const result = await handler({ project: "proj1", buildid: 123 });

      expect(mockTestResultsApi.getTestResultDetailsForBuild).toHaveBeenCalledWith("proj1", 123, undefined, undefined, undefined, undefined, true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toHaveLength(2);
      expect(parsed[0].testCaseTitle).toBe("TestHello");
      expect(parsed[0].errorMessage).toBe("Assert.Equal() failed");
      expect(parsed[0].stackTrace).toBe("at TestClass.TestHello() line 42");
      expect(parsed[0].outcome).toBe("Failed");
      expect(parsed[1].testCaseTitle).toBe("TestWorld");
      expect(parsed[1].outcome).toBe("Passed");
    });

    it("should pass outcome filter expression for server-side filtering", async () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testplan_show_test_results_from_build_id");
      if (!call) throw new Error("testplan_show_test_results_from_build_id tool not registered");
      const [, , , handler] = call;

      (mockTestResultsApi.getTestResultDetailsForBuild as jest.Mock).mockResolvedValue({
        resultsForGroup: [],
      });

      await handler({ project: "proj1", buildid: 123, outcomes: ["Failed", "Aborted"] });

      expect(mockTestResultsApi.getTestResultDetailsForBuild).toHaveBeenCalledWith(
        "proj1",
        123,
        undefined, // publishContext
        undefined, // groupBy
        "Outcome eq Failed,Aborted", // filter expression
        undefined, // orderby
        true // shouldIncludeResults
      );
    });

    it("should handle API errors when fetching test results", async () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testplan_show_test_results_from_build_id");
      if (!call) throw new Error("testplan_show_test_results_from_build_id tool not registered");
      const [, , , handler] = call;

      (mockTestResultsApi.getTestResultDetailsForBuild as jest.Mock).mockRejectedValue(new Error("API Error"));

      const result = await handler({ project: "proj1", buildid: 123 });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error fetching test results");
      expect(result.content[0].text).toContain("API Error");
    });

    it("should return test case titles for all results across multiple groups", async () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testplan_show_test_results_from_build_id");
      if (!call) throw new Error("testplan_show_test_results_from_build_id tool not registered");
      const [, , , handler] = call;

      // Simulate multiple groups (e.g., grouped by configuration or test suite)
      (mockTestResultsApi.getTestResultDetailsForBuild as jest.Mock).mockResolvedValue({
        resultsForGroup: [
          {
            groupByValue: "Configuration1",
            results: [
              {
                id: 1,
                testCaseTitle: "Test Case Alpha",
                outcome: "Passed",
                durationInMs: 100,
              },
              {
                id: 2,
                testCaseTitle: "Test Case Beta",
                outcome: "Failed",
                errorMessage: "Assertion failed",
              },
            ],
          },
          {
            groupByValue: "Configuration2",
            results: [
              {
                id: 3,
                testCaseTitle: "Test Case Gamma",
                outcome: "Passed",
                durationInMs: 150,
              },
            ],
          },
        ],
      });

      const result = await handler({ project: "proj1", buildid: 456 });

      const parsed = JSON.parse(result.content[0].text);

      // Verify all 3 results are present
      expect(parsed).toHaveLength(3);

      // Explicitly verify each test case title is present and correct
      expect(parsed[0].testCaseTitle).toBe("Test Case Alpha");
      expect(parsed[0].id).toBe(1);
      expect(parsed[1].testCaseTitle).toBe("Test Case Beta");
      expect(parsed[1].id).toBe(2);
      expect(parsed[2].testCaseTitle).toBe("Test Case Gamma");
      expect(parsed[2].id).toBe(3);

      // Verify testCaseTitle field exists in all results
      parsed.forEach((result: any) => {
        expect(result).toHaveProperty("testCaseTitle");
        expect(result.testCaseTitle).toBeTruthy();
      });
    });

    it("should handle large result groups without spreading them onto the stack", async () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testplan_show_test_results_from_build_id");
      if (!call) throw new Error("testplan_show_test_results_from_build_id tool not registered");
      const [, , , handler] = call;

      const largeResults = Array.from({ length: 150_000 }, (_, id) => ({
        id,
        testCaseTitle: `Test ${id}`,
        outcome: "Passed",
      }));

      (mockTestResultsApi.getTestResultDetailsForBuild as jest.Mock).mockResolvedValue({
        resultsForGroup: [{ results: largeResults }],
      });

      const result = await handler({ project: "proj1", buildid: 456 });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toHaveLength(largeResults.length);
      expect(parsed[0].testCaseTitle).toBe("Test 0");
      expect(parsed[largeResults.length - 1].testCaseTitle).toBe("Test 149999");
    });

    it("should handle empty results groups without errors", async () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testplan_show_test_results_from_build_id");
      if (!call) throw new Error("testplan_show_test_results_from_build_id tool not registered");
      const [, , , handler] = call;

      (mockTestResultsApi.getTestResultDetailsForBuild as jest.Mock).mockResolvedValue({
        resultsForGroup: [
          {
            groupByValue: "EmptyGroup",
            results: [],
          },
          {
            groupByValue: "GroupWithResults",
            results: [
              {
                id: 1,
                testCaseTitle: "Only Test",
                outcome: "Passed",
              },
            ],
          },
        ],
      });

      const result = await handler({ project: "proj1", buildid: 789 });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].testCaseTitle).toBe("Only Test");
    });

    it("should return test case titles when present and handle missing titles gracefully", async () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testplan_show_test_results_from_build_id");
      if (!call) throw new Error("testplan_show_test_results_from_build_id tool not registered");
      const [, , , handler] = call;

      (mockTestResultsApi.getTestResultDetailsForBuild as jest.Mock).mockResolvedValue({
        resultsForGroup: [
          {
            results: [
              {
                id: 1,
                testCaseTitle: "Manual Test Case Title",
                automatedTestName: "Namespace.TestClass.TestMethod",
                outcome: "Passed",
              },
              {
                id: 2,
                testCaseTitle: undefined, // Missing testCaseTitle
                automatedTestName: "Namespace.TestClass.AnotherTest",
                outcome: "Failed",
              },
              {
                id: 3,
                testCaseTitle: "Another Manual Test Case",
                automatedTestName: "Namespace.TestClass.ThirdTest",
                outcome: "Passed",
              },
            ],
          },
        ],
      });

      const result = await handler({ project: "proj1", buildid: 999 });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toHaveLength(3);

      // Verify testCaseTitle is present when provided by the API
      expect(parsed[0]).toHaveProperty("testCaseTitle");
      expect(parsed[0].testCaseTitle).toBe("Manual Test Case Title");

      // When testCaseTitle is undefined, JSON.stringify omits it (expected behavior)
      // but automatedTestName should still be available
      expect(parsed[1].id).toBe(2);
      expect(parsed[1].automatedTestName).toBe("Namespace.TestClass.AnotherTest");

      // Third result also has testCaseTitle
      expect(parsed[2]).toHaveProperty("testCaseTitle");
      expect(parsed[2].testCaseTitle).toBe("Another Manual Test Case");
    });

    it("should return empty array when resultsForGroup is null", async () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testplan_show_test_results_from_build_id");
      if (!call) throw new Error("testplan_show_test_results_from_build_id tool not registered");
      const [, , , handler] = call;

      (mockTestResultsApi.getTestResultDetailsForBuild as jest.Mock).mockResolvedValue({ resultsForGroup: null });

      const result = await handler({ project: "proj1", buildid: 123 });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toEqual([]);
    });

    it("should skip groups that have no results property", async () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testplan_show_test_results_from_build_id");
      if (!call) throw new Error("testplan_show_test_results_from_build_id tool not registered");
      const [, , , handler] = call;

      (mockTestResultsApi.getTestResultDetailsForBuild as jest.Mock).mockResolvedValue({
        resultsForGroup: [{ groupByValue: "NoResults" }, { results: [{ id: 1, testCaseTitle: "Test", outcome: "Passed" }] }],
      });

      const result = await handler({ project: "proj1", buildid: 123 });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].testCaseTitle).toBe("Test");
    });

    it("should handle non-Error throws and return fallback message", async () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testplan_show_test_results_from_build_id");
      if (!call) throw new Error("testplan_show_test_results_from_build_id tool not registered");
      const [, , , handler] = call;

      (mockTestResultsApi.getTestResultDetailsForBuild as jest.Mock).mockRejectedValue("plain string error");

      const result = await handler({ project: "proj1", buildid: 123 });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Unknown error occurred");
    });
  });
});
