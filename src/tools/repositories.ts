// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import {
  GitRef,
  PullRequestStatus,
  GitVersionType,
  GitVersionDescriptor,
  GitPullRequestQuery,
  GitPullRequestQueryInput,
  GitPullRequestQueryType,
  CommentThreadStatus,
  GitPullRequest,
  GitPullRequestCommentThread,
  Comment,
  VersionControlRecursionType,
} from "azure-devops-node-api/interfaces/GitInterfaces.js";
import { z } from "zod";
import { getCurrentUserDetails, getUserIdFromEmail } from "./auth.js";
import { GitRepository } from "azure-devops-node-api/interfaces/TfvcInterfaces.js";
import { extractAdoStreamError, getEnumKeys, streamToString, apiVersion } from "../utils.js";
import { orgName } from "../index.js";

const REPO_TOOLS = {
  repo_repository: "repo_repository",
  repo_pull_request: "repo_pull_request",
  repo_pull_request_thread: "repo_pull_request_thread",
  repo_branch: "repo_branch",
  repo_file: "repo_file",
  repo_search_commits: "repo_search_commits",
};

function branchesFilterOutIrrelevantProperties(branches: GitRef[], top: number) {
  return branches
    ?.flatMap((branch) => (branch.name ? [branch.name] : []))
    ?.filter((branch) => branch.startsWith("refs/heads/"))
    .map((branch) => branch.replace("refs/heads/", ""))
    .sort((a, b) => b.localeCompare(a))
    .slice(0, top);
}

function trimPullRequestThread(thread: GitPullRequestCommentThread) {
  return {
    id: thread.id,
    publishedDate: thread.publishedDate,
    lastUpdatedDate: thread.lastUpdatedDate,
    status: thread.status,
    comments: trimComments(thread.comments),
    threadContext: thread.threadContext,
    pullRequestThreadContext: thread.pullRequestThreadContext,
  };
}

function trimComments(comments: Comment[] | undefined | null) {
  return comments
    ?.filter((comment) => !comment.isDeleted)
    ?.map((comment) => ({
      id: comment.id,
      author: {
        displayName: comment.author?.displayName,
        uniqueName: comment.author?.uniqueName,
      },
      content: comment.content,
      publishedDate: comment.publishedDate,
      lastUpdatedDate: comment.lastUpdatedDate,
      lastContentUpdatedDate: comment.lastContentUpdatedDate,
    }));
}

function pullRequestStatusStringToInt(status: string): number {
  switch (status) {
    case "Abandoned":
      return PullRequestStatus.Abandoned.valueOf();
    case "Active":
      return PullRequestStatus.Active.valueOf();
    case "All":
      return PullRequestStatus.All.valueOf();
    case "Completed":
      return PullRequestStatus.Completed.valueOf();
    case "NotSet":
      return PullRequestStatus.NotSet.valueOf();
    default:
      throw new Error(`Unknown pull request status: ${status}`);
  }
}

function filterReposByName(repositories: GitRepository[], repoNameFilter: string): GitRepository[] {
  const lowerCaseFilter = repoNameFilter.toLowerCase();
  return repositories?.filter((repo) => repo.name?.toLowerCase().includes(lowerCaseFilter));
}

function trimPullRequest(pr: GitPullRequest | null | undefined, includeDescription = false) {
  if (!pr) {
    return null;
  }
  const statusName = typeof pr.status === "number" ? (PullRequestStatus[pr.status] ?? "Unknown") : "Unknown";
  return {
    pullRequestId: pr.pullRequestId,
    codeReviewId: pr.codeReviewId,
    repository: pr.repository?.name,
    status: pr.status,
    statusName,
    createdBy: {
      displayName: pr.createdBy?.displayName,
      uniqueName: pr.createdBy?.uniqueName,
    },
    creationDate: pr.creationDate,
    closedDate: pr.closedDate,
    title: pr.title,
    ...(includeDescription ? { description: pr.description ?? "" } : {}),
    isDraft: pr.isDraft,
    sourceRefName: pr.sourceRefName,
    targetRefName: pr.targetRefName,
    project: pr.repository?.project?.name,
  };
}

