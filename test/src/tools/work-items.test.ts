// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { describe, expect, it } from "@jest/globals";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { configureWorkItemTools } from "../../../src/tools/work-items";
import { WebApi } from "azure-devops-node-api";
import { Readable } from "stream";
import * as fs from "fs";
import * as path from "path";
import { QueryExpand } from "azure-devops-node-api/interfaces/WorkItemTrackingInterfaces.js";

jest.mock("fs");
import {
  _mockBacklogs,
  _mockQuery,
  _mockQueryResults,
  _mockWiqlQueryResults,
  _mockWorkItem,
  _mockWorkItemComments,
  _mockWorkItemRevisions,
  _mockWorkItems,
  _mockWorkItemsForIteration,
  _mockWorkItemType,
} from "../../mocks/work-items";

type TokenProviderMock = () => Promise<string>;
type ConnectionProviderMock = () => Promise<WebApi>;

interface WorkApiMock {
  getBacklogs: jest.Mock;
  getBacklogLevelWorkItems: jest.Mock;
  reorderBacklogWorkItems: jest.Mock;
  reorderIterationWorkItems: jest.Mock;
  getPredefinedQueryResults: jest.Mock;
  getTeamIterations: jest.Mock;
  getIterationWorkItems: jest.Mock;
}

interface WorkItemTrackingApiMock {
  getWorkItemsBatch: jest.Mock;
  getWorkItem: jest.Mock;
  getComments: jest.Mock;
  addComment: jest.Mock;
  getRevisions: jest.Mock;
  updateWorkItem: jest.Mock;
  createWorkItem: jest.Mock;
  getWorkItemType: jest.Mock;
  getQuery: jest.Mock;
  queryById: jest.Mock;
  queryByWiql: jest.Mock;
  getAttachmentContent: jest.Mock;
}

interface MockConnection {
  getWorkApi: jest.Mock;
  getWorkItemTrackingApi: jest.Mock;
  getCoreApi: jest.Mock;
  serverUrl?: string;
}

