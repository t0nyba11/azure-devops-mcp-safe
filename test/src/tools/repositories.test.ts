// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { configureRepoTools, REPO_TOOLS } from "../../../src/tools/repositories";
import { PullRequestStatus, GitVersionType, GitPullRequestQueryType, CommentThreadStatus, VersionControlRecursionType } from "azure-devops-node-api/interfaces/GitInterfaces.js";
import { getCurrentUserDetails, getUserIdFromEmail } from "../../../src/tools/auth";

// Mock the auth module
jest.mock("../../../src/tools/auth", () => ({
  getCurrentUserDetails: jest.fn(),
  getUserIdFromEmail: jest.fn(),
}));

// Mock index.js to avoid yargs CLI parsing at import time
jest.mock("../../../src/index", () => ({ orgName: "test-org" }));

const mockGetCurrentUserDetails = getCurrentUserDetails as jest.MockedFunction<typeof getCurrentUserDetails>;
const mockGetUserIdFromEmail = getUserIdFromEmail as jest.MockedFunction<typeof getUserIdFromEmail>;

describe("repos tools", () => {
  let server: McpServer;
  let tokenProvider: jest.MockedFunction<() => Promise<string>>;
  let connectionProvider: jest.MockedFunction<() => Promise<WebApi>>;
  let userAgentProvider: () => string;
  let mockGitApi: {
    updatePullRequest: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    createPullRequest: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    createPullRequestReviewers: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    createPullRequestReviewer: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    deletePullRequestReviewer: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    getRepositories: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    getPullRequests: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    getPullRequestsByProject: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    getThreads: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    getComments: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    getRefs: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    getPullRequest: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    getPullRequestReviewer: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    getPullRequestLabels: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    createPullRequestLabel: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    deletePullRequestLabels: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    createComment: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    createThread: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    updateThread: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    getCommits: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    getPullRequestQuery: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    updateRefs: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    getPullRequestIterationChanges: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    getPullRequestIterations: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    getItems: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
  };

  beforeEach(() => {
    server = {
      tool: jest.fn(),
    } as unknown as McpServer;

    tokenProvider = jest.fn();
    mockGitApi = {
      updatePullRequest: jest.fn(),
      createPullRequest: jest.fn(),
      createPullRequestReviewers: jest.fn(),
      createPullRequestReviewer: jest.fn(),
      deletePullRequestReviewer: jest.fn(),
      getRepositories: jest.fn(),
      getPullRequests: jest.fn(),
      getPullRequestsByProject: jest.fn(),
      getThreads: jest.fn(),
      getComments: jest.fn(),
      getRefs: jest.fn(),
      getPullRequest: jest.fn(),
      getPullRequestReviewer: jest.fn(),
      getPullRequestLabels: jest.fn(),
      createPullRequestLabel: jest.fn(),
      deletePullRequestLabels: jest.fn(),
      createComment: jest.fn(),
      createThread: jest.fn(),
      updateThread: jest.fn(),
      getCommits: jest.fn(),
      getPullRequestQuery: jest.fn(),
      updateRefs: jest.fn(),
      getPullRequestIterationChanges: jest.fn(),
      getPullRequestIterations: jest.fn(),
      getPullRequestIteration: jest.fn(),
      getFileDiffs: jest.fn(),
      getItemText: jest.fn(),
      getItems: jest.fn(),
    };

    connectionProvider = jest.fn().mockResolvedValue({
      getGitApi: jest.fn().mockResolvedValue(mockGitApi),
    });

    userAgentProvider = () => "Jest";

    mockGetCurrentUserDetails.mockResolvedValue({
      authenticatedUser: { id: "user123", uniqueName: "testuser@example.com", displayName: "Test User" },
    } as any);
  });

  describe("repo_list_repos_by_project", () => {
    it("should list repositories by project", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_repository);
      if (!call) throw new Error("repo_repository tool not registered");
      const [, , , handler] = call;

      const mockRepos = [
        {
          id: "repo1",
          name: "Repository 1",
          isDisabled: false,
          isFork: false,
          isInMaintenance: false,
          webUrl: "https://dev.azure.com/org/project/_git/repo1",
          size: 1024,
        },
        {
          id: "repo2",
          name: "Repository 2",
          isDisabled: false,
          isFork: true,
          isInMaintenance: false,
          webUrl: "https://dev.azure.com/org/project/_git/repo2",
          size: 2048,
        },
      ];
      mockGitApi.getRepositories.mockResolvedValue(mockRepos);

      const params = {
        action: "list",
        project: "test-project",
        status: "Active",
        top: 100,
        skip: 0,
      };

      const result = await handler(params);

      expect(mockGitApi.getRepositories).toHaveBeenCalledWith("test-project", false, false, false);

      const expectedTrimmedRepos = mockRepos.map((repo) => ({
        id: repo.id,
        name: repo.name,
        isDisabled: repo.isDisabled,
        isFork: repo.isFork,
        isInMaintenance: repo.isInMaintenance,
        webUrl: repo.webUrl,
        size: repo.size,
      }));

      expect(result.content[0].text).toBe(JSON.stringify(expectedTrimmedRepos, null, 2));
    });

    it("should filter repositories by name", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_repository);
      if (!call) throw new Error("repo_repository tool not registered");
      const [, , , handler] = call;

      const mockRepos = [
        { id: "repo1", name: "frontend-app", isDisabled: false, isFork: false, isInMaintenance: false, webUrl: "url1", size: 1024 },
        { id: "repo2", name: "backend-api", isDisabled: false, isFork: false, isInMaintenance: false, webUrl: "url2", size: 2048 },
        { id: "repo3", name: "frontend-web", isDisabled: false, isFork: false, isInMaintenance: false, webUrl: "url3", size: 3072 },
      ];
      mockGitApi.getRepositories.mockResolvedValue(mockRepos);

      const params = {
        action: "list",
        project: "test-project",
        repoNameFilter: "frontend",
        top: 100,
        skip: 0,
      };

      const result = await handler(params);

      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult).toHaveLength(2);
      expect(parsedResult.map((r: { name: string }) => r.name).sort()).toEqual(["frontend-app", "frontend-web"]);
    });
  });

  describe("repo_list_pull_requests_by_repo_or_project - repository tests", () => {
    it("should list pull requests by repository", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request);
      if (!call) throw new Error("repo_pull_request tool not registered");
      const [, , , handler] = call;

      const mockPRs = [
        {
          pullRequestId: 123,
          codeReviewId: 456,
          status: PullRequestStatus.Active,
          statusName: "Active",
          createdBy: { displayName: "John Doe", uniqueName: "john@example.com" },
          creationDate: "2023-01-01T00:00:00Z",
          title: "Feature PR",
          isDraft: false,
          sourceRefName: "refs/heads/feature-branch",
          targetRefName: "refs/heads/main",
        },
      ];
      mockGitApi.getPullRequests.mockResolvedValue(mockPRs);

      const params = {
        action: "list",
        repositoryId: "repo123",
        top: 100,
        skip: 0,
        created_by_me: false,
        i_am_reviewer: false,
        status: "Active",
      };

      const result = await handler(params);

      expect(mockGitApi.getPullRequests).toHaveBeenCalledWith("repo123", { status: PullRequestStatus.Active, repositoryId: "repo123" }, undefined, undefined, 0, 100);

      expect(result.content[0].text).toBe(JSON.stringify(mockPRs, null, 2));
    });

    it("should filter pull requests created by me", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request);
      if (!call) throw new Error("repo_pull_request tool not registered");
      const [, , , handler] = call;

      mockGitApi.getPullRequests.mockResolvedValue([]);

      const params = {
        action: "list",
        repositoryId: "repo123",
        created_by_me: true,
        status: "Active",
        top: 100,
        skip: 0,
      };

      await handler(params);

      expect(mockGetCurrentUserDetails).toHaveBeenCalled();
      expect(mockGitApi.getPullRequests).toHaveBeenCalledWith("repo123", { status: PullRequestStatus.Active, repositoryId: "repo123", creatorId: "user123" }, undefined, undefined, 0, 100);
    });

    it("should filter pull requests where I am a reviewer", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request);
      if (!call) throw new Error("repo_pull_request tool not registered");
      const [, , , handler] = call;

      mockGitApi.getPullRequests.mockResolvedValue([]);

      const params = {
        action: "list",
        repositoryId: "repo123",
        i_am_reviewer: true,
        status: "Active",
        top: 100,
        skip: 0,
      };

      await handler(params);

      expect(mockGetCurrentUserDetails).toHaveBeenCalled();
      expect(mockGitApi.getPullRequests).toHaveBeenCalledWith("repo123", { status: PullRequestStatus.Active, repositoryId: "repo123", reviewerId: "user123" }, undefined, undefined, 0, 100);
    });

    it("should filter pull requests created by me and where I am a reviewer", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request);
      if (!call) throw new Error("repo_pull_request tool not registered");
      const [, , , handler] = call;

      mockGitApi.getPullRequests.mockResolvedValue([]);

      const params = {
        action: "list",
        repositoryId: "repo123",
        created_by_me: true,
        i_am_reviewer: true,
        status: "Active",
        top: 100,
        skip: 0,
      };

      await handler(params);

      expect(mockGetCurrentUserDetails).toHaveBeenCalled();
      expect(mockGitApi.getPullRequests).toHaveBeenCalledWith(
        "repo123",
        { status: PullRequestStatus.Active, repositoryId: "repo123", creatorId: "user123", reviewerId: "user123" },
        undefined,
        undefined,
        0,
        100
      );
    });

    it("should filter pull requests created by specific user successfully", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request);
      if (!call) throw new Error("repo_pull_request tool not registered");
      const [, , , handler] = call;

      // Mock successful user lookup
      mockGetUserIdFromEmail.mockResolvedValue("specific-user-123");
      mockGitApi.getPullRequests.mockResolvedValue([]);

      const params = {
        action: "list",
        repositoryId: "repo123",
        created_by_user: "john@example.com",
        status: "Active",
        top: 100,
        skip: 0,
      };

      await handler(params);

      expect(mockGetUserIdFromEmail).toHaveBeenCalledWith("john@example.com", tokenProvider, connectionProvider, userAgentProvider);
      expect(mockGitApi.getPullRequests).toHaveBeenCalledWith("repo123", { status: PullRequestStatus.Active, repositoryId: "repo123", creatorId: "specific-user-123" }, undefined, undefined, 0, 100);
    });

    it("should filter pull requests by source branch", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request);
      if (!call) throw new Error("repo_pull_request tool not registered");
      const [, , , handler] = call;

      mockGitApi.getPullRequests.mockResolvedValue([]);

      const params = {
        action: "list",
        repositoryId: "repo123",
        sourceRefName: "refs/heads/feature-branch",
        status: "Active",
        top: 100,
        skip: 0,
      };

      await handler(params);

      expect(mockGitApi.getPullRequests).toHaveBeenCalledWith(
        "repo123",
        {
          status: PullRequestStatus.Active,
          repositoryId: "repo123",
          sourceRefName: "refs/heads/feature-branch",
        },
        undefined,
        undefined,
        0,
        100
      );
    });

    it("should filter pull requests by target branch", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request);
      if (!call) throw new Error("repo_pull_request tool not registered");
      const [, , , handler] = call;

      mockGitApi.getPullRequests.mockResolvedValue([]);

      const params = {
        action: "list",
        repositoryId: "repo123",
        targetRefName: "refs/heads/main",
        status: "Active",
        top: 100,
        skip: 0,
      };

      await handler(params);

      expect(mockGitApi.getPullRequests).toHaveBeenCalledWith(
        "repo123",
        {
          status: PullRequestStatus.Active,
          repositoryId: "repo123",
          targetRefName: "refs/heads/main",
        },
        undefined,
        undefined,
        0,
        100
      );
    });

    it("should filter pull requests by both source and target branches", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request);
      if (!call) throw new Error("repo_pull_request tool not registered");
      const [, , , handler] = call;

      mockGitApi.getPullRequests.mockResolvedValue([]);

      const params = {
        action: "list",
        repositoryId: "repo123",
        sourceRefName: "refs/heads/feature-branch",
        targetRefName: "refs/heads/main",
        status: "Active",
        top: 100,
        skip: 0,
      };

      await handler(params);

      expect(mockGitApi.getPullRequests).toHaveBeenCalledWith(
        "repo123",
        {
          status: PullRequestStatus.Active,
          repositoryId: "repo123",
          sourceRefName: "refs/heads/feature-branch",
          targetRefName: "refs/heads/main",
        },
        undefined,
        undefined,
        0,
        100
      );
    });

    it("should combine branch filters with user filters", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request);
      if (!call) throw new Error("repo_pull_request tool not registered");
      const [, , , handler] = call;

      mockGitApi.getPullRequests.mockResolvedValue([]);

      const params = {
        action: "list",
        repositoryId: "repo123",
        sourceRefName: "refs/heads/feature-branch",
        targetRefName: "refs/heads/main",
        created_by_me: true,
        i_am_reviewer: true,
        status: "Active",
        top: 100,
        skip: 0,
      };

      await handler(params);

      expect(mockGetCurrentUserDetails).toHaveBeenCalled();
      expect(mockGitApi.getPullRequests).toHaveBeenCalledWith(
        "repo123",
        {
          status: PullRequestStatus.Active,
          repositoryId: "repo123",
          sourceRefName: "refs/heads/feature-branch",
          targetRefName: "refs/heads/main",
          creatorId: "user123",
          reviewerId: "user123",
        },
        undefined,
        undefined,
        0,
        100
      );
    });

    it("should filter pull requests by specific reviewer successfully", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request);
      if (!call) throw new Error("repo_pull_request tool not registered");
      const [, , , handler] = call;

      // Mock successful user lookup
      mockGetUserIdFromEmail.mockResolvedValue("reviewer-user-123");
      mockGitApi.getPullRequests.mockResolvedValue([]);

      const params = {
        action: "list",
        repositoryId: "repo123",
        user_is_reviewer: "reviewer@example.com",
        status: "Active",
        top: 100,
        skip: 0,
      };

      await handler(params);

      expect(mockGetUserIdFromEmail).toHaveBeenCalledWith("reviewer@example.com", tokenProvider, connectionProvider, userAgentProvider);
      expect(mockGitApi.getPullRequests).toHaveBeenCalledWith("repo123", { status: PullRequestStatus.Active, repositoryId: "repo123", reviewerId: "reviewer-user-123" }, undefined, undefined, 0, 100);
    });

    it("should prioritize user_is_reviewer over i_am_reviewer flag", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request);
      if (!call) throw new Error("repo_pull_request tool not registered");
      const [, , , handler] = call;

      // Mock successful user lookup
      mockGetUserIdFromEmail.mockResolvedValue("specific-reviewer-123");
      mockGitApi.getPullRequests.mockResolvedValue([]);

      const params = {
        action: "list",
        repositoryId: "repo123",
        user_is_reviewer: "specific-reviewer@example.com",
        i_am_reviewer: true, // This should be ignored
        status: "Active",
        top: 100,
        skip: 0,
      };

      await handler(params);

      expect(mockGetUserIdFromEmail).toHaveBeenCalledWith("specific-reviewer@example.com", tokenProvider, connectionProvider, userAgentProvider);
      expect(mockGetCurrentUserDetails).not.toHaveBeenCalled(); // Should not be called since user_is_reviewer takes precedence
      expect(mockGitApi.getPullRequests).toHaveBeenCalledWith(
        "repo123",
        { status: PullRequestStatus.Active, repositoryId: "repo123", reviewerId: "specific-reviewer-123" },
        undefined,
        undefined,
        0,
        100
      );
    });

    it("should handle error when user_is_reviewer user not found", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request);
      if (!call) throw new Error("repo_pull_request tool not registered");
      const [, , , handler] = call;

      // Mock user lookup failure
      mockGetUserIdFromEmail.mockRejectedValue(new Error("User not found"));

      const params = {
        action: "list",
        repositoryId: "repo123",
        user_is_reviewer: "nonexistent@example.com",
        status: "Active",
        top: 100,
        skip: 0,
      };

      const result = await handler(params);

      expect(mockGetUserIdFromEmail).toHaveBeenCalledWith("nonexistent@example.com", tokenProvider, connectionProvider, userAgentProvider);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("Error finding reviewer with email nonexistent@example.com: User not found");
      expect(mockGitApi.getPullRequests).not.toHaveBeenCalled();
    });
  });

  describe("repo_list_pull_requests_by_repo_or_project - project tests", () => {
    it("should list pull requests by project", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request);
      if (!call) throw new Error("repo_pull_request tool not registered");
      const [, , , handler] = call;

      const mockPRs = [
        {
          pullRequestId: 123,
          codeReviewId: 456,
          repository: { name: "test-repo" },
          status: PullRequestStatus.Active,
          statusName: "Active",
          createdBy: { displayName: "John Doe", uniqueName: "john@example.com" },
          creationDate: "2023-01-01T00:00:00Z",
          title: "Feature PR",
          isDraft: false,
          sourceRefName: "refs/heads/feature-branch",
          targetRefName: "refs/heads/main",
        },
      ];
      mockGitApi.getPullRequestsByProject.mockResolvedValue(mockPRs);

      const params = {
        action: "list",
        project: "test-project",
        status: "Active",
        top: 100,
        skip: 0,
      };

      const result = await handler(params);

      expect(mockGitApi.getPullRequestsByProject).toHaveBeenCalledWith("test-project", { status: PullRequestStatus.Active }, undefined, 0, 100);

      const expectedResult = [
        {
          pullRequestId: 123,
          codeReviewId: 456,
          repository: "test-repo",
          status: PullRequestStatus.Active,
          statusName: "Active",
          createdBy: { displayName: "John Doe", uniqueName: "john@example.com" },
          creationDate: "2023-01-01T00:00:00Z",
          title: "Feature PR",
          isDraft: false,
          sourceRefName: "refs/heads/feature-branch",
          targetRefName: "refs/heads/main",
        },
      ];

      expect(result.content[0].text).toBe(JSON.stringify(expectedResult, null, 2));
    });

    it("should map statusName from PullRequestStatus enum values", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request);
      if (!call) throw new Error("repo_pull_request tool not registered");
      const [, , , handler] = call;

      const mockPRs = [
        {
          pullRequestId: 123,
          codeReviewId: 456,
          repository: { name: "test-repo" },
          status: PullRequestStatus.NotSet,
          createdBy: { displayName: "John Doe", uniqueName: "john@example.com" },
          creationDate: "2023-01-01T00:00:00Z",
          title: "NotSet PR",
          isDraft: false,
          sourceRefName: "refs/heads/notset-branch",
          targetRefName: "refs/heads/main",
        },
        {
          pullRequestId: 124,
          codeReviewId: 457,
          repository: { name: "test-repo" },
          status: PullRequestStatus.All,
          createdBy: { displayName: "John Doe", uniqueName: "john@example.com" },
          creationDate: "2023-01-01T00:00:00Z",
          title: "All PR",
          isDraft: false,
          sourceRefName: "refs/heads/all-branch",
          targetRefName: "refs/heads/main",
        },
      ];
      mockGitApi.getPullRequestsByProject.mockResolvedValue(mockPRs);

      const params = {
        action: "list",
        project: "test-project",
        status: "Active",
        top: 100,
        skip: 0,
      };

      const result = await handler(params);

      const expectedResult = [
        {
          pullRequestId: 123,
          codeReviewId: 456,
          repository: "test-repo",
          status: PullRequestStatus.NotSet,
          statusName: "NotSet",
          createdBy: { displayName: "John Doe", uniqueName: "john@example.com" },
          creationDate: "2023-01-01T00:00:00Z",
          title: "NotSet PR",
          isDraft: false,
          sourceRefName: "refs/heads/notset-branch",
          targetRefName: "refs/heads/main",
        },
        {
          pullRequestId: 124,
          codeReviewId: 457,
          repository: "test-repo",
          status: PullRequestStatus.All,
          statusName: "All",
          createdBy: { displayName: "John Doe", uniqueName: "john@example.com" },
          creationDate: "2023-01-01T00:00:00Z",
          title: "All PR",
          isDraft: false,
          sourceRefName: "refs/heads/all-branch",
          targetRefName: "refs/heads/main",
        },
      ];

      expect(result.content[0].text).toBe(JSON.stringify(expectedResult, null, 2));
    });

    it("should return Unknown statusName for unrecognized pull request status", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request);
      if (!call) throw new Error("repo_pull_request tool not registered");
      const [, , , handler] = call;

      const mockPRs = [
        {
          pullRequestId: 123,
          codeReviewId: 456,
          repository: { name: "test-repo" },
          status: 999,
          createdBy: { displayName: "John Doe", uniqueName: "john@example.com" },
          creationDate: "2023-01-01T00:00:00Z",
          title: "Unknown Status PR",
          isDraft: false,
          sourceRefName: "refs/heads/unknown-status",
          targetRefName: "refs/heads/main",
        },
      ];
      mockGitApi.getPullRequestsByProject.mockResolvedValue(mockPRs as any);

      const params = {
        action: "list",
        project: "test-project",
        status: "Active",
        top: 100,
        skip: 0,
      };

      const result = await handler(params);

      const expectedResult = [
        {
          pullRequestId: 123,
          codeReviewId: 456,
          repository: "test-repo",
          status: 999,
          statusName: "Unknown",
          createdBy: { displayName: "John Doe", uniqueName: "john@example.com" },
          creationDate: "2023-01-01T00:00:00Z",
          title: "Unknown Status PR",
          isDraft: false,
          sourceRefName: "refs/heads/unknown-status",
          targetRefName: "refs/heads/main",
        },
      ];

      expect(result.content[0].text).toBe(JSON.stringify(expectedResult, null, 2));
    });

    it("should filter by current user when created_by_me is true", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request);
      if (!call) throw new Error("repo_pull_request tool not registered");
      const [, , , handler] = call;

      const mockPRs = [
        {
          pullRequestId: 123,
          codeReviewId: 456,
          repository: { name: "test-repo" },
          status: PullRequestStatus.Active,
          statusName: "Active",
          createdBy: { displayName: "Test User", uniqueName: "testuser@example.com" },
          creationDate: "2023-01-01T00:00:00Z",
          title: "My Feature PR",
          isDraft: false,
          sourceRefName: "refs/heads/my-feature-branch",
          targetRefName: "refs/heads/main",
        },
      ];
      mockGitApi.getPullRequestsByProject.mockResolvedValue(mockPRs);

      const params = {
        action: "list",
        project: "test-project",
        created_by_me: true,
        status: "Active",
        top: 100,
        skip: 0,
      };

      const result = await handler(params);

      expect(mockGetCurrentUserDetails).toHaveBeenCalledWith(tokenProvider, connectionProvider, userAgentProvider);
      expect(mockGitApi.getPullRequestsByProject).toHaveBeenCalledWith("test-project", { status: PullRequestStatus.Active, creatorId: "user123" }, undefined, 0, 100);

      const expectedResult = [
        {
          pullRequestId: 123,
          codeReviewId: 456,
          repository: "test-repo",
          status: PullRequestStatus.Active,
          statusName: "Active",
          createdBy: { displayName: "Test User", uniqueName: "testuser@example.com" },
          creationDate: "2023-01-01T00:00:00Z",
          title: "My Feature PR",
          isDraft: false,
          sourceRefName: "refs/heads/my-feature-branch",
          targetRefName: "refs/heads/main",
        },
      ];

      expect(result.content[0].text).toBe(JSON.stringify(expectedResult, null, 2));
    });

    it("should filter by current user as reviewer when i_am_reviewer is true", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request);
      if (!call) throw new Error("repo_pull_request tool not registered");
      const [, , , handler] = call;

      const mockPRs = [
        {
          pullRequestId: 456,
          codeReviewId: 789,
          repository: { name: "test-repo" },
          status: PullRequestStatus.Active,
          statusName: "Active",
          createdBy: { displayName: "Other User", uniqueName: "other@example.com" },
          creationDate: "2023-01-02T00:00:00Z",
          title: "Review Me PR",
          isDraft: false,
          sourceRefName: "refs/heads/review-branch",
          targetRefName: "refs/heads/main",
        },
      ];
      mockGitApi.getPullRequestsByProject.mockResolvedValue(mockPRs);

      const params = {
        action: "list",
        project: "test-project",
        i_am_reviewer: true,
        status: "Active",
        top: 100,
        skip: 0,
      };

      const result = await handler(params);

      expect(mockGetCurrentUserDetails).toHaveBeenCalledWith(tokenProvider, connectionProvider, userAgentProvider);
      expect(mockGitApi.getPullRequestsByProject).toHaveBeenCalledWith("test-project", { status: PullRequestStatus.Active, reviewerId: "user123" }, undefined, 0, 100);

      const expectedResult = [
        {
          pullRequestId: 456,
          codeReviewId: 789,
          repository: "test-repo",
          status: PullRequestStatus.Active,
          statusName: "Active",
          createdBy: { displayName: "Other User", uniqueName: "other@example.com" },
          creationDate: "2023-01-02T00:00:00Z",
          title: "Review Me PR",
          isDraft: false,
          sourceRefName: "refs/heads/review-branch",
          targetRefName: "refs/heads/main",
        },
      ];

      expect(result.content[0].text).toBe(JSON.stringify(expectedResult, null, 2));
    });

    it("should filter by both creator and reviewer when both created_by_me and i_am_reviewer are true", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request);
      if (!call) throw new Error("repo_pull_request tool not registered");
      const [, , , handler] = call;

      const mockPRs = [
        {
          pullRequestId: 789,
          codeReviewId: 101112,
          repository: { name: "test-repo" },
          status: PullRequestStatus.Active,
          statusName: "Active",
          createdBy: { displayName: "Test User", uniqueName: "testuser@example.com" },
          creationDate: "2023-01-03T00:00:00Z",
          title: "Both Creator and Reviewer PR",
          isDraft: false,
          sourceRefName: "refs/heads/both-branch",
          targetRefName: "refs/heads/main",
        },
      ];
      mockGitApi.getPullRequestsByProject.mockResolvedValue(mockPRs);

      const params = {
        action: "list",
        project: "test-project",
        created_by_me: true,
        i_am_reviewer: true,
        status: "Active",
        top: 100,
        skip: 0,
      };

      const result = await handler(params);

      expect(mockGetCurrentUserDetails).toHaveBeenCalledWith(tokenProvider, connectionProvider, userAgentProvider);
      expect(mockGitApi.getPullRequestsByProject).toHaveBeenCalledWith("test-project", { status: PullRequestStatus.Active, creatorId: "user123", reviewerId: "user123" }, undefined, 0, 100);

      const expectedResult = [
        {
          pullRequestId: 789,
          codeReviewId: 101112,
          repository: "test-repo",
          status: PullRequestStatus.Active,
          statusName: "Active",
          createdBy: { displayName: "Test User", uniqueName: "testuser@example.com" },
          creationDate: "2023-01-03T00:00:00Z",
          title: "Both Creator and Reviewer PR",
          isDraft: false,
          sourceRefName: "refs/heads/both-branch",
          targetRefName: "refs/heads/main",
        },
      ];

      expect(result.content[0].text).toBe(JSON.stringify(expectedResult, null, 2));
    });

    it("should prioritize created_by_user over created_by_me flag", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request);
      if (!call) throw new Error("repo_pull_request tool not registered");
      const [, , , handler] = call;

      // Mock getUserIdFromEmail to return a specific user ID
      mockGetUserIdFromEmail.mockResolvedValue("specific-user-123");

      const mockPRs = [
        {
          pullRequestId: 999,
          codeReviewId: 888,
          repository: { name: "test-repo" },
          status: PullRequestStatus.Active,
          statusName: "Active",
          createdBy: { displayName: "Specific User", uniqueName: "specific@example.com" },
          creationDate: "2023-01-04T00:00:00Z",
          title: "Specific User PR",
          isDraft: false,
          sourceRefName: "refs/heads/specific-branch",
          targetRefName: "refs/heads/main",
        },
      ];
      mockGitApi.getPullRequestsByProject.mockResolvedValue(mockPRs);

      const params = {
        action: "list",
        project: "test-project",
        created_by_user: "specific@example.com",
        created_by_me: true, // This should be ignored since created_by_user takes precedence
        status: "Active",
        top: 100,
        skip: 0,
      };

      const result = await handler(params);

      expect(mockGetUserIdFromEmail).toHaveBeenCalledWith("specific@example.com", tokenProvider, connectionProvider, userAgentProvider);
      expect(mockGetCurrentUserDetails).not.toHaveBeenCalled(); // Should not be called when created_by_user is provided
      expect(mockGitApi.getPullRequestsByProject).toHaveBeenCalledWith("test-project", { status: PullRequestStatus.Active, creatorId: "specific-user-123" }, undefined, 0, 100);

      const expectedResult = [
        {
          pullRequestId: 999,
          codeReviewId: 888,
          repository: "test-repo",
          status: PullRequestStatus.Active,
          statusName: "Active",
          createdBy: { displayName: "Specific User", uniqueName: "specific@example.com" },
          creationDate: "2023-01-04T00:00:00Z",
          title: "Specific User PR",
          isDraft: false,
          sourceRefName: "refs/heads/specific-branch",
          targetRefName: "refs/heads/main",
        },
      ];

      expect(result.content[0].text).toBe(JSON.stringify(expectedResult, null, 2));
    });

    it("should filter pull requests by source branch", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request);
      if (!call) throw new Error("repo_pull_request tool not registered");
      const [, , , handler] = call;

      mockGitApi.getPullRequestsByProject.mockResolvedValue([]);

      const params = {
        action: "list",
        project: "test-project",
        sourceRefName: "refs/heads/feature-branch",
        status: "Active",
        top: 100,
        skip: 0,
      };

      await handler(params);

      expect(mockGitApi.getPullRequestsByProject).toHaveBeenCalledWith(
        "test-project",
        {
          status: PullRequestStatus.Active,
          sourceRefName: "refs/heads/feature-branch",
        },
        undefined,
        0,
        100
      );
    });

    it("should filter pull requests by target branch", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request);
      if (!call) throw new Error("repo_pull_request tool not registered");
      const [, , , handler] = call;

      mockGitApi.getPullRequestsByProject.mockResolvedValue([]);

      const params = {
        action: "list",
        project: "test-project",
        targetRefName: "refs/heads/main",
        status: "Active",
        top: 100,
        skip: 0,
      };

      await handler(params);

      expect(mockGitApi.getPullRequestsByProject).toHaveBeenCalledWith(
        "test-project",
        {
          status: PullRequestStatus.Active,
          targetRefName: "refs/heads/main",
        },
        undefined,
        0,
        100
      );
    });

    it("should filter pull requests by both source and target branches", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request);
      if (!call) throw new Error("repo_pull_request tool not registered");
      const [, , , handler] = call;

      mockGitApi.getPullRequestsByProject.mockResolvedValue([]);

      const params = {
        action: "list",
        project: "test-project",
        sourceRefName: "refs/heads/feature-branch",
        targetRefName: "refs/heads/main",
        status: "Active",
        top: 100,
        skip: 0,
      };

      await handler(params);

      expect(mockGitApi.getPullRequestsByProject).toHaveBeenCalledWith(
        "test-project",
        {
          status: PullRequestStatus.Active,
          sourceRefName: "refs/heads/feature-branch",
          targetRefName: "refs/heads/main",
        },
        undefined,
        0,
        100
      );
    });

    it("should combine branch filters with user filters", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request);
      if (!call) throw new Error("repo_pull_request tool not registered");
      const [, , , handler] = call;

      mockGitApi.getPullRequestsByProject.mockResolvedValue([]);

      const params = {
        action: "list",
        project: "test-project",
        sourceRefName: "refs/heads/feature-branch",
        targetRefName: "refs/heads/main",
        created_by_me: true,
        status: "Active",
        top: 100,
        skip: 0,
      };

      await handler(params);

      expect(mockGetCurrentUserDetails).toHaveBeenCalled();
      expect(mockGitApi.getPullRequestsByProject).toHaveBeenCalledWith(
        "test-project",
        {
          status: PullRequestStatus.Active,
          sourceRefName: "refs/heads/feature-branch",
          targetRefName: "refs/heads/main",
          creatorId: "user123",
        },
        undefined,
        0,
        100
      );
    });

    it("should filter pull requests by specific reviewer successfully", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request);
      if (!call) throw new Error("repo_pull_request tool not registered");
      const [, , , handler] = call;

      // Mock successful user lookup
      mockGetUserIdFromEmail.mockResolvedValue("reviewer-user-123");
      const mockPRs = [
        {
          pullRequestId: 555,
          codeReviewId: 666,
          repository: { name: "test-repo" },
          status: PullRequestStatus.Active,
          statusName: "Active",
          createdBy: { displayName: "Another User", uniqueName: "another@example.com" },
          creationDate: "2023-01-05T00:00:00Z",
          title: "PR Reviewed by Specific User",
          isDraft: false,
          sourceRefName: "refs/heads/reviewed-branch",
          targetRefName: "refs/heads/main",
        },
      ];
      mockGitApi.getPullRequestsByProject.mockResolvedValue(mockPRs);

      const params = {
        action: "list",
        project: "test-project",
        user_is_reviewer: "reviewer@example.com",
        status: "Active",
        top: 100,
        skip: 0,
      };

      const result = await handler(params);

      expect(mockGetUserIdFromEmail).toHaveBeenCalledWith("reviewer@example.com", tokenProvider, connectionProvider, userAgentProvider);
      expect(mockGitApi.getPullRequestsByProject).toHaveBeenCalledWith("test-project", { status: PullRequestStatus.Active, reviewerId: "reviewer-user-123" }, undefined, 0, 100);

      const expectedResult = [
        {
          pullRequestId: 555,
          codeReviewId: 666,
          repository: "test-repo",
          status: PullRequestStatus.Active,
          statusName: "Active",
          createdBy: { displayName: "Another User", uniqueName: "another@example.com" },
          creationDate: "2023-01-05T00:00:00Z",
          title: "PR Reviewed by Specific User",
          isDraft: false,
          sourceRefName: "refs/heads/reviewed-branch",
          targetRefName: "refs/heads/main",
        },
      ];

      expect(result.content[0].text).toBe(JSON.stringify(expectedResult, null, 2));
    });

    it("should prioritize user_is_reviewer over i_am_reviewer flag", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request);
      if (!call) throw new Error("repo_pull_request tool not registered");
      const [, , , handler] = call;

      // Mock successful user lookup
      mockGetUserIdFromEmail.mockResolvedValue("specific-reviewer-123");
      mockGitApi.getPullRequestsByProject.mockResolvedValue([]);

      const params = {
        action: "list",
        project: "test-project",
        user_is_reviewer: "specific-reviewer@example.com",
        i_am_reviewer: true, // This should be ignored
        status: "Active",
        top: 100,
        skip: 0,
      };

      await handler(params);

      expect(mockGetUserIdFromEmail).toHaveBeenCalledWith("specific-reviewer@example.com", tokenProvider, connectionProvider, userAgentProvider);
      expect(mockGetCurrentUserDetails).not.toHaveBeenCalled(); // Should not be called since user_is_reviewer takes precedence
      expect(mockGitApi.getPullRequestsByProject).toHaveBeenCalledWith("test-project", { status: PullRequestStatus.Active, reviewerId: "specific-reviewer-123" }, undefined, 0, 100);
    });

    it("should handle error when user_is_reviewer user not found", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request);
      if (!call) throw new Error("repo_pull_request tool not registered");
      const [, , , handler] = call;

      // Mock user lookup failure
      mockGetUserIdFromEmail.mockRejectedValue(new Error("User not found"));

      const params = {
        action: "list",
        project: "test-project",
        user_is_reviewer: "nonexistent@example.com",
        status: "Active",
        top: 100,
        skip: 0,
      };

      const result = await handler(params);

      expect(mockGetUserIdFromEmail).toHaveBeenCalledWith("nonexistent@example.com", tokenProvider, connectionProvider, userAgentProvider);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("Error finding reviewer with email nonexistent@example.com: User not found");
      expect(mockGitApi.getPullRequestsByProject).not.toHaveBeenCalled();
    });

    it("should support both created_by_user and user_is_reviewer filters simultaneously", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request);
      if (!call) throw new Error("repo_pull_request tool not registered");
      const [, , , handler] = call;

      // Mock both user lookups
      mockGetUserIdFromEmail
        .mockResolvedValueOnce("creator-user-123") // First call for created_by_user
        .mockResolvedValueOnce("reviewer-user-123"); // Second call for user_is_reviewer

      mockGitApi.getPullRequestsByProject.mockResolvedValue([]);

      const params = {
        action: "list",
        project: "test-project",
        created_by_user: "creator@example.com",
        user_is_reviewer: "reviewer@example.com",
        status: "Active",
        top: 100,
        skip: 0,
      };

      await handler(params);

      expect(mockGetUserIdFromEmail).toHaveBeenCalledWith("creator@example.com", tokenProvider, connectionProvider, userAgentProvider);
      expect(mockGetUserIdFromEmail).toHaveBeenCalledWith("reviewer@example.com", tokenProvider, connectionProvider, userAgentProvider);
      expect(mockGitApi.getPullRequestsByProject).toHaveBeenCalledWith(
        "test-project",
        {
          status: PullRequestStatus.Active,
          creatorId: "creator-user-123",
          reviewerId: "reviewer-user-123",
        },
        undefined,
        0,
        100
      );
    });
  });

  describe("repo_list_pull_request_threads", () => {
    it("should list pull request threads", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request_thread);
      if (!call) throw new Error("repo_pull_request_thread tool not registered");
      const [, , , handler] = call;

      const mockThreads = [
        {
          id: 1,
          publishedDate: "2023-01-01T00:00:00Z",
          lastUpdatedDate: "2023-01-01T01:00:00Z",
          status: CommentThreadStatus.Active,
          comments: [
            {
              id: 1,
              author: { displayName: "John Doe", uniqueName: "john@example.com" },
              content: "This looks good",
              publishedDate: "2023-01-01T00:00:00Z",
              isDeleted: false,
              lastUpdatedDate: "2023-01-01T00:30:00Z",
              lastContentUpdatedDate: "2023-01-01T00:15:00Z",
            },
          ],
        },
      ];
      mockGitApi.getThreads.mockResolvedValue(mockThreads);

      const params = {
        action: "list",
        repositoryId: "repo123",
        pullRequestId: 456,
        top: 100,
        skip: 0,
      };

      const result = await handler(params);

      expect(mockGitApi.getThreads).toHaveBeenCalledWith("repo123", 456, undefined, undefined, undefined);

      const expectedResult = [
        {
          id: 1,
          publishedDate: "2023-01-01T00:00:00Z",
          lastUpdatedDate: "2023-01-01T01:00:00Z",
          status: CommentThreadStatus.Active,
          comments: [
            {
              id: 1,
              author: { displayName: "John Doe", uniqueName: "john@example.com" },
              content: "This looks good",
              publishedDate: "2023-01-01T00:00:00Z",
              lastUpdatedDate: "2023-01-01T00:30:00Z",
              lastContentUpdatedDate: "2023-01-01T00:15:00Z",
            },
          ],
        },
      ];

      expect(result.content[0].text).toBe(JSON.stringify(expectedResult, null, 2));
    });

    it("should return full response when requested", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request_thread);
      if (!call) throw new Error("repo_pull_request_thread tool not registered");
      const [, , , handler] = call;

      const mockThreads = [{ id: 1, fullData: "complete" }];
      mockGitApi.getThreads.mockResolvedValue(mockThreads);

      const params = {
        action: "list",
        repositoryId: "repo123",
        pullRequestId: 456,
        fullResponse: true,
        top: 100,
        skip: 0,
      };

      const result = await handler(params);

      expect(result.content[0].text).toBe(JSON.stringify(mockThreads, null, 2));
    });

    it("should return an empty array when no pull request threads are returned", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request_thread);
      if (!call) throw new Error("repo_pull_request_thread tool not registered");
      const [, , , handler] = call;

      mockGitApi.getThreads.mockResolvedValue(undefined);

      const result = await handler({
        action: "list",
        repositoryId: "repo123",
        pullRequestId: 456,
        top: 100,
        skip: 0,
      });

      expect(mockGitApi.getThreads).toHaveBeenCalledWith("repo123", 456, undefined, undefined, undefined);
      expect(result).not.toHaveProperty("isError");
      expect(result.content[0].text).toBe(JSON.stringify([], null, 2));
    });

    it("should return an empty full response when no pull request threads are returned", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request_thread);
      if (!call) throw new Error("repo_pull_request_thread tool not registered");
      const [, , , handler] = call;

      mockGitApi.getThreads.mockResolvedValue(undefined);

      const result = await handler({
        action: "list",
        repositoryId: "repo123",
        pullRequestId: 456,
        fullResponse: true,
        top: 100,
        skip: 0,
      });

      expect(mockGitApi.getThreads).toHaveBeenCalledWith("repo123", 456, undefined, undefined, undefined);
      expect(result).not.toHaveProperty("isError");
      expect(result.content[0].text).toBe(JSON.stringify([], null, 2));
    });

    it("should filter threads by status (Active)", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request_thread);
      if (!call) throw new Error("repo_pull_request_thread tool not registered");
      const [, , , handler] = call;

      const mockThreads = [
        {
          id: 1,
          status: CommentThreadStatus.Active,
          comments: [{ id: 1, author: { displayName: "User1", uniqueName: "user1@example.com" }, content: "Active comment", isDeleted: false }],
        },
        {
          id: 2,
          status: CommentThreadStatus.Closed,
          comments: [{ id: 2, author: { displayName: "User2", uniqueName: "user2@example.com" }, content: "Closed comment", isDeleted: false }],
        },
        {
          id: 3,
          status: CommentThreadStatus.Fixed,
          comments: [{ id: 3, author: { displayName: "User3", uniqueName: "user3@example.com" }, content: "Fixed comment", isDeleted: false }],
        },
      ];
      mockGitApi.getThreads.mockResolvedValue(mockThreads);

      const params = {
        action: "list",
        repositoryId: "repo123",
        pullRequestId: 456,
        status: "Active",
        top: 100,
        skip: 0,
      };

      const result = await handler(params);

      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult).toHaveLength(1);
      expect(parsedResult[0].id).toBe(1);
      expect(parsedResult[0].status).toBe(CommentThreadStatus.Active);
    });

    it("should filter threads by status (Closed)", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request_thread);
      if (!call) throw new Error("repo_pull_request_thread tool not registered");
      const [, , , handler] = call;

      const mockThreads = [
        {
          id: 1,
          status: CommentThreadStatus.Active,
          comments: [{ id: 1, author: { displayName: "User1", uniqueName: "user1@example.com" }, content: "Active comment", isDeleted: false }],
        },
        {
          id: 2,
          status: CommentThreadStatus.Closed,
          comments: [{ id: 2, author: { displayName: "User2", uniqueName: "user2@example.com" }, content: "Closed comment", isDeleted: false }],
        },
      ];
      mockGitApi.getThreads.mockResolvedValue(mockThreads);

      const params = {
        action: "list",
        repositoryId: "repo123",
        pullRequestId: 456,
        status: "Closed",
        top: 100,
        skip: 0,
      };

      const result = await handler(params);

      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult).toHaveLength(1);
      expect(parsedResult[0].id).toBe(2);
      expect(parsedResult[0].status).toBe(CommentThreadStatus.Closed);
    });

    it("should filter threads by status (Fixed)", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request_thread);
      if (!call) throw new Error("repo_pull_request_thread tool not registered");
      const [, , , handler] = call;

      const mockThreads = [
        {
          id: 1,
          status: CommentThreadStatus.Active,
          comments: [{ id: 1, author: { displayName: "User1", uniqueName: "user1@example.com" }, content: "Active comment", isDeleted: false }],
        },
        {
          id: 2,
          status: CommentThreadStatus.Fixed,
          comments: [{ id: 2, author: { displayName: "User2", uniqueName: "user2@example.com" }, content: "Fixed comment", isDeleted: false }],
        },
      ];
      mockGitApi.getThreads.mockResolvedValue(mockThreads);

      const params = {
        action: "list",
        repositoryId: "repo123",
        pullRequestId: 456,
        status: "Fixed",
        top: 100,
        skip: 0,
      };

      const result = await handler(params);

      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult).toHaveLength(1);
      expect(parsedResult[0].id).toBe(2);
      expect(parsedResult[0].status).toBe(CommentThreadStatus.Fixed);
    });

    it("should filter threads by author email", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request_thread);
      if (!call) throw new Error("repo_pull_request_thread tool not registered");
      const [, , , handler] = call;

      const mockThreads = [
        {
          id: 1,
          status: CommentThreadStatus.Active,
          comments: [{ id: 1, author: { displayName: "John Doe", uniqueName: "john@example.com" }, content: "Comment by John", isDeleted: false }],
        },
        {
          id: 2,
          status: CommentThreadStatus.Active,
          comments: [{ id: 2, author: { displayName: "Jane Doe", uniqueName: "jane@example.com" }, content: "Comment by Jane", isDeleted: false }],
        },
        {
          id: 3,
          status: CommentThreadStatus.Active,
          comments: [{ id: 3, author: { displayName: "John Doe", uniqueName: "john@example.com" }, content: "Another comment by John", isDeleted: false }],
        },
      ];
      mockGitApi.getThreads.mockResolvedValue(mockThreads);

      const params = {
        action: "list",
        repositoryId: "repo123",
        pullRequestId: 456,
        authorEmail: "john@example.com",
        top: 100,
        skip: 0,
      };

      const result = await handler(params);

      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult).toHaveLength(2);
      expect(parsedResult[0].id).toBe(1);
      expect(parsedResult[1].id).toBe(3);
      expect(parsedResult[0].comments[0].author.uniqueName).toBe("john@example.com");
      expect(parsedResult[1].comments[0].author.uniqueName).toBe("john@example.com");
    });

    it("should filter threads by author email (case-insensitive)", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request_thread);
      if (!call) throw new Error("repo_pull_request_thread tool not registered");
      const [, , , handler] = call;

      const mockThreads = [
        {
          id: 1,
          status: CommentThreadStatus.Active,
          comments: [{ id: 1, author: { displayName: "John Doe", uniqueName: "John@Example.COM" }, content: "Comment by John", isDeleted: false }],
        },
        {
          id: 2,
          status: CommentThreadStatus.Active,
          comments: [{ id: 2, author: { displayName: "Jane Doe", uniqueName: "jane@example.com" }, content: "Comment by Jane", isDeleted: false }],
        },
      ];
      mockGitApi.getThreads.mockResolvedValue(mockThreads);

      const params = {
        action: "list",
        repositoryId: "repo123",
        pullRequestId: 456,
        authorEmail: "john@example.com",
        top: 100,
        skip: 0,
      };

      const result = await handler(params);

      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult).toHaveLength(1);
      expect(parsedResult[0].id).toBe(1);
    });

    it("should filter threads by author display name", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request_thread);
      if (!call) throw new Error("repo_pull_request_thread tool not registered");
      const [, , , handler] = call;

      const mockThreads = [
        {
          id: 1,
          status: CommentThreadStatus.Active,
          comments: [{ id: 1, author: { displayName: "John Doe", uniqueName: "john@example.com" }, content: "Comment by John", isDeleted: false }],
        },
        {
          id: 2,
          status: CommentThreadStatus.Active,
          comments: [{ id: 2, author: { displayName: "Jane Smith", uniqueName: "jane@example.com" }, content: "Comment by Jane", isDeleted: false }],
        },
        {
          id: 3,
          status: CommentThreadStatus.Active,
          comments: [{ id: 3, author: { displayName: "John Smith", uniqueName: "jsmith@example.com" }, content: "Comment by John Smith", isDeleted: false }],
        },
      ];
      mockGitApi.getThreads.mockResolvedValue(mockThreads);

      const params = {
        action: "list",
        repositoryId: "repo123",
        pullRequestId: 456,
        authorDisplayName: "John",
        top: 100,
        skip: 0,
      };

      const result = await handler(params);

      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult).toHaveLength(2);
      expect(parsedResult[0].id).toBe(1);
      expect(parsedResult[1].id).toBe(3);
      expect(parsedResult[0].comments[0].author.displayName).toContain("John");
      expect(parsedResult[1].comments[0].author.displayName).toContain("John");
    });

    it("should filter threads by author display name (case-insensitive)", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request_thread);
      if (!call) throw new Error("repo_pull_request_thread tool not registered");
      const [, , , handler] = call;

      const mockThreads = [
        {
          id: 1,
          status: CommentThreadStatus.Active,
          comments: [{ id: 1, author: { displayName: "JOHN DOE", uniqueName: "john@example.com" }, content: "Comment", isDeleted: false }],
        },
        {
          id: 2,
          status: CommentThreadStatus.Active,
          comments: [{ id: 2, author: { displayName: "Jane Smith", uniqueName: "jane@example.com" }, content: "Comment", isDeleted: false }],
        },
      ];
      mockGitApi.getThreads.mockResolvedValue(mockThreads);

      const params = {
        action: "list",
        repositoryId: "repo123",
        pullRequestId: 456,
        authorDisplayName: "john",
        top: 100,
        skip: 0,
      };

      const result = await handler(params);

      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult).toHaveLength(1);
      expect(parsedResult[0].id).toBe(1);
    });

    it("should filter threads by both status and author email", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request_thread);
      if (!call) throw new Error("repo_pull_request_thread tool not registered");
      const [, , , handler] = call;

      const mockThreads = [
        {
          id: 1,
          status: CommentThreadStatus.Active,
          comments: [{ id: 1, author: { displayName: "John Doe", uniqueName: "john@example.com" }, content: "Active by John", isDeleted: false }],
        },
        {
          id: 2,
          status: CommentThreadStatus.Closed,
          comments: [{ id: 2, author: { displayName: "John Doe", uniqueName: "john@example.com" }, content: "Closed by John", isDeleted: false }],
        },
        {
          id: 3,
          status: CommentThreadStatus.Active,
          comments: [{ id: 3, author: { displayName: "Jane Doe", uniqueName: "jane@example.com" }, content: "Active by Jane", isDeleted: false }],
        },
      ];
      mockGitApi.getThreads.mockResolvedValue(mockThreads);

      const params = {
        action: "list",
        repositoryId: "repo123",
        pullRequestId: 456,
        status: "Active",
        authorEmail: "john@example.com",
        top: 100,
        skip: 0,
      };

      const result = await handler(params);

      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult).toHaveLength(1);
      expect(parsedResult[0].id).toBe(1);
      expect(parsedResult[0].status).toBe(CommentThreadStatus.Active);
      expect(parsedResult[0].comments[0].author.uniqueName).toBe("john@example.com");
    });

    it("should filter threads by status and author display name", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request_thread);
      if (!call) throw new Error("repo_pull_request_thread tool not registered");
      const [, , , handler] = call;

      const mockThreads = [
        {
          id: 1,
          status: CommentThreadStatus.Active,
          comments: [{ id: 1, author: { displayName: "John Doe", uniqueName: "john@example.com" }, content: "Active by John", isDeleted: false }],
        },
        {
          id: 2,
          status: CommentThreadStatus.Fixed,
          comments: [{ id: 2, author: { displayName: "John Smith", uniqueName: "jsmith@example.com" }, content: "Fixed by John Smith", isDeleted: false }],
        },
        {
          id: 3,
          status: CommentThreadStatus.Active,
          comments: [{ id: 3, author: { displayName: "Jane Doe", uniqueName: "jane@example.com" }, content: "Active by Jane", isDeleted: false }],
        },
      ];
      mockGitApi.getThreads.mockResolvedValue(mockThreads);

      const params = {
        action: "list",
        repositoryId: "repo123",
        pullRequestId: 456,
        status: "Active",
        authorDisplayName: "John",
        top: 100,
        skip: 0,
      };

      const result = await handler(params);

      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult).toHaveLength(1);
      expect(parsedResult[0].id).toBe(1);
      expect(parsedResult[0].status).toBe(CommentThreadStatus.Active);
      expect(parsedResult[0].comments[0].author.displayName).toContain("John");
    });

    it("should combine all filters: status, authorEmail, and authorDisplayName", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request_thread);
      if (!call) throw new Error("repo_pull_request_thread tool not registered");
      const [, , , handler] = call;

      const mockThreads = [
        {
          id: 1,
          status: CommentThreadStatus.Active,
          comments: [{ id: 1, author: { displayName: "John Doe", uniqueName: "john@example.com" }, content: "Active by John Doe", isDeleted: false }],
        },
        {
          id: 2,
          status: CommentThreadStatus.Active,
          comments: [{ id: 2, author: { displayName: "John Smith", uniqueName: "john@example.com" }, content: "Active by John Smith", isDeleted: false }],
        },
        {
          id: 3,
          status: CommentThreadStatus.Closed,
          comments: [{ id: 3, author: { displayName: "John Doe", uniqueName: "john@example.com" }, content: "Closed by John Doe", isDeleted: false }],
        },
      ];
      mockGitApi.getThreads.mockResolvedValue(mockThreads);

      const params = {
        action: "list",
        repositoryId: "repo123",
        pullRequestId: 456,
        status: "Active",
        authorEmail: "john@example.com",
        authorDisplayName: "Doe",
        top: 100,
        skip: 0,
      };

      const result = await handler(params);

      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult).toHaveLength(1);
      expect(parsedResult[0].id).toBe(1);
      expect(parsedResult[0].status).toBe(CommentThreadStatus.Active);
      expect(parsedResult[0].comments[0].author.uniqueName).toBe("john@example.com");
      expect(parsedResult[0].comments[0].author.displayName).toContain("Doe");
    });

    it("should return empty array when no threads match filters", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request_thread);
      if (!call) throw new Error("repo_pull_request_thread tool not registered");
      const [, , , handler] = call;

      const mockThreads = [
        {
          id: 1,
          status: CommentThreadStatus.Active,
          comments: [{ id: 1, author: { displayName: "John Doe", uniqueName: "john@example.com" }, content: "Comment", isDeleted: false }],
        },
      ];
      mockGitApi.getThreads.mockResolvedValue(mockThreads);

      const params = {
        action: "list",
        repositoryId: "repo123",
        pullRequestId: 456,
        status: "Closed",
        authorEmail: "nonexistent@example.com",
        top: 100,
        skip: 0,
      };

      const result = await handler(params);

      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult).toHaveLength(0);
    });

    it("should apply pagination after filtering", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request_thread);
      if (!call) throw new Error("repo_pull_request_thread tool not registered");
      const [, , , handler] = call;

      const mockThreads = [
        {
          id: 1,
          status: CommentThreadStatus.Active,
          comments: [{ id: 1, author: { displayName: "User", uniqueName: "user@example.com" }, content: "Comment 1", isDeleted: false }],
        },
        {
          id: 2,
          status: CommentThreadStatus.Active,
          comments: [{ id: 2, author: { displayName: "User", uniqueName: "user@example.com" }, content: "Comment 2", isDeleted: false }],
        },
        {
          id: 3,
          status: CommentThreadStatus.Active,
          comments: [{ id: 3, author: { displayName: "User", uniqueName: "user@example.com" }, content: "Comment 3", isDeleted: false }],
        },
        {
          id: 4,
          status: CommentThreadStatus.Active,
          comments: [{ id: 4, author: { displayName: "User", uniqueName: "user@example.com" }, content: "Comment 4", isDeleted: false }],
        },
      ];
      mockGitApi.getThreads.mockResolvedValue(mockThreads);

      const params = {
        action: "list",
        repositoryId: "repo123",
        pullRequestId: 456,
        status: "Active",
        top: 2,
        skip: 1,
      };

      const result = await handler(params);

      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult).toHaveLength(2);
      expect(parsedResult[0].id).toBe(2);
      expect(parsedResult[1].id).toBe(3);
    });

    it("should handle threads with no comments when filtering by author", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request_thread);
      if (!call) throw new Error("repo_pull_request_thread tool not registered");
      const [, , , handler] = call;

      const mockThreads = [
        {
          id: 1,
          status: CommentThreadStatus.Active,
          comments: undefined,
        },
        {
          id: 2,
          status: CommentThreadStatus.Active,
          comments: [{ id: 2, author: { displayName: "User", uniqueName: "user@example.com" }, content: "Comment", isDeleted: false }],
        },
      ];
      mockGitApi.getThreads.mockResolvedValue(mockThreads);

      const params = {
        action: "list",
        repositoryId: "repo123",
        pullRequestId: 456,
        authorEmail: "user@example.com",
        top: 100,
        skip: 0,
      };

      const result = await handler(params);

      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult).toHaveLength(1);
      expect(parsedResult[0].id).toBe(2);
    });

    it("should handle threads with empty comments array when filtering by author", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request_thread);
      if (!call) throw new Error("repo_pull_request_thread tool not registered");
      const [, , , handler] = call;

      const mockThreads = [
        {
          id: 1,
          status: CommentThreadStatus.Active,
          comments: [],
        },
        {
          id: 2,
          status: CommentThreadStatus.Active,
          comments: [{ id: 2, author: { displayName: "User", uniqueName: "user@example.com" }, content: "Comment", isDeleted: false }],
        },
      ];
      mockGitApi.getThreads.mockResolvedValue(mockThreads);

      const params = {
        action: "list",
        repositoryId: "repo123",
        pullRequestId: 456,
        authorDisplayName: "User",
        top: 100,
        skip: 0,
      };

      const result = await handler(params);

      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult).toHaveLength(1);
      expect(parsedResult[0].id).toBe(2);
    });
  });

  describe("repo_list_pull_request_thread_comments", () => {
    it("should list pull request thread comments", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request_thread);
      if (!call) throw new Error("repo_pull_request_thread tool not registered");
      const [, , , handler] = call;

      const mockComments = [
        {
          id: 1,
          author: { displayName: "John Doe", uniqueName: "john@example.com" },
          content: "This looks good",
          publishedDate: "2023-01-01T00:00:00Z",
          lastUpdatedDate: "2023-01-01T00:30:00Z",
          lastContentUpdatedDate: "2023-01-01T00:15:00Z",
          isDeleted: false,
        },
        {
          id: 2,
          author: { displayName: "Jane Doe", uniqueName: "jane@example.com" },
          content: "Deleted comment",
          publishedDate: "2023-01-01T01:00:00Z",
          isDeleted: true,
        },
      ];
      mockGitApi.getComments.mockResolvedValue(mockComments);

      const params = {
        action: "list_comments",
        repositoryId: "repo123",
        pullRequestId: 456,
        threadId: 789,
        top: 100,
        skip: 0,
      };

      const result = await handler(params);

      expect(mockGitApi.getComments).toHaveBeenCalledWith("repo123", 456, 789, undefined);

      const expectedResult = [
        {
          id: 1,
          author: { displayName: "John Doe", uniqueName: "john@example.com" },
          content: "This looks good",
          publishedDate: "2023-01-01T00:00:00Z",
          lastUpdatedDate: "2023-01-01T00:30:00Z",
          lastContentUpdatedDate: "2023-01-01T00:15:00Z",
        },
      ];

      expect(result.content[0].text).toBe(JSON.stringify(expectedResult, null, 2));
    });

    it("should list pull request thread comments with full response", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request_thread);
      if (!call) throw new Error("repo_pull_request_thread tool not registered");
      const [, , , handler] = call;

      const mockComments = [
        {
          id: 1,
          author: { displayName: "John Doe", uniqueName: "john@example.com" },
          content: "This looks good",
          publishedDate: "2023-01-01T00:00:00Z",
          lastUpdatedDate: "2023-01-01T00:30:00Z",
          lastContentUpdatedDate: "2023-01-01T00:15:00Z",
          isDeleted: false,
          // Additional properties that would be in full response
          commentType: 1,
          usersLiked: [],
          parentCommentId: 0,
        },
        {
          id: 2,
          author: { displayName: "Jane Doe", uniqueName: "jane@example.com" },
          content: "Deleted comment",
          publishedDate: "2023-01-01T01:00:00Z",
          isDeleted: true,
          commentType: 1,
          usersLiked: [],
          parentCommentId: 0,
        },
      ];
      mockGitApi.getComments.mockResolvedValue(mockComments);

      const params = {
        action: "list_comments",
        repositoryId: "repo123",
        pullRequestId: 456,
        threadId: 789,
        top: 100,
        skip: 0,
        fullResponse: true,
      };

      const result = await handler(params);

      expect(mockGitApi.getComments).toHaveBeenCalledWith("repo123", 456, 789, undefined);

      // When fullResponse is true, it should return the full comment objects without trimming
      expect(result.content[0].text).toBe(JSON.stringify(mockComments, null, 2));
    });
  });

  describe("repo_list_branches_by_repo", () => {
    it("should list branches by repository", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_branch);
      if (!call) throw new Error("repo_branch tool not registered");
      const [, , , handler] = call;

      const mockBranches = [
        { name: "refs/heads/main" },
        { name: "refs/heads/feature-1" },
        { name: "refs/heads/feature-2" },
        { name: "refs/tags/v1.0" }, // Should be filtered out
      ];
      mockGitApi.getRefs.mockResolvedValue(mockBranches);

      const params = {
        action: "list",
        repositoryId: "repo123",
        project: "test-project",
        top: 100,
      };

      const result = await handler(params);

      expect(mockGitApi.getRefs).toHaveBeenCalledWith("repo123", "test-project", "heads/", undefined, undefined, undefined, undefined, undefined, undefined);

      const expectedResult = ["main", "feature-2", "feature-1"]; // Sorted reverse alphabetically
      expect(result.content[0].text).toBe(JSON.stringify(expectedResult, null, 2));
    });
  });

  describe("repo_list_my_branches_by_repo", () => {
    it("should list my branches by repository", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_branch);
      if (!call) throw new Error("repo_branch tool not registered");
      const [, , , handler] = call;

      const mockBranches = [{ name: "refs/heads/main" }, { name: "refs/heads/my-feature" }];
      mockGitApi.getRefs.mockResolvedValue(mockBranches);

      const params = {
        action: "list_mine",
        repositoryId: "repo123",
        project: "test-project",
        top: 100,
      };

      const result = await handler(params);

      expect(mockGitApi.getRefs).toHaveBeenCalledWith("repo123", "test-project", undefined, undefined, undefined, true, undefined, undefined, undefined);

      const expectedResult = ["my-feature", "main"];
      expect(result.content[0].text).toBe(JSON.stringify(expectedResult, null, 2));
    });
  });

  describe("repo_get_repo_by_name_or_id", () => {
    it("should get repository by name", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_repository);
      if (!call) throw new Error("repo_repository tool not registered");
      const [, , , handler] = call;

      const mockRepos = [
        { id: "repo1", name: "test-repo" },
        { id: "repo2", name: "other-repo" },
      ];
      mockGitApi.getRepositories.mockResolvedValue(mockRepos);

      const params = {
        action: "get",
        project: "test-project",
        repositoryNameOrId: "test-repo",
      };

      const result = await handler(params);

      expect(mockGitApi.getRepositories).toHaveBeenCalledWith("test-project");
      expect(result.content[0].text).toBe(JSON.stringify(mockRepos[0], null, 2));
    });

    it("should get repository by ID", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_repository);
      if (!call) throw new Error("repo_repository tool not registered");
      const [, , , handler] = call;

      const mockRepos = [
        { id: "repo1", name: "test-repo" },
        { id: "repo2", name: "other-repo" },
      ];
      mockGitApi.getRepositories.mockResolvedValue(mockRepos);

      const params = {
        action: "get",
        project: "test-project",
        repositoryNameOrId: "repo2",
      };

      const result = await handler(params);

      expect(result.content[0].text).toBe(JSON.stringify(mockRepos[1], null, 2));
    });

    it("should return error when repository not found", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_repository);
      if (!call) throw new Error("repo_repository tool not registered");
      const [, , , handler] = call;

      mockGitApi.getRepositories.mockResolvedValue([]);

      const params = {
        action: "get",
        project: "test-project",
        repositoryNameOrId: "nonexistent-repo",
      };

      const result = await handler(params);
      expect(result).toEqual({
        content: [{ type: "text", text: "Repository nonexistent-repo not found in project test-project" }],
        isError: true,
      });
    });
  });

  describe("repo_get_branch_by_name", () => {
    it("should get branch by name", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_branch);
      if (!call) throw new Error("repo_branch tool not registered");
      const [, , , handler] = call;

      const mockBranches = [
        { name: "refs/heads/main", objectId: "abc123" },
        { name: "refs/heads/feature", objectId: "def456" },
      ];
      mockGitApi.getRefs.mockResolvedValue(mockBranches);

      const params = {
        action: "get",
        repositoryId: "repo123",
        project: "test-project",
        branchName: "main",
      };

      const result = await handler(params);

      expect(mockGitApi.getRefs).toHaveBeenCalledWith("repo123", "test-project", "heads/", false, false, undefined, false, undefined, "main");
      expect(result.content[0].text).toBe(JSON.stringify(mockBranches[0], null, 2));
    });

    it("should return error message when branch not found", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_branch);
      if (!call) throw new Error("repo_branch tool not registered");
      const [, , , handler] = call;

      mockGitApi.getRefs.mockResolvedValue([]);

      const params = {
        action: "get",
        repositoryId: "repo123",
        project: "test-project",
        branchName: "nonexistent",
      };

      const result = await handler(params);

      expect(result.content[0].text).toBe("Branch nonexistent not found in repository repo123");
    });
  });

  describe("repo_get_pull_request_by_id", () => {
    it("should get pull request by ID", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request);
      if (!call) throw new Error("repo_pull_request tool not registered");
      const [, , , handler] = call;

      const mockPR = {
        pullRequestId: 123,
        title: "Test PR",
        status: 1,
      };
      mockGitApi.getPullRequest.mockResolvedValue(mockPR);

      const params = {
        action: "get",
        repositoryId: "repo123",
        pullRequestId: 123,
        includeWorkItemRefs: false,
      };

      const result = await handler(params);

      expect(mockGitApi.getPullRequest).toHaveBeenCalledWith("repo123", 123, undefined, undefined, undefined, undefined, undefined, false);
      expect(result.content[0].text).toBe(JSON.stringify(mockPR, null, 2));
    });

    it("should pass project parameter when provided", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request);
      if (!call) throw new Error("repo_pull_request tool not registered");
      const [, , , handler] = call;

      const mockPR = {
        pullRequestId: 456,
        title: "Test PR with project",
        status: 1,
      };
      mockGitApi.getPullRequest.mockResolvedValue(mockPR);

      const params = {
        action: "get",
        repositoryId: "my-repo-name",
        pullRequestId: 456,
        project: "my-project",
        includeWorkItemRefs: false,
      };

      const result = await handler(params);

      expect(mockGitApi.getPullRequest).toHaveBeenCalledWith("my-repo-name", 456, "my-project", undefined, undefined, undefined, undefined, false);
      expect(result.content[0].text).toBe(JSON.stringify(mockPR, null, 2));
    });

    it("should include work item refs when requested", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request);
      if (!call) throw new Error("repo_pull_request tool not registered");
      const [, , , handler] = call;

      mockGitApi.getPullRequest.mockResolvedValue({});

      const params = {
        action: "get",
        repositoryId: "repo123",
        pullRequestId: 123,
        includeWorkItemRefs: true,
      };

      await handler(params);

      expect(mockGitApi.getPullRequest).toHaveBeenCalledWith("repo123", 123, undefined, undefined, undefined, undefined, undefined, true);
    });

    it("should include labels when includeLabels is true", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request);
      if (!call) throw new Error("repo_pull_request tool not registered");
      const [, , , handler] = call;

      const mockPR = {
        pullRequestId: 123,
        title: "Test PR",
        status: 1,
        repository: {
          project: {
            id: "project123",
            name: "testproject",
          },
        },
      };
      const mockLabels = [
        { name: "bug", id: "label1" },
        { name: "enhancement", id: "label2" },
      ];

      mockGitApi.getPullRequest.mockResolvedValue(mockPR);
      mockGitApi.getPullRequestLabels.mockResolvedValue(mockLabels);

      const params = {
        action: "get",
        repositoryId: "repo123",
        pullRequestId: 123,
        includeLabels: true,
        includeWorkItemRefs: false,
      };

      const result = await handler(params);

      expect(mockGitApi.getPullRequest).toHaveBeenCalledWith("repo123", 123, undefined, undefined, undefined, undefined, undefined, false);
      expect(mockGitApi.getPullRequestLabels).toHaveBeenCalledWith("repo123", 123, "testproject", "project123");

      const expectedResponse = {
        ...mockPR,
        labelSummary: {
          labels: ["bug", "enhancement"],
          labelCount: 2,
        },
      };

      expect(result.content[0].text).toBe(JSON.stringify(expectedResponse, null, 2));
    });

    it("should not include labels when includeLabels parameter is not specified and defaults are not applied", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request);
      if (!call) throw new Error("repo_pull_request tool not registered");
      const [, , , handler] = call;

      const mockPR = {
        pullRequestId: 123,
        title: "Test PR",
        status: 1,
      };

      mockGitApi.getPullRequest.mockResolvedValue(mockPR);

      const params = {
        action: "get",
        repositoryId: "repo123",
        pullRequestId: 123,
        // includeLabels not specified, in test environment doesn't get default
        // includeWorkItemRefs not specified, doesn't get default
      };

      const result = await handler(params);

      expect(mockGitApi.getPullRequest).toHaveBeenCalledWith("repo123", 123, undefined, undefined, undefined, undefined, undefined, undefined);
      expect(mockGitApi.getPullRequestLabels).not.toHaveBeenCalled();
      expect(result.content[0].text).toBe(JSON.stringify(mockPR, null, 2));
    });

    it("should include labels by default when includeLabels is explicitly set to default value true", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request);
      if (!call) throw new Error("repo_pull_request tool not registered");
      const [, , , handler] = call;

      const mockPR = {
        pullRequestId: 123,
        title: "Test PR",
        status: 1,
        repository: {
          project: {
            id: "project123",
            name: "testproject",
          },
        },
      };
      const mockLabels = [{ name: "documentation", id: "label3" }];

      mockGitApi.getPullRequest.mockResolvedValue(mockPR);
      mockGitApi.getPullRequestLabels.mockResolvedValue(mockLabels);

      const params = {
        action: "get",
        repositoryId: "repo123",
        pullRequestId: 123,
        includeLabels: true, // explicitly set to default value
        includeWorkItemRefs: false, // explicitly set to default value
      };

      const result = await handler(params);

      expect(mockGitApi.getPullRequest).toHaveBeenCalledWith("repo123", 123, undefined, undefined, undefined, undefined, undefined, false);
      expect(mockGitApi.getPullRequestLabels).toHaveBeenCalledWith("repo123", 123, "testproject", "project123");

      const expectedResponse = {
        ...mockPR,
        labelSummary: {
          labels: ["documentation"],
          labelCount: 1,
        },
      };

      expect(result.content[0].text).toBe(JSON.stringify(expectedResponse, null, 2));
    });

    it("should not include labels when includeLabels is false", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request);
      if (!call) throw new Error("repo_pull_request tool not registered");
      const [, , , handler] = call;

      const mockPR = {
        pullRequestId: 123,
        title: "Test PR",
        status: 1,
      };

      mockGitApi.getPullRequest.mockResolvedValue(mockPR);

      const params = {
        action: "get",
        repositoryId: "repo123",
        pullRequestId: 123,
        includeLabels: false,
        includeWorkItemRefs: false,
      };

      const result = await handler(params);

      expect(mockGitApi.getPullRequest).toHaveBeenCalledWith("repo123", 123, undefined, undefined, undefined, undefined, undefined, false);
      expect(mockGitApi.getPullRequestLabels).not.toHaveBeenCalled();
      expect(result.content[0].text).toBe(JSON.stringify(mockPR, null, 2));
    });

    it("should handle empty labels array", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request);
      if (!call) throw new Error("repo_pull_request tool not registered");
      const [, , , handler] = call;

      const mockPR = {
        pullRequestId: 123,
        title: "Test PR",
        status: 1,
        repository: {
          project: {
            id: "project123",
            name: "testproject",
          },
        },
      };
      const mockLabels: any[] = [];

      mockGitApi.getPullRequest.mockResolvedValue(mockPR);
      mockGitApi.getPullRequestLabels.mockResolvedValue(mockLabels);

      const params = {
        action: "get",
        repositoryId: "repo123",
        pullRequestId: 123,
        includeLabels: true,
      };

      const result = await handler(params);

      expect(mockGitApi.getPullRequestLabels).toHaveBeenCalledWith("repo123", 123, "testproject", "project123");

      const expectedResponse = {
        ...mockPR,
        labelSummary: {
          labels: [],
          labelCount: 0,
        },
      };

      expect(result.content[0].text).toBe(JSON.stringify(expectedResponse, null, 2));
    });

    it("should handle labels with undefined names", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request);
      if (!call) throw new Error("repo_pull_request tool not registered");
      const [, , , handler] = call;

      const mockPR = {
        pullRequestId: 123,
        title: "Test PR",
        status: 1,
        repository: {
          project: {
            id: "project123",
            name: "testproject",
          },
        },
      };
      const mockLabels = [
        { name: "bug", id: "label1" },
        { name: undefined, id: "label2" }, // undefined name should be filtered out
        { name: "feature", id: "label3" },
      ];

      mockGitApi.getPullRequest.mockResolvedValue(mockPR);
      mockGitApi.getPullRequestLabels.mockResolvedValue(mockLabels);

      const params = {
        action: "get",
        repositoryId: "repo123",
        pullRequestId: 123,
        includeLabels: true,
      };

      const result = await handler(params);

      const expectedResponse = {
        ...mockPR,
        labelSummary: {
          labels: ["bug", "feature"], // undefined name filtered out
          labelCount: 2,
        },
      };

      expect(result.content[0].text).toBe(JSON.stringify(expectedResponse, null, 2));
    });

    it("should handle getPullRequestLabels API error gracefully", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request);
      if (!call) throw new Error("repo_pull_request tool not registered");
      const [, , , handler] = call;

      const mockPR = {
        pullRequestId: 123,
        title: "Test PR",
        status: 1,
        repository: {
          project: {
            id: "project123",
            name: "testproject",
          },
        },
      };

      mockGitApi.getPullRequest.mockResolvedValue(mockPR);
      mockGitApi.getPullRequestLabels.mockRejectedValue(new Error("API Error: Labels not accessible"));

      // Mock console.warn to verify warning is logged
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation();

      const params = {
        action: "get",
        repositoryId: "repo123",
        pullRequestId: 123,
        includeLabels: true,
      };

      const result = await handler(params);

      expect(mockGitApi.getPullRequestLabels).toHaveBeenCalledWith("repo123", 123, "testproject", "project123");
      expect(consoleSpy).toHaveBeenCalledWith("Error fetching PR labels: API Error: Labels not accessible");

      // Should fall back to empty labelSummary
      const expectedResponse = {
        ...mockPR,
        labelSummary: {},
      };

      expect(result.content[0].text).toBe(JSON.stringify(expectedResponse, null, 2));

      consoleSpy.mockRestore();
    });

    it("should work with both includeLabels and includeWorkItemRefs enabled", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request);
      if (!call) throw new Error("repo_pull_request tool not registered");
      const [, , , handler] = call;

      const mockPR = {
        pullRequestId: 123,
        title: "Test PR",
        status: 1,
        repository: {
          project: {
            id: "project123",
            name: "testproject",
          },
        },
      };
      const mockLabels = [{ name: "urgent", id: "label1" }];

      mockGitApi.getPullRequest.mockResolvedValue(mockPR);
      mockGitApi.getPullRequestLabels.mockResolvedValue(mockLabels);

      const params = {
        action: "get",
        repositoryId: "repo123",
        pullRequestId: 123,
        includeLabels: true,
        includeWorkItemRefs: true,
      };

      const result = await handler(params);

      expect(mockGitApi.getPullRequest).toHaveBeenCalledWith("repo123", 123, undefined, undefined, undefined, undefined, undefined, true);
      expect(mockGitApi.getPullRequestLabels).toHaveBeenCalledWith("repo123", 123, "testproject", "project123");

      const expectedResponse = {
        ...mockPR,
        labelSummary: {
          labels: ["urgent"],
          labelCount: 1,
        },
      };

      expect(result.content[0].text).toBe(JSON.stringify(expectedResponse, null, 2));
    });

    it("should include changed files when includeChangedFiles is true", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request);
      if (!call) throw new Error("repo_pull_request tool not registered");
      const [, , , handler] = call;

      const mockPR = {
        pullRequestId: 123,
        title: "Test PR",
        repository: { project: { id: "project123", name: "testproject" } },
      };
      mockGitApi.getPullRequest.mockResolvedValue(mockPR);

      const mockChangeEntries = [
        { changeTrackingId: 1, item: { path: "/src/file1.ts" }, changeType: 2 },
        { changeTrackingId: 2, item: { path: "/src/file2.ts" }, changeType: 1 },
      ];
      mockGitApi.getPullRequestIterations.mockResolvedValue([{ id: 1 }, { id: 2 }]);
      mockGitApi.getPullRequestIterationChanges.mockResolvedValue({ changeEntries: mockChangeEntries });

      const params = {
        action: "get",
        repositoryId: "repo123",
        pullRequestId: 123,
        includeChangedFiles: true,
      };

      const result = await handler(params);

      expect(mockGitApi.getPullRequestIterations).toHaveBeenCalledWith("repo123", 123, undefined);
      expect(mockGitApi.getPullRequestIterationChanges).toHaveBeenCalledWith("repo123", 123, 2, undefined);

      const resultData = JSON.parse(result.content[0].text);
      expect(resultData.changedFilesSummary).toEqual({
        changeEntries: mockChangeEntries,
        fileCount: 2,
        firstComparingIteration: 1,
        secondComparingIteration: 2,
      });
    });

    it("should not fetch changed files when includeChangedFiles is false", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request);
      const [, , , handler] = call;

      const mockPR = { pullRequestId: 123, title: "Test PR" };
      mockGitApi.getPullRequest.mockResolvedValue(mockPR);

      const result = await handler({ action: "get", repositoryId: "repo123", pullRequestId: 123, includeChangedFiles: false });

      expect(mockGitApi.getPullRequestIterations).not.toHaveBeenCalled();
      expect(result.content[0].text).toBe(JSON.stringify(mockPR, null, 2));
    });

    it("should not fetch changed files when includeChangedFiles is not specified", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request);
      const [, , , handler] = call;

      const mockPR = { pullRequestId: 123, title: "Test PR" };
      mockGitApi.getPullRequest.mockResolvedValue(mockPR);

      const result = await handler({ action: "get", repositoryId: "repo123", pullRequestId: 123 });

      expect(mockGitApi.getPullRequestIterations).not.toHaveBeenCalled();
      expect(result.content[0].text).toBe(JSON.stringify(mockPR, null, 2));
    });

    it("should handle empty iterations when includeChangedFiles is true", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request);
      const [, , , handler] = call;

      const mockPR = { pullRequestId: 123, title: "Test PR" };
      mockGitApi.getPullRequest.mockResolvedValue(mockPR);
      mockGitApi.getPullRequestIterations.mockResolvedValue([]);

      const result = await handler({ action: "get", repositoryId: "repo123", pullRequestId: 123, includeChangedFiles: true });

      const resultData = JSON.parse(result.content[0].text);
      expect(resultData.changedFilesSummary).toEqual({ changeEntries: [], fileCount: 0 });
      expect(mockGitApi.getPullRequestIterationChanges).not.toHaveBeenCalled();
    });

    it("should handle getPullRequestIterationChanges API error gracefully", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request);
      const [, , , handler] = call;

      const mockPR = { pullRequestId: 123, title: "Test PR" };
      mockGitApi.getPullRequest.mockResolvedValue(mockPR);
      mockGitApi.getPullRequestIterations.mockResolvedValue([{ id: 1 }]);
      mockGitApi.getPullRequestIterationChanges.mockRejectedValue(new Error("API Error: Changes not accessible"));

      const consoleSpy = jest.spyOn(console, "warn").mockImplementation();

      const result = await handler({ action: "get", repositoryId: "repo123", pullRequestId: 123, includeChangedFiles: true });

      expect(consoleSpy).toHaveBeenCalledWith("Error fetching PR changed files: API Error: Changes not accessible");

      const resultData = JSON.parse(result.content[0].text);
      expect(resultData.pullRequestId).toBe(123);
      expect(resultData.changedFilesSummary).toEqual({});

      consoleSpy.mockRestore();
    });

    it("should handle iteration with null id when includeChangedFiles is true", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request);
      const [, , , handler] = call;

      const mockPR = { pullRequestId: 123, title: "Test PR" };
      mockGitApi.getPullRequest.mockResolvedValue(mockPR);
      mockGitApi.getPullRequestIterations.mockResolvedValue([{ id: null }]);

      const result = await handler({ action: "get", repositoryId: "repo123", pullRequestId: 123, includeChangedFiles: true });

      const resultData = JSON.parse(result.content[0].text);
      expect(resultData.changedFilesSummary).toEqual({ changeEntries: [], fileCount: 0 });
      expect(mockGitApi.getPullRequestIterationChanges).not.toHaveBeenCalled();
    });

    it("should work with both includeLabels and includeChangedFiles enabled", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request);
      const [, , , handler] = call;

      const mockPR = {
        pullRequestId: 123,
        title: "Test PR",
        repository: { project: { id: "project123", name: "testproject" } },
      };
      mockGitApi.getPullRequest.mockResolvedValue(mockPR);

      const mockLabels = [{ name: "bug", id: "label1" }];
      mockGitApi.getPullRequestLabels.mockResolvedValue(mockLabels);

      const mockChangeEntries = [{ changeTrackingId: 1, item: { path: "/src/app.ts" }, changeType: 2 }];
      mockGitApi.getPullRequestIterations.mockResolvedValue([{ id: 1 }]);
      mockGitApi.getPullRequestIterationChanges.mockResolvedValue({ changeEntries: mockChangeEntries });

      const result = await handler({
        action: "get",
        repositoryId: "repo123",
        pullRequestId: 123,
        includeLabels: true,
        includeChangedFiles: true,
      });

      expect(mockGitApi.getPullRequestLabels).toHaveBeenCalled();
      expect(mockGitApi.getPullRequestIterations).toHaveBeenCalled();

      const resultData = JSON.parse(result.content[0].text);
      expect(resultData.labelSummary).toEqual({ labels: ["bug"], labelCount: 1 });
      expect(resultData.changedFilesSummary).toEqual({
        changeEntries: mockChangeEntries,
        fileCount: 1,
        firstComparingIteration: 0,
        secondComparingIteration: 1,
      });
    });
  });

  describe("repo_search_commits", () => {
    const mockSearchResponse = {
      count: 2,
      results: [
        {
          commitId: "abc123",
          commitTitle: "test commit title one",
          commitDescription: "test commit description one",
          authorName: "test-author-1",
          repositoryName: "test-repo",
          projectName: "test-project",
        },
        {
          commitId: "def456",
          commitTitle: "test commit title two",
          commitDescription: "test commit description two",
          authorName: "test-author-2",
          repositoryName: "test-repo",
          projectName: "test-project",
        },
      ],
    };

    function setupFetchMock(ok: boolean, body: unknown, status = 200, statusText = "OK") {
      const mockFetch = jest.fn().mockResolvedValue({
        ok,
        status,
        statusText,
        text: () => Promise.resolve(JSON.stringify(body)),
      });
      global.fetch = mockFetch;
      return mockFetch;
    }

    function getHandler() {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_search_commits);
      if (!call) throw new Error("repo_search_commits tool not registered");
      const [, , , handler] = call;
      return handler;
    }

    beforeEach(() => {
      tokenProvider.mockResolvedValue("fake-token");
    });

    it("should search commits with searchText only and always send filters: {}", async () => {
      const mockFetch = setupFetchMock(true, mockSearchResponse);
      const handler = getHandler();

      const result = await handler({ searchText: "fix bug", skip: 0, top: 10, includeFacets: false });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("commitSearchResults"),
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({ Authorization: "Bearer fake-token" }),
          body: expect.stringContaining('"filters":{}'),
        })
      );
      expect(result.content[0].text).toBe(JSON.stringify(mockSearchResponse));
    });

    it("should send projectName filter when project is provided as string", async () => {
      const mockFetch = setupFetchMock(true, mockSearchResponse);
      const handler = getHandler();

      // Zod transform converts string → string[] before handler is called; pass post-transform value
      await handler({ searchText: "test search", project: ["test-project"], skip: 0, top: 10, includeFacets: false });

      const body = JSON.parse((mockFetch.mock.calls[0][1] as { body: string }).body);
      expect(body.filters.projectName).toEqual(["test-project"]);
    });

    it("should send projectName filter when project is provided as array", async () => {
      const mockFetch = setupFetchMock(true, mockSearchResponse);
      const handler = getHandler();

      await handler({ searchText: "test search", project: ["test-project-1", "test-project-2"], skip: 0, top: 10, includeFacets: false });

      const body = JSON.parse((mockFetch.mock.calls[0][1] as { body: string }).body);
      expect(body.filters.projectName).toEqual(["test-project-1", "test-project-2"]);
    });

    it("should send repositoryName filter for multiple repos", async () => {
      const mockFetch = setupFetchMock(true, mockSearchResponse);
      const handler = getHandler();

      await handler({
        searchText: "test search",
        project: ["test-project"],
        repository: ["test-repo-1", "test-repo-2"],
        skip: 0,
        top: 10,
        includeFacets: false,
      });

      const body = JSON.parse((mockFetch.mock.calls[0][1] as { body: string }).body);
      expect(body.filters.repositoryName).toEqual(["test-repo-1", "test-repo-2"]);
    });

    it("should send authorName filter for multiple authors", async () => {
      const mockFetch = setupFetchMock(true, mockSearchResponse);
      const handler = getHandler();

      await handler({
        searchText: "test search",
        author: ["test-author-1", "test-author-2"],
        skip: 0,
        top: 10,
        includeFacets: false,
      });

      const body = JSON.parse((mockFetch.mock.calls[0][1] as { body: string }).body);
      expect(body.filters.authorName).toEqual(["test-author-1", "test-author-2"]);
    });

    it("should send branchName filter", async () => {
      const mockFetch = setupFetchMock(true, mockSearchResponse);
      const handler = getHandler();

      await handler({
        searchText: "security",
        branch: ["main", "develop"],
        skip: 0,
        top: 10,
        includeFacets: false,
      });

      const body = JSON.parse((mockFetch.mock.calls[0][1] as { body: string }).body);
      expect(body.filters.branchName).toEqual(["main", "develop"]);
    });

    it("should send commitStartDate and commitEndDate filters", async () => {
      const mockFetch = setupFetchMock(true, mockSearchResponse);
      const handler = getHandler();

      await handler({
        searchText: "merge",
        commitStartDate: "2025-01-01",
        commitEndDate: "2025-06-30T23:59:59",
        skip: 0,
        top: 10,
        includeFacets: false,
      });

      const body = JSON.parse((mockFetch.mock.calls[0][1] as { body: string }).body);
      expect(body.filters.commitStartDate).toEqual(["2025-01-01"]);
      expect(body.filters.commitEndDate).toEqual(["2025-06-30T23:59:59"]);
    });

    it("should send $orderBy with commitDate DESC when orderBy is DESC", async () => {
      const mockFetch = setupFetchMock(true, mockSearchResponse);
      const handler = getHandler();

      await handler({ searchText: "fix", orderBy: "DESC", skip: 0, top: 10, includeFacets: false });

      const body = JSON.parse((mockFetch.mock.calls[0][1] as { body: string }).body);
      expect(body.$orderBy).toEqual([{ field: "commitDate", sortOrder: "DESC" }]);
    });

    it("should send $orderBy with commitDate ASC when orderBy is ASC", async () => {
      const mockFetch = setupFetchMock(true, mockSearchResponse);
      const handler = getHandler();

      await handler({ searchText: "init", orderBy: "ASC", skip: 0, top: 10, includeFacets: false });

      const body = JSON.parse((mockFetch.mock.calls[0][1] as { body: string }).body);
      expect(body.$orderBy).toEqual([{ field: "commitDate", sortOrder: "ASC" }]);
    });

    it("should not send $orderBy when orderBy is omitted", async () => {
      const mockFetch = setupFetchMock(true, mockSearchResponse);
      const handler = getHandler();

      await handler({ searchText: "fix", skip: 0, top: 10, includeFacets: false });

      const body = JSON.parse((mockFetch.mock.calls[0][1] as { body: string }).body);
      expect(body.$orderBy).toBeUndefined();
    });

    it("should send includeFacets: true when requested", async () => {
      const mockFetch = setupFetchMock(true, mockSearchResponse);
      const handler = getHandler();

      await handler({ searchText: "api", includeFacets: true, skip: 0, top: 25 });

      const body = JSON.parse((mockFetch.mock.calls[0][1] as { body: string }).body);
      expect(body.includeFacets).toBe(true);
    });

    it("should send $skip and $top for pagination", async () => {
      const mockFetch = setupFetchMock(true, mockSearchResponse);
      const handler = getHandler();

      await handler({ searchText: "test", skip: 10, top: 5, includeFacets: false });

      const body = JSON.parse((mockFetch.mock.calls[0][1] as { body: string }).body);
      expect(body.$skip).toBe(10);
      expect(body.$top).toBe(5);
    });

    it("should send all filters combined (kitchen sink)", async () => {
      const mockFetch = setupFetchMock(true, mockSearchResponse);
      const handler = getHandler();

      await handler({
        searchText: "test search",
        project: ["test-project"],
        repository: ["test-repo-1", "test-repo-2"],
        branch: ["test-branch-1"],
        author: ["test-author-1", "test-author-2"],
        commitStartDate: "2024-01-01",
        commitEndDate: "2025-12-31T23:59:59",
        orderBy: "DESC",
        includeFacets: true,
        skip: 0,
        top: 25,
      });

      const body = JSON.parse((mockFetch.mock.calls[0][1] as { body: string }).body);
      expect(body.searchText).toBe("test search");
      expect(body.filters.projectName).toEqual(["test-project"]);
      expect(body.filters.repositoryName).toEqual(["test-repo-1", "test-repo-2"]);
      expect(body.filters.branchName).toEqual(["test-branch-1"]);
      expect(body.filters.authorName).toEqual(["test-author-1", "test-author-2"]);
      expect(body.filters.commitStartDate).toEqual(["2024-01-01"]);
      expect(body.filters.commitEndDate).toEqual(["2025-12-31T23:59:59"]);
      expect(body.$orderBy).toEqual([{ field: "commitDate", sortOrder: "DESC" }]);
      expect(body.includeFacets).toBe(true);
      expect(body.$skip).toBe(0);
      expect(body.$top).toBe(25);
    });

    it("should throw an error when the API returns a non-OK response", async () => {
      setupFetchMock(false, { message: "Bad Request" }, 400, "Bad Request");
      const handler = getHandler();

      await expect(handler({ searchText: "fix", skip: 0, top: 10, includeFacets: false })).rejects.toThrow("Azure DevOps Commit Search API error: 400 Bad Request");
    });
  });

  describe("repo_list_pull_requests_by_commits", () => {
    it("should list pull requests by commits successfully", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request);
      if (!call) throw new Error("repo_pull_request tool not registered");
      const [, , , handler] = call;

      const mockQueryResult = {
        results: [
          {
            pullRequestId: 123,
            commit: "abc123",
          },
        ],
      };
      mockGitApi.getPullRequestQuery.mockResolvedValue(mockQueryResult);

      const params = {
        action: "list_by_commits",
        project: "test-project",
        repository: "test-repo",
        commits: ["abc123", "def456"],
        queryType: "LastMergeCommit",
      };

      const result = await handler(params);

      expect(mockGitApi.getPullRequestQuery).toHaveBeenCalledWith(
        {
          queries: [
            {
              items: ["abc123", "def456"],
              type: GitPullRequestQueryType.LastMergeCommit,
            },
          ],
        },
        "test-repo",
        "test-project"
      );

      expect(result.content[0].text).toBe(JSON.stringify(mockQueryResult, null, 2));
    });

    it("should handle pull request query errors", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request);
      if (!call) throw new Error("repo_pull_request tool not registered");
      const [, , , handler] = call;

      mockGitApi.getPullRequestQuery.mockRejectedValue(new Error("Query Error"));

      const params = {
        action: "list_by_commits",
        project: "test-project",
        repository: "test-repo",
        commits: ["abc123"],
      };

      const result = await handler(params);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error with pull request operation: Query Error");
    });
  });

  describe("pullRequestStatusStringToInt function coverage", () => {
    it("should handle Completed status", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request);
      if (!call) throw new Error("repo_pull_request tool not registered");
      const [, , , handler] = call;

      mockGetCurrentUserDetails.mockResolvedValue({
        authenticatedUser: { id: "user123" },
      });

      mockGitApi.getPullRequests.mockResolvedValue([]);

      const params = {
        action: "list",
        repositoryId: "repo123",
        status: "Completed",
        top: 100,
        skip: 0,
      };

      await handler(params);

      expect(mockGitApi.getPullRequests).toHaveBeenCalledWith("repo123", { status: PullRequestStatus.Completed, repositoryId: "repo123" }, undefined, undefined, 0, 100);
    });

    it("should handle All status", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request);
      if (!call) throw new Error("repo_pull_request tool not registered");
      const [, , , handler] = call;

      mockGitApi.getPullRequests.mockResolvedValue([]);

      const params = {
        action: "list",
        repositoryId: "repo123",
        status: "All",
        top: 100,
        skip: 0,
      };

      await handler(params);

      expect(mockGitApi.getPullRequests).toHaveBeenCalledWith("repo123", { status: PullRequestStatus.All, repositoryId: "repo123" }, undefined, undefined, 0, 100);
    });

    it("should handle NotSet status", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request);
      if (!call) throw new Error("repo_pull_request tool not registered");
      const [, , , handler] = call;

      mockGitApi.getPullRequests.mockResolvedValue([]);

      const params = {
        action: "list",
        repositoryId: "repo123",
        status: "NotSet",
        top: 100,
        skip: 0,
      };

      await handler(params);

      expect(mockGitApi.getPullRequests).toHaveBeenCalledWith("repo123", { status: PullRequestStatus.NotSet, repositoryId: "repo123" }, undefined, undefined, 0, 100);
    });

    it("should handle Abandoned status", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request);
      if (!call) throw new Error("repo_pull_request tool not registered");
      const [, , , handler] = call;

      mockGitApi.getPullRequests.mockResolvedValue([]);

      const params = {
        action: "list",
        repositoryId: "repo123",
        status: "Abandoned",
        top: 100,
        skip: 0,
      };

      await handler(params);

      expect(mockGitApi.getPullRequests).toHaveBeenCalledWith("repo123", { status: PullRequestStatus.Abandoned, repositoryId: "repo123" }, undefined, undefined, 0, 100);
    });

    it("should throw error for unknown status", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request);
      if (!call) throw new Error("repo_pull_request tool not registered");
      const [, , , handler] = call;

      const params = {
        action: "list",
        repositoryId: "repo123",
        status: "InvalidStatus",
        top: 100,
        skip: 0,
      };

      const result = await handler(params);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Unknown pull request status: InvalidStatus");
    });
  });

  describe("error handling coverage", () => {
    it("should handle getUserIdFromEmail error in list_pull_requests_by_repo", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request);
      if (!call) throw new Error("repo_pull_request tool not registered");
      const [, , , handler] = call;

      // Mock getUserIdFromEmail to throw an error
      mockGetUserIdFromEmail.mockRejectedValue(new Error("User not found"));

      const params = {
        action: "list",
        repositoryId: "repo123",
        created_by_user: "nonexistent@example.com",
        status: "Active",
        top: 100,
        skip: 0,
      };

      const result = await handler(params);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error finding user with email nonexistent@example.com: User not found");
    });

    it("should handle getUserIdFromEmail error in list_pull_requests_by_project", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request);
      if (!call) throw new Error("repo_pull_request tool not registered");
      const [, , , handler] = call;

      // Mock getUserIdFromEmail to throw an error
      mockGetUserIdFromEmail.mockRejectedValue(new Error("User not found"));

      const params = {
        action: "list",
        project: "test-project",
        created_by_user: "nonexistent@example.com",
        status: "Active",
        top: 100,
        skip: 0,
      };

      const result = await handler(params);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error finding user with email nonexistent@example.com: User not found");
    });

    it("should handle commit search error in search_commits", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_search_commits);
      if (!call) throw new Error("repo_search_commits tool not registered");
      const [, , , handler] = call;

      tokenProvider.mockResolvedValue("fake-token");
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500, statusText: "Internal Server Error", text: jest.fn() });

      await expect(handler({ searchText: "fix", skip: 0, top: 10, includeFacets: false })).rejects.toThrow("Azure DevOps Commit Search API error: 500 Internal Server Error");
    });
  });

  describe("edge cases and validation", () => {
    it("should handle trimComments with undefined comments", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request_thread);
      if (!call) throw new Error("repo_pull_request_thread tool not registered");
      const [, , , handler] = call;

      // Mock threads with undefined comments to test the trimComments function
      const mockThreads = [
        {
          id: 1,
          publishedDate: "2023-01-01T00:00:00Z",
          lastUpdatedDate: "2023-01-01T00:00:00Z",
          status: 1,
          comments: undefined, // undefined comments
        },
        {
          id: 2,
          publishedDate: "2023-01-02T00:00:00Z",
          lastUpdatedDate: "2023-01-02T00:00:00Z",
          status: 1,
          comments: null, // null comments
        },
      ];

      mockGitApi.getThreads.mockResolvedValue(mockThreads);

      const params = {
        action: "list",
        repositoryId: "repo123",
        pullRequestId: 456,
        top: 10,
        skip: 0,
      };

      const result = await handler(params);

      const resultData = JSON.parse(result.content[0].text);
      expect(resultData).toHaveLength(2);
      expect(resultData[0].comments).toBeUndefined();
      expect(resultData[1].comments).toBeUndefined();
    });

    it("should handle trimComments with deleted comments", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request_thread);
      if (!call) throw new Error("repo_pull_request_thread tool not registered");
      const [, , , handler] = call;

      // Mock threads with deleted comments to test the trimComments function
      const mockThreads = [
        {
          id: 1,
          publishedDate: "2023-01-01T00:00:00Z",
          lastUpdatedDate: "2023-01-01T00:00:00Z",
          status: 1,
          comments: [
            {
              id: 1,
              content: "This is a normal comment",
              isDeleted: false,
              author: { displayName: "User 1", uniqueName: "user1@example.com" },
            },
            {
              id: 2,
              content: "This comment was deleted",
              isDeleted: true, // This should be filtered out
              author: { displayName: "User 2", uniqueName: "user2@example.com" },
            },
          ],
        },
      ];

      mockGitApi.getThreads.mockResolvedValue(mockThreads);

      const params = {
        action: "list",
        repositoryId: "repo123",
        pullRequestId: 456,
        top: 10,
        skip: 0,
      };

      const result = await handler(params);

      const resultData = JSON.parse(result.content[0].text);
      expect(resultData).toHaveLength(1);
      expect(resultData[0].comments).toHaveLength(1); // Only non-deleted comment should remain
      expect(resultData[0].comments[0].id).toBe(1);
    });

    it("should handle list_repos_by_project without repoNameFilter", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_repository);
      if (!call) throw new Error("repo_repository tool not registered");
      const [, , , handler] = call;

      const mockRepos = [
        { id: "1", name: "repo1", isDisabled: false, isFork: false, isInMaintenance: false, webUrl: "http://example.com/repo1", size: 100 },
        { id: "2", name: "repo2", isDisabled: false, isFork: false, isInMaintenance: false, webUrl: "http://example.com/repo2", size: 200 },
      ];

      mockGitApi.getRepositories.mockResolvedValue(mockRepos);

      const params = {
        action: "list",
        project: "test-project",
        top: 100,
        skip: 0,
        // repoNameFilter is undefined - should test the branch where it's not provided
      };

      const result = await handler(params);

      const resultData = JSON.parse(result.content[0].text);
      expect(resultData).toHaveLength(2); // All repos should be returned when no filter is applied
      expect(resultData[0].name).toBe("repo1");
      expect(resultData[1].name).toBe("repo2");
    });

    it("should handle branches.find returning undefined (branch name mismatch)", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_branch);
      if (!call) throw new Error("repo_branch tool not registered");
      const [, , , handler] = call;

      // Mock branches that don't match the requested branch name
      const mockBranches = [
        { name: "refs/heads/other-branch", objectId: "abc123" },
        { name: "refs/heads/another-branch", objectId: "def456" },
      ];

      mockGitApi.getRefs.mockResolvedValue(mockBranches);

      const params = {
        action: "get",
        repositoryId: "repo123",
        branchName: "nonexistent-branch", // This branch doesn't exist in the mock data
      };

      const result = await handler(params);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("Branch nonexistent-branch not found in repository repo123");
    });

    it("should handle branch.name with exact branchName match", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_branch);
      if (!call) throw new Error("repo_branch tool not registered");
      const [, , , handler] = call;

      // Mock branches where one matches exactly with the branchName (second condition in the find)
      const mockBranches = [
        { name: "refs/heads/other-branch", objectId: "abc123" },
        { name: "main", objectId: "def456" }, // This matches the branchName directly
      ];

      mockGitApi.getRefs.mockResolvedValue(mockBranches);

      const params = {
        action: "get",
        repositoryId: "repo123",
        branchName: "main",
      };

      const result = await handler(params);

      expect(result.isError).toBeUndefined();
      expect(JSON.parse(result.content[0].text).name).toBe("main");
    });

    it("should handle list_pull_requests_by_repo with created_by_user and i_am_reviewer both false", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request);
      if (!call) throw new Error("repo_pull_request tool not registered");
      const [, , , handler] = call;

      mockGitApi.getPullRequests.mockResolvedValue([]);

      const params = {
        action: "list",
        repositoryId: "repo123",
        status: "Active", // Provide explicit status to avoid undefined
        created_by_me: false,
        i_am_reviewer: false,
        top: 100, // Explicit defaults
        skip: 0, // Explicit defaults
        // created_by_user is undefined - should test the case where we don't call getCurrentUserDetails
      };

      await handler(params);

      // getCurrentUserDetails should not be called when both flags are false and created_by_user is undefined
      expect(mockGetCurrentUserDetails).not.toHaveBeenCalled();
      expect(mockGitApi.getPullRequests).toHaveBeenCalledWith(
        "repo123",
        { status: PullRequestStatus.Active, repositoryId: "repo123" },
        undefined,
        undefined,
        0, // skip
        100 // top
      );
    });

    it("should handle list_pull_requests_by_project with created_by_user and i_am_reviewer both false", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request);
      if (!call) throw new Error("repo_pull_request tool not registered");
      const [, , , handler] = call;

      mockGitApi.getPullRequestsByProject.mockResolvedValue([]);

      const params = {
        action: "list",
        project: "test-project",
        status: "Active", // Provide explicit status to avoid undefined
        created_by_me: false,
        i_am_reviewer: false,
        top: 100, // Explicit defaults
        skip: 0, // Explicit defaults
        // created_by_user is undefined - should test the case where we don't call getCurrentUserDetails
      };

      await handler(params);

      // getCurrentUserDetails should not be called when both flags are false and created_by_user is undefined
      expect(mockGetCurrentUserDetails).not.toHaveBeenCalled();
      expect(mockGitApi.getPullRequestsByProject).toHaveBeenCalledWith(
        "test-project",
        { status: PullRequestStatus.Active },
        undefined,
        0, // skip
        100 // top
      );
    });

    it("should handle comments?.flatMap with null/undefined branch in branchesFilterOutIrrelevantProperties", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_branch);
      if (!call) throw new Error("repo_branch tool not registered");
      const [, , , handler] = call;

      // Mock branches with some having null/undefined names to test the flatMap filter
      const mockBranches = [
        { name: "refs/heads/main", objectId: "abc123" },
        { name: null, objectId: "def456" }, // null name should be filtered out
        { name: undefined, objectId: "ghi789" }, // undefined name should be filtered out
        { name: "refs/heads/feature", objectId: "jkl012" },
        { name: "refs/tags/v1.0", objectId: "mno345" }, // not a heads/ ref, should be filtered out
      ];

      mockGitApi.getRefs.mockResolvedValue(mockBranches);

      const params = {
        action: "list",
        repositoryId: "repo123",
      };

      const result = await handler(params);

      const resultData = JSON.parse(result.content[0].text);
      // Should only include valid heads/ refs with names
      expect(resultData).toEqual(["main", "feature"]);
    });

    it("should handle search_commits with branch filter", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_search_commits);
      if (!call) throw new Error("repo_search_commits tool not registered");
      const [, , , handler] = call;

      tokenProvider.mockResolvedValue("fake-token");
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ count: 1, results: [{ commitId: "abc123" }] })),
      });
      global.fetch = mockFetch;

      await handler({ searchText: "test commit", branch: ["main"], skip: 0, top: 10, includeFacets: false });

      const body = JSON.parse((mockFetch.mock.calls[0][1] as { body: string }).body);
      expect(body.filters.branchName).toEqual(["main"]);
    });

    it("should handle search_commits without branch filter", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_search_commits);
      if (!call) throw new Error("repo_search_commits tool not registered");
      const [, , , handler] = call;

      tokenProvider.mockResolvedValue("fake-token");
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ count: 1, results: [{ commitId: "abc123" }] })),
      });
      global.fetch = mockFetch;

      await handler({ searchText: "test commit", skip: 0, top: 10, includeFacets: false });

      const body = JSON.parse((mockFetch.mock.calls[0][1] as { body: string }).body);
      expect(body.filters.branchName).toBeUndefined();
    });

    it("should test pullRequestStatusStringToInt with unknown status", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request);
      if (!call) throw new Error("repo_pull_request tool not registered");
      const [, , , handler] = call;

      const params = {
        action: "list",
        repositoryId: "repo123",
        status: "UnknownStatus" as "Active", // Invalid status that should trigger the default case
        created_by_me: false,
        i_am_reviewer: false,
      };

      const result = await handler(params);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Unknown pull request status: UnknownStatus");
    });

    it("should handle threads?.sort with undefined id values", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request_thread);
      if (!call) throw new Error("repo_pull_request_thread tool not registered");
      const [, , , handler] = call;

      // Mock threads with undefined/null id values to test the sort function
      const mockThreads = [
        {
          id: undefined, // undefined id
          publishedDate: "2023-01-03T00:00:00Z",
          lastUpdatedDate: "2023-01-03T00:00:00Z",
          status: 1,
          comments: [],
        },
        {
          id: 2,
          publishedDate: "2023-01-02T00:00:00Z",
          lastUpdatedDate: "2023-01-02T00:00:00Z",
          status: 1,
          comments: [],
        },
        {
          id: null, // null id
          publishedDate: "2023-01-01T00:00:00Z",
          lastUpdatedDate: "2023-01-01T00:00:00Z",
          status: 1,
          comments: [],
        },
      ];

      mockGitApi.getThreads.mockResolvedValue(mockThreads);

      const params = {
        action: "list",
        repositoryId: "repo123",
        pullRequestId: 456,
        top: 10,
        skip: 0,
      };

      const result = await handler(params);

      const resultData = JSON.parse(result.content[0].text);
      expect(resultData).toHaveLength(3); // All threads should be returned even with undefined/null ids
    });

    it("should handle comments?.sort with undefined id values", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request_thread);
      if (!call) throw new Error("repo_pull_request_thread tool not registered");
      const [, , , handler] = call;

      // Mock comments with undefined/null id values to test the sort function
      const mockComments = [
        {
          id: undefined, // undefined id
          content: "Comment with undefined id",
          isDeleted: false,
          author: { displayName: "User 1", uniqueName: "user1@example.com" },
        },
        {
          id: 2,
          content: "Comment with id 2",
          isDeleted: false,
          author: { displayName: "User 2", uniqueName: "user2@example.com" },
        },
        {
          id: null, // null id
          content: "Comment with null id",
          isDeleted: false,
          author: { displayName: "User 3", uniqueName: "user3@example.com" },
        },
      ];

      mockGitApi.getComments.mockResolvedValue(mockComments);

      const params = {
        action: "list_comments",
        repositoryId: "repo123",
        pullRequestId: 456,
        threadId: 789,
        top: 10,
        skip: 0,
      };

      const result = await handler(params);

      const resultData = JSON.parse(result.content[0].text);
      expect(resultData).toHaveLength(3); // All comments should be returned even with undefined/null ids
    });

    it("should handle empty repoNameFilter in list_repos_by_project", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_repository);
      if (!call) throw new Error("repo_repository tool not registered");
      const [, , , handler] = call;

      const mockRepos = [{ id: "repo1", name: "Repository 1", isDisabled: false, isFork: false, isInMaintenance: false, webUrl: "url1", size: 1024 }];
      mockGitApi.getRepositories.mockResolvedValue(mockRepos);

      const params = {
        action: "list",
        project: "test-project",
        repoNameFilter: "", // Empty string - should use all repositories
        top: 100,
        skip: 0,
      };

      const result = await handler(params);

      // Should return all repositories since empty string is falsy
      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult).toHaveLength(1);
      expect(parsedResult[0].name).toBe("Repository 1");
    });

    it("should handle getUserIdFromEmail error with created_by_user in list_pull_requests_by_repo", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request);
      if (!call) throw new Error("repo_pull_request tool not registered");
      const [, , , handler] = call;

      mockGetUserIdFromEmail.mockRejectedValue(new Error("User not found"));

      const params = {
        action: "list",
        repositoryId: "repo123",
        created_by_user: "nonexistent@example.com",
        status: "Active",
        top: 100,
        skip: 0,
      };

      const result = await handler(params);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error finding user with email nonexistent@example.com: User not found");
    });

    it("should handle getUserIdFromEmail error with created_by_user in list_pull_requests_by_project", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request);
      if (!call) throw new Error("repo_pull_request tool not registered");
      const [, , , handler] = call;

      mockGetUserIdFromEmail.mockRejectedValue(new Error("User not found"));

      const params = {
        action: "list",
        project: "test-project",
        created_by_user: "nonexistent@example.com",
        status: "Active",
        top: 100,
        skip: 0,
      };

      const result = await handler(params);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error finding user with email nonexistent@example.com: User not found");
    });

    it("should handle error in list_pull_requests_by_commits", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request);
      if (!call) throw new Error("repo_pull_request tool not registered");
      const [, , , handler] = call;

      mockGitApi.getPullRequestQuery.mockRejectedValue(new Error("API error"));

      const params = {
        action: "list_by_commits",
        project: "test-project",
        repository: "test-repo",
        commits: ["abc123", "def456"],
        queryType: "LastMergeCommit",
      };

      const result = await handler(params);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error with pull request operation: API error");
    });

    it("should handle different queryType values in list_pull_requests_by_commits", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request);
      if (!call) throw new Error("repo_pull_request tool not registered");
      const [, , , handler] = call;

      const mockQueryResult = { results: [] };
      mockGitApi.getPullRequestQuery.mockResolvedValue(mockQueryResult);

      const params = {
        action: "list_by_commits",
        project: "test-project",
        repository: "test-repo",
        commits: ["abc123"],
        queryType: "Commit",
      };

      const result = await handler(params);

      expect(mockGitApi.getPullRequestQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          queries: [
            expect.objectContaining({
              items: ["abc123"],
              type: expect.any(Number), // Should be the enum value for Commit
            }),
          ],
        }),
        "test-repo",
        "test-project"
      );
      expect(result.content[0].text).toBe(JSON.stringify(mockQueryResult, null, 2));
    });

    it("should handle repositories with null/undefined names in sorting", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_repository);
      if (!call) throw new Error("repo_repository tool not registered");
      const [, , , handler] = call;

      const mockRepos = [
        { id: "repo1", name: undefined, isDisabled: false, isFork: false, isInMaintenance: false, webUrl: "url1", size: 1024 },
        { id: "repo2", name: "Repository B", isDisabled: false, isFork: false, isInMaintenance: false, webUrl: "url2", size: 2048 },
        { id: "repo3", name: null, isDisabled: false, isFork: false, isInMaintenance: false, webUrl: "url3", size: 3072 },
      ];
      mockGitApi.getRepositories.mockResolvedValue(mockRepos);

      const params = {
        action: "list",
        project: "test-project",
        top: 100,
        skip: 0,
      };

      const result = await handler(params);

      // Should handle sorting even with null/undefined names
      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult).toHaveLength(3);
    });

    it("should handle non-Error exceptions in list_pull_requests_by_repo", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request);
      if (!call) throw new Error("repo_pull_request tool not registered");
      const [, , , handler] = call;

      mockGetUserIdFromEmail.mockRejectedValue("String error"); // Non-Error exception

      const params = {
        action: "list",
        repositoryId: "repo123",
        created_by_user: "nonexistent@example.com",
        status: "Active",
        top: 100,
        skip: 0,
      };

      const result = await handler(params);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error finding user with email nonexistent@example.com: String error");
    });

    it("should handle non-Error exceptions in list_pull_requests_by_project", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request);
      if (!call) throw new Error("repo_pull_request tool not registered");
      const [, , , handler] = call;

      mockGetUserIdFromEmail.mockRejectedValue("String error"); // Non-Error exception

      const params = {
        action: "list",
        project: "test-project",
        created_by_user: "nonexistent@example.com",
        status: "Active",
        top: 100,
        skip: 0,
      };

      const result = await handler(params);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error finding user with email nonexistent@example.com: String error");
    });

    it("should handle non-Error exceptions in list_pull_requests_by_commits", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request);
      if (!call) throw new Error("repo_pull_request tool not registered");
      const [, , , handler] = call;

      mockGitApi.getPullRequestQuery.mockRejectedValue("String error"); // Non-Error exception

      const params = {
        action: "list_by_commits",
        project: "test-project",
        repository: "test-repo",
        commits: ["abc123", "def456"],
        queryType: "LastMergeCommit",
      };

      const result = await handler(params);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error with pull request operation: Unknown error occurred");
    });

    it("should handle network errors in search_commits", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_search_commits);
      if (!call) throw new Error("repo_search_commits tool not registered");
      const [, , , handler] = call;

      tokenProvider.mockResolvedValue("fake-token");
      global.fetch = jest.fn().mockRejectedValue(new Error("Network failure"));

      await expect(handler({ searchText: "fix", skip: 0, top: 10, includeFacets: false })).rejects.toThrow("Network failure");
    });
  });

  describe("enhanced commit search functions", () => {
    describe("repo_search_commits enhanced functionality", () => {
      it("should search commits with author and date filters via Search API", async () => {
        configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

        const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_search_commits);
        if (!call) throw new Error("repo_search_commits tool not registered");
        const [, , , handler] = call;

        tokenProvider.mockResolvedValue("fake-token");
        const mockFetch = jest.fn().mockResolvedValue({
          ok: true,
          text: () => Promise.resolve(JSON.stringify({ count: 1, results: [{ commitId: "abc123", commitTitle: "Fix bug in authentication" }] })),
        });
        global.fetch = mockFetch;

        await handler({
          searchText: "test search",
          author: ["test-author@example.com"],
          commitStartDate: "2023-01-01",
          commitEndDate: "2023-12-31T23:59:59",
          skip: 0,
          top: 10,
          includeFacets: false,
        });

        const body = JSON.parse((mockFetch.mock.calls[0][1] as { body: string }).body);
        expect(body.filters.authorName).toEqual(["test-author@example.com"]);
        expect(body.filters.commitStartDate).toEqual(["2023-01-01"]);
        expect(body.filters.commitEndDate).toEqual(["2023-12-31T23:59:59"]);
      });

      it("should search commits across multiple repos", async () => {
        configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

        const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_search_commits);
        if (!call) throw new Error("repo_search_commits tool not registered");
        const [, , , handler] = call;

        tokenProvider.mockResolvedValue("fake-token");
        const mockFetch = jest.fn().mockResolvedValue({
          ok: true,
          text: () => Promise.resolve(JSON.stringify({ count: 2, results: [{ commitId: "abc123" }, { commitId: "def456" }] })),
        });
        global.fetch = mockFetch;

        await handler({
          searchText: "refactor",
          repository: ["RepoA", "RepoB"],
          skip: 0,
          top: 10,
          includeFacets: false,
        });

        const body = JSON.parse((mockFetch.mock.calls[0][1] as { body: string }).body);
        expect(body.filters.repositoryName).toEqual(["RepoA", "RepoB"]);
      });
    });
  });

  // Error handling tests for all repository tools
  describe("Error Handling Tests", () => {
    beforeEach(() => {
      // Reset all mocks
      jest.clearAllMocks();
    });

    describe("repo_list_repos_by_project error handling", () => {
      it("should handle repository listing errors", async () => {
        configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);
        const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_repository);
        const [, , , handler] = call;

        mockGitApi.getRepositories.mockRejectedValue(new Error("Project not found"));

        const params = {
          action: "list",
          project: "nonexistent-project",
        };

        const result = await handler(params);

        expect(result).toEqual({
          content: [{ type: "text", text: "Error with repository operation: Project not found" }],
          isError: true,
        });
      });
    });

    describe("repo_list_pull_requests_by_repo_or_project error handling", () => {
      it("should handle pull request listing errors", async () => {
        configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);
        const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request);
        const [, , , handler] = call;

        mockGitApi.getPullRequests.mockRejectedValue(new Error("Repository access denied"));

        const params = {
          action: "list",
          repositoryId: "repo123",
          status: "Active", // Add required default status
        };

        const result = await handler(params);

        expect(result).toEqual({
          content: [{ type: "text", text: "Error with pull request operation: Repository access denied" }],
          isError: true,
        });
      });
    });

    describe("repo_list_pull_request_threads error handling", () => {
      it("should handle thread listing errors", async () => {
        configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);
        const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request_thread);
        const [, , , handler] = call;

        mockGitApi.getThreads.mockRejectedValue(new Error("Pull request not found"));

        const params = {
          action: "list",
          repositoryId: "repo123",
          pullRequestId: 456,
        };

        const result = await handler(params);

        expect(result).toEqual({
          content: [{ type: "text", text: "Error with pull request thread operation: Pull request not found" }],
          isError: true,
        });
      });
    });

    describe("repo_list_pull_request_thread_comments error handling", () => {
      it("should handle comment listing errors", async () => {
        configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);
        const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request_thread);
        const [, , , handler] = call;

        mockGitApi.getComments.mockRejectedValue(new Error("Thread not found"));

        const params = {
          action: "list_comments",
          repositoryId: "repo123",
          pullRequestId: 456,
          threadId: 789,
        };

        const result = await handler(params);

        expect(result).toEqual({
          content: [{ type: "text", text: "Error with pull request thread operation: Thread not found" }],
          isError: true,
        });
      });
    });

    describe("repo_list_branches_by_repo error handling", () => {
      it("should handle branch listing errors", async () => {
        configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);
        const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_branch);
        const [, , , handler] = call;

        mockGitApi.getRefs.mockRejectedValue(new Error("Repository not found"));

        const params = {
          action: "list",
          repositoryId: "repo123",
        };

        const result = await handler(params);

        expect(result).toEqual({
          content: [{ type: "text", text: "Error with branch operation: Repository not found" }],
          isError: true,
        });
      });
    });

    describe("repo_list_my_branches_by_repo error handling", () => {
      it("should handle my branches listing errors", async () => {
        configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);
        const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_branch);
        const [, , , handler] = call;

        mockGitApi.getRefs.mockRejectedValue(new Error("Access denied"));

        const params = {
          action: "list_mine",
          repositoryId: "repo123",
        };

        const result = await handler(params);

        expect(result).toEqual({
          content: [{ type: "text", text: "Error with branch operation: Access denied" }],
          isError: true,
        });
      });
    });

    describe("repo_get_repo_by_name_or_id error handling", () => {
      it("should handle repository fetch errors", async () => {
        configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);
        const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_repository);
        const [, , , handler] = call;

        mockGitApi.getRepositories.mockRejectedValue(new Error("Project not accessible"));

        const params = {
          action: "get",
          project: "test-project",
          repositoryNameOrId: "test-repo",
        };

        const result = await handler(params);

        expect(result).toEqual({
          content: [{ type: "text", text: "Error with repository operation: Project not accessible" }],
          isError: true,
        });
      });
    });

    describe("repo_get_branch_by_name error handling", () => {
      it("should handle branch fetch errors", async () => {
        configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);
        const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_branch);
        const [, , , handler] = call;

        mockGitApi.getRefs.mockRejectedValue(new Error("Branch access denied"));

        const params = {
          action: "get",
          repositoryId: "repo123",
          branchName: "main",
        };

        const result = await handler(params);

        expect(result).toEqual({
          content: [{ type: "text", text: "Error with branch operation: Branch access denied" }],
          isError: true,
        });
      });
    });

    describe("repo_get_pull_request_by_id error handling", () => {
      it("should handle pull request fetch errors", async () => {
        configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);
        const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request);
        const [, , , handler] = call;

        mockGitApi.getPullRequest.mockRejectedValue(new Error("Pull request not found"));

        const params = {
          action: "get",
          repositoryId: "repo123",
          pullRequestId: 456,
        };

        const result = await handler(params);

        expect(result).toEqual({
          content: [{ type: "text", text: "Error with pull request operation: Pull request not found" }],
          isError: true,
        });
      });
    });

    describe("repo_search_commits error handling", () => {
      it("should handle commit search errors (non-ok HTTP response)", async () => {
        configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);
        const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_search_commits);
        const [, , , handler] = call;

        tokenProvider.mockResolvedValue("fake-token");
        global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 403, statusText: "Forbidden", text: jest.fn() });

        await expect(handler({ searchText: "fix", skip: 0, top: 10, includeFacets: false })).rejects.toThrow("Azure DevOps Commit Search API error: 403 Forbidden");
      });
    });

    describe("repo_list_pull_requests_by_commits error handling", () => {
      it("should handle pull request query errors", async () => {
        configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);
        const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request);
        const [, , , handler] = call;

        mockGitApi.getPullRequestQuery.mockRejectedValue(new Error("Invalid commit ID"));

        const params = {
          action: "list_by_commits",
          project: "test-project",
          repository: "test-repo",
          commits: ["abc123"],
        };

        const result = await handler(params);

        expect(result).toEqual({
          content: [{ type: "text", text: "Error with pull request operation: Invalid commit ID" }],
          isError: true,
        });
      });
    });

    describe("repo_list_directory", () => {
      it("should list directory with default options", async () => {
        configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);
        const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_file);
        const [, , , handler] = call;

        const items = [
          {
            path: "/",
            isFolder: true,
            gitObjectType: 2,
            commitId: "abc123",
            contentMetadata: { contentType: undefined, fileName: "" },
          },
          {
            path: "/README.md",
            isFolder: false,
            gitObjectType: 3,
            commitId: "abc123",
            contentMetadata: { contentType: "text/markdown", fileName: "README.md" },
          },
        ];

        mockGitApi.getItems.mockResolvedValue(items);

        const result = await handler({ action: "list_directory", repositoryId: "repo123", path: "/", recursive: false, recursionDepth: 1 });

        expect(mockGitApi.getItems).toHaveBeenCalledWith("repo123", undefined, "/", VersionControlRecursionType.OneLevel, true, false, false, false, undefined);

        expect(result.content[0].text).toBe(
          JSON.stringify(
            {
              count: 2,
              path: "/",
              recursive: false,
              items: [
                {
                  path: "/",
                  isFolder: true,
                  gitObjectType: 2,
                  commitId: "abc123",
                  contentMetadata: { contentType: undefined, fileName: "" },
                },
                {
                  path: "/README.md",
                  isFolder: false,
                  gitObjectType: 3,
                  commitId: "abc123",
                  contentMetadata: { contentType: "text/markdown", fileName: "README.md" },
                },
              ],
            },
            null,
            2
          )
        );
      });

      it("should recursively list and filter by recursion depth", async () => {
        configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);
        const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_file);
        const [, , , handler] = call;

        const items = [
          { path: "/src", isFolder: true, gitObjectType: 2, commitId: "def456" },
          { path: "/src/index.ts", isFolder: false, gitObjectType: 3, commitId: "def456" },
          { path: "/src/components", isFolder: true, gitObjectType: 2, commitId: "def456" },
          { path: "/src/components/Button.tsx", isFolder: false, gitObjectType: 3, commitId: "def456" },
          { path: "/src/components/deep/Nested.tsx", isFolder: false, gitObjectType: 3, commitId: "def456" },
        ];

        mockGitApi.getItems.mockResolvedValue(items);

        const result = await handler({
          action: "list_directory",
          repositoryId: "repo123",
          path: "/src",
          recursive: true,
          recursionDepth: 2,
          version: "main",
          versionType: "Branch",
        });

        expect(mockGitApi.getItems).toHaveBeenCalledWith("repo123", undefined, "/src", VersionControlRecursionType.Full, true, false, false, false, {
          version: "main",
          versionType: GitVersionType.Branch,
        });

        expect(result.content[0].text).toBe(
          JSON.stringify(
            {
              count: 4,
              path: "/src",
              recursive: true,
              recursionDepth: 2,
              items: [
                { path: "/src", isFolder: true, gitObjectType: 2, commitId: "def456", contentMetadata: undefined },
                { path: "/src/index.ts", isFolder: false, gitObjectType: 3, commitId: "def456", contentMetadata: undefined },
                { path: "/src/components", isFolder: true, gitObjectType: 2, commitId: "def456", contentMetadata: undefined },
                { path: "/src/components/Button.tsx", isFolder: false, gitObjectType: 3, commitId: "def456", contentMetadata: undefined },
              ],
            },
            null,
            2
          )
        );
      });

      it("should return isError when no items found (empty array)", async () => {
        configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);
        const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_file);
        const [, , , handler] = call;

        mockGitApi.getItems.mockResolvedValue([]);

        const result = await handler({ action: "list_directory", repositoryId: "repo123", path: "/missing" });

        expect(result).toEqual({
          content: [{ type: "text", text: "No items found at path: /missing. The path may not exist in the repository." }],
          isError: true,
        });
      });

      it("should succeed for empty directory (folder entry only)", async () => {
        configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);
        const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_file);
        const [, , , handler] = call;

        const items = [
          {
            path: "/empty-dir",
            isFolder: true,
            gitObjectType: 2,
            commitId: "abc123",
          },
        ];
        mockGitApi.getItems.mockResolvedValue(items);

        const result = await handler({ action: "list_directory", repositoryId: "repo123", path: "/empty-dir" });

        expect(result.isError).toBeFalsy();
        expect(result.content[0].text).toContain('"count": 1');
      });

      it("should return isError when getItems returns null", async () => {
        configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);
        const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_file);
        const [, , , handler] = call;

        mockGitApi.getItems.mockResolvedValue(null);

        const result = await handler({ action: "list_directory", repositoryId: "repo123", path: "/nonexistent" });

        expect(result).toEqual({
          content: [{ type: "text", text: "No items found at path: /nonexistent. The path may not exist in the repository." }],
          isError: true,
        });
      });
    });

    describe("repo_list_directory error handling", () => {
      it("should handle directory list errors", async () => {
        configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);
        const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_file);
        const [, , , handler] = call;

        mockGitApi.getItems.mockRejectedValue(new Error("Repository access denied"));

        const result = await handler({ action: "list_directory", repositoryId: "repo123", path: "/" });

        expect(result).toEqual({
          content: [{ type: "text", text: "Error with file operation: Repository access denied" }],
          isError: true,
        });
      });
    });

    describe("repo_get_file_content", () => {
      it("returns file content on success", async () => {
        configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

        const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_file);
        if (!call) throw new Error("repo_file tool not registered");
        const [, , , handler] = call;

        const fileContent = "# Hello World\nThis is a test file.";
        const { Readable } = await import("stream");
        const contentStream = new Readable();
        contentStream.push(fileContent);
        contentStream.push(null);

        mockGitApi.getItemText.mockResolvedValue(contentStream);

        const result = await handler({
          action: "get_content",
          repositoryId: "test-repo",
          path: "README.md",
          project: "test-project",
        });

        expect(result.isError).toBeFalsy();
        expect(result.content[0].text).toBe(fileContent);
      });

      it("returns isError: true when getItemText throws", async () => {
        configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

        const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_file);
        if (!call) throw new Error("repo_file tool not registered");
        const [, , , handler] = call;

        mockGitApi.getItemText.mockRejectedValue(new Error("Network error"));

        const result = await handler({
          action: "get_content",
          repositoryId: "test-repo",
          path: "README.md",
          project: "test-project",
        });

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("Network error");
      });

      it("returns isError: true when getItemText stream contains ADO error JSON (e.g. file not found)", async () => {
        configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

        const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_file);
        if (!call) throw new Error("repo_file tool not registered");
        const [, , , handler] = call;

        const adoErrorBody = JSON.stringify({
          $id: "1",
          innerException: null,
          message: "The file 'nonexistent.md' does not exist in the repository.",
          typeName: "Microsoft.TeamFoundation.Git.Server.GitItemNotFoundException",
          typeKey: "GitItemNotFoundException",
          errorCode: 0,
          eventId: 3000,
        });

        const { Readable } = await import("stream");
        const errorStream = new Readable();
        errorStream.push(adoErrorBody);
        errorStream.push(null);

        mockGitApi.getItemText.mockResolvedValue(errorStream);

        const params = {
          action: "get_content",
          repositoryId: "test-repo",
          path: "nonexistent.md",
          project: "test-project",
        };

        const result = await handler(params);

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("The file 'nonexistent.md' does not exist in the repository.");
      });
    });
  });

  describe("unknown action fallbacks", () => {
    function getHandler(toolName: string) {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([name]) => name === toolName);
      if (!call) throw new Error(`${toolName} tool not registered`);
      return call[3] as (...args: unknown[]) => Promise<unknown>;
    }

    it("repo_repository: unknown action returns error", async () => {
      const handler = getHandler(REPO_TOOLS.repo_repository);
      const result = await (handler as any)({ action: "invalid_action", project: "proj" });
      expect((result as any).isError).toBe(true);
      expect((result as any).content[0].text).toContain("Unknown action");
    });

    it("repo_pull_request: unknown action returns error", async () => {
      const handler = getHandler(REPO_TOOLS.repo_pull_request);
      const result = await (handler as any)({ action: "invalid_action" });
      expect((result as any).isError).toBe(true);
      expect((result as any).content[0].text).toContain("Unknown action");
    });

    it("repo_pull_request: list with no repositoryId or project returns error", async () => {
      const handler = getHandler(REPO_TOOLS.repo_pull_request);
      const result = await (handler as any)({ action: "list", status: "Active", created_by_me: false, i_am_reviewer: false });
      expect((result as any).isError).toBe(true);
      expect((result as any).content[0].text).toContain("Either repositoryId or project must be provided.");
    });

    it("repo_pull_request_thread: unknown action returns error", async () => {
      const handler = getHandler(REPO_TOOLS.repo_pull_request_thread);
      const result = await (handler as any)({ action: "invalid_action", repositoryId: "repo1", pullRequestId: 1 });
      expect((result as any).isError).toBe(true);
      expect((result as any).content[0].text).toContain("Unknown action");
    });

    it("repo_branch: unknown action returns error", async () => {
      const handler = getHandler(REPO_TOOLS.repo_branch);
      const result = await (handler as any)({ action: "invalid_action", repositoryId: "repo1" });
      expect((result as any).isError).toBe(true);
      expect((result as any).content[0].text).toContain("Unknown action");
    });

    it("repo_file: unknown action returns error", async () => {
      const handler = getHandler(REPO_TOOLS.repo_file);
      const result = await (handler as any)({ action: "invalid_action", repositoryId: "repo1" });
      expect((result as any).isError).toBe(true);
      expect((result as any).content[0].text).toContain("Unknown action");
    });
  });

  describe("required parameter validation", () => {
    function getHandler(toolName: string) {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([name]) => name === toolName);
      if (!call) throw new Error(`${toolName} not registered`);
      return call[3] as (p: unknown) => Promise<{ content: [{ text: string }]; isError?: boolean }>;
    }

    // repo_repository
    it("repo_repository get: missing project", async () => {
      const h = getHandler(REPO_TOOLS.repo_repository);
      const r = await h({ action: "get", repositoryNameOrId: "repo1" });
      expect(r.isError).toBe(true);
      expect(r.content[0].text).toContain("project is required");
    });
    it("repo_repository get: missing repositoryNameOrId", async () => {
      const h = getHandler(REPO_TOOLS.repo_repository);
      const r = await h({ action: "get", project: "proj" });
      expect(r.isError).toBe(true);
      expect(r.content[0].text).toContain("repositoryNameOrId is required");
    });
    it("repo_repository list: missing project", async () => {
      const h = getHandler(REPO_TOOLS.repo_repository);
      const r = await h({ action: "list" });
      expect(r.isError).toBe(true);
      expect(r.content[0].text).toContain("project is required");
    });

    // repo_pull_request
    it("repo_pull_request get: missing repositoryId", async () => {
      const h = getHandler(REPO_TOOLS.repo_pull_request);
      const r = await h({ action: "get", pullRequestId: 1 });
      expect(r.isError).toBe(true);
      expect(r.content[0].text).toContain("repositoryId is required");
    });
    it("repo_pull_request get: missing pullRequestId", async () => {
      const h = getHandler(REPO_TOOLS.repo_pull_request);
      const r = await h({ action: "get", repositoryId: "r" });
      expect(r.isError).toBe(true);
      expect(r.content[0].text).toContain("pullRequestId is required");
    });
    it("repo_pull_request list_by_commits: missing project", async () => {
      const h = getHandler(REPO_TOOLS.repo_pull_request);
      const r = await h({ action: "list_by_commits", repository: "r", commits: ["c"] });
      expect(r.isError).toBe(true);
      expect(r.content[0].text).toContain("project is required");
    });
    it("repo_pull_request list_by_commits: missing repository", async () => {
      const h = getHandler(REPO_TOOLS.repo_pull_request);
      const r = await h({ action: "list_by_commits", project: "p", commits: ["c"] });
      expect(r.isError).toBe(true);
      expect(r.content[0].text).toContain("repository is required");
    });
    it("repo_pull_request list_by_commits: missing commits", async () => {
      const h = getHandler(REPO_TOOLS.repo_pull_request);
      const r = await h({ action: "list_by_commits", project: "p", repository: "r" });
      expect(r.isError).toBe(true);
      expect(r.content[0].text).toContain("commits is required");
    });

    // repo_pull_request_thread
    it("repo_pull_request_thread list_comments: missing threadId", async () => {
      const h = getHandler(REPO_TOOLS.repo_pull_request_thread);
      const r = await h({ action: "list_comments", repositoryId: "r", pullRequestId: 1 });
      expect(r.isError).toBe(true);
      expect(r.content[0].text).toContain("threadId is required");
    });

    // repo_branch
    it("repo_branch get: missing branchName", async () => {
      const h = getHandler(REPO_TOOLS.repo_branch);
      const r = await h({ action: "get", repositoryId: "r" });
      expect(r.isError).toBe(true);
      expect(r.content[0].text).toContain("branchName is required");
    });

    // repo_file
    it("repo_file get_content: missing path", async () => {
      const h = getHandler(REPO_TOOLS.repo_file);
      const r = await h({ action: "get_content", repositoryId: "r", path: "" });
      expect(r.isError).toBe(true);
      expect(r.content[0].text).toContain("path is required");
    });
  });

  describe("non-Error catch branches", () => {
    function getHandler(toolName: string) {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([name]) => name === toolName);
      if (!call) throw new Error(`${toolName} not registered`);
      return call[3] as (p: unknown) => Promise<{ content: [{ text: string }]; isError?: boolean }>;
    }

    it("repo_repository: non-Error thrown returns Unknown error occurred", async () => {
      mockGitApi.getRepositories.mockRejectedValue("not an error object");
      const h = getHandler(REPO_TOOLS.repo_repository);
      const r = await h({ action: "list", project: "p" });
      expect(r.isError).toBe(true);
      expect(r.content[0].text).toContain("Unknown error occurred");
    });

    it("repo_pull_request_thread: non-Error thrown returns Unknown error occurred", async () => {
      mockGitApi.getThreads.mockRejectedValue("not an error object");
      const h = getHandler(REPO_TOOLS.repo_pull_request_thread);
      const r = await h({ action: "list", repositoryId: "r", pullRequestId: 1 });
      expect(r.isError).toBe(true);
      expect(r.content[0].text).toContain("Unknown error occurred");
    });

    it("repo_branch: non-Error thrown returns Unknown error occurred", async () => {
      mockGitApi.getRefs.mockRejectedValue("not an error object");
      const h = getHandler(REPO_TOOLS.repo_branch);
      const r = await h({ action: "list", repositoryId: "r" });
      expect(r.isError).toBe(true);
      expect(r.content[0].text).toContain("Unknown error occurred");
    });

    it("repo_file: non-Error thrown returns Unknown error occurred", async () => {
      mockGitApi.getItems.mockRejectedValue("not an error object");
      const h = getHandler(REPO_TOOLS.repo_file);
      const r = await h({ action: "list_directory", repositoryId: "r", path: "/" });
      expect(r.isError).toBe(true);
      expect(r.content[0].text).toContain("Unknown error occurred");
    });
  });

  describe("feature branch coverage", () => {
    // repo_pull_request: includeChangedFiles edge cases
    describe("repo_pull_request get includeChangedFiles edge cases", () => {
      function getHandler() {
        configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);
        const call = (server.tool as jest.Mock).mock.calls.find(([name]) => name === REPO_TOOLS.repo_pull_request);
        if (!call) throw new Error("not registered");
        return call[3] as (p: unknown) => Promise<{ content: [{ text: string }] }>;
      }

      it("empty iterations returns changedFilesSummary with empty entries", async () => {
        mockGitApi.getPullRequest.mockResolvedValue({ pullRequestId: 1 });
        mockGitApi.getPullRequestIterations.mockResolvedValue([]);
        const h = getHandler();
        const r = await h({ action: "get", repositoryId: "r", pullRequestId: 1, includeChangedFiles: true });
        const data = JSON.parse(r.content[0].text);
        expect(data.changedFilesSummary).toEqual({ changeEntries: [], fileCount: 0 });
      });

      it("iteration with null id returns empty changedFilesSummary", async () => {
        mockGitApi.getPullRequest.mockResolvedValue({ pullRequestId: 1 });
        mockGitApi.getPullRequestIterations.mockResolvedValue([{ id: null }]);
        const h = getHandler();
        const r = await h({ action: "get", repositoryId: "r", pullRequestId: 1, includeChangedFiles: true });
        const data = JSON.parse(r.content[0].text);
        expect(data.changedFilesSummary).toEqual({ changeEntries: [], fileCount: 0 });
      });

      it("getPullRequestIterations throws falls back to empty changedFilesSummary", async () => {
        mockGitApi.getPullRequest.mockResolvedValue({ pullRequestId: 1 });
        mockGitApi.getPullRequestIterations.mockRejectedValue(new Error("iterations failed"));
        const consoleSpy = jest.spyOn(console, "warn").mockImplementation();
        const h = getHandler();
        const r = await h({ action: "get", repositoryId: "r", pullRequestId: 1, includeChangedFiles: true });
        const data = JSON.parse(r.content[0].text);
        expect(data.changedFilesSummary).toEqual({});
        consoleSpy.mockRestore();
      });

      it("getPullRequestLabels throws non-Error falls back to empty labelSummary", async () => {
        mockGitApi.getPullRequest.mockResolvedValue({ pullRequestId: 1, repository: { project: { id: "pid", name: "proj" } } });
        mockGitApi.getPullRequestLabels.mockRejectedValue("label fetch failed");
        const consoleSpy = jest.spyOn(console, "warn").mockImplementation();
        const h = getHandler();
        const r = await h({ action: "get", repositoryId: "r", pullRequestId: 1, includeLabels: true });
        const data = JSON.parse(r.content[0].text);
        expect(data.labelSummary).toEqual({});
        consoleSpy.mockRestore();
      });
    });

    // repo_pull_request list: user_is_reviewer non-Error
    it("repo_pull_request list: getUserIdFromEmail throws non-Error for user_is_reviewer", async () => {
      mockGetUserIdFromEmail.mockRejectedValue("not an error");
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([name]) => name === REPO_TOOLS.repo_pull_request);
      if (!call) throw new Error("not registered");
      const handler = call[3] as (p: unknown) => Promise<{ content: [{ text: string }]; isError?: boolean }>;
      const r = await handler({ action: "list", repositoryId: "r", user_is_reviewer: "user@example.com", status: "Active", created_by_me: false, i_am_reviewer: false });
      expect(r.isError).toBe(true);
      expect(r.content[0].text).toContain("Error finding reviewer");
    });

    // repo_file: get_content without version (versionDescriptor = undefined)
    it("repo_file get_content: no version yields undefined versionDescriptor", async () => {
      const { Readable } = await import("stream");
      const stream = new Readable();
      stream.push("file content");
      stream.push(null);
      mockGitApi.getItemText.mockResolvedValue(stream);
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([name]) => name === REPO_TOOLS.repo_file);
      if (!call) throw new Error("not registered");
      const handler = call[3] as (p: unknown) => Promise<{ content: [{ text: string }] }>;
      const r = await handler({ action: "get_content", repositoryId: "r", path: "/file.ts" });
      expect(r.content[0].text).toBe("file content");
      expect(mockGitApi.getItemText).toHaveBeenCalledWith("r", "/file.ts", undefined, undefined, undefined, undefined, undefined, false, undefined, true);
    });

    // repo_file: list_directory with version string
    it("repo_file list_directory: with version uses buildVersionDescriptor", async () => {
      mockGitApi.getItems.mockResolvedValue([{ path: "/README.md", isFolder: false }]);
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([name]) => name === REPO_TOOLS.repo_file);
      if (!call) throw new Error("not registered");
      const handler = call[3] as (p: unknown) => Promise<{ content: [{ text: string }] }>;
      const r = await handler({ action: "list_directory", repositoryId: "r", path: "/", version: "main", versionType: "Branch" });
      const data = JSON.parse(r.content[0].text);
      expect(data.count).toBe(1);
    });

    // repo_file: list_directory recursive filter with path="/" and item without path
    it("repo_file list_directory: recursive with path='/' and item missing path filtered out", async () => {
      mockGitApi.getItems.mockResolvedValue([
        { path: "/src", isFolder: true },
        { path: "/src/main.ts", isFolder: false },
        { path: null, isFolder: false }, // item without path — should be filtered
      ]);
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([name]) => name === REPO_TOOLS.repo_file);
      if (!call) throw new Error("not registered");
      const handler = call[3] as (p: unknown) => Promise<{ content: [{ text: string }] }>;
      const r = await handler({ action: "list_directory", repositoryId: "r", path: "/", recursive: true, recursionDepth: 1 });
      const data = JSON.parse(r.content[0].text);
      // /src (depth 1) and /src/main.ts (depth 2 > baseDepth 0 + 1) — main.ts should be filtered
      expect(data.items.every((i: { path: unknown }) => i.path !== null)).toBe(true);
    });

    // buildVersionDescriptor: versionType || "Branch" fallback
    it("repo_file list_directory: versionType undefined falls back to Branch", async () => {
      mockGitApi.getItems.mockResolvedValue([{ path: "/file.ts", isFolder: false }]);
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([name]) => name === REPO_TOOLS.repo_file);
      if (!call) throw new Error("not registered");
      const handler = call[3] as (p: unknown) => Promise<{ content: [{ text: string }] }>;
      // Pass version but no versionType — triggers the "Branch" fallback inside buildVersionDescriptor
      const r = await handler({ action: "list_directory", repositoryId: "r", path: "/", version: "main" });
      const data = JSON.parse(r.content[0].text);
      expect(data.count).toBe(1);
    });

    // line 136: ?? GitVersionType.Branch fallback when versionType not in map
    it("repo_file list_directory: unknown versionType triggers ?? GitVersionType.Branch fallback", async () => {
      mockGitApi.getItems.mockResolvedValue([{ path: "/file.ts", isFolder: false }]);
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([name]) => name === REPO_TOOLS.repo_file);
      if (!call) throw new Error("not registered");
      const handler = call[3] as (p: unknown) => Promise<{ content: [{ text: string }] }>;
      const r = await handler({ action: "list_directory", repositoryId: "r", path: "/", version: "main", versionType: "Unknown" });
      const data = JSON.parse(r.content[0].text);
      expect(data.count).toBe(1);
    });

    // line 563: version truthy branch in get_content
    it("repo_file get_content: with version creates versionDescriptor", async () => {
      const { Readable } = await import("stream");
      const stream = new Readable();
      stream.push("content");
      stream.push(null);
      mockGitApi.getItemText.mockResolvedValue(stream);
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([name]) => name === REPO_TOOLS.repo_file);
      if (!call) throw new Error("not registered");
      const handler = call[3] as (p: unknown) => Promise<{ content: [{ text: string }] }>;
      const r = await handler({ action: "get_content", repositoryId: "r", path: "/file.ts", version: "abc123", versionType: "Commit" });
      expect(r.content[0].text).toBe("content");
      expect(mockGitApi.getItemText).toHaveBeenCalledWith(
        "r",
        "/file.ts",
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        false,
        { version: "abc123", versionType: GitVersionType.Commit },
        true
      );
    });

    // line 579: versionType === "Commit" TRUE branch in list_directory
    it("repo_file list_directory: versionType Commit is remapped to Branch for buildVersionDescriptor", async () => {
      mockGitApi.getItems.mockResolvedValue([{ path: "/src", isFolder: true }]);
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([name]) => name === REPO_TOOLS.repo_file);
      if (!call) throw new Error("not registered");
      const handler = call[3] as (p: unknown) => Promise<{ content: [{ text: string }] }>;
      const r = await handler({ action: "list_directory", repositoryId: "r", path: "/", version: "main", versionType: "Commit" });
      const data = JSON.parse(r.content[0].text);
      expect(data.count).toBe(1);
    });

    // line 593: path !== "/" branch in recursive filter (non-root path)
    it("repo_file list_directory: recursive with non-root path filters by depth correctly", async () => {
      mockGitApi.getItems.mockResolvedValue([
        { path: "/src", isFolder: true },
        { path: "/src/utils", isFolder: true },
        { path: "/src/utils/helper.ts", isFolder: false },
      ]);
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([name]) => name === REPO_TOOLS.repo_file);
      if (!call) throw new Error("not registered");
      const handler = call[3] as (p: unknown) => Promise<{ content: [{ text: string }] }>;
      // path="/src" base depth=1, recursionDepth=1 → only items at depth ≤ 2
      const r = await handler({ action: "list_directory", repositoryId: "r", path: "/src", recursive: true, recursionDepth: 1 });
      const data = JSON.parse(r.content[0].text);
      // /src (depth 1) and /src/utils (depth 2) qualify; /src/utils/helper.ts (depth 3) does not
      expect(data.items.map((i: { path: unknown }) => i.path)).not.toContain("/src/utils/helper.ts");
    });

    // lines 295-296: ?? [] and ?? 0 fallbacks when changes.changeEntries is undefined
    it("repo_pull_request get: includeChangedFiles with undefined changeEntries falls back to []", async () => {
      mockGitApi.getPullRequest.mockResolvedValue({ pullRequestId: 1 });
      mockGitApi.getPullRequestIterations.mockResolvedValue([{ id: 1 }]);
      mockGitApi.getPullRequestIterationChanges.mockResolvedValue({ changeEntries: undefined });
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([name]) => name === REPO_TOOLS.repo_pull_request);
      if (!call) throw new Error("not registered");
      const handler = call[3] as (p: unknown) => Promise<{ content: [{ text: string }] }>;
      const r = await handler({ action: "get", repositoryId: "r", pullRequestId: 1, includeChangedFiles: true });
      const data = JSON.parse(r.content[0].text);
      expect(data.changedFilesSummary.changeEntries).toEqual([]);
      expect(data.changedFilesSummary.fileCount).toBe(0);
    });

    // line 308: non-Error in changedFiles catch
    it("repo_pull_request get: includeChangedFiles catch with non-Error logs Unknown error", async () => {
      mockGitApi.getPullRequest.mockResolvedValue({ pullRequestId: 1 });
      mockGitApi.getPullRequestIterations.mockRejectedValue("string error not an Error");
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation();
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([name]) => name === REPO_TOOLS.repo_pull_request);
      if (!call) throw new Error("not registered");
      const handler = call[3] as (p: unknown) => Promise<{ content: [{ text: string }] }>;
      await handler({ action: "get", repositoryId: "r", pullRequestId: 1, includeChangedFiles: true });
      expect(consoleSpy).toHaveBeenCalledWith("Error fetching PR changed files: Unknown error");
      consoleSpy.mockRestore();
    });
  });
});
