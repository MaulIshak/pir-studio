'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowSquareOut, Trash, Certificate } from '@phosphor-icons/react'
import { Credit, deleteCredit } from '@/actions/credits'
import { Asset } from '@/actions/assets'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { EmptyState } from '@/components/projects/empty-state'
import { CreateCreditDialog } from './create-credit-dialog'

interface CreditTableProps {
  credits: Credit[]
  projectId: string
  assets?: Asset[]
}

function getLicenseStyle(license: Credit['license']) {
  switch (license) {
    case 'cc0':
      return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
    case 'cc_by':
      return 'bg-blue-500/10 text-blue-400 border-blue-500/20'
    case 'royalty_free':
      return 'bg-purple-500/10 text-purple-400 border-purple-500/20'
    case 'proprietary':
      return 'bg-amber-500/10 text-amber-500 border-amber-500/20'
    default:
      return 'bg-secondary text-muted-foreground'
  }
}

export function CreditTable({ credits, projectId, assets = [] }: CreditTableProps) {
  const [licenseFilter, setLicenseFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [, startTransition] = useTransition()
  const router = useRouter()

  const filteredCredits = credits.filter((credit) => {
    if (licenseFilter !== 'all' && credit.license !== licenseFilter) return false
    if (
      searchQuery.trim() &&
      !credit.source_name.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !credit.author?.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !credit.notes?.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false
    }
    return true
  })

  function handleDelete(creditId: string) {
    if (!confirm('Are you sure you want to remove this credit attribution?')) return
    startTransition(async () => {
      await deleteCredit(creditId, projectId)
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Search and License Filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2 max-w-sm">
          <Input
            placeholder="Search credits..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <Select value={licenseFilter} onValueChange={(val) => val && setLicenseFilter(val)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Licenses</SelectItem>
            <SelectItem value="cc0">CC0 Public Domain</SelectItem>
            <SelectItem value="cc_by">CC-BY</SelectItem>
            <SelectItem value="royalty_free">Royalty-Free</SelectItem>
            <SelectItem value="proprietary">Proprietary</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filteredCredits.length === 0 ? (
        <EmptyState
          title={credits.length === 0 ? 'No credits recorded' : 'No matching credits'}
          description={
            credits.length === 0
              ? 'No external attributions or licenses recorded yet. Add credits for sound, music, and art.'
              : 'No credits match your filter criteria.'
          }
          icon={<Certificate className="size-7" />}
          action={credits.length === 0 ? <CreateCreditDialog projectId={projectId} assets={assets} /> : undefined}
        />
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="rounded-md border bg-card/60 overflow-hidden"
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Source Name</TableHead>
                <TableHead>Author</TableHead>
                <TableHead>License</TableHead>
                <TableHead>Associated Asset</TableHead>
                <TableHead>Source Link</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCredits.map((credit) => (
                <TableRow key={credit.id} className="hover:bg-muted/40 transition-colors">
                  <TableCell className="font-medium">
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground">{credit.source_name}</span>
                      {credit.notes && (
                        <span className="text-xs text-muted-foreground line-clamp-1">
                          {credit.notes}
                        </span>
                      )}
                    </div>
                  </TableCell>

                  <TableCell className="text-sm text-muted-foreground">
                    {credit.author || '-'}
                  </TableCell>

                  <TableCell>
                    <Badge variant="outline" className={`uppercase text-xs font-mono font-medium ${getLicenseStyle(credit.license)}`}>
                      {credit.license.replace('_', '-')}
                    </Badge>
                  </TableCell>

                  <TableCell className="text-sm">
                    {credit.assets ? (
                      <span className="font-medium text-foreground">
                        {credit.assets.name}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs">General</span>
                    )}
                  </TableCell>

                  <TableCell>
                    {credit.source_url ? (
                      <Button
                        variant="ghost"
                        size="xs"
                        nativeButton={false}
                        render={
                          <a
                            href={credit.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                          />
                        }
                        className="text-primary hover:text-primary"
                      >
                        <ArrowSquareOut className="size-3.5" />
                        Source
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </TableCell>

                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => handleDelete(credit.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash className="size-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </motion.div>
      )}
    </div>
  )
}