describe("configureWorkItemTools", () => {
  let server: McpServer;
  let tokenProvider: TokenProviderMock;
  let connectionProvider: ConnectionProviderMock;
  let mockConnection: MockConnection;
  let mockWorkApi: WorkApiMock;
  let mockWorkItemTrackingApi: WorkItemTrackingApiMock;

  beforeEach(() => {
    server = { tool: jest.fn(), server: { elicitInput: jest.fn() } } as unknown as McpServer;
    tokenProvider = jest.fn();

    mockWorkApi = {
      getBacklogs: jest.fn(),
      getBacklogLevelWorkItems: jest.fn(),
      reorderBacklogWorkItems: jest.fn(),
      reorderIterationWorkItems: jest.fn(),
      getPredefinedQueryResults: jest.fn(),
      getTeamIterations: jest.fn(),
      getIterationWorkItems: jest.fn(),
    };

    mockWorkItemTrackingApi = {
      getWorkItemsBatch: jest.fn(),
      getWorkItem: jest.fn(),
      getComments: jest.fn(),
      addComment: jest.fn(),
      getRevisions: jest.fn(),
      updateWorkItem: jest.fn(),
      createWorkItem: jest.fn(),
      getWorkItemType: jest.fn(),
      getQuery: jest.fn(),
      queryById: jest.fn(),
      queryByWiql: jest.fn(),
      getAttachmentContent: jest.fn(),
    };

    mockConnection = {
      getWorkApi: jest.fn().mockResolvedValue(mockWorkApi),
      getWorkItemTrackingApi: jest.fn().mockResolvedValue(mockWorkItemTrackingApi),
      getCoreApi: jest.fn().mockResolvedValue({ getProjects: jest.fn() }),
    };

    connectionProvider = jest.fn().mockResolvedValue(mockConnection);
  });

  describe("tool registration", () => {
    it("registers core tools on the server", () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);
      expect(server.tool as jest.Mock).toHaveBeenCalled();
    });
  });

  describe("list_backlogs tool", () => {
    it("should call getBacklogs API with the correct parameters and return the expected result", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_backlog");
      if (!call) throw new Error("wit_backlog tool not registered");
      const [, , , handler] = call;

      (mockWorkApi.getBacklogs as jest.Mock).mockResolvedValue([_mockBacklogs]);

      const params = {
        project: "Contoso",
        team: "Fabrikam",
      };

      const result = await handler({ action: "list", ...params });

      expect(mockWorkApi.getBacklogs).toHaveBeenCalledWith({
        project: params.project,
        team: params.team,
      });

      expect(result.content[0].text).toBe(JSON.stringify([_mockBacklogs], null, 2));
    });
  });

  describe("list_backlog_work_items tool", () => {
    it("should call getBacklogLevelWorkItems API with the correct parameters and return the expected result", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_backlog");
      if (!call) throw new Error("wit_backlog tool not registered");
      const [, , , handler] = call;

      (mockWorkApi.getBacklogLevelWorkItems as jest.Mock).mockResolvedValue([
        {
          workItems: [
            {
              rel: null,
              source: null,
              target: {
                id: 50,
              },
            },
            {
              rel: null,
              source: null,
              target: {
                id: 49,
              },
            },
          ],
        },
      ]);

      const params = {
        project: "Contoso",
        team: "Fabrikam",
        backlogId: "Microsoft.FeatureCategory",
      };

      const result = await handler({ action: "list_work_items", ...params });

      expect(mockWorkApi.getBacklogLevelWorkItems).toHaveBeenCalledWith({ project: params.project, team: params.team }, params.backlogId);

      expect(result.content[0].text).toBe(
        JSON.stringify(
          [
            {
              workItems: [
                {
                  rel: null,
                  source: null,
                  target: {
                    id: 50,
                  },
                },
                {
                  rel: null,
                  source: null,
                  target: {
                    id: 49,
                  },
                },
              ],
            },
          ],
          null,
          2
        )
      );
    });
  });

  describe("my_work_items tool", () => {
    it("should call getPredefinedQueryResults API with the correct parameters and return the expected result", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_work_item");
      if (!call) throw new Error("wit_work_item tool not registered");
      const [, , , handler] = call;

      (mockWorkApi.getPredefinedQueryResults as jest.Mock).mockResolvedValue([
        {
          id: "assignedtome",
          name: "Assigned to me",
          url: "https://dev.azure.com/org/project/_apis/work/predefinedQueries/assignedtome",
          webUrl: "https://dev.azure.com/org/project/project/_workitems/assignedtome",
          hasMore: false,
          results: [
            {
              id: 115784,
              url: "https://dev.azure.com/org/_apis/wit/workItems/115784",
            },
            {
              id: 115794,
              url: "https://dev.azure.com/org/_apis/wit/workItems/115794",
            },
            {
              id: 115792,
              url: "https://dev.azure.com/org/_apis/wit/workItems/115792",
            },
          ],
        },
      ]);

      const params = {
        project: "Contoso",
        type: "assignedtome",
        top: 10,
        includeCompleted: false,
      };

      const result = await handler({ action: "my", ...params });

      expect(mockWorkApi.getPredefinedQueryResults).toHaveBeenCalledWith(params.project, params.type, params.top, params.includeCompleted);

      expect(result.content[0].text).toBe(
        JSON.stringify(
          [
            {
              id: "assignedtome",
              name: "Assigned to me",
              url: "https://dev.azure.com/org/project/_apis/work/predefinedQueries/assignedtome",
              webUrl: "https://dev.azure.com/org/project/project/_workitems/assignedtome",
              hasMore: false,
              results: [
                {
                  id: 115784,
                  url: "https://dev.azure.com/org/_apis/wit/workItems/115784",
                },
                {
                  id: 115794,
                  url: "https://dev.azure.com/org/_apis/wit/workItems/115794",
                },
                {
                  id: 115792,
                  url: "https://dev.azure.com/org/_apis/wit/workItems/115792",
                },
              ],
            },
          ],
          null,
          2
        )
      );
    });
  });

  describe("getWorkItemsBatch tool", () => {
    it("should call workItemApi.getWorkItemsBatch API with the correct parameters and return the expected result", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_work_item");

      if (!call) throw new Error("wit_work_item tool not registered");
      const [, , , handler] = call;

      (mockWorkItemTrackingApi.getWorkItemsBatch as jest.Mock).mockResolvedValue([_mockWorkItems]);

      const params = {
        ids: [297, 299, 300],
        project: "Contoso",
      };

      const result = await handler({ action: "get_batch", ...params });

      expect(mockWorkItemTrackingApi.getWorkItemsBatch).toHaveBeenCalledWith(
        {
          ids: params.ids,
          fields: ["System.Id", "System.WorkItemType", "System.Title", "System.State", "System.Parent", "System.Tags", "Microsoft.VSTS.Common.StackRank", "System.AssignedTo"],
        },
        params.project
      );

      expect(result.content[0].text).toBe(JSON.stringify([_mockWorkItems], null, 2));
    });

    it("should call workItemApi.getWorkItemsBatch API with custom fields when fields parameter is provided", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_work_item");

      if (!call) throw new Error("wit_work_item tool not registered");
      const [, , , handler] = call;

      const mockWorkItemsWithCustomFields = [
        {
          id: 297,
          fields: {
            "System.Id": 297,
            "System.Title": "Test Work Item",
          },
        },
      ];

      (mockWorkItemTrackingApi.getWorkItemsBatch as jest.Mock).mockResolvedValue(mockWorkItemsWithCustomFields);

      const params = {
        ids: [297, 299, 300],
        project: "Contoso",
        fields: ["System.Id", "System.Title"],
      };

      const result = await handler({ action: "get_batch", ...params });

      expect(mockWorkItemTrackingApi.getWorkItemsBatch).toHaveBeenCalledWith(
        {
          ids: params.ids,
          fields: params.fields,
        },
        params.project
      );

      expect(result.content[0].text).toBe(JSON.stringify(mockWorkItemsWithCustomFields, null, 2));
    });

    it("should use default fields when an empty fields array is provided", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_work_item");

      if (!call) throw new Error("wit_work_item tool not registered");
      const [, , , handler] = call;

      (mockWorkItemTrackingApi.getWorkItemsBatch as jest.Mock).mockResolvedValue([_mockWorkItems]);

      const params = {
        ids: [297, 299, 300],
        project: "Contoso",
        fields: [], // Empty array should trigger default fields
      };

      const result = await handler({ action: "get_batch", ...params });

      expect(mockWorkItemTrackingApi.getWorkItemsBatch).toHaveBeenCalledWith(
        {
          ids: params.ids,
          fields: ["System.Id", "System.WorkItemType", "System.Title", "System.State", "System.Parent", "System.Tags", "Microsoft.VSTS.Common.StackRank", "System.AssignedTo"],
        },
        params.project
      );

      expect(result.content[0].text).toBe(JSON.stringify([_mockWorkItems], null, 2));
    });

    it("should transform System.AssignedTo object to formatted string", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_work_item");

      if (!call) throw new Error("wit_work_item tool not registered");
      const [, , , handler] = call;

      // Mock work items with System.AssignedTo as objects
      const mockWorkItemsWithAssignedTo = [
        {
          id: 297,
          fields: {
            "System.Id": 297,
            "System.WorkItemType": "Bug",
            "System.Title": "Test Bug",
            "System.AssignedTo": {
              displayName: "John Doe",
              uniqueName: "john.doe@example.com",
              id: "12345",
            },
          },
        },
        {
          id: 298,
          fields: {
            "System.Id": 298,
            "System.WorkItemType": "User Story",
            "System.Title": "Test Story",
            "System.AssignedTo": {
              displayName: "Jane Smith",
              uniqueName: "jane.smith@example.com",
              id: "67890",
            },
          },
        },
      ];

      (mockWorkItemTrackingApi.getWorkItemsBatch as jest.Mock).mockResolvedValue(mockWorkItemsWithAssignedTo);

      const params = {
        ids: [297, 298],
        project: "Contoso",
      };

      const result = await handler({ action: "get_batch", ...params });

      // Parse the returned JSON to verify transformation
      const resultData = JSON.parse(result.content[0].text);

      expect(resultData[0].fields["System.AssignedTo"]).toBe("John Doe <john.doe@example.com>");
      expect(resultData[1].fields["System.AssignedTo"]).toBe("Jane Smith <jane.smith@example.com>");
    });

    it("should handle System.AssignedTo with only displayName", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_work_item");

      if (!call) throw new Error("wit_work_item tool not registered");
      const [, , , handler] = call;

      const mockWorkItemsWithPartialAssignedTo = [
        {
          id: 297,
          fields: {
            "System.Id": 297,
            "System.WorkItemType": "Bug",
            "System.Title": "Test Bug",
            "System.AssignedTo": {
              displayName: "John Doe",
              id: "12345",
            },
          },
        },
      ];

      (mockWorkItemTrackingApi.getWorkItemsBatch as jest.Mock).mockResolvedValue(mockWorkItemsWithPartialAssignedTo);

      const params = {
        ids: [297],
        project: "Contoso",
      };

      const result = await handler({ action: "get_batch", ...params });

      const resultData = JSON.parse(result.content[0].text);
      expect(resultData[0].fields["System.AssignedTo"]).toBe("John Doe <>");
    });

    it("should handle System.AssignedTo with only uniqueName", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_work_item");

      if (!call) throw new Error("wit_work_item tool not registered");
      const [, , , handler] = call;

      const mockWorkItemsWithPartialAssignedTo = [
        {
          id: 297,
          fields: {
            "System.Id": 297,
            "System.WorkItemType": "Bug",
            "System.Title": "Test Bug",
            "System.AssignedTo": {
              uniqueName: "john.doe@example.com",
              id: "12345",
            },
          },
        },
      ];

      (mockWorkItemTrackingApi.getWorkItemsBatch as jest.Mock).mockResolvedValue(mockWorkItemsWithPartialAssignedTo);

      const params = {
        ids: [297],
        project: "Contoso",
      };

      const result = await handler({ action: "get_batch", ...params });

      const resultData = JSON.parse(result.content[0].text);
      expect(resultData[0].fields["System.AssignedTo"]).toBe("<john.doe@example.com>");
    });

    it("should not transform System.AssignedTo if it's not an object", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_work_item");

      if (!call) throw new Error("wit_work_item tool not registered");
      const [, , , handler] = call;

      const mockWorkItemsWithStringAssignedTo = [
        {
          id: 297,
          fields: {
            "System.Id": 297,
            "System.WorkItemType": "Bug",
            "System.Title": "Test Bug",
            "System.AssignedTo": "Already a string",
          },
        },
      ];

      (mockWorkItemTrackingApi.getWorkItemsBatch as jest.Mock).mockResolvedValue(mockWorkItemsWithStringAssignedTo);

      const params = {
        ids: [297],
        project: "Contoso",
      };

      const result = await handler({ action: "get_batch", ...params });

      const resultData = JSON.parse(result.content[0].text);
      expect(resultData[0].fields["System.AssignedTo"]).toBe("Already a string");
    });

    it("should handle work items without System.AssignedTo field", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_work_item");

      if (!call) throw new Error("wit_work_item tool not registered");
      const [, , , handler] = call;

      const mockWorkItemsWithoutAssignedTo = [
        {
          id: 297,
          fields: {
            "System.Id": 297,
            "System.WorkItemType": "Bug",
            "System.Title": "Test Bug",
          },
        },
      ];

      (mockWorkItemTrackingApi.getWorkItemsBatch as jest.Mock).mockResolvedValue(mockWorkItemsWithoutAssignedTo);

      const params = {
        ids: [297],
        project: "Contoso",
      };

      const result = await handler({ action: "get_batch", ...params });

      const resultData = JSON.parse(result.content[0].text);
      expect(resultData[0].fields["System.AssignedTo"]).toBeUndefined();
    });

    it("should handle null or undefined workitems response", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_work_item");

      if (!call) throw new Error("wit_work_item tool not registered");
      const [, , , handler] = call;

      (mockWorkItemTrackingApi.getWorkItemsBatch as jest.Mock).mockResolvedValue(null);

      const params = {
        ids: [297],
        project: "Contoso",
      };

      const result = await handler({ action: "get_batch", ...params });

      expect(result.content[0].text).toBe(JSON.stringify(null, null, 2));
    });

    it("should transform all user fields to formatted strings", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_work_item");

      if (!call) throw new Error("wit_work_item tool not registered");
      const [, , , handler] = call;

      // Mock work items with all user fields as objects
      const mockWorkItemsWithUserFields = [
        {
          id: 297,
          fields: {
            "System.Id": 297,
            "System.WorkItemType": "Bug",
            "System.Title": "Test Bug",
            "System.AssignedTo": {
              displayName: "John Doe",
              uniqueName: "john.doe@example.com",
              id: "12345",
            },
            "System.CreatedBy": {
              displayName: "Jane Smith",
              uniqueName: "jane.smith@example.com",
              id: "67890",
            },
            "System.ChangedBy": {
              displayName: "Bob Johnson",
              uniqueName: "bob.johnson@example.com",
              id: "11111",
            },
            "System.AuthorizedAs": {
              displayName: "Alice Brown",
              uniqueName: "alice.brown@example.com",
              id: "22222",
            },
            "Microsoft.VSTS.Common.ActivatedBy": {
              displayName: "Charlie Wilson",
              uniqueName: "charlie.wilson@example.com",
              id: "33333",
            },
            "Microsoft.VSTS.Common.ResolvedBy": {
              displayName: "Diana Clark",
              uniqueName: "diana.clark@example.com",
              id: "44444",
            },
            "Microsoft.VSTS.Common.ClosedBy": {
              displayName: "Edward Davis",
              uniqueName: "edward.davis@example.com",
              id: "55555",
            },
          },
        },
      ];

      (mockWorkItemTrackingApi.getWorkItemsBatch as jest.Mock).mockResolvedValue(mockWorkItemsWithUserFields);

      const params = {
        ids: [297],
        project: "Contoso",
      };

      const result = await handler({ action: "get_batch", ...params });

      // Parse the returned JSON to verify transformation
      const resultData = JSON.parse(result.content[0].text);

      // Verify that all user fields are transformed to formatted strings
      expect(resultData[0].fields["System.AssignedTo"]).toBe("John Doe <john.doe@example.com>");
      expect(resultData[0].fields["System.CreatedBy"]).toBe("Jane Smith <jane.smith@example.com>");
      expect(resultData[0].fields["System.ChangedBy"]).toBe("Bob Johnson <bob.johnson@example.com>");
      expect(resultData[0].fields["System.AuthorizedAs"]).toBe("Alice Brown <alice.brown@example.com>");
      expect(resultData[0].fields["Microsoft.VSTS.Common.ActivatedBy"]).toBe("Charlie Wilson <charlie.wilson@example.com>");
      expect(resultData[0].fields["Microsoft.VSTS.Common.ResolvedBy"]).toBe("Diana Clark <diana.clark@example.com>");
      expect(resultData[0].fields["Microsoft.VSTS.Common.ClosedBy"]).toBe("Edward Davis <edward.davis@example.com>");
    });

    it("should pass all ids to getWorkItemsBatch regardless of top", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_work_item");
      if (!call) throw new Error("wit_work_item tool not registered");
      const [, , , handler] = call;

      (mockWorkItemTrackingApi.getWorkItemsBatch as jest.Mock).mockResolvedValue([_mockWorkItem]);

      const params = {
        ids: [1, 2, 3, 4, 5],
        top: 2,
        project: "Contoso",
      };

      await handler({ action: "get_batch", ...params });

      expect(mockWorkItemTrackingApi.getWorkItemsBatch).toHaveBeenCalledWith(expect.objectContaining({ ids: [1, 2, 3, 4, 5] }), "Contoso");
    });
  });

  describe("get_work_item tool", () => {
    it("should call workItemApi.getWorkItem API with the correct parameters and return the expected result", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_work_item");

      if (!call) throw new Error("wit_work_item tool not registered");
      const [, , , handler] = call;

      (mockWorkItemTrackingApi.getWorkItem as jest.Mock).mockResolvedValue([_mockWorkItem]);

      const params = {
        id: 12,
        fields: undefined,
        asOf: undefined,
        expand: "none",
        project: "Contoso",
      };

      const result = await handler({ action: "get", ...params });

      expect(mockWorkItemTrackingApi.getWorkItem).toHaveBeenCalledWith(params.id, params.fields, params.asOf, params.expand, params.project);

      expect(result.content[0].text).toBe(JSON.stringify([_mockWorkItem], null, 2));
    });

    it("should call getWorkItem with fields and no expand when fields are provided but expand is empty", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_work_item");

      if (!call) throw new Error("wit_work_item tool not registered");
      const [, , , handler] = call;

      (mockWorkItemTrackingApi.getWorkItem as jest.Mock).mockResolvedValue(_mockWorkItem);

      const params = {
        id: 12,
        fields: ["System.Title", "System.State"],
        asOf: undefined,
        expand: undefined,
        project: "Contoso",
      };

      const result = await handler({ action: "get", ...params });

      expect(mockWorkItemTrackingApi.getWorkItem).toHaveBeenCalledWith(params.id, params.fields, params.asOf, undefined, params.project);

      expect(result.content[0].text).toBe(JSON.stringify(_mockWorkItem, null, 2));
    });

    it("should call getWorkItem with expand and no fields when expand is provided but fields are empty", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_work_item");

      if (!call) throw new Error("wit_work_item tool not registered");
      const [, , , handler] = call;

      (mockWorkItemTrackingApi.getWorkItem as jest.Mock).mockResolvedValue(_mockWorkItem);

      const params = {
        id: 12,
        fields: undefined,
        asOf: undefined,
        expand: "relations",
        project: "Contoso",
      };

      const result = await handler({ action: "get", ...params });

      expect(mockWorkItemTrackingApi.getWorkItem).toHaveBeenCalledWith(params.id, params.fields, params.asOf, "relations", params.project);

      expect(result.content[0].text).toBe(JSON.stringify(_mockWorkItem, null, 2));
    });

    it("should override expand to 'none' when both fields and expand are provided", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_work_item");

      if (!call) throw new Error("wit_work_item tool not registered");
      const [, , , handler] = call;

      (mockWorkItemTrackingApi.getWorkItem as jest.Mock).mockResolvedValue(_mockWorkItem);

      const params = {
        id: 12,
        fields: ["System.Title", "System.State"],
        asOf: undefined,
        expand: "relations",
        project: "Contoso",
      };

      const result = await handler({ action: "get", ...params });

      // expand should be overridden to "none" because fields takes precedence
      expect(mockWorkItemTrackingApi.getWorkItem).toHaveBeenCalledWith(params.id, params.fields, params.asOf, "none", params.project);

      expect(result.content[0].text).toBe(JSON.stringify(_mockWorkItem, null, 2));
    });
  });

  describe("list_work_item_comments tool", () => {
    it("should call workItemApi.getComments API with the correct parameters and return the expected result", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_work_item");

      if (!call) throw new Error("wit_work_item tool not registered");
      const [, , , handler] = call;

      (mockWorkItemTrackingApi.getComments as jest.Mock).mockResolvedValue([_mockWorkItemComments]);

      const params = {
        project: "Contoso",
        workItemId: 299,
        top: 10,
      };

      const result = await handler({ action: "list_comments", ...params });

      expect(mockWorkItemTrackingApi.getComments).toHaveBeenCalledWith(params.project, params.workItemId, params.top);

      expect(result.content[0].text).toBe(JSON.stringify([_mockWorkItemComments], null, 2));
    });
  });

  describe("get_work_items_for_iteration tool", () => {
    it("should call workApi.getIterationWorkItems API with the correct parameters and return the expected result", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_work_item");

      if (!call) throw new Error("wit_work_item tool not registered");
      const [, , , handler] = call;

      (mockWorkApi.getIterationWorkItems as jest.Mock).mockResolvedValue([_mockWorkItemsForIteration]);

      const params = {
        project: "Contoso",
        team: "Fabrikam",
        iterationId: "6bfde89e-b22e-422e-814a-e8db432f5a58",
      };

      const result = await handler({ action: "list_for_iteration", ...params });

      expect(mockWorkApi.getIterationWorkItems).toHaveBeenCalledWith(
        {
          project: params.project,
          team: params.team,
        },
        params.iterationId
      );

      expect(result.content[0].text).toBe(JSON.stringify([_mockWorkItemsForIteration], null, 2));
    });
  });

  describe("list_work_item_revisions tool", () => {
    it("should call workItemApi.getRevisions API with the correct parameters and return the expected result", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_work_item");

      if (!call) throw new Error("wit_work_item tool not registered");
      const [, , , handler] = call;

      (mockWorkItemTrackingApi.getRevisions as jest.Mock).mockResolvedValue(_mockWorkItemRevisions);

      const params = {
        project: "Contoso",
        workItemId: 299,
        top: 10,
      };

      const result = await handler({ action: "list_revisions", ...params });

      expect(mockWorkItemTrackingApi.getRevisions).toHaveBeenCalledWith(params.workItemId, params.top, undefined, undefined, params.project);

      expect(result.content[0].text).toBe(JSON.stringify(_mockWorkItemRevisions, null, 2));
    });

    it("should call workItemApi.getRevisions API with expand parameter", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_work_item");

      if (!call) throw new Error("wit_work_item tool not registered");
      const [, , , handler] = call;

      (mockWorkItemTrackingApi.getRevisions as jest.Mock).mockResolvedValue(_mockWorkItemRevisions);

      const params = {
        project: "Contoso",
        workItemId: 299,
        top: 20,
        skip: 5,
        expand: "Relations",
      };

      const result = await handler({ action: "list_revisions", ...params });

      expect(mockWorkItemTrackingApi.getRevisions).toHaveBeenCalledWith(params.workItemId, params.top, params.skip, 1, params.project);

      expect(result.content[0].text).toBe(JSON.stringify(_mockWorkItemRevisions, null, 2));
    });

    it("should clean up identity fields by removing unwanted properties", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_work_item");

      if (!call) throw new Error("wit_work_item tool not registered");
      const [, , , handler] = call;

      // Create a deep copy of mock data to avoid mutating the original
      const mockDataWithIdentities = JSON.parse(JSON.stringify(_mockWorkItemRevisions));

      (mockWorkItemTrackingApi.getRevisions as jest.Mock).mockResolvedValue(mockDataWithIdentities);

      const params = {
        project: "Contoso",
        workItemId: 299,
        expand: "fields",
      };

      const result = await handler({ action: "list_revisions", ...params });

      const parsedResult = JSON.parse(result.content[0].text);

      // Check that identity fields have been cleaned up
      const firstRevisionCreatedBy = parsedResult[0].fields["System.CreatedBy"];
      expect(firstRevisionCreatedBy).toHaveProperty("displayName");
      expect(firstRevisionCreatedBy).not.toHaveProperty("url");
      expect(firstRevisionCreatedBy).not.toHaveProperty("_links");
      expect(firstRevisionCreatedBy).not.toHaveProperty("id");
      expect(firstRevisionCreatedBy).not.toHaveProperty("uniqueName");
      expect(firstRevisionCreatedBy).not.toHaveProperty("imageUrl");
      expect(firstRevisionCreatedBy).not.toHaveProperty("descriptor");
    });

    it("should handle revisions with no identity fields without errors", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_work_item");

      if (!call) throw new Error("wit_work_item tool not registered");
      const [, , , handler] = call;

      const mockRevisionsWithoutIdentities = [
        {
          id: 299,
          rev: 1,
          fields: {
            "System.Id": 299,
            "System.Title": "Test Task",
            "System.State": "New",
          },
        },
      ];

      (mockWorkItemTrackingApi.getRevisions as jest.Mock).mockResolvedValue(mockRevisionsWithoutIdentities);

      const params = {
        project: "Contoso",
        workItemId: 299,
        top: 25,
      };

      const result = await handler({ action: "list_revisions", ...params });

      expect(mockWorkItemTrackingApi.getRevisions).toHaveBeenCalledWith(params.workItemId, 25, undefined, undefined, params.project);
      expect(result.content[0].text).toBe(JSON.stringify(mockRevisionsWithoutIdentities, null, 2));
    });

    it("should use default top value of 50 when not provided", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_work_item");

      if (!call) throw new Error("wit_work_item tool not registered");
      const [, , , handler] = call;

      (mockWorkItemTrackingApi.getRevisions as jest.Mock).mockResolvedValue(_mockWorkItemRevisions);

      const params = {
        project: "Contoso",
        workItemId: 299,
        top: 50,
      };

      await handler({ action: "list_revisions", ...params });

      expect(mockWorkItemTrackingApi.getRevisions).toHaveBeenCalledWith(299, 50, undefined, undefined, "Contoso");
    });
  });

  describe("get_work_item_type tool", () => {
    it("should call workItemApi.getWorkItemType API with the correct parameters and return the expected result", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_work_item");

      if (!call) throw new Error("wit_work_item tool not registered");
      const [, , , handler] = call;

      (mockWorkItemTrackingApi.getWorkItemType as jest.Mock).mockResolvedValue([_mockWorkItemType]);

      const params = {
        project: "Contoso",
        workItemType: "Bug",
      };

      const result = await handler({ action: "get_type", ...params });

      expect(mockWorkItemTrackingApi.getWorkItemType).toHaveBeenCalledWith(params.project, params.workItemType);

      expect(result.content[0].text).toBe(JSON.stringify([_mockWorkItemType], null, 2));
    });
  });

  describe("get_query tool", () => {
    it("should call workItemApi.getQuery API with the correct parameters and return the expected result", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_query");

      if (!call) throw new Error("wit_query tool not registered");
      const [, , , handler] = call;

      (mockWorkItemTrackingApi.getQuery as jest.Mock).mockResolvedValue([_mockQuery]);

      const params = {
        project: "Contoso",
        query: "342f0f44-4069-46b1-a940-3d0468979ceb",
        expand: "None",
        depth: 1,
        includeDeleted: false,
        useIsoDateFormat: false,
      };

      const result = await handler({ action: "get", ...params });

      expect(mockWorkItemTrackingApi.getQuery).toHaveBeenCalledWith(params.project, params.query, QueryExpand.None, params.depth, params.includeDeleted, params.useIsoDateFormat);

      expect(result.content[0].text).toBe(JSON.stringify([_mockQuery], null, 2));
    });
  });

  describe("get_query_results_by_id tool", () => {
    it("should call workItemApi.getQueryById API with the correct parameters and return the expected result", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_query");

      if (!call) throw new Error("wit_query tool not registered");
      const [, , , handler] = call;

      (mockWorkItemTrackingApi.queryById as jest.Mock).mockResolvedValue([_mockQueryResults]);

      const params = {
        id: "342f0f44-4069-46b1-a940-3d0468979ceb",
        project: "Contoso",
        team: "Fabrikam",
        timePrecision: false,
        top: 50,
      };

      const result = await handler({ action: "get_results", ...params });

      expect(mockWorkItemTrackingApi.queryById).toHaveBeenCalledWith(params.id, { project: params.project, team: params.team }, params.timePrecision, params.top);

      expect(result.content[0].text).toBe(JSON.stringify([_mockQueryResults], null, 2));
    });
  });

  // Add error handling tests for existing tools

  // Add tests for optional parameters and edge cases

  describe("additional error handling for all tools", () => {
    it("should handle list_backlogs errors", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_backlog");
      if (!call) throw new Error("wit_backlog tool not registered");
      const [, , , handler] = call;

      (mockWorkApi.getBacklogs as jest.Mock).mockRejectedValue(new Error("API Error"));

      const params = {
        project: "Contoso",
        team: "Fabrikam",
      };

      const result = await handler({ action: "list", ...params });

      expect(result.content[0].text).toBe("Error listing backlogs: API Error");
      expect(result.isError).toBe(true);
    });

    it("should handle list_backlog_work_items errors", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_backlog");
      if (!call) throw new Error("wit_backlog tool not registered");
      const [, , , handler] = call;

      (mockWorkApi.getBacklogLevelWorkItems as jest.Mock).mockRejectedValue(new Error("API Error"));

      const params = {
        project: "Contoso",
        team: "Fabrikam",
        backlogId: "Microsoft.FeatureCategory",
      };

      const result = await handler({ action: "list_work_items", ...params });

      expect(result.content[0].text).toBe("Error listing backlog work items: API Error");
      expect(result.isError).toBe(true);
    });

    it("should handle my_work_items errors", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_work_item");
      if (!call) throw new Error("wit_work_item tool not registered");
      const [, , , handler] = call;

      (mockWorkApi.getPredefinedQueryResults as jest.Mock).mockRejectedValue(new Error("API Error"));

      const params = {
        project: "Contoso",
        type: "assignedtome",
        top: 50,
        includeCompleted: false,
      };

      const result = await handler({ action: "my", ...params });

      expect(result.content[0].text).toBe("Error retrieving work items: API Error");
      expect(result.isError).toBe(true);
    });

    it("should handle get_work_items_batch_by_ids errors", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_work_item");
      if (!call) throw new Error("wit_work_item tool not registered");
      const [, , , handler] = call;

      (mockWorkItemTrackingApi.getWorkItemsBatch as jest.Mock).mockRejectedValue(new Error("API Error"));

      const params = {
        ids: [1, 2, 3],
        project: "Contoso",
      };

      const result = await handler({ action: "get_batch", ...params });

      expect(result.content[0].text).toBe("Error retrieving work items batch: API Error");
      expect(result.isError).toBe(true);
    });

    it("should handle get_work_item errors", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_work_item");
      if (!call) throw new Error("wit_work_item tool not registered");
      const [, , , handler] = call;

      (mockWorkItemTrackingApi.getWorkItem as jest.Mock).mockRejectedValue(new Error("API Error"));

      const params = {
        id: 12,
        project: "Contoso",
      };

      const result = await handler({ action: "get", ...params });

      expect(result.content[0].text).toBe("Error retrieving work item: API Error");
      expect(result.isError).toBe(true);
    });

    it("should handle list_work_item_comments errors", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_work_item");
      if (!call) throw new Error("wit_work_item tool not registered");
      const [, , , handler] = call;

      (mockWorkItemTrackingApi.getComments as jest.Mock).mockRejectedValue(new Error("API Error"));

      const params = {
        project: "Contoso",
        workItemId: 299,
        top: 10,
      };

      const result = await handler({ action: "list_comments", ...params });

      expect(result.content[0].text).toBe("Error listing work item comments: API Error");
      expect(result.isError).toBe(true);
    });

    it("should handle list_work_item_revisions errors", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_work_item");
      if (!call) throw new Error("wit_work_item tool not registered");
      const [, , , handler] = call;

      (mockWorkItemTrackingApi.getRevisions as jest.Mock).mockRejectedValue(new Error("API Error"));

      const params = {
        project: "Contoso",
        workItemId: 299,
        top: 10,
      };

      const result = await handler({ action: "list_revisions", ...params });

      expect(result.content[0].text).toBe("Error listing work item revisions: API Error");
      expect(result.isError).toBe(true);
    });

    it("should handle get_work_items_for_iteration errors", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_work_item");
      if (!call) throw new Error("wit_work_item tool not registered");
      const [, , , handler] = call;

      (mockWorkApi.getIterationWorkItems as jest.Mock).mockRejectedValue(new Error("API Error"));

      const params = {
        project: "Contoso",
        team: "Fabrikam",
        iterationId: "abc-123",
      };

      const result = await handler({ action: "list_for_iteration", ...params });

      expect(result.content[0].text).toBe("Error retrieving work items for iteration: API Error");
      expect(result.isError).toBe(true);
    });

    it("should handle get_work_item_type errors", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_work_item");
      if (!call) throw new Error("wit_work_item tool not registered");
      const [, , , handler] = call;

      (mockWorkItemTrackingApi.getWorkItemType as jest.Mock).mockRejectedValue(new Error("API Error"));

      const params = {
        project: "Contoso",
        workItemType: "Bug",
      };

      const result = await handler({ action: "get_type", ...params });

      expect(result.content[0].text).toBe("Error retrieving work item type: API Error");
      expect(result.isError).toBe(true);
    });

    it("should handle get_query errors", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_query");
      if (!call) throw new Error("wit_query tool not registered");
      const [, , , handler] = call;

      (mockWorkItemTrackingApi.getQuery as jest.Mock).mockRejectedValue(new Error("API Error"));

      const params = {
        project: "Contoso",
        query: "342f0f44-4069-46b1-a940-3d0468979ceb",
        depth: 1,
        includeDeleted: false,
        useIsoDateFormat: false,
      };

      const result = await handler({ action: "get", ...params });

      expect(result.content[0].text).toBe("Error retrieving query: API Error");
      expect(result.isError).toBe(true);
    });

    it("should handle get_query_results_by_id errors", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_query");
      if (!call) throw new Error("wit_query tool not registered");
      const [, , , handler] = call;

      (mockWorkItemTrackingApi.queryById as jest.Mock).mockRejectedValue(new Error("API Error"));

      const params = {
        id: "342f0f44-4069-46b1-a940-3d0468979ceb",
        project: "Contoso",
        team: "Fabrikam",
        timePrecision: false,
        top: 50,
      };

      const result = await handler({ action: "get_results", ...params });

      expect(result.content[0].text).toBe("Error retrieving query results: API Error");
      expect(result.isError).toBe(true);
    });

    it("should handle get_query_results_by_id with responseType ids", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_query");
      if (!call) throw new Error("wit_query tool not registered");
      const [, , , handler] = call;

      const mockQueryResultsWithIds = {
        workItems: [{ id: 1 }, { id: 2 }, { id: 3 }],
      };

      (mockWorkItemTrackingApi.queryById as jest.Mock).mockResolvedValue(mockQueryResultsWithIds);

      const params = {
        id: "342f0f44-4069-46b1-a940-3d0468979ceb",
        project: "Contoso",
        responseType: "ids",
      };

      const result = await handler({ action: "get_results", ...params });

      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult.ids).toEqual([1, 2, 3]);
      expect(parsedResult.count).toBe(3);
    });
  });

  describe("wit_get_work_item_attachment tool", () => {
    function makeReadableStream(data: Buffer): NodeJS.ReadableStream {
      const stream = new Readable();
      stream.push(data);
      stream.push(null);
      return stream;
    }

    it("should return attachment content as a base64 image resource", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_work_item_attachment");
      if (!call) throw new Error("wit_work_item_attachment tool not registered");
      const [, , , handler] = call;

      const fakeImageData = Buffer.from("fake-png-bytes");
      mockWorkItemTrackingApi.getAttachmentContent.mockResolvedValue(makeReadableStream(fakeImageData));

      const params = {
        project: "TestProject",
        attachmentId: "12341234-1234-1234-1234-123412341234",
        fileName: "screenshot.png",
      };

      const result = await handler({ action: "add_artifact_link", ...params });

      expect(mockWorkItemTrackingApi.getAttachmentContent).toHaveBeenCalledWith(params.attachmentId, params.fileName, params.project);

      const base64Data = fakeImageData.toString("base64");
      expect(result.content[0].type).toBe("resource");
      expect(result.content[0].resource.mimeType).toBe("image/png");
      expect(result.content[0].resource.blob).toBe(base64Data);
      expect(result.content[0].resource.uri).toBe(`data:image/png;base64,${base64Data}`);
    });

    it("should use application/octet-stream for an unknown file extension", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_work_item_attachment");
      if (!call) throw new Error("wit_work_item_attachment tool not registered");
      const [, , , handler] = call;

      const fakeData = Buffer.from("binary-data");
      mockWorkItemTrackingApi.getAttachmentContent.mockResolvedValue(makeReadableStream(fakeData));

      const result = await handler({ action: "add_artifact_link", project: "TestProject", attachmentId: "12341234-1234-1234-1234-123412341234", fileName: "data.xyz" });

      expect(result.content[0].resource.mimeType).toBe("application/octet-stream");
    });

    it("should use application/octet-stream when fileName is omitted", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_work_item_attachment");
      if (!call) throw new Error("wit_work_item_attachment tool not registered");
      const [, , , handler] = call;

      const fakeData = Buffer.from("binary-data");
      mockWorkItemTrackingApi.getAttachmentContent.mockResolvedValue(makeReadableStream(fakeData));

      const result = await handler({ action: "add_artifact_link", project: "TestProject", attachmentId: "12341234-1234-1234-1234-123412341234" });

      expect(result.content[0].resource.mimeType).toBe("application/octet-stream");
    });

    it("should return an error when getAttachmentContent rejects", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_work_item_attachment");
      if (!call) throw new Error("wit_work_item_attachment tool not registered");
      const [, , , handler] = call;

      mockWorkItemTrackingApi.getAttachmentContent.mockRejectedValue(new Error("Not found"));

      const result = await handler({ action: "add_artifact_link", project: "TestProject", attachmentId: "12341234-1234-1234-1234-123412341234", fileName: "screenshot.png" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("Error retrieving work item attachment: Not found");
    });

    it("should save file to disk and return path text when savePath is provided", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_work_item_attachment");
      if (!call) throw new Error("wit_work_item_attachment tool not registered");
      const [, , , handler] = call;

      const fakeData = Buffer.from("fake-png-bytes");
      mockWorkItemTrackingApi.getAttachmentContent.mockResolvedValue(makeReadableStream(fakeData));
      const writeFileSyncMock = jest.spyOn(fs, "writeFileSync").mockImplementation(() => undefined);

      const params = {
        project: "TestProject",
        attachmentId: "12341234-1234-1234-1234-123412341234",
        fileName: "screenshot.png",
        savePath: "downloads/attachments",
      };

      const result = await handler({ action: "add_artifact_link", ...params });

      const expectedPath = path.join("downloads/attachments", "screenshot.png");
      expect(writeFileSyncMock).toHaveBeenCalledWith(expectedPath, fakeData);
      expect(result.content[0].type).toBe("text");
      expect(result.content[0].text).toBe(`Attachment saved to: ${expectedPath}`);

      writeFileSyncMock.mockRestore();
    });

    it("should use attachmentId as filename when savePath is provided but fileName is omitted", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_work_item_attachment");
      if (!call) throw new Error("wit_work_item_attachment tool not registered");
      const [, , , handler] = call;

      const fakeData = Buffer.from("binary-data");
      mockWorkItemTrackingApi.getAttachmentContent.mockResolvedValue(makeReadableStream(fakeData));
      const writeFileSyncMock = jest.spyOn(fs, "writeFileSync").mockImplementation(() => undefined);

      const attachmentId = "12341234-1234-1234-1234-123412341234";
      const params = {
        project: "TestProject",
        attachmentId,
        savePath: "downloads/attachments",
      };

      const result = await handler({ action: "add_artifact_link", ...params });

      const expectedPath = path.join("downloads/attachments", attachmentId);
      expect(writeFileSyncMock).toHaveBeenCalledWith(expectedPath, fakeData);
      expect(result.content[0].text).toBe(`Attachment saved to: ${expectedPath}`);

      writeFileSyncMock.mockRestore();
    });

    it("should throw an error if the file already exists at the savePath", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_work_item_attachment");
      if (!call) throw new Error("wit_work_item_attachment tool not registered");
      const [, , , handler] = call;

      const fakeData = Buffer.from("fake-png-bytes");
      mockWorkItemTrackingApi.getAttachmentContent.mockResolvedValue(makeReadableStream(fakeData));
      jest.spyOn(fs, "existsSync").mockReturnValue(true);

      const params = {
        project: "TestProject",
        attachmentId: "12341234-1234-1234-1234-123412341234",
        fileName: "screenshot.png",
        savePath: "downloads/attachments",
      };

      const expectedPath = path.join("downloads/attachments", "screenshot.png");
      const result = await handler({ action: "add_artifact_link", ...params });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe(`Error retrieving work item attachment: File already exists: ${expectedPath}`);

      jest.restoreAllMocks();
    });

    it("should return text content for markdown files when savePath is not provided", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_work_item_attachment");
      if (!call) throw new Error("wit_work_item_attachment tool not registered");
      const [, , , handler] = call;

      const markdownContent = "# Hello\n\nThis is a markdown file.";
      const fakeData = Buffer.from(markdownContent, "utf-8");
      mockWorkItemTrackingApi.getAttachmentContent.mockResolvedValue(makeReadableStream(fakeData));

      const result = await handler({ action: "add_artifact_link", project: "TestProject", attachmentId: "12341234-1234-1234-1234-123412341234", fileName: "notes.md" });

      expect(result.content[0].type).toBe("text");
      expect(result.content[0].text).toBe(markdownContent);
    });

    it("should return text content for plain text files when savePath is not provided", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_work_item_attachment");
      if (!call) throw new Error("wit_work_item_attachment tool not registered");
      const [, , , handler] = call;

      const textContent = "Hello, world!";
      const fakeData = Buffer.from(textContent, "utf-8");
      mockWorkItemTrackingApi.getAttachmentContent.mockResolvedValue(makeReadableStream(fakeData));

      const result = await handler({ action: "add_artifact_link", project: "TestProject", attachmentId: "12341234-1234-1234-1234-123412341234", fileName: "readme.txt" });

      expect(result.content[0].type).toBe("text");
      expect(result.content[0].text).toBe(textContent);
    });

    it("should reject savePath with a Unix absolute path", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_work_item_attachment");
      if (!call) throw new Error("wit_work_item_attachment tool not registered");
      const [, , , handler] = call;

      const params = {
        project: "TestProject",
        attachmentId: "12341234-1234-1234-1234-123412341234",
        fileName: "screenshot.png",
        savePath: "/tmp/attachments",
      };

      await expect(handler({ ...params })).rejects.toThrow("Invalid savePath: absolute paths and path traversals are not allowed.");
      expect(connectionProvider).not.toHaveBeenCalled();
    });

    it("should reject savePath with a Windows absolute path", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_work_item_attachment");
      if (!call) throw new Error("wit_work_item_attachment tool not registered");
      const [, , , handler] = call;

      const params = {
        project: "TestProject",
        attachmentId: "12341234-1234-1234-1234-123412341234",
        fileName: "screenshot.png",
        savePath: "C:\\temp\\attachments",
      };

      await expect(handler({ ...params })).rejects.toThrow("Invalid savePath: absolute paths and path traversals are not allowed.");
      expect(connectionProvider).not.toHaveBeenCalled();
    });

    it("should reject savePath with path traversal segments", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_work_item_attachment");
      if (!call) throw new Error("wit_work_item_attachment tool not registered");
      const [, , , handler] = call;

      const params = {
        project: "TestProject",
        attachmentId: "12341234-1234-1234-1234-123412341234",
        fileName: "screenshot.png",
        savePath: "../../etc",
      };

      await expect(handler({ ...params })).rejects.toThrow("Invalid savePath: absolute paths and path traversals are not allowed.");
      expect(connectionProvider).not.toHaveBeenCalled();
    });

    it("should reject savePath with a Windows drive-relative path", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_work_item_attachment");
      if (!call) throw new Error("wit_work_item_attachment tool not registered");
      const [, , , handler] = call;

      const params = {
        project: "TestProject",
        attachmentId: "12341234-1234-1234-1234-123412341234",
        fileName: "screenshot.png",
        savePath: "D:attachments",
      };

      await expect(handler({ ...params })).rejects.toThrow("Invalid savePath: absolute paths and path traversals are not allowed.");
      expect(connectionProvider).not.toHaveBeenCalled();
    });

    it("should reject fileName with path traversal segments", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_work_item_attachment");
      if (!call) throw new Error("wit_work_item_attachment tool not registered");
      const [, , , handler] = call;

      const params = {
        project: "TestProject",
        attachmentId: "12341234-1234-1234-1234-123412341234",
        fileName: "../../etc/passwd",
        savePath: "downloads",
      };

      await expect(handler({ ...params })).rejects.toThrow("Invalid fileName: path traversal is not allowed.");
      expect(connectionProvider).not.toHaveBeenCalled();
    });
  });

  describe("query_by_wiql tool", () => {
    it("should call queryByWiql with correct params when project is provided", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_query");
      if (!call) throw new Error("wit_query tool not registered");
      const [, , , handler] = call;

      (mockWorkItemTrackingApi.queryByWiql as jest.Mock).mockResolvedValue(_mockWiqlQueryResults);

      const params = {
        wiql: "SELECT [System.Id], [System.Title] FROM WorkItems WHERE [System.TeamProject] = @project",
        project: "Contoso",
        team: undefined,
        timePrecision: undefined,
        top: 50,
      };

      const result = await handler({ action: "wiql", ...params });

      expect(mockWorkItemTrackingApi.queryByWiql).toHaveBeenCalledWith({ query: params.wiql }, { project: params.project, team: undefined }, undefined, 50);
      expect(result.content[0].text).toContain("UNTRUSTED");
      expect(result.content[0].text).toContain(JSON.stringify(_mockWiqlQueryResults, null, 2));
    });

    it("should call queryByWiql with all optional params when provided", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_query");
      if (!call) throw new Error("wit_query tool not registered");
      const [, , , handler] = call;

      (mockWorkItemTrackingApi.queryByWiql as jest.Mock).mockResolvedValue(_mockWiqlQueryResults);

      const params = {
        wiql: "SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = @project AND [System.State] = 'Active'",
        project: "Contoso",
        team: "Fabrikam",
        timePrecision: true,
        top: 100,
      };

      const result = await handler({ action: "wiql", ...params });

      expect(mockWorkItemTrackingApi.queryByWiql).toHaveBeenCalledWith({ query: params.wiql }, { project: "Contoso", team: "Fabrikam" }, true, 100);
      expect(result.content[0].text).toContain("UNTRUSTED");
      expect(result.content[0].text).toContain(JSON.stringify(_mockWiqlQueryResults, null, 2));
    });

    it("should elicit project when project is not provided and user accepts", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_query");
      if (!call) throw new Error("wit_query tool not registered");
      const [, , , handler] = call;

      const mockCoreApi = { getProjects: jest.fn().mockResolvedValue([{ id: "proj-1", name: "Contoso" }]) };
      (mockConnection.getCoreApi as jest.Mock).mockResolvedValue(mockCoreApi);

      ((server as unknown as { server: { elicitInput: jest.Mock } }).server.elicitInput as jest.Mock).mockResolvedValue({
        action: "accept",
        content: { project: "Contoso" },
      });

      (mockWorkItemTrackingApi.queryByWiql as jest.Mock).mockResolvedValue(_mockWiqlQueryResults);

      const params = {
        wiql: "SELECT [System.Id] FROM WorkItems",
        project: undefined,
        team: undefined,
        timePrecision: undefined,
        top: 50,
      };

      const result = await handler({ action: "wiql", ...params });

      expect((server as unknown as { server: { elicitInput: jest.Mock } }).server.elicitInput).toHaveBeenCalled();
      expect(mockWorkItemTrackingApi.queryByWiql).toHaveBeenCalledWith({ query: params.wiql }, { project: "Contoso", team: undefined }, undefined, 50);
      expect(result.content[0].text).toContain("UNTRUSTED");
      expect(result.content[0].text).toContain(JSON.stringify(_mockWiqlQueryResults, null, 2));
    });

    it("should return cancellation message when user declines project elicitation", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_query");
      if (!call) throw new Error("wit_query tool not registered");
      const [, , , handler] = call;

      const mockCoreApi = { getProjects: jest.fn().mockResolvedValue([{ id: "proj-1", name: "Contoso" }]) };
      (mockConnection.getCoreApi as jest.Mock).mockResolvedValue(mockCoreApi);

      ((server as unknown as { server: { elicitInput: jest.Mock } }).server.elicitInput as jest.Mock).mockResolvedValue({
        action: "decline",
      });

      const params = {
        wiql: "SELECT [System.Id] FROM WorkItems",
        project: undefined,
        team: undefined,
        timePrecision: undefined,
        top: 50,
      };

      const result = await handler({ action: "wiql", ...params });

      expect(mockWorkItemTrackingApi.queryByWiql).not.toHaveBeenCalled();
      expect(result.content[0].text).toBe("Project selection cancelled.");
    });

    it("should return an error when queryByWiql throws", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_query");
      if (!call) throw new Error("wit_query tool not registered");
      const [, , , handler] = call;

      (mockWorkItemTrackingApi.queryByWiql as jest.Mock).mockRejectedValue(new Error("WIQL syntax error"));

      const params = {
        wiql: "INVALID WIQL",
        project: "Contoso",
        team: undefined,
        timePrecision: undefined,
        top: 50,
      };

      const result = await handler({ action: "wiql", ...params });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("Error executing WIQL query: WIQL syntax error");
    });
  });

  describe("elicitation decline paths", () => {
    // Helper to set up getCoreApi mock for elicitation
    function setupElicitMocks(elicitAction: "accept" | "decline", selectedProject = "Contoso", selectedTeam = "Fabrikam") {
      (mockConnection.getCoreApi as jest.Mock).mockResolvedValue({
        getProjects: jest.fn().mockResolvedValue([{ id: "proj-1", name: selectedProject }]),
        getTeams: jest.fn().mockResolvedValue([{ id: "team-1", name: selectedTeam }]),
      });
      ((server as unknown as { server: { elicitInput: jest.Mock } }).server.elicitInput as jest.Mock).mockResolvedValue(
        elicitAction === "accept" ? { action: "accept", content: { project: selectedProject, team: selectedTeam } } : { action: "decline" }
      );
    }

    it("list_backlogs: should return elicitation response when project selection is declined", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_backlog");
      if (!call) throw new Error("wit_backlog not registered");
      const [, , , handler] = call;

      setupElicitMocks("decline");

      const result = await handler({ action: "list", team: "Fabrikam" });
      expect(result.content[0].text).toBe("Project selection cancelled.");
    });

    it("list_backlogs: should use elicited project and return elicitation response when team selection is declined", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_backlog");
      if (!call) throw new Error("wit_backlog not registered");
      const [, , , handler] = call;

      setupElicitMocks("decline");

      const result = await handler({ action: "list", project: "Contoso" });
      expect(result.content[0].text).toBe("Team selection cancelled.");
    });

    it("list_backlog_work_items: should return elicitation response when project selection is declined", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_backlog");
      if (!call) throw new Error("wit_backlog not registered");
      const [, , , handler] = call;

      setupElicitMocks("decline");

      const result = await handler({ action: "list_work_items", team: "Fabrikam", backlogId: "Microsoft.FeatureCategory" });
      expect(result.content[0].text).toBe("Project selection cancelled.");
    });

    it("list_backlog_work_items: should return elicitation response when team selection is declined", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_backlog");
      if (!call) throw new Error("wit_backlog not registered");
      const [, , , handler] = call;

      setupElicitMocks("decline");

      const result = await handler({ action: "list_work_items", project: "Contoso", backlogId: "Microsoft.FeatureCategory" });
      expect(result.content[0].text).toBe("Team selection cancelled.");
    });

    it("my_work_items: should return elicitation response when project selection is declined", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_work_item");
      if (!call) throw new Error("wit_work_item not registered");
      const [, , , handler] = call;

      setupElicitMocks("decline");

      const result = await handler({ action: "my", type: "assignedtome", top: 50, includeCompleted: false });
      expect(result.content[0].text).toBe("Project selection cancelled.");
    });

    it("get_work_items_batch_by_ids: should return elicitation response when project selection is declined", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_work_item");
      if (!call) throw new Error("wit_work_item not registered");
      const [, , , handler] = call;

      setupElicitMocks("decline");

      const result = await handler({ action: "get_batch", ids: [1, 2] });
      expect(result.content[0].text).toBe("Project selection cancelled.");
    });

    it("get_work_item: should return elicitation response when project selection is declined", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_work_item");
      if (!call) throw new Error("wit_work_item not registered");
      const [, , , handler] = call;

      setupElicitMocks("decline");

      const result = await handler({ action: "get", id: 1 });
      expect(result.content[0].text).toBe("Project selection cancelled.");
    });

    it("list_work_item_comments: should return elicitation response when project selection is declined", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_work_item");
      if (!call) throw new Error("wit_work_item not registered");
      const [, , , handler] = call;

      setupElicitMocks("decline");

      const result = await handler({ action: "list_comments", workItemId: 1, top: 10 });
      expect(result.content[0].text).toBe("Project selection cancelled.");
    });

    it("list_work_item_revisions: should return elicitation response when project selection is declined", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_work_item");
      if (!call) throw new Error("wit_work_item not registered");
      const [, , , handler] = call;

      setupElicitMocks("decline");

      const result = await handler({ action: "list_revisions", workItemId: 1, top: 10 });
      expect(result.content[0].text).toBe("Project selection cancelled.");
    });

    it("get_work_items_for_iteration: should return elicitation response when project selection is declined", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_work_item");
      if (!call) throw new Error("wit_work_item not registered");
      const [, , , handler] = call;

      setupElicitMocks("decline");

      const result = await handler({ action: "list_for_iteration", iterationId: "iter-1" });
      expect(result.content[0].text).toBe("Project selection cancelled.");
    });

    it("get_work_item_type: should return elicitation response when project selection is declined", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_work_item");
      if (!call) throw new Error("wit_work_item not registered");
      const [, , , handler] = call;

      setupElicitMocks("decline");

      const result = await handler({ action: "get_type", workItemType: "Bug" });
      expect(result.content[0].text).toBe("Project selection cancelled.");
    });

    it("get_query: should return elicitation response when project selection is declined", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_query");
      if (!call) throw new Error("wit_query not registered");
      const [, , , handler] = call;

      setupElicitMocks("decline");

      const result = await handler({ action: "get", query: "some-query-id", depth: 0, includeDeleted: false, useIsoDateFormat: false });
      expect(result.content[0].text).toBe("Project selection cancelled.");
    });

    it("get_work_item_attachment: should return elicitation response when project selection is declined", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_work_item_attachment");
      if (!call) throw new Error("wit_work_item_attachment not registered");
      const [, , , handler] = call;

      setupElicitMocks("decline");

      const result = await handler({ attachmentId: "12341234-1234-1234-1234-123412341234", fileName: "screenshot.png" });
      expect(result.content[0].text).toBe("Project selection cancelled.");
    });
  });

  describe("elicitation accept paths", () => {
    function setupAcceptMocks(selectedProject = "Contoso", selectedTeam = "Fabrikam") {
      (mockConnection.getCoreApi as jest.Mock).mockResolvedValue({
        getProjects: jest.fn().mockResolvedValue([{ id: "proj-1", name: selectedProject }]),
        getTeams: jest.fn().mockResolvedValue([{ id: "team-1", name: selectedTeam }]),
      });
      ((server as unknown as { server: { elicitInput: jest.Mock } }).server.elicitInput as jest.Mock).mockResolvedValue({
        action: "accept",
        content: { project: selectedProject, team: selectedTeam },
      });
    }

    it("list_backlogs: should use elicited project when project is not provided", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_backlog");
      if (!call) throw new Error("wit_backlog not registered");
      const [, , , handler] = call;

      setupAcceptMocks();
      (mockWorkApi.getBacklogs as jest.Mock).mockResolvedValue([]);

      await handler({ action: "list", team: "Fabrikam" });
      expect(mockWorkApi.getBacklogs).toHaveBeenCalledWith({ project: "Contoso", team: "Fabrikam" });
    });

    it("list_backlogs: should use elicited team when team is not provided", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_backlog");
      if (!call) throw new Error("wit_backlog not registered");
      const [, , , handler] = call;

      setupAcceptMocks();
      (mockWorkApi.getBacklogs as jest.Mock).mockResolvedValue([]);

      await handler({ action: "list", project: "Contoso" });
      expect(mockWorkApi.getBacklogs).toHaveBeenCalledWith({ project: "Contoso", team: "Fabrikam" });
    });

    it("list_backlog_work_items: should use elicited project when project is not provided", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_backlog");
      if (!call) throw new Error("wit_backlog not registered");
      const [, , , handler] = call;

      setupAcceptMocks();
      (mockWorkApi.getBacklogLevelWorkItems as jest.Mock).mockResolvedValue([]);

      await handler({ action: "list_work_items", team: "Fabrikam", backlogId: "Microsoft.FeatureCategory" });
      expect(mockWorkApi.getBacklogLevelWorkItems).toHaveBeenCalledWith({ project: "Contoso", team: "Fabrikam" }, "Microsoft.FeatureCategory");
    });

    it("list_backlog_work_items: should use elicited team when team is not provided", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_backlog");
      if (!call) throw new Error("wit_backlog not registered");
      const [, , , handler] = call;

      setupAcceptMocks();
      (mockWorkApi.getBacklogLevelWorkItems as jest.Mock).mockResolvedValue([]);

      await handler({ action: "list_work_items", project: "Contoso", backlogId: "Microsoft.FeatureCategory" });
      expect(mockWorkApi.getBacklogLevelWorkItems).toHaveBeenCalledWith({ project: "Contoso", team: "Fabrikam" }, "Microsoft.FeatureCategory");
    });

    it("my_work_items: should use elicited project when project is not provided", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_work_item");
      if (!call) throw new Error("wit_work_item not registered");
      const [, , , handler] = call;

      setupAcceptMocks();
      (mockWorkApi.getPredefinedQueryResults as jest.Mock).mockResolvedValue([]);

      await handler({ action: "my", type: "assignedtome", top: 10, includeCompleted: false });
      expect(mockWorkApi.getPredefinedQueryResults).toHaveBeenCalledWith("Contoso", "assignedtome", 10, false);
    });

    it("get_work_items_batch_by_ids: should use elicited project when project is not provided", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_work_item");
      if (!call) throw new Error("wit_work_item not registered");
      const [, , , handler] = call;

      setupAcceptMocks();
      (mockWorkItemTrackingApi.getWorkItemsBatch as jest.Mock).mockResolvedValue([]);

      await handler({ action: "get_batch", ids: [1, 2] });
      expect(mockWorkItemTrackingApi.getWorkItemsBatch).toHaveBeenCalledWith({ ids: [1, 2], fields: expect.any(Array) }, "Contoso");
    });

    it("get_work_item: should use elicited project when project is not provided", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_work_item");
      if (!call) throw new Error("wit_work_item not registered");
      const [, , , handler] = call;

      setupAcceptMocks();
      (mockWorkItemTrackingApi.getWorkItem as jest.Mock).mockResolvedValue({ id: 1 });

      await handler({ action: "get", id: 1 });
      expect(mockWorkItemTrackingApi.getWorkItem).toHaveBeenCalledWith(1, undefined, undefined, undefined, "Contoso");
    });

    it("list_work_item_comments: should use elicited project when project is not provided", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_work_item");
      if (!call) throw new Error("wit_work_item not registered");
      const [, , , handler] = call;

      setupAcceptMocks();
      (mockWorkItemTrackingApi.getComments as jest.Mock).mockResolvedValue([]);

      await handler({ action: "list_comments", workItemId: 1, top: 10 });
      expect(mockWorkItemTrackingApi.getComments).toHaveBeenCalledWith("Contoso", 1, 10);
    });

    it("list_work_item_revisions: should use elicited project when project is not provided", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_work_item");
      if (!call) throw new Error("wit_work_item not registered");
      const [, , , handler] = call;

      setupAcceptMocks();
      (mockWorkItemTrackingApi.getRevisions as jest.Mock).mockResolvedValue([]);

      await handler({ action: "list_revisions", workItemId: 1, top: 10 });
      expect(mockWorkItemTrackingApi.getRevisions).toHaveBeenCalledWith(1, 10, undefined, undefined, "Contoso");
    });

    it("get_work_items_for_iteration: should use elicited project when project is not provided", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_work_item");
      if (!call) throw new Error("wit_work_item not registered");
      const [, , , handler] = call;

      setupAcceptMocks();
      (mockWorkApi.getIterationWorkItems as jest.Mock).mockResolvedValue([]);

      await handler({ action: "list_for_iteration", iterationId: "iter-1" });
      expect(mockWorkApi.getIterationWorkItems).toHaveBeenCalledWith({ project: "Contoso", team: undefined }, "iter-1");
    });

    it("get_work_item_type: should use elicited project when project is not provided", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_work_item");
      if (!call) throw new Error("wit_work_item not registered");
      const [, , , handler] = call;

      setupAcceptMocks();
      (mockWorkItemTrackingApi.getWorkItemType as jest.Mock).mockResolvedValue({});

      await handler({ action: "get_type", workItemType: "Bug" });
      expect(mockWorkItemTrackingApi.getWorkItemType).toHaveBeenCalledWith("Contoso", "Bug");
    });

    it("get_query: should use elicited project when project is not provided", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_query");
      if (!call) throw new Error("wit_query not registered");
      const [, , , handler] = call;

      setupAcceptMocks();
      (mockWorkItemTrackingApi.getQuery as jest.Mock).mockResolvedValue({});

      await handler({ action: "get", query: "some-query-id", depth: 0, includeDeleted: false, useIsoDateFormat: false });
      expect(mockWorkItemTrackingApi.getQuery).toHaveBeenCalledWith("Contoso", "some-query-id", undefined, 0, false, false);
    });

    it("get_work_item_attachment: should use elicited project when project is not provided", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_work_item_attachment");
      if (!call) throw new Error("wit_work_item_attachment not registered");
      const [, , , handler] = call;

      setupAcceptMocks();
      const fakeStream = new Readable();
      fakeStream.push(Buffer.from("data"));
      fakeStream.push(null);
      (mockWorkItemTrackingApi.getAttachmentContent as jest.Mock).mockResolvedValue(fakeStream);

      await handler({ attachmentId: "12341234-1234-1234-1234-123412341234", fileName: "screenshot.png" });
      expect(mockWorkItemTrackingApi.getAttachmentContent).toHaveBeenCalledWith("12341234-1234-1234-1234-123412341234", "screenshot.png", "Contoso");
    });
  });

  describe("unknown error type branch coverage", () => {
    // Helper to get handler for a tool
    function getHandler(toolName: string) {
      configureWorkItemTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([name]) => name === toolName);
      if (!call) throw new Error(`${toolName} not registered`);
      return call[3] as (params: Record<string, unknown>) => Promise<{ content: { text: string }[]; isError?: boolean }>;
    }

    it("list_backlogs: should return unknown error message for non-Error throws", async () => {
      const handler = getHandler("wit_backlog");
      (connectionProvider as jest.Mock).mockRejectedValue("string error");
      const result = await handler({ action: "list", project: "P", team: "T" });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("Error listing backlogs: Unknown error occurred");
    });

    it("list_backlog_work_items: should return unknown error message for non-Error throws", async () => {
      const handler = getHandler("wit_backlog");
      (connectionProvider as jest.Mock).mockRejectedValue("string error");
      const result = await handler({ action: "list_work_items", project: "P", team: "T", backlogId: "B" });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("Error listing backlog work items: Unknown error occurred");
    });

    it("my_work_items: should return unknown error message for non-Error throws", async () => {
      const handler = getHandler("wit_work_item");
      (connectionProvider as jest.Mock).mockRejectedValue("string error");
      const result = await handler({ action: "my", project: "P", type: "assignedtome", top: 10, includeCompleted: false });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("Error retrieving work items: Unknown error occurred");
    });

    it("get_work_items_batch_by_ids: should return unknown error message for non-Error throws", async () => {
      const handler = getHandler("wit_work_item");
      (connectionProvider as jest.Mock).mockRejectedValue("string error");
      const result = await handler({ action: "get_batch", project: "P", ids: [1] });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("Error retrieving work items batch: Unknown error occurred");
    });

    it("get_work_item: should return unknown error message for non-Error throws", async () => {
      const handler = getHandler("wit_work_item");
      (connectionProvider as jest.Mock).mockRejectedValue("string error");
      const result = await handler({ action: "get", id: 1, project: "P" });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("Error retrieving work item: Unknown error occurred");
    });

    it("list_work_item_comments: should return unknown error message for non-Error throws", async () => {
      const handler = getHandler("wit_work_item");
      (connectionProvider as jest.Mock).mockRejectedValue("string error");
      const result = await handler({ action: "list_comments", project: "P", workItemId: 1, top: 10 });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("Error listing work item comments: Unknown error occurred");
    });

    it("list_work_item_revisions: should return unknown error message for non-Error throws", async () => {
      const handler = getHandler("wit_work_item");
      (connectionProvider as jest.Mock).mockRejectedValue("string error");
      const result = await handler({ action: "list_revisions", project: "P", workItemId: 1, top: 10 });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("Error listing work item revisions: Unknown error occurred");
    });

    it("list_work_item_revisions: should handle null revisions without errors", async () => {
      const handler = getHandler("wit_work_item");
      (mockWorkItemTrackingApi.getRevisions as jest.Mock).mockResolvedValue(null);
      const result = await handler({ action: "list_revisions", project: "P", workItemId: 1, top: 10 });
      expect(result.content[0].text).toBe(JSON.stringify(null, null, 2));
    });

    it("get_work_items_for_iteration: should return unknown error message for non-Error throws", async () => {
      const handler = getHandler("wit_work_item");
      (connectionProvider as jest.Mock).mockRejectedValue("string error");
      const result = await handler({ action: "list_for_iteration", project: "P", iterationId: "iter-1" });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("Error retrieving work items for iteration: Unknown error occurred");
    });

    it("get_work_item_type: should return unknown error message for non-Error throws", async () => {
      const handler = getHandler("wit_work_item");
      (mockWorkItemTrackingApi.getWorkItemType as jest.Mock).mockRejectedValue("string error");
      const result = await handler({ action: "get_type", project: "P", workItemType: "Bug" });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("Error retrieving work item type: Unknown error occurred");
    });

    it("get_query: should return unknown error message for non-Error throws", async () => {
      const handler = getHandler("wit_query");
      (mockWorkItemTrackingApi.getQuery as jest.Mock).mockRejectedValue("string error");
      const result = await handler({ action: "get", project: "P", query: "q", depth: 0, includeDeleted: false, useIsoDateFormat: false });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("Error retrieving query: Unknown error occurred");
    });

    it("get_query_results_by_id: should return unknown error message for non-Error throws", async () => {
      const handler = getHandler("wit_query");
      (mockWorkItemTrackingApi.queryById as jest.Mock).mockRejectedValue("string error");
      const result = await handler({ action: "get_results", id: "q-id", project: "P", top: 10 });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("Error retrieving query results: Unknown error occurred");
    });

    it("get_query_results_by_id: should handle null workItems in ids mode", async () => {
      const handler = getHandler("wit_query");
      (mockWorkItemTrackingApi.queryById as jest.Mock).mockResolvedValue({ workItems: null });
      const result = await handler({ action: "get_results", id: "q-id", project: "P", responseType: "ids", top: 50 });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.ids).toEqual([]);
      expect(parsed.count).toBe(0);
    });

    it("get_work_item_attachment: should return unknown error message for non-Error throws", async () => {
      const handler = getHandler("wit_work_item_attachment");
      (mockWorkItemTrackingApi.getAttachmentContent as jest.Mock).mockRejectedValue("string error");
      const result = await handler({ project: "P", attachmentId: "att-id" });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("Error retrieving work item attachment: Unknown error occurred");
    });

    it("query_by_wiql: should return unknown error message for non-Error throws", async () => {
      const handler = getHandler("wit_query");
      (mockWorkItemTrackingApi.queryByWiql as jest.Mock).mockRejectedValue("string error");
      const result = await handler({ action: "wiql", wiql: "SELECT [System.Id] FROM WorkItems", project: "P", top: 50 });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("Error executing WIQL query: Unknown error occurred");
    });

    it("list_work_item_revisions: should handle revision without fields property", async () => {
      const handler = getHandler("wit_work_item");
      const revisionsWithNoFields = [
        { id: 1, rev: 1 }, // no fields property
        { id: 2, rev: 2, fields: { "System.Title": "Test" } },
      ];
      (mockWorkItemTrackingApi.getRevisions as jest.Mock).mockResolvedValue(revisionsWithNoFields);
      const result = await handler({ action: "list_revisions", project: "P", workItemId: 1, top: 10 });
      expect(result.content[0].text).toBe(JSON.stringify(revisionsWithNoFields, null, 2));
    });

    it("wit_work_item: should return unknown action for unrecognized action", async () => {
      const handler = getHandler("wit_work_item");
      const result = await handler({ action: "invalid_action" as string, project: "P" });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("Unknown action: invalid_action");
    });

    it("wit_query: should return unknown action for unrecognized action", async () => {
      const handler = getHandler("wit_query");
      const result = await handler({ action: "invalid_action" as string, project: "P" });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("Unknown action: invalid_action");
    });

    it("wit_backlog: should return unknown action for unrecognized action", async () => {
      const handler = getHandler("wit_backlog");
      const result = await handler({ action: "invalid_action" as string, project: "P", team: "T" });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("Unknown action: invalid_action");
    });

    // wit_work_item required param guards
    it("wit_work_item.get: should return error when id is missing", async () => {
      const handler = getHandler("wit_work_item");
      const result = await handler({ action: "get", project: "P" });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("id is required for get");
    });

    it("wit_work_item.get_batch: should return error when ids is missing", async () => {
      const handler = getHandler("wit_work_item");
      const result = await handler({ action: "get_batch", project: "P" });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("ids is required for get_batch");
    });

    it("wit_work_item.list_comments: should return error when workItemId is missing", async () => {
      const handler = getHandler("wit_work_item");
      const result = await handler({ action: "list_comments", project: "P" });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("workItemId is required for list_comments");
    });

    it("wit_work_item.list_comments: should use default top of 50 when not provided", async () => {
      const handler = getHandler("wit_work_item");
      (mockWorkItemTrackingApi.getComments as jest.Mock).mockResolvedValue([]);
      await handler({ action: "list_comments", project: "P", workItemId: 1 });
      expect(mockWorkItemTrackingApi.getComments).toHaveBeenCalledWith("P", 1, 50);
    });

    it("wit_work_item.my: should use defaults when type, top and includeCompleted are not provided", async () => {
      const handler = getHandler("wit_work_item");
      (mockWorkApi.getPredefinedQueryResults as jest.Mock).mockResolvedValue([]);
      await handler({ action: "my", project: "P" });
      expect(mockWorkApi.getPredefinedQueryResults).toHaveBeenCalledWith("P", "assignedtome", 50, false);
    });

    it("wit_work_item.list_revisions: should return error when workItemId is missing", async () => {
      const handler = getHandler("wit_work_item");
      const result = await handler({ action: "list_revisions", project: "P" });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("workItemId is required for list_revisions");
    });

    it("wit_work_item.list_for_iteration: should return error when iterationId is missing", async () => {
      const handler = getHandler("wit_work_item");
      const result = await handler({ action: "list_for_iteration", project: "P" });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("iterationId is required for list_for_iteration");
    });

    it("wit_work_item.get_type: should return error when workItemType is missing", async () => {
      const handler = getHandler("wit_work_item");
      const result = await handler({ action: "get_type", project: "P" });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("workItemType is required for get_type");
    });

    it("wit_work_item: should use error fallback when action is unknown and error is thrown", async () => {
      const handler = getHandler("wit_work_item");
      (connectionProvider as jest.Mock).mockRejectedValue(new Error("Connection error"));
      const result = await handler({ action: "invalid_action" as string });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("Error: Connection error");
    });

    // wit_query required param guards
    it("wit_query.get: should return error when query is missing", async () => {
      const handler = getHandler("wit_query");
      const result = await handler({ action: "get", project: "P" });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("query is required for get");
    });

    it("wit_query.get_results: should return error when id is missing", async () => {
      const handler = getHandler("wit_query");
      const result = await handler({ action: "get_results", project: "P" });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("id is required for get_results");
    });

    it("wit_query.wiql: should return error when wiql is missing", async () => {
      const handler = getHandler("wit_query");
      const result = await handler({ action: "wiql", project: "P" });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("wiql is required for wiql");
    });

    it("wit_query: should use error fallback when action is unknown and error is thrown", async () => {
      const handler = getHandler("wit_query");
      (connectionProvider as jest.Mock).mockRejectedValue(new Error("Connection error"));
      const result = await handler({ action: "invalid_action" as string });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("Error: Connection error");
    });

    // wit_backlog required param guards
    it("wit_backlog.list_work_items: should return error when backlogId is missing", async () => {
      const handler = getHandler("wit_backlog");
      const result = await handler({ action: "list_work_items", project: "P", team: "T" });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("backlogId is required for list_work_items");
    });

    it("wit_backlog: should use error fallback when action is unknown and error is thrown", async () => {
      const handler = getHandler("wit_backlog");
      (connectionProvider as jest.Mock).mockRejectedValue(new Error("Connection error"));
      const result = await handler({ action: "invalid_action" as string });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("Error: Connection error");
    });
  });
});
