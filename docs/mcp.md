# MCP Setup

Connect an external AI agent to GameDev Project Manager over Streamable HTTP.

## Endpoint

```
https://<your-domain>/api/mcp
```

Local development:

```
http://localhost:3000/api/mcp
```

## Auth

Each team member logs in with Google OAuth, opens the MCP Setup page in the app, and creates a token under Your Tokens. The token is shown once. Use it as:

```
Authorization: Bearer <user-token>
```

Revoke anytime from the same page. Revoked tokens return 401 immediately.

## Connect

Any MCP client with Streamable HTTP transport works. Point it at the endpoint above and set the Authorization header.

### MCP Inspector

```bash
npx @modelcontextprotocol/inspector
```

Select Streamable HTTP transport, enter the endpoint URL and the Authorization header.

### Claude Code

```bash
claude mcp add --transport http pir-project https://<your-domain>/api/mcp \
  --header "Authorization: Bearer <user-token>"
```

### Cursor

Settings, MCP, Add custom MCP server with type `http`, URL `https://<your-domain>/api/mcp`, and the Authorization header.

### VS Code

Create `.vscode/mcp.json`:

```json
{
  "servers": {
    "pir-project": {
      "type": "http",
      "url": "https://<your-domain>/api/mcp",
      "headers": { "Authorization": "Bearer <user-token>" }
    }
  }
}
```

Then run MCP List Servers and start `pir-project`.

### Opencode

Edit `~/.config/opencode/opencode.jsonc`:

```jsonc
"pir-project": {
  "type": "remote",
  "url": "https://<your-domain>/api/mcp",
  "headers": { "Authorization": "Bearer <user-token>" }
}
```

Then open a new session.

### Generic

Any client with Streamable HTTP transport works. Point it at the endpoint and set the Authorization header.

### Curl

List tools:

```bash
curl -H "Authorization: Bearer $MCP_TOKEN" https://<your-domain>/api/mcp
```

Call a tool:

```bash
curl -X POST https://<your-domain>/api/mcp \
  -H "Authorization: Bearer $MCP_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

## Tools

| Tool | Purpose |
| ---- | ------- |
| `list_projects` | List all projects |
| `list_profiles` | List team members for assignee lookup |
| `get_project` | Get one project by ID |
| `create_project` | Create a project without Drive folder |
| `update_project` | Update project fields by ID |
| `archive_project` | Archive a project by ID |
| `list_tasks` | List tasks in a project |
| `create_task` | Create a task with optional subtasks |
| `update_task` | Update task fields by ID |
| `update_task_status` | Move a task to a new status |
| `delete_task` | Delete a task by ID |
| `create_subtask` | Add a subtask to a task |
| `update_subtask_status` | Set subtask status |
| `update_subtask_title` | Rename a subtask |
| `delete_subtask` | Delete a subtask by ID |
| `list_milestones` | List milestones in a project |
| `create_milestone` | Create a milestone in a project |
| `update_milestone` | Update milestone fields by ID |
| `delete_milestone` | Delete a milestone by ID |
| `list_assets` | List assets in a project |
| `create_asset` | Create an asset entry without file upload |
| `update_asset_status` | Set asset status |
| `delete_asset` | Delete an asset by ID |
| `list_bundles` | List asset bundles in a project |
| `list_credits` | List credits in a project |
| `create_credit` | Create a credit entry |
| `delete_credit` | Delete a credit by ID |
| `export_credits` | Export credits as markdown text |
| `list_artifacts` | List artifact links in a project |
| `create_artifact` | Create an artifact link |
| `delete_artifact` | Delete an artifact link by ID |
| `upload_asset_file` | Upload a file for an asset |
| `upload_bundle` | Upload a bundle archive to Builds |
| `upload_artifact_file` | Upload a build or GDD file and link it |

Scope is tasks, milestones, projects, assets, credits, and artifact links. File upload works through `upload_asset_file`, `upload_bundle`, and `upload_artifact_file`. Ground tool calls with `list_tasks` and `list_milestones` before resolving a title to an ID.

## Uploads

Upload tools accept files as base64 in JSON:

- Max 15MB raw per file. Larger files go through the web UI.
- The caller's user token decides the Drive identity. Connect Google Drive in the web app first, or the call fails with a clear message.
- Server secret callers cannot upload. Use a user token.
- Dual-write applies: the DB row is written first, then the Drive file, then the returned ID is stored. A Drive failure keeps the row visible with an error.

## Troubleshoot

| Status | Cause | Fix |
| ------ | ----- | --- |
| 401 | Missing or wrong token | Check the Authorization header and `MCP_SECRET` value |
| 500 Missing server config | Server env incomplete | Contact developer |
| Timeout on first call | Cold start | Retry once |

## Security

Treat every token like a password. User tokens are revocable per agent from the MCP Setup page. Only hashes are stored in the database. Never paste a real value into the repo, docs, or chat.
