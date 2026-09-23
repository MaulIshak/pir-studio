'use client'

import { useCallback, useEffect, useState } from 'react'
import { Key, Plus } from '@phosphor-icons/react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { listMyMcpTokens, createMcpToken, revokeMcpToken, type McpTokenItem } from '@/actions/mcp-tokens'
import { CopyButton } from '@/components/mcp/copy-button'

export function TokenManager() {
  const [tokens, setTokens] = useState<McpTokenItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [plainToken, setPlainToken] = useState<string | null>(null)
  const [revokeId, setRevokeId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      setTokens(await listMyMcpTokens())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load tokens.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    listMyMcpTokens()
      .then((items) => setTokens(items))
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Unable to load tokens.')
      )
      .finally(() => setLoading(false))
  }, [])

  const handleCreate = async () => {
    if (!name.trim() || saving) return
    setSaving(true)
    const result = await createMcpToken({ name: name.trim() })
    setSaving(false)
    if ('error' in result && result.error) {
      setError(result.error as string)
      return
    }
    if ('token' in result && typeof result.token === 'string') {
      setPlainToken(result.token)
      setName('')
      setDialogOpen(false)
      load()
    }
  }

  const handleRevoke = async () => {
    if (!revokeId) return
    const result = await revokeMcpToken(revokeId)
    setRevokeId(null)
    if ('error' in result && result.error) {
      setError(result.error as string)
      return
    }
    load()
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Key className="size-4 text-amber-400" />
            <CardTitle>Your Tokens</CardTitle>
          </div>
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="size-3.5" />
            New Token
          </Button>
        </div>
        <CardDescription>One per agent</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {plainToken && (
          <Alert>
            <AlertTitle>Save now</AlertTitle>
            <AlertDescription>Shown once only</AlertDescription>
            <code className="mt-1 block rounded-none border border-border bg-muted px-2.5 py-1.5 font-mono text-xs break-all text-foreground">
              {plainToken}
            </code>
            <div className="mt-2 flex items-center gap-2">
              <CopyButton text={plainToken} />
              <Button variant="ghost" size="sm" onClick={() => setPlainToken(null)}>
                Dismiss
              </Button>
            </div>
          </Alert>
        )}

        {loading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : tokens.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-2 py-6 text-center">
              <div className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Key className="size-4" />
              </div>
              <p className="text-xs font-medium text-foreground">No tokens</p>
              <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)}>
                <Plus className="size-3.5" />
                New Token
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            {tokens.map((token) => (
              <div
                key={token.id}
                className="flex items-center justify-between gap-2 rounded-none border border-border px-2.5 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-foreground">{token.name}</p>
                  <p className="font-mono text-[10px] text-muted-foreground">
                    {token.last_used_at
                      ? `Used ${new Date(token.last_used_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                      : 'Never used'}
                  </p>
                </div>
                <Button variant="destructive" size="sm" onClick={() => setRevokeId(token.id)}>
                  Revoke
                </Button>
              </div>
            ))}
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertTitle>Failed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
            <div className="mt-2">
              <Button variant="outline" size="sm" onClick={load}>
                Retry
              </Button>
            </div>
          </Alert>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">New Token</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 pt-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-foreground">Name</label>
              <Input
                placeholder="e.g. Laptop Agent"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={saving}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleCreate()
                  }
                }}
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDialogOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button size="sm" onClick={handleCreate} disabled={saving || !name.trim()}>
                {saving ? 'Creating...' : 'Create'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={revokeId !== null}
        onOpenChange={(open) => {
          if (!open) setRevokeId(null)
        }}
        title="Revoke Token"
        description="Agents using this token lose access immediately."
        confirmLabel="Revoke"
        onConfirm={handleRevoke}
      />
    </Card>
  )
}
