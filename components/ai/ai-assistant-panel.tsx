'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { PaperPlaneTilt, Sparkle, X } from '@phosphor-icons/react'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { chatWithAssistant, getProjectsForAssistant } from '@/actions/ai'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface ProjectOption {
  id: string
  name: string
  slug: string
}

const LINK_PATTERN = /((?:https?:\/\/\S+)|(?:\/projects\/[\w\-/]+))/g

function renderMessageContent(content: string) {
  const parts = content.split(LINK_PATTERN)
  if (parts.length === 1) return content
  return parts.map((part, i) => {
    if (part.startsWith('/projects/')) {
      return (
        <Link key={i} href={part} className="font-medium text-primary underline underline-offset-2">
          {part}
        </Link>
      )
    }
    if (/^https?:\/\//.test(part)) {
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-primary underline underline-offset-2"
        >
          {part}
        </a>
      )
    }
    return <span key={i}>{part}</span>
  })
}

export function AiAssistantPanel({ onClose }: { onClose: () => void }) {
  const params = useParams()
  const slug = typeof params?.slug === 'string' ? params.slug : null

  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [loadingProjects, setLoadingProjects] = useState(!slug)
  const [error, setError] = useState<string | null>(null)
  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [projectId, setProjectId] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (slug) return
    let active = true
    getProjectsForAssistant()
      .then((list) => {
        if (!active) return
        setProjects(list as ProjectOption[])
        setProjectId((prev) => prev ?? (list[0]?.id as string | undefined) ?? null)
      })
      .catch(() => {
        if (active) setError('Unable to load projects.')
      })
      .finally(() => {
        if (active) setLoadingProjects(false)
      })
    return () => {
      active = false
    }
  }, [slug])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, sending])

  const send = useCallback(
    async (retryText?: string) => {
      const text = (retryText ?? draft).trim()
      if (!text || sending) return
      setError(null)
      const nextMessages: Message[] = [...messages, { role: 'user', content: text }]
      setMessages(nextMessages)
      setDraft('')
      setSending(true)
      const history = nextMessages.slice(-10).map((m) => ({ role: m.role, content: m.content }))
      const result = await chatWithAssistant({
        projectSlug: slug ?? undefined,
        projectId: slug ? undefined : (projectId ?? undefined),
        message: text,
        history: history.slice(0, -1),
      })
      setSending(false)
      if ('error' in result && result.error) {
        setError(result.error as string)
        return
      }
      if ('reply' in result && typeof result.reply === 'string') {
        setMessages([...nextMessages, { role: 'assistant', content: result.reply }])
      }
    },
    [draft, sending, messages, slug, projectId]
  )

  const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user')?.content

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.2 }}
      className="fixed right-4 bottom-16 z-50 w-[min(360px,calc(100vw-2rem))]"
    >
      <Card className="border-primary/20 bg-card shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between gap-2 border-b py-2.5">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-md bg-primary/15 text-primary">
              <Sparkle className="size-4" />
            </div>
            <CardTitle>Assistant</CardTitle>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close">
            <X className="size-4" />
          </Button>
        </CardHeader>

        <CardContent className="flex flex-col gap-2 px-3 py-2.5">
          {!slug && (
            <div className="flex items-center gap-2">
              {loadingProjects ? (
                <Skeleton className="h-8 w-full" />
              ) : (
                <Select value={projectId ?? ''} onValueChange={(v) => setProjectId(v)}>
                  <SelectTrigger className="h-8 w-full text-xs">
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          <ScrollArea className="h-[300px] pr-2">
            {sending && messages.length === 0 ? (
              <div className="flex flex-col gap-2">
                <Skeleton className="h-10 w-3/4" />
                <Skeleton className="h-10 w-2/3 self-end" />
                <Skeleton className="h-14 w-full" />
              </div>
            ) : messages.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center gap-2 py-6 text-center">
                  <div className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Sparkle className="size-4" />
                  </div>
                  <p className="text-xs font-medium text-foreground">No messages</p>
                  <p className="text-xs text-muted-foreground">Ask to create tasks</p>
                </CardContent>
              </Card>
            ) : (
              <div className="flex flex-col gap-2">
                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={
                      m.role === 'user'
                        ? 'self-end rounded-none bg-primary px-2.5 py-1.5 text-xs text-primary-foreground'
                        : 'self-start rounded-none border border-border bg-muted px-2.5 py-1.5 text-xs break-words text-foreground'
                    }
                  >
                    {renderMessageContent(m.content)}
                  </div>
                ))}
                {sending && (
                  <div className="flex flex-col gap-1.5">
                    <Skeleton className="h-8 w-2/3" />
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
            )}
          </ScrollArea>

          {error && (
            <Alert variant="destructive">
              <AlertTitle>Failed</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
              <div className="mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => lastUserMessage && send(lastUserMessage)}
                >
                  Retry
                </Button>
              </div>
            </Alert>
          )}
        </CardContent>

        <CardFooter className="gap-2 border-t pt-2.5">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
            placeholder="Ask assistant"
            aria-label="Message"
          />
          <Button onClick={() => send()} disabled={sending || !draft.trim()} aria-label="Send">
            <PaperPlaneTilt className="size-4" />
            Send
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  )
}
