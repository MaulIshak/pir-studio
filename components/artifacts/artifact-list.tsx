'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  FigmaLogo,
  FileText,
  GameController,
  Globe,
  ArrowSquareOut,
  Trash,
  Link as LinkIcon,
} from '@phosphor-icons/react'
import { ArtifactLink, deleteArtifactLink } from '@/actions/artifacts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { EmptyState } from '@/components/projects/empty-state'
import { CreateArtifactDialog } from './create-artifact-dialog'

interface ArtifactListProps {
  artifacts: ArtifactLink[]
  projectId: string
}

function getArtifactDetails(type: ArtifactLink['type']) {
  switch (type) {
    case 'figma':
      return {
        icon: <FigmaLogo className="size-5 text-purple-400" />,
        badgeBg: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
        cardBg: 'hover:border-purple-500/30 bg-gradient-to-br from-card to-purple-500/[0.03]',
      }
    case 'figjam':
      return {
        icon: <FigmaLogo className="size-5 text-rose-400" />,
        badgeBg: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
        cardBg: 'hover:border-rose-500/30 bg-gradient-to-br from-card to-rose-500/[0.03]',
      }
    case 'gdd':
      return {
        icon: <FileText className="size-5 text-blue-400" />,
        badgeBg: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
        cardBg: 'hover:border-blue-500/30 bg-gradient-to-br from-card to-blue-500/[0.03]',
      }
    case 'build':
      return {
        icon: <GameController className="size-5 text-emerald-400" />,
        badgeBg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        cardBg: 'hover:border-emerald-500/30 bg-gradient-to-br from-card to-emerald-500/[0.03]',
      }
    default:
      return {
        icon: <Globe className="size-5 text-amber-400" />,
        badgeBg: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
        cardBg: 'hover:border-primary/30 bg-card',
      }
  }
}

const CATEGORIES: Array<{ key: ArtifactLink['type']; label: string }> = [
  { key: 'figma', label: 'Figma' },
  { key: 'figjam', label: 'FigJam' },
  { key: 'gdd', label: 'GDD' },
  { key: 'build', label: 'Builds' },
  { key: 'other', label: 'Other Links' },
]

export function ArtifactList({ artifacts, projectId }: ArtifactListProps) {
  const [, startTransition] = useTransition()
  const router = useRouter()

  function handleDelete(linkId: string) {
    if (!confirm('Are you sure you want to remove this artifact link?')) return
    startTransition(async () => {
      await deleteArtifactLink(linkId, projectId)
      router.refresh()
    })
  }

  if (artifacts.length === 0) {
    return (
      <EmptyState
        title="No artifacts linked"
        description="Connect design files, game design documents, or playable builds."
        icon={<LinkIcon className="size-7" />}
        action={<CreateArtifactDialog projectId={projectId} />}
      />
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {CATEGORIES.map((cat) => {
        const categoryArtifacts = artifacts.filter((a) => a.type === cat.key)
        if (categoryArtifacts.length === 0) return null

        return (
          <div key={cat.key} className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <h3 className="font-heading text-xs font-semibold tracking-wider uppercase text-muted-foreground">
                {cat.label}
              </h3>
              <Badge variant="secondary" className="text-xs font-mono">
                {categoryArtifacts.length}
              </Badge>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
              {categoryArtifacts.map((artifact) => {
                const details = getArtifactDetails(artifact.type)

                return (
                  <motion.div
                    key={artifact.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileHover={{ y: -3, transition: { duration: 0.18 } }}
                    transition={{ duration: 0.2 }}
                  >
                    <Card className={`flex h-full flex-col justify-between transition-all duration-200 ${details.cardBg}`}>
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <div className="flex size-9 items-center justify-center rounded-lg bg-card/80 border shadow-xs">
                              {details.icon}
                            </div>
                            <CardTitle className="font-heading text-base font-semibold leading-tight line-clamp-1">
                              {artifact.label}
                            </CardTitle>
                          </div>
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => handleDelete(artifact.id)}
                            className="text-muted-foreground hover:text-destructive shrink-0 size-7 p-0"
                          >
                            <Trash className="size-3.5" />
                          </Button>
                        </div>

                        {artifact.notes && (
                          <CardDescription className="text-xs line-clamp-2 pt-1.5">
                            {artifact.notes}
                          </CardDescription>
                        )}
                      </CardHeader>

                      <CardContent className="pt-0">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full text-xs"
                          nativeButton={false}
                          render={
                            <a
                              href={artifact.url}
                              target="_blank"
                              rel="noopener noreferrer"
                            />
                          }
                        >
                          <ArrowSquareOut className="size-3.5 text-primary" />
                          Open Resource
                        </Button>
                      </CardContent>
                    </Card>
                  </motion.div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
