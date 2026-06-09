'use client'
import Link from 'next/link'
import { useMatches, useDeleteMatch } from '@/hooks/useMatches'
import { Button, buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MatchStatus } from '@/types/api'

const STATUS_LABELS: Record<MatchStatus, string> = {
  SCHEDULED: 'Programado',
  IN_PROGRESS: 'En juego',
  FINISHED: 'Finalizado',
}

export default function AdminMatchesPage() {
  const { data: matches = [], isLoading } = useMatches()
  const { mutate: deleteMatch } = useDeleteMatch()

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Partidos</h1>
        <Link href="/admin/matches/new" className={cn(buttonVariants(), 'font-bold text-black')}>
          <Plus className="mr-2 h-4 w-4" /> Nuevo partido
        </Link>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      )}

      <div className="space-y-2">
        {matches.map((match) => (
          <div
            key={match.id}
            className="flex items-center justify-between rounded-lg border border-border bg-card p-3"
          >
            <div>
              <p className="font-semibold">
                {match.homeTeam} vs {match.awayTeam}
                {match.homeScore !== null && match.awayScore !== null && (
                  <span className="ml-2 text-primary">
                    ({match.homeScore}-{match.awayScore})
                  </span>
                )}
              </p>
              <div className="flex gap-2 mt-1">
                <Badge variant="outline" className="text-xs">{match.stage}</Badge>
                <Badge variant="secondary" className="text-xs">
                  {STATUS_LABELS[match.status]}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {new Date(match.matchDatetime).toLocaleDateString('es')}
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <Link
                href={`/admin/matches/${match.id}/edit`}
                className={buttonVariants({ size: 'sm', variant: 'outline' })}
              >
                <Pencil className="h-3 w-3" />
              </Link>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => deleteMatch(match.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
