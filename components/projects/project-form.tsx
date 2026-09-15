'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createProject } from '@/actions/projects'
import { slugify } from '@/lib/slug'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { ArrowClockwise } from '@phosphor-icons/react'

export function ProjectForm() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [isSlugTouched, setIsSlugTouched] = useState(false)
  const [type, setType] = useState<'jam' | 'competition' | 'internal'>('jam')
  const [startDate, setStartDate] = useState('')
  const [deadline, setDeadline] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [driveWarning, setDriveWarning] = useState<string | null>(null)

  const handleNameChange = (val: string) => {
    setName(val)
    if (!isSlugTouched) {
      setSlug(slugify(val))
    }
  }

  const handleSlugChange = (val: string) => {
    setIsSlugTouched(true)
    setSlug(val.toLowerCase().replace(/[^a-z0-9-]/g, ''))
  }

  const handleResetSlug = () => {
    setIsSlugTouched(false)
    setSlug(slugify(name))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Project name is required')
      return
    }

    const cleanSlug = (slug.trim() || slugify(name)).replace(/^-+|-+$/g, '')
    if (!cleanSlug) {
      setError('A valid project slug is required')
      return
    }

    if (cleanSlug === 'new') {
      setError('Slug cannot be "new"')
      return
    }

    setLoading(true)
    setError(null)
    setDriveWarning(null)

    const res = await createProject({
      name: name.trim(),
      slug: cleanSlug,
      type,
      start_date: startDate || null,
      deadline: deadline || null,
      description: description.trim() || null,
    })

    setLoading(false)

    if (res.error) {
      setError(res.error)
      return
    }

    if (res.driveError) {
      setDriveWarning('Project created, but Drive folder setup was skipped or failed. You can retry anytime.')
    }

    if (res.project?.slug) {
      router.push(`/projects/${res.project.slug}`)
    } else if (res.project?.id) {
      router.push(`/projects/${res.project.id}`)
    } else {
      router.push('/projects')
    }
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle className="text-lg">New Project</CardTitle>
        <CardDescription>Enter project details to start tracking tasks and assets.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {driveWarning && (
            <Alert>
              <AlertDescription>{driveWarning}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="name" className="text-xs font-medium text-foreground">
              Name
            </label>
            <Input
              id="name"
              placeholder="Game Title"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="slug" className="text-xs font-medium text-foreground">
                Slug
              </label>
              {isSlugTouched && (
                <button
                  type="button"
                  onClick={handleResetSlug}
                  className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowClockwise className="size-3" />
                  Auto-generate
                </button>
              )}
            </div>
            <Input
              id="slug"
              placeholder="game-title"
              value={slug}
              onChange={(e) => handleSlugChange(e.target.value)}
              disabled={loading}
              required
            />
            <p className="text-[11px] text-muted-foreground">
              URL preview:{' '}
              <span className="font-mono text-foreground">
                /projects/{slug || 'project-slug'}
              </span>
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-foreground">
                Type
              </label>
              <Select
                value={type}
                onValueChange={(val) => {
                  if (val === 'jam' || val === 'competition' || val === 'internal') {
                    setType(val)
                  }
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="jam">Jam</SelectItem>
                  <SelectItem value="competition">Competition</SelectItem>
                  <SelectItem value="internal">Internal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="start_date" className="text-xs font-medium text-foreground">
                Start Date
              </label>
              <Input
                id="start_date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="deadline" className="text-xs font-medium text-foreground">
                Deadline
              </label>
              <Input
                id="deadline"
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="description" className="text-xs font-medium text-foreground">
              Description
            </label>
            <Textarea
              id="description"
              placeholder="Brief summary of the game concept or jam theme"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Project'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