function buildVersionDescriptor(version?: string, versionType?: string): GitVersionDescriptor | undefined {
  if (!version) return undefined;
  const versionTypeMap: Record<string, GitVersionType> = {
    Branch: GitVersionType.Branch,
    Commit: GitVersionType.Commit,
    Tag: GitVersionType.Tag,
  };
  return {
    version,
    versionType: versionTypeMap[versionType || "Branch"] ?? GitVersionType.Branch,
  };
}

function configureRepoTools(server: McpServer, tokenProvider: () => Promise<string>, connectionProvider: () => Promise<WebApi>, userAgentProvider: () => string) {
  // --- repo_repository -------------------------------------------------------
  server.tool(
    REPO_TOOLS.repo_repository,
    "Retrieve repository data for an organization or project. Use the action parameter to specify the operation.",
    {
      action: z.enum(["get", "list"]).describe("The action to perform. Options: get (get a repository by name or ID), list (list repositories in a project)."),
      project: z.string().optional().describe("The name or ID of the Azure DevOps project. Required for get and list."),
      repositoryNameOrId: z.string().optional().describe("Repository name or ID. Required for get."),
      top: z.coerce.number().default(100).describe("The maximum number of repositories to return. Used for list. Defaults to 100."),
      skip: z.coerce.number().default(0).describe("The number of repositories to skip. Used for list. Defaults to 0."),
      repoNameFilter: z.string().optional().describe("Optional filter to search for repositories by name. Used for list."),
    },
    async ({ action, project, repositoryNameOrId, top, skip, repoNameFilter }) => {
      try {
        const connection = await connectionProvider();
        const gitApi = await connection.getGitApi();

        if (action === "get") {
          if (!project) return { content: [{ type: "text", text: "project is required for get" }], isError: true };
          if (!repositoryNameOrId) return { content: [{ type: "text", text: "repositoryNameOrId is required for get" }], isError: true };

          const repositories = await gitApi.getRepositories(project);
          const repository = repositories?.find((repo) => repo.name === repositoryNameOrId || repo.id === repositoryNameOrId);

          if (!repository) {
            return { content: [{ type: "text", text: `Repository ${repositoryNameOrId} not found in project ${project}` }], isError: true };
          }
          return { content: [{ type: "text", text: JSON.stringify(repository, null, 2) }] };
        }

        if (action === "list") {
          if (!project) return { content: [{ type: "text", text: "project is required for list" }], isError: true };

          const repositories = await gitApi.getRepositories(project, false, false, false);
          const filteredRepositories = repoNameFilter ? filterReposByName(repositories, repoNameFilter) : repositories;
          const paginatedRepositories = filteredRepositories?.sort((a, b) => a.name?.localeCompare(b.name ?? "") ?? 0).slice(skip, skip + top);

          const trimmedRepositories = paginatedRepositories?.map((repo) => ({
            id: repo.id,
            name: repo.name,
            isDisabled: repo.isDisabled,
            isFork: repo.isFork,
            isInMaintenance: repo.isInMaintenance,
            webUrl: repo.webUrl,
            size: repo.size,
          }));

          return { content: [{ type: "text", text: JSON.stringify(trimmedRepositories, null, 2) }] };
        }

        return { content: [{ type: "text", text: `Unknown action: ${action}` }], isError: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error with repository operation: ${errorMessage}` }], isError: true };
      }
    }
  );

  // --- repo_pull_request -----------------------------------------------------
  server.tool(
    REPO_TOOLS.repo_pull_request,
    "Retrieve pull request data. Use the action parameter to specify the operation.",
    {
      action: z
        .enum(["get", "list", "list_by_commits"])
        .describe(
          "The action to perform. Options: get (get a pull request by ID), list (list pull requests in a repository or project), list_by_commits (find pull requests that contain specific commit IDs)."
        ),
      repositoryId: z.string().optional().describe("The ID or name of the repository. Required for get. Optional for list. When using a name instead of a GUID, project must also be provided."),
      pullRequestId: z.coerce.number().min(1).optional().describe("The ID of the pull request. Required for get."),
      project: z.string().optional().describe("Project ID or project name. Required for list_by_commits. Optional for get and list."),
      includeWorkItemRefs: z.boolean().optional().default(false).describe("Whether to include work item references. Used for get."),
      includeLabels: z.boolean().optional().default(false).describe("Whether to include labels. Used for get."),
      includeChangedFiles: z.boolean().optional().default(false).describe("Whether to include the list of changed files. Used for get."),
      top: z.coerce.number().default(100).describe("The maximum number of pull requests to return. Used for list. Defaults to 100."),
      skip: z.coerce.number().default(0).describe("The number of pull requests to skip. Used for list. Defaults to 0."),
      created_by_me: z.boolean().default(false).describe("Filter pull requests created by the current user. Used for list."),
      created_by_user: z.string().optional().describe("Filter pull requests created by a specific user email. Used for list."),
      i_am_reviewer: z.boolean().default(false).describe("Filter pull requests where the current user is a reviewer. Used for list."),
      user_is_reviewer: z.string().optional().describe("Filter pull requests where a specific user is a reviewer (email). Used for list."),
      status: z
        .enum(getEnumKeys(PullRequestStatus) as [string, ...string[]])
        .default("Active")
        .describe("Filter pull requests by status. Used for list. Defaults to 'Active'."),
      sourceRefName: z.string().optional().describe("Filter by source branch. Used for list."),
      targetRefName: z.string().optional().describe("Filter by target branch. Used for list and create."),
      repository: z.string().optional().describe("Repository name or ID. Required for list_by_commits."),
      commits: z.array(z.string()).optional().describe("Array of commit IDs to query. Required for list_by_commits."),
      queryType: z
        .enum(Object.values(GitPullRequestQueryType).filter((v): v is string => typeof v === "string") as [string, ...string[]])
        .optional()
        .default(GitPullRequestQueryType[GitPullRequestQueryType.LastMergeCommit])
        .describe("Type of commit query. Used for list_by_commits."),
    },
    async ({
      action,
      repositoryId,
      pullRequestId,
      project,
      includeWorkItemRefs,
      includeLabels,
      includeChangedFiles,
      top,
      skip,
      created_by_me,
      created_by_user,
      i_am_reviewer,
      user_is_reviewer,
      status,
      sourceRefName,
      targetRefName,
      repository,
      commits,
      queryType,
    }) => {
      try {
        const connection = await connectionProvider();
        const gitApi = await connection.getGitApi();

        if (action === "get") {
          if (!repositoryId) return { content: [{ type: "text", text: "repositoryId is required for get" }], isError: true };
          if (!pullRequestId) return { content: [{ type: "text", text: "pullRequestId is required for get" }], isError: true };

          const pullRequest = await gitApi.getPullRequest(repositoryId, pullRequestId, project, undefined, undefined, undefined, undefined, includeWorkItemRefs);
          let enhancedResponse: Record<string, unknown> = { ...pullRequest };

          if (includeLabels) {
            try {
              const projectId = pullRequest.repository?.project?.id;
              const projectName = pullRequest.repository?.project?.name;
              const labels = await gitApi.getPullRequestLabels(repositoryId, pullRequestId, projectName, projectId);
              const labelNames = labels.map((label) => label.name).filter((name) => name !== undefined);
              enhancedResponse = { ...enhancedResponse, labelSummary: { labels: labelNames, labelCount: labelNames.length } };
            } catch (error) {
              console.warn(`Error fetching PR labels: ${error instanceof Error ? error.message : "Unknown error"}`);
              enhancedResponse = { ...enhancedResponse, labelSummary: {} };
            }
          }

          if (includeChangedFiles) {
            try {
              const iterations = await gitApi.getPullRequestIterations(repositoryId, pullRequestId, project);
              if (iterations?.length) {
                const latestIteration = iterations[iterations.length - 1];
                if (latestIteration.id != null) {
                  const changes = await gitApi.getPullRequestIterationChanges(repositoryId, pullRequestId, latestIteration.id, project);
                  enhancedResponse = {
                    ...enhancedResponse,
                    changedFilesSummary: {
                      changeEntries: changes?.changeEntries ?? [],
                      fileCount: changes?.changeEntries?.length ?? 0,
                      firstComparingIteration: Math.max(0, latestIteration.id - 1),
                      secondComparingIteration: latestIteration.id,
                      nextSkip: changes?.nextSkip,
                      nextTop: changes?.nextTop,
                    },
                  };
                } else {
                  enhancedResponse = { ...enhancedResponse, changedFilesSummary: { changeEntries: [], fileCount: 0 } };
                }
              } else {
                enhancedResponse = { ...enhancedResponse, changedFilesSummary: { changeEntries: [], fileCount: 0 } };
              }
            } catch (error) {
              console.warn(`Error fetching PR changed files: ${error instanceof Error ? error.message : "Unknown error"}`);
              enhancedResponse = { ...enhancedResponse, changedFilesSummary: {} };
            }
          }

          return { content: [{ type: "text", text: JSON.stringify(enhancedResponse, null, 2) }] };
        }

        if (action === "list") {
          if (!repositoryId && !project) {
            return { content: [{ type: "text", text: "Either repositoryId or project must be provided." }], isError: true };
          }

          const searchCriteria: {
            status: number;
            repositoryId?: string;
            creatorId?: string;
            reviewerId?: string;
            sourceRefName?: string;
            targetRefName?: string;
          } = { status: pullRequestStatusStringToInt(status) };

          if (repositoryId) searchCriteria.repositoryId = repositoryId;
          if (sourceRefName) searchCriteria.sourceRefName = sourceRefName;
          if (targetRefName) searchCriteria.targetRefName = targetRefName;

          if (created_by_user) {
            try {
              const userId = await getUserIdFromEmail(created_by_user, tokenProvider, connectionProvider, userAgentProvider);
              searchCriteria.creatorId = userId;
            } catch (error) {
              return { content: [{ type: "text", text: `Error finding user with email ${created_by_user}: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
            }
          } else if (created_by_me) {
            const data = await getCurrentUserDetails(tokenProvider, connectionProvider, userAgentProvider);
            searchCriteria.creatorId = data.authenticatedUser.id;
          }

          if (user_is_reviewer) {
            try {
              const reviewerUserId = await getUserIdFromEmail(user_is_reviewer, tokenProvider, connectionProvider, userAgentProvider);
              searchCriteria.reviewerId = reviewerUserId;
            } catch (error) {
              return { content: [{ type: "text", text: `Error finding reviewer with email ${user_is_reviewer}: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
            }
          } else if (i_am_reviewer) {
            const data = await getCurrentUserDetails(tokenProvider, connectionProvider, userAgentProvider);
            searchCriteria.reviewerId = data.authenticatedUser.id;
          }

          let pullRequests;
          /* istanbul ignore else */
          if (repositoryId) {
            pullRequests = await gitApi.getPullRequests(repositoryId, searchCriteria, project, undefined, skip, top);
          } else if (project) {
            pullRequests = await gitApi.getPullRequestsByProject(project, searchCriteria, undefined, skip, top);
          }

          const filteredPullRequests = pullRequests?.map((pr) => trimPullRequest(pr));
          return { content: [{ type: "text", text: JSON.stringify(filteredPullRequests, null, 2) }] };
        }

        if (action === "list_by_commits") {
          if (!project) return { content: [{ type: "text", text: "project is required for list_by_commits" }], isError: true };
          if (!repository) return { content: [{ type: "text", text: "repository is required for list_by_commits" }], isError: true };
          if (!commits || commits.length === 0) return { content: [{ type: "text", text: "commits is required for list_by_commits" }], isError: true };

          const query: GitPullRequestQuery = {
            queries: [
              {
                items: commits,
                type: GitPullRequestQueryType[queryType as keyof typeof GitPullRequestQueryType],
              } as GitPullRequestQueryInput,
            ],
          };

          const queryResult = await gitApi.getPullRequestQuery(query, repository, project);
          return { content: [{ type: "text", text: JSON.stringify(queryResult, null, 2) }] };
        }

        return { content: [{ type: "text", text: `Unknown action: ${action}` }], isError: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error with pull request operation: ${errorMessage}` }], isError: true };
      }
    }
  );

  // --- repo_pull_request_thread ----------------------------------------------
  server.tool(
    REPO_TOOLS.repo_pull_request_thread,
    "Retrieve pull request thread and comment data. Use the action parameter to specify the operation.",
    {
      action: z.enum(["list", "list_comments"]).describe("The action to perform. Options: list (list comment threads on a pull request), list_comments (list comments in a specific thread)."),
      repositoryId: z.string().describe("The ID or name of the repository. When using a name instead of a GUID, project must also be provided."),
      pullRequestId: z.coerce.number().min(1).describe("The ID of the pull request."),
      project: z.string().optional().describe("Project ID or project name. Required when repositoryId is a name instead of a GUID."),
      threadId: z.coerce.number().min(1).optional().describe("The ID of the thread. Required for list_comments."),
      iteration: z.coerce.number().min(1).optional().describe("The iteration ID. Used for list."),
      baseIteration: z.coerce.number().min(1).optional().describe("The base iteration ID. Used for list."),
      top: z.coerce.number().default(100).describe("The maximum number of results to return. Defaults to 100."),
      skip: z.coerce.number().default(0).describe("The number of results to skip. Defaults to 0."),
      fullResponse: z.boolean().optional().default(false).describe("Return full JSON response instead of trimmed data."),
      status: z
        .enum(getEnumKeys(CommentThreadStatus) as [string, ...string[]])
        .optional()
        .describe("Filter threads by status. Used for list."),
      authorEmail: z.string().optional().describe("Filter threads by the email of the thread author. Used for list."),
      authorDisplayName: z.string().optional().describe("Filter threads by the display name of the thread author. Used for list."),
    },
    async ({ action, repositoryId, pullRequestId, project, threadId, iteration, baseIteration, top, skip, fullResponse, status, authorEmail, authorDisplayName }) => {
      try {
        const connection = await connectionProvider();
        const gitApi = await connection.getGitApi();

        if (action === "list") {
          const threads = (await gitApi.getThreads(repositoryId, pullRequestId, project, iteration, baseIteration)) ?? [];
          let filteredThreads = threads;

          if (status !== undefined) {
            const statusValue = CommentThreadStatus[status as keyof typeof CommentThreadStatus];
            filteredThreads = filteredThreads.filter((thread) => thread.status === statusValue);
          }
          if (authorEmail !== undefined) {
            filteredThreads = filteredThreads.filter((thread) => {
              const firstComment = thread.comments?.[0];
              return firstComment?.author?.uniqueName?.toLowerCase() === authorEmail.toLowerCase();
            });
          }
          if (authorDisplayName !== undefined) {
            const lowerAuthorName = authorDisplayName.toLowerCase();
            filteredThreads = filteredThreads.filter((thread) => {
              const firstComment = thread.comments?.[0];
              return firstComment?.author?.displayName?.toLowerCase().includes(lowerAuthorName);
            });
          }

          const paginatedThreads = filteredThreads.sort((a, b) => (a.id ?? 0) - (b.id ?? 0)).slice(skip, skip + top);

          if (fullResponse) {
            return { content: [{ type: "text", text: JSON.stringify(paginatedThreads, null, 2) }] };
          }

          const trimmedThreads = paginatedThreads.map((thread) => trimPullRequestThread(thread));
          return { content: [{ type: "text", text: JSON.stringify(trimmedThreads, null, 2) }] };
        }

        if (action === "list_comments") {
          if (!threadId) return { content: [{ type: "text", text: "threadId is required for list_comments" }], isError: true };

          const comments = await gitApi.getComments(repositoryId, pullRequestId, threadId, project);
          const paginatedComments = comments?.sort((a, b) => (a.id ?? 0) - (b.id ?? 0)).slice(skip, skip + top);

          if (fullResponse) {
            return { content: [{ type: "text", text: JSON.stringify(paginatedComments, null, 2) }] };
          }

          const trimmedComments = trimComments(paginatedComments);
          return { content: [{ type: "text", text: JSON.stringify(trimmedComments, null, 2) }] };
        }

        return { content: [{ type: "text", text: `Unknown action: ${action}` }], isError: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error with pull request thread operation: ${errorMessage}` }], isError: true };
      }
    }
  );

  // --- repo_branch -----------------------------------------------------------
  server.tool(
    REPO_TOOLS.repo_branch,
    "Retrieve branch data for a repository. Use the action parameter to specify the operation.",
    {
      action: z
        .enum(["get", "list", "list_mine"])
        .describe("The action to perform. Options: get (get a branch by name), list (list branches in a repository), list_mine (list branches the current user has pushed to)."),
      repositoryId: z.string().describe("The ID or name of the repository. When using a name instead of a GUID, project must also be provided."),
      project: z.string().optional().describe("Project ID or project name. Required when repositoryId is a name instead of a GUID."),
      branchName: z.string().optional().describe("The name of the branch. Required for get."),
      top: z.coerce.number().default(100).describe("The maximum number of branches to return. Used for list and list_mine. Defaults to 100."),
      filterContains: z.string().optional().describe("Filter branches containing this string. Used for list and list_mine."),
    },
    async ({ action, repositoryId, project, branchName, top, filterContains }) => {
      try {
        const connection = await connectionProvider();
        const gitApi = await connection.getGitApi();

        if (action === "get") {
          if (!branchName) return { content: [{ type: "text", text: "branchName is required for get" }], isError: true };

          const branches = await gitApi.getRefs(repositoryId, project, "heads/", false, false, undefined, false, undefined, branchName);
          const branch = branches.find((branch) => branch.name === `refs/heads/${branchName}` || branch.name === branchName);

          if (!branch) {
            return { content: [{ type: "text", text: `Branch ${branchName} not found in repository ${repositoryId}` }], isError: true };
          }
          return { content: [{ type: "text", text: JSON.stringify(branch, null, 2) }] };
        }

        if (action === "list") {
          const branches = await gitApi.getRefs(repositoryId, project, "heads/", undefined, undefined, undefined, undefined, undefined, filterContains);
          const filteredBranches = branchesFilterOutIrrelevantProperties(branches, top);
          return { content: [{ type: "text", text: JSON.stringify(filteredBranches, null, 2) }] };
        }

        if (action === "list_mine") {
          const branches = await gitApi.getRefs(repositoryId, project, undefined, undefined, undefined, true, undefined, undefined, filterContains);
          const filteredBranches = branchesFilterOutIrrelevantProperties(branches, top);
          return { content: [{ type: "text", text: JSON.stringify(filteredBranches, null, 2) }] };
        }

        return { content: [{ type: "text", text: `Unknown action: ${action}` }], isError: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error with branch operation: ${errorMessage}` }], isError: true };
      }
    }
  );

  // --- repo_file -------------------------------------------------------------
  const fileVersionTypeStrings = getEnumKeys(GitVersionType);

  server.tool(
    REPO_TOOLS.repo_file,
    "Retrieve file data from a repository. Use the action parameter to specify the operation.",
    {
      action: z
        .enum(["get_content", "list_directory"])
        .describe("The action to perform. Options: get_content (get the text content of a file at a specific branch, tag, or commit), list_directory (list files and folders in a directory)."),
      repositoryId: z.string().describe("The ID or name of the repository."),
      path: z.string().optional().default("/").describe("The file or directory path. Required for get_content. Defaults to '/' for list_directory."),
      project: z.string().optional().describe("Project ID or project name. Required when repositoryId is a name."),
      version: z.string().optional().describe("Version string: branch name, tag name, or commit SHA."),
      versionType: z
        .enum(fileVersionTypeStrings as [string, ...string[]])
        .optional()
        .default("Commit")
        .describe("How to interpret the version parameter. Used for get_content. Defaults to 'Commit'."),
      recursive: z.boolean().optional().default(false).describe("Whether to list items recursively. Used for list_directory. Defaults to false."),
      recursionDepth: z.coerce.number().min(1).optional().default(1).describe("Maximum depth for recursive listing. Used for list_directory when recursive is true. Defaults to 1."),
    },
    async ({ action, repositoryId, path, project, version, versionType, recursive, recursionDepth }) => {
      try {
        const connection = await connectionProvider();
        const gitApi = await connection.getGitApi();

        if (action === "get_content") {
          if (!path) return { content: [{ type: "text", text: "path is required for get_content" }], isError: true };

          const versionDescriptor: GitVersionDescriptor | undefined = version ? { version, versionType: GitVersionType[versionType as keyof typeof GitVersionType] } : undefined;

          const stream = await gitApi.getItemText(repositoryId, path, project, undefined, undefined, undefined, undefined, false, versionDescriptor, true);
          const content = await streamToString(stream);

          const streamError = extractAdoStreamError(content);
          if (streamError) {
            return { content: [{ type: "text", text: `Error getting file content for '${path}': ${streamError}` }], isError: true };
          }

          return { content: [{ type: "text", text: content }] };
        }

        if (action === "list_directory") {
          const versionDescriptor = buildVersionDescriptor(version, versionType === "Commit" ? "Branch" : versionType);
          const clampedDepth = Math.min(Math.max(recursionDepth || 1, 1), 10);
          const recursionType = recursive ? VersionControlRecursionType.Full : VersionControlRecursionType.OneLevel;

          const items = await gitApi.getItems(repositoryId, project, path, recursionType, true, false, false, false, versionDescriptor);

          if (!items || items.length === 0) {
            return { content: [{ type: "text", text: `No items found at path: ${path}. The path may not exist in the repository.` }], isError: true };
          }

          let filteredItems = items;

          if (recursive && clampedDepth < 10) {
            const basePath = path === "/" ? "" : path;
            const baseDepth = basePath.split("/").filter((p) => p).length;
            filteredItems = items.filter((item) => {
              if (!item.path) return false;
              const itemDepth = item.path.split("/").filter((p) => p).length;
              return itemDepth <= baseDepth + clampedDepth;
            });
          }

          const formattedItems = filteredItems.map((item) => ({
            path: item.path,
            isFolder: item.isFolder,
            gitObjectType: item.gitObjectType,
            commitId: item.commitId,
            contentMetadata: item.contentMetadata ? { contentType: item.contentMetadata.contentType, fileName: item.contentMetadata.fileName } : undefined,
          }));

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ count: formattedItems.length, path, recursive, recursionDepth: recursive ? clampedDepth : undefined, items: formattedItems }, null, 2),
              },
            ],
          };
        }

        return { content: [{ type: "text", text: `Unknown action: ${action}` }], isError: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error with file operation: ${errorMessage}` }], isError: true };
      }
    }
  );

  // --- repo_search_commits ---------------------------------------------------
  server.tool(
    REPO_TOOLS.repo_search_commits,
    "Search commits with filtering by text, author, date range, and more.",
    {
      searchText: z.string().describe("Keywords to search for in commit messages"),
      project: z
        .union([z.string().transform(/* istanbul ignore next */ (value) => [value]), z.array(z.string())])
        .optional()
        .describe("The names of the projects to search within. If omitted, searches across all projects in the organization."),
      repository: z.array(z.string()).optional().describe("The names of the repositories to search within."),
      branch: z.array(z.string()).optional().describe("The names of the repository branches to search within."),
      author: z.array(z.string()).optional().describe("The names of the commit authors to search for. Only full display names are supported."),
      commitStartDate: z.string().optional().describe("Filter commits from this date (format: 'YYYY-MM-DD' or 'YYYY-MM-DDTHH:MM:SS')"),
      commitEndDate: z.string().optional().describe("Filter commits up to this date (format: 'YYYY-MM-DD' or 'YYYY-MM-DDTHH:MM:SS')"),
      orderBy: z.enum(["ASC", "DESC"]).optional().describe("Sort commits by date: 'ASC' for oldest-first, 'DESC' for newest-first."),
      includeFacets: z.boolean().default(false).describe("Include facets in the search results"),
      skip: z.coerce.number().default(0).describe("Number of results to skip"),
      top: z.coerce.number().default(10).describe("Maximum number of results to return"),
    },
    async ({ searchText, project, repository, branch, author, commitStartDate, commitEndDate, orderBy, includeFacets, skip, top }) => {
      const accessToken = await tokenProvider();
      const url = `https://almsearch.dev.azure.com/${orgName}/_apis/search/commitSearchResults?api-version=${apiVersion}`;

      const requestBody: Record<string, unknown> = { searchText, includeFacets, $skip: skip, $top: top };

      const filters: Record<string, string[]> = {};
      if (project && project.length > 0) filters.projectName = project;
      if (repository && repository.length > 0) filters.repositoryName = repository;
      if (branch && branch.length > 0) filters.branchName = branch;
      if (author && author.length > 0) filters.authorName = author;
      if (commitStartDate) filters.commitStartDate = [commitStartDate];
      if (commitEndDate) filters.commitEndDate = [commitEndDate];

      requestBody.filters = filters;

      if (orderBy) {
        requestBody.$orderBy = [{ field: "commitDate", sortOrder: orderBy }];
      }

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`,
          "User-Agent": userAgentProvider(),
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`Azure DevOps Commit Search API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.text();
      return { content: [{ type: "text", text: result }] };
    }
  );
}

export { REPO_TOOLS, configureRepoTools };
