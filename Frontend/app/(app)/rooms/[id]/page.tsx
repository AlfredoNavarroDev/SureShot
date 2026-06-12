'use client'
import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useRoom } from '@/hooks/useRoom'
import { useMatches } from '@/hooks/useMatches'
import { usePredictions } from '@/hooks/usePredictions'
import { useLeaderboard } from '@/hooks/useLeaderboard'
import { useRoomMembers, useKickMember } from '@/hooks/useRoomMembers'
import { useAuthStore } from '@/lib/auth-store'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { PredictionBadge } from '@/components/features/predictions/PredictionBadge'
import { LeaderboardTable } from '@/components/features/leaderboard/LeaderboardTable'
import Link from 'next/link'
import { Copy, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { Match, MatchStatus, MatchStage } from '@/types/api'

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

const STATUS_ORDER: Record<MatchStatus, number> = { IN_PROGRESS: 0, FINISHED: 1, SCHEDULED: 2 }
const STAGE_ORDER: Record<MatchStage, number>   = { FINAL: 0, SEMI_FINAL: 1, QUARTER_FINAL: 2, ROUND_OF_16: 3, GROUP: 4 }

export default function RoomPage() {
  const { id } = useParams<{ id: string }>()
  const user = useAuthStore((s) => s.user)
  const router = useRouter()

  const [statusFilter, setStatusFilter] = useState<MatchStatus | 'ALL'>('ALL')
  const [stageFilter,  setStageFilter]  = useState<MatchStage  | 'ALL'>('ALL')

  const { data: room, isLoading: roomLoading } = useRoom(id)
  const { data: matches = [] } = useMatches({
    status: statusFilter === 'ALL' ? undefined : statusFilter,
    stage:  stageFilter  === 'ALL' ? undefined : stageFilter,
  })
  const { data: predictions = [] } = usePredictions(id)
  const { data: leaderboard = [], isLoading: lbLoading } = useLeaderboard(id)
  const { data: members = [] } = useRoomMembers(id)
  const { mutate: kickMember } = useKickMember(id)

  const isOwner = room?.ownerId === user?.id

  const predictionMap = new Map(predictions.map((p) => [p.matchId, p]))

  const copyCode = () => {
    if (room) {
      navigator.clipboard.writeText(room.inviteCode)
      toast.success('Código copiado')
    }
  }

  if (roomLoading) {
    return (
      <div className="p-6 space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-32" />
      </div>
    )
  }

  if (!room) return <p className="p-6 text-muted-foreground">Sala no encontrada</p>

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{room.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-muted-foreground">
              Código: <span className="font-mono font-bold">{room.inviteCode}</span>
            </span>
            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={copyCode}>
              <Copy className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>

      <Tabs defaultValue="predictions">
        <TabsList className="w-full">
          <TabsTrigger value="predictions" className="flex-1">Predicciones</TabsTrigger>
          <TabsTrigger value="leaderboard" className="flex-1">Leaderboard</TabsTrigger>
          <TabsTrigger value="members" className="flex-1">Miembros</TabsTrigger>
        </TabsList>

        <TabsContent value="predictions" className="mt-4 space-y-3">
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

          {matches.length === 0 && (
            <p className="text-sm text-muted-foreground">No hay partidos con estos filtros.</p>
          )}
          {[...matches]
            .sort((a, b) => {
              const sd = STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
              if (sd !== 0) return sd
              return STAGE_ORDER[a.stage] - STAGE_ORDER[b.stage]
            })
            .map((match: Match) => {
            const prediction = predictionMap.get(match.id)
            const isLocked = match.status !== 'SCHEDULED'
            return (
              <div
                key={match.id}
                className="flex items-center justify-between rounded-lg border border-border bg-card p-3"
              >
                <div>
                  <p className="text-sm font-semibold">
                    {match.homeTeam} vs {match.awayTeam}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {match.stage.replace(/_/g, ' ')} ·{' '}
                    {new Date(match.matchDatetime).toLocaleString('es', {
                      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <PredictionBadge
                    predicted={!!prediction}
                    matchStatus={match.status}
                    homeScore={prediction?.homeScore}
                    awayScore={prediction?.awayScore}
                  />
                  {!isLocked && (
                    <Link
                      href={`/rooms/${id}/predict/${match.id}`}
                      className="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs font-medium hover:bg-accent"
                    >
                      {prediction ? 'Editar' : 'Predecir'}
                    </Link>
                  )}
                </div>
              </div>
            )
          })}
        </TabsContent>

        <TabsContent value="leaderboard" className="mt-4">
          {lbLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : (
            <LeaderboardTable entries={leaderboard} />
          )}
        </TabsContent>

        <TabsContent value="members" className="mt-4 space-y-2">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center gap-3 rounded-lg border border-border p-3"
            >
              <Avatar className="h-8 w-8">
                <AvatarImage src={member.user.avatar} />
                <AvatarFallback>{member.user.name[0]?.toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="text-sm font-semibold">{member.user.name}</p>
                {room.ownerId === member.userId && (
                  <Badge variant="outline" className="text-xs">Owner</Badge>
                )}
              </div>
              {isOwner && member.userId !== user?.id && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => kickMember(member.userId)}
                >
                  Expulsar
                </Button>
              )}
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  )
}
