# Examples

Use these example prompts to get started with Azure DevOps MCP Safe. Replace names such as `Contoso` and IDs such as `1234` with values from your organization.

> [!NOTE]
> These examples have been tested only in English. If you have problems using another language, [open an issue](https://github.com/t0nyba11/azure-devops-mcp-safe/issues).

- [Get List of Projects](#get-list-of-projects)
- [Get List of Teams](#get-list-of-teams)
- [Get My Work Items](#get-my-work-items)
- [Get Work Items in a Backlog](#get-all-work-items-in-a-backlog)
- [Inspect a Work Item](#inspect-a-work-item)
- [Review Test Plans and Results](#review-test-plans-and-results)
- [Inspect Pull Requests](#inspect-pull-requests)
- [Read Wiki Pages](#read-wiki-pages)

## Projects and Teams

### Get List of Projects

**Tool:** `core_list_projects`

```text
List my Azure DevOps projects.
```

### Get List of Teams

**Tool:** `core_list_project_teams`

```text
List teams for the Contoso project.
```

## Work Items

### Get My Work Items

**Tools:** `wit_work_item` with `my`, followed by `get_batch` for details

```text
List my work items in the Contoso project.
```

The `my` action returns work item references. Pass those IDs to `get_batch` to retrieve their fields.

### Get All Work Items in a Backlog

**Tools:** `wit_backlog` with `list` and `list_work_items`, followed by `wit_work_item` with `get_batch`

```text
List backlog levels for the Contoso project and Fabrikam team, then show the work items in the Features backlog.
```

The server can list backlog contents but cannot reorder them.

### Inspect a Work Item

**Tool:** `wit_work_item`

```text
Open work item 1234 in the Contoso project, including its relations and comments, and summarize its current state.
```

Attachments can be retrieved with `wit_work_item_attachment` and may be saved to a local relative path.

## Test Plans

### Review Test Plans and Results

**Tools:** `testplan`, `testplan_show_test_results_from_build_id`

```text
List the test plans in the Contoso project and show failed test results for build 5678.
```

## Repositories

### Inspect Pull Requests

**Tools:** `repo_pull_request`, `repo_pull_request_thread`

```text
List active pull requests in the Fabrikam repository, then summarize the unresolved review threads on pull request 42.
```

The server cannot create, update, approve, vote on, or merge pull requests.

## Wiki

### Read Wiki Pages

**Tool:** `wiki`

```text
Get the content of the page '/Architecture/Overview' from the Fabrikam wiki in the Contoso project.
```

Wiki pages can be listed and read but cannot be created or updated.
