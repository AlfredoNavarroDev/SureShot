'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useMatches, useDeleteMatch } from '@/hooks/useMatches'
import { Button, buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MatchStatus, MatchStage } from '@/types/api'

const STATUS_LABELS: Record<MatchStatus, string> = {
  SCHEDULED: 'Programado',
  IN_PROGRESS: 'En juego',
  FINISHED: 'Finalizado',
}

const STATUS_VARIANTS: Record<MatchStatus, 'default' | 'secondary' | 'outline'> = {
  SCHEDULED: 'outline',
  IN_PROGRESS: 'default',
  FINISHED: 'secondary',
}

const STAGE_LABELS: Record<MatchStage, string> = {
  GROUP: 'Grupos',
  ROUND_OF_16: 'Octavos',
  QUARTER_FINAL: 'Cuartos',
  SEMI_FINAL: 'Semis',
  FINAL: 'Final',
}

const STATUS_FILTERS: Array<{ label: string; value: MatchStatus | 'ALL' }> = [
  { label: 'Todos',       value: 'ALL' },
  { label: 'Programados', value: 'SCHEDULED' },
  { label: 'En juego',    value: 'IN_PROGRESS' },
  { label: 'Finalizados', value: 'FINISHED' },
]

const STAGE_FILTERS: Array<{ label: string; value: MatchStage | 'ALL' }> = [
  { label: 'Todas las fases', value: 'ALL' },
  { label: 'Grupos',          value: 'GROUP' },
  { label: 'Octavos',         value: 'ROUND_OF_16' },
  { label: 'Cuartos',         value: 'QUARTER_FINAL' },
  { label: 'Semis',           value: 'SEMI_FINAL' },
  { label: 'Final',           value: 'FINAL' },
]

const STATUS_ORDER: Record<MatchStatus, number> = {
  IN_PROGRESS: 0,
  FINISHED: 1,
  SCHEDULED: 2,
}

const STAGE_ORDER: Record<MatchStage, number> = {
  FINAL: 0,
  SEMI_FINAL: 1,
  QUARTER_FINAL: 2,
  ROUND_OF_16: 3,
  GROUP: 4,
}

export default function AdminMatchesPage() {
  const [statusFilter, setStatusFilter] = useState<MatchStatus | 'ALL'>('ALL')
  const [stageFilter,  setStageFilter]  = useState<MatchStage  | 'ALL'>('ALL')

  const { data: matches = [], isLoading } = useMatches({
    status: statusFilter === 'ALL' ? undefined : statusFilter,
    stage:  stageFilter  === 'ALL' ? undefined : stageFilter,
  })
  const { mutate: deleteMatch } = useDeleteMatch()

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Partidos</h1>
        <Link href="/admin/matches/new" className={cn(buttonVariants(), 'font-bold text-black')}>
          <Plus className="mr-2 h-4 w-4" /> Nuevo partido
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <Button
            key={f.value}
            size="sm"
            variant={statusFilter === f.value ? 'default' : 'outline'}
            className={cn(statusFilter === f.value && 'text-black font-bold')}
            onClick={() => setStatusFilter(f.value)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {STAGE_FILTERS.map((f) => (
          <Button
            key={f.value}
            size="sm"
            variant={stageFilter === f.value ? 'secondary' : 'ghost'}
            onClick={() => setStageFilter(f.value)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      )}

      {!isLoading && matches.length === 0 && (
        <p className="text-sm text-muted-foreground">No hay partidos con estos filtros.</p>
      )}

      <div className="space-y-2">
        {[...matches]
          .sort((a, b) => {
            const statusDiff = STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
            if (statusDiff !== 0) return statusDiff
            return STAGE_ORDER[a.stage] - STAGE_ORDER[b.stage]
          })
          .map((match) => (
          <div
            key={match.id}
            className="flex items-center justify-between rounded-lg border border-border bg-card p-4"
          >
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-3">
                <span className="font-semibold">{match.homeTeam}</span>
                {match.homeScore !== null && match.awayScore !== null ? (
                  <span className="rounded bg-primary/20 px-2 py-0.5 font-black text-primary">
                    {match.homeScore} - {match.awayScore}
                  </span>
                ) : (
                  <span className="text-muted-foreground">vs</span>
                )}
                <span className="font-semibold">{match.awayTeam}</span>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline" className="text-xs">
                  {STAGE_LABELS[match.stage]}
                  {match.group ? ` · Grupo ${match.group}` : ''}
                </Badge>
                <Badge variant={STATUS_VARIANTS[match.status]} className="text-xs">
                  {STATUS_LABELS[match.status]}
                </Badge>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground text-right">
                {new Date(match.matchDatetime).toLocaleString('es', {
                  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                })}
              </span>
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
          </div>
        ))}
      </div>
    </div>
  )
}
