# Toolset

This page lists all tools provided by Azure DevOps MCP Safe. Use it to understand what each read-only tool does and how tools are organized by functional area.

The server exposes Azure DevOps read operations only. Attachment and artifact downloads may save files on the local machine when a destination path is provided.

### Core

| Tool                      | Description                            |
| ------------------------- | -------------------------------------- |
| `core_list_projects`      | List all projects in the organization  |
| `core_list_project_teams` | List teams within a project            |
| `core_get_identity_ids`   | Retrieve identity IDs by search filter |

### Work

| Tool   | Action                     | Description                                                                             |
| ------ | -------------------------- | --------------------------------------------------------------------------------------- |
| `work` | `list_iterations`          | List all iterations in a project                                                        |
| `work` | `list_team_iterations`     | List iterations assigned to a team                                                      |
| `work` | `get_team_settings`        | Get team settings including default iteration, backlog iteration, and default area path |
| `work` | `get_team_capacity`        | Get team capacity for an iteration                                                      |
| `work` | `get_iteration_capacities` | Get an iteration's capacity for all teams in the iteration and project                  |

### Work Items

| Tool                       | Action               | Description                                                       |
| -------------------------- | -------------------- | ----------------------------------------------------------------- |
| `wit_work_item`            | `get`                | Get a single work item by ID                                      |
| `wit_work_item`            | `get_batch`          | Retrieve multiple work items by IDs                               |
| `wit_work_item`            | `list_comments`      | List comments on a work item                                      |
| `wit_work_item`            | `my`                 | List work items relevant to the authenticated user                |
| `wit_work_item`            | `list_revisions`     | Get revision history of a work item                               |
| `wit_work_item`            | `list_for_iteration` | Get work items in a specific team iteration                       |
| `wit_work_item`            | `get_type`           | Get metadata for a work item type                                 |
| `wit_query`                | `get`                | Get a work item query by ID or path                               |
| `wit_query`                | `get_results`        | Execute a saved query and return results                          |
| `wit_query`                | `wiql`               | Execute an ad-hoc WIQL query                                      |
| `wit_backlog`              | `list`               | List backlog levels for a team                                    |
| `wit_backlog`              | `list_work_items`    | Get work items in a specific backlog level                        |
| `wit_work_item_attachment` |                      | Download a work item attachment; save locally or return as base64 |

### Repositories

| Tool                       | Action            | Description                                                         |
| -------------------------- | ----------------- | ------------------------------------------------------------------- |
| `repo_repository`          | `get`             | Get a repository by name or ID                                      |
| `repo_repository`          | `list`            | List repositories in a project                                      |
| `repo_pull_request`        | `get`             | Get a pull request by ID                                            |
| `repo_pull_request`        | `list`            | List pull requests in a repository or project                       |
| `repo_pull_request`        | `list_by_commits` | Find pull requests that contain specific commit IDs                 |
| `repo_pull_request_thread` | `list`            | List comment threads on a pull request                              |
| `repo_pull_request_thread` | `list_comments`   | List comments in a specific thread                                  |
| `repo_branch`              | `get`             | Get a branch by name                                                |
| `repo_branch`              | `list`            | List branches in a repository                                       |
| `repo_branch`              | `list_mine`       | List branches the current user has pushed to                        |
| `repo_file`                | `get_content`     | Get the text content of a file at a specific branch, tag, or commit |
| `repo_file`                | `list_directory`  | List files and folders in a directory                               |
| `repo_search_commits`      |                   | Search commits with filtering by text, author, date range, and more |

### Pipelines

| Tool                   | Action           | Description                                         |
| ---------------------- | ---------------- | --------------------------------------------------- |
| `pipelines_build`      | `list`           | List builds with optional filters                   |
| `pipelines_build`      | `get_status`     | Get status, issues, and report metadata for a build |
| `pipelines_build`      | `get_changes`    | Get commits and work items associated with a build  |
| `pipelines_build_log`  | `list`           | List available logs for a build                     |
| `pipelines_build_log`  | `get_content`    | Get the text content of a specific log by ID        |
| `pipelines_definition` | `list`           | List pipeline definitions with optional filters     |
| `pipelines_definition` | `list_revisions` | List revision history for a pipeline definition     |
| `pipelines_run`        | `get`            | Get a single pipeline run                           |
| `pipelines_run`        | `list`           | List runs for a pipeline                            |
| `pipelines_artifact`   | `list`           | List artifacts for a build                          |
| `pipelines_artifact`   | `download`       | Download a named build artifact                     |

### Test Plans

| Tool                                       | Action        | Description                           |
| ------------------------------------------ | ------------- | ------------------------------------- |
| `testplan`                                 | `list_plans`  | List test plans in a project          |
| `testplan`                                 | `list_suites` | List test suites under a test plan    |
| `testplan`                                 | `list_cases`  | List test cases under a test suite    |
| `testplan_show_test_results_from_build_id` |               | Get test results for a specific build |

### Wiki

| Tool   | Action             | Description                                  |
| ------ | ------------------ | -------------------------------------------- |
| `wiki` | `list_wikis`       | List all wikis in an organization or project |
| `wiki` | `get_wiki`         | Get details of a specific wiki               |
| `wiki` | `list_pages`       | List pages in a wiki                         |
| `wiki` | `get_page`         | Get wiki page metadata without content       |
| `wiki` | `get_page_content` | Retrieve wiki page content                   |

### Search

| Tool              | Description                           |
| ----------------- | ------------------------------------- |
| `search_code`     | Search for code across repositories   |
| `search_wiki`     | Search wiki pages by keywords         |
| `search_workitem` | Search work items by text and filters |

### Advanced Security

| Tool                       | Description                                              |
| -------------------------- | -------------------------------------------------------- |
| `advsec_get_alerts`        | Retrieve Advanced Security alerts for a repository       |
| `advsec_get_alert_details` | Get detailed information about a specific security alert |

### MCP Apps Diagnostic

The `mcp-apps` domain is excluded from the default `all` selection and must be enabled explicitly with `-d mcp-apps`.

| Tool            | Description                                  |
| --------------- | -------------------------------------------- |
| `mcp_apps_ping` | Verify that the `mcp-apps` domain is enabled |
