import { headers } from 'next/headers'
import { PlugsConnected, Key, ListChecks, Wrench } from '@phosphor-icons/react/dist/ssr'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table'
import { GEMINI_TOOL_DECLARATIONS } from '@/lib/ai/tools'
import { CopyButton } from '@/components/mcp/copy-button'
import { TokenManager } from '@/components/mcp/token-manager'

const AUTH_HEADER = 'Authorization: Bearer <your-token>'

const TROUBLESHOOT_ROWS = [
  { status: '401', cause: 'Missing token', fix: 'Check header value' },
  { status: '500', cause: 'Server config', fix: 'Contact developer' },
  { status: '503', cause: 'Model busy', fix: 'Retry shortly' },
]

interface ClientGuide {
  name: string
  description: string
  steps: string[]
  snippetLabel: string
  snippet: (endpoint: string) => string
}

const CLIENT_GUIDES: ClientGuide[] = [
  {
    name: 'Inspector',
    description: 'Official test UI',
    steps: [
      'Run the command below',
      'Pick Streamable HTTP transport',
      'Paste endpoint and header, Connect',
    ],
    snippetLabel: 'Run',
    snippet: () => 'npx @modelcontextprotocol/inspector',
  },
  {
    name: 'Claude Code',
    description: 'CLI agent',
    steps: ['Run the command below', 'Open a new session', 'Call any tool'],
    snippetLabel: 'Command',
    snippet: (endpoint) =>
      `claude mcp add --transport http pir-project ${endpoint} --header "Authorization: Bearer <your-token>"`,
  },
  {
    name: 'Cursor',
    description: 'Editor agent',
    steps: ['Open Settings, MCP', 'Add server with snippet below', 'Enable it'],
    snippetLabel: 'Config',
    snippet: (endpoint) =>
      `{\n  "url": "${endpoint}",\n  "headers": { "Authorization": "Bearer <your-token>" }\n}`,
  },
  {
    name: 'VS Code',
    description: 'Editor agent',
    steps: ['Create .vscode/mcp.json below', 'Run MCP List Servers', 'Start pir-project'],
    snippetLabel: 'Config',
    snippet: (endpoint) =>
      `{\n  "servers": {\n    "pir-project": {\n      "type": "http",\n      "url": "${endpoint}",\n      "headers": { "Authorization": "Bearer <your-token>" }\n    }\n  }\n}`,
  },
  {
    name: 'Opencode',
    description: 'CLI agent',
    steps: ['Edit config below', 'Open a new session', 'Call any tool'],
    snippetLabel: 'Config',
    snippet: (endpoint) =>
      `"pir-project": {\n  "type": "remote",\n  "url": "${endpoint}",\n  "headers": { "Authorization": "Bearer <your-token>" }\n}`,
  },
  {
    name: 'Generic',
    description: 'Any Streamable HTTP client',
    steps: ['Point client at endpoint', 'Set header below', 'List tools'],
    snippetLabel: 'Header',
    snippet: () => 'Authorization: Bearer <your-token>',
  },
]

export default async function McpSetupPage() {
  const headerList = await headers()
  const host = headerList.get('x-forwarded-host') ?? headerList.get('host') ?? 'localhost:3000'
  const proto = headerList.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  const endpoint = `${proto}://${host}/api/mcp`
  const curlList = `curl -H "Authorization: Bearer $MCP_TOKEN" ${endpoint}`

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4 sm:p-6">
      <div className="flex items-center gap-2.5">
        <div className="flex size-8 items-center justify-center rounded-md bg-primary/15 text-primary">
          <PlugsConnected className="size-4" />
        </div>
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
            MCP Setup
          </h1>
          <p className="text-xs text-muted-foreground">Connect external agents</p>
        </div>
      </div>

      <Card className="border-primary/25 bg-gradient-to-br from-primary/10 via-primary/5 to-card">
        <CardHeader>
          <CardTitle>Endpoint</CardTitle>
          <CardDescription>Streamable HTTP transport</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <code className="rounded-none border border-border bg-muted px-2.5 py-1.5 font-mono text-xs break-all text-foreground">
            {endpoint}
          </code>
          <div className="flex items-center gap-2">
            <CopyButton text={endpoint} />
            <Badge variant="secondary">POST</Badge>
            <Badge variant="secondary">GET</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Key className="size-4 text-amber-400" />
            <CardTitle>Auth</CardTitle>
          </div>
          <CardDescription>Bearer token required</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-xs text-muted-foreground">
          <p>Create a token in Your Tokens below. Send it as header.</p>
          <code className="rounded-none border border-border bg-muted px-2.5 py-1.5 font-mono text-xs text-foreground">
            {AUTH_HEADER}
          </code>
          <div className="flex items-center gap-2">
            <CopyButton text={AUTH_HEADER} />
          </div>
        </CardContent>
      </Card>

      <TokenManager />

      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Wrench className="size-4 text-primary" />
          <h2 className="font-heading text-sm font-semibold text-foreground">Connect</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {CLIENT_GUIDES.map((client) => {
            const snippet = client.snippet(endpoint)
            return (
              <Card key={client.name}>
                <CardHeader>
                  <CardTitle>{client.name}</CardTitle>
                  <CardDescription>{client.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  <ol className="flex list-decimal flex-col gap-1 pl-4 text-xs text-muted-foreground">
                    {client.steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                  <p className="text-[11px] font-medium text-foreground uppercase tracking-wider">
                    {client.snippetLabel}
                  </p>
                  <code className="rounded-none border border-border bg-muted px-2.5 py-1.5 font-mono text-xs break-all whitespace-pre-wrap text-foreground">
                    {snippet}
                  </code>
                  <div className="flex items-center gap-2">
                    <CopyButton text={snippet} />
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Wrench className="size-4 text-primary" />
            <CardTitle>Verify</CardTitle>
          </div>
          <CardDescription>Check with curl</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <code className="rounded-none border border-border bg-muted px-2.5 py-1.5 font-mono text-xs break-all text-foreground">
            {curlList}
          </code>
          <div className="flex items-center gap-2">
            <CopyButton text={curlList} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ListChecks className="size-4 text-emerald-400" />
            <CardTitle>Tools</CardTitle>
          </div>
          <CardDescription>Tasks and milestones only</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Purpose</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {GEMINI_TOOL_DECLARATIONS.map((tool) => (
                <TableRow key={tool.name}>
                  <TableCell className="font-mono text-xs text-foreground">{tool.name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {tool.description}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Troubleshoot</CardTitle>
          <CardDescription>Common status codes</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Cause</TableHead>
                <TableHead>Fix</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {TROUBLESHOOT_ROWS.map((row) => (
                <TableRow key={row.status}>
                  <TableCell>
                    <Badge variant={row.status === '503' ? 'destructive' : 'secondary'}>
                      {row.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-foreground">{row.cause}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{row.fix}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
