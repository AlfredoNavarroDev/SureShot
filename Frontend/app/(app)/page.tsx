'use client'
import { useEffect } from 'react'
import { useAuthStore } from '@/lib/auth-store'
import { useRooms } from '@/hooks/useRooms'
import { useQueries, useQueryClient } from '@tanstack/react-query'
import { CreateRoomDialog } from '@/components/features/rooms/CreateRoomDialog'
import { JoinRoomDialog } from '@/components/features/rooms/JoinRoomDialog'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import Link from 'next/link'
import { Flame, Target, Trophy } from 'lucide-react'
import api from '@/lib/api'
import { getSocket } from '@/lib/socket'
import type { LeaderboardEntry } from '@/types/api'
import { cn } from '@/lib/utils'

export default function HomePage() {
  const user = useAuthStore((s) => s.user)
  const qc = useQueryClient()
  const { data: rooms = [], isLoading: roomsLoading } = useRooms()

  const leaderboardQueries = useQueries({
    queries: rooms.map((room) => ({
      queryKey: ['rooms', room.id, 'leaderboard', 'home'],
      queryFn: async () => {
        const { data } = await api.get<LeaderboardEntry[]>(
          `/rooms/${room.id}/leaderboard`
        )
        return { roomId: room.id, entries: data }
      },
      staleTime: 30_000,
    })),
  })

  useEffect(() => {
    const socket = getSocket()
    const handler = () => {
      qc.invalidateQueries({ queryKey: ['rooms'] })
    }
    socket.on('leaderboard:updated', handler)
    return () => { socket.off('leaderboard:updated', handler) }
  }, [qc])

  const globalStats = leaderboardQueries.reduce(
    (acc, q) => {
      const entry = q.data?.entries.find((e) => e.user.id === user?.id)
      if (!entry) return acc
      return {
        totalPoints: acc.totalPoints + entry.totalPoints,
        predictionsCount: acc.predictionsCount + entry.predictionsCount,
        streakBonus: acc.streakBonus + entry.streakBonus,
      }
    },
    { totalPoints: 0, predictionsCount: 0, streakBonus: 0 }
  )

  const rankByRoom: Record<string, { rank: number; entry: LeaderboardEntry }> = {}
  leaderboardQueries.forEach((q) => {
    if (!q.data) return
    const idx = q.data.entries.findIndex((e) => e.user.id === user?.id)
    if (idx >= 0) {
      rankByRoom[q.data.roomId] = { rank: idx + 1, entry: q.data.entries[idx] }
    }
  })

  const statsLoading = leaderboardQueries.some((q) => q.isLoading)

  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          icon={<Trophy className="h-5 w-5" />}
          value={statsLoading ? null : globalStats.totalPoints}
          label="pts totales"
          highlight
        />
        <StatCard
          icon={<Target className="h-5 w-5" />}
          value={statsLoading ? null : globalStats.predictionsCount}
          label="predicciones"
        />
        <StatCard
          icon={<Flame className="h-5 w-5 text-orange-400" />}
          value={statsLoading ? null : globalStats.streakBonus}
          label="bonus racha"
          orange
        />
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
          Mis Salas
        </h2>

        {roomsLoading && (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        )}

        {!roomsLoading && rooms.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Aún no perteneces a ninguna sala.
          </p>
        )}

        <div className="flex flex-col gap-3">
          {rooms.map((room) => {
            const info = rankByRoom[room.id]
            const isTop = info?.rank === 1
            return (
              <Link key={room.id} href={`/rooms/${room.id}`}>
                <Card
                  className={cn(
                    'cursor-pointer transition-colors hover:border-primary/60',
                    isTop && 'border-primary/50'
                  )}
                >
                  <CardContent className="flex items-center justify-between p-4">
                    <div>
                      <p className="font-semibold">{room.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {info
                          ? `${info.entry.predictionsCount} predicciones`
                          : 'Sin predicciones aún'}
                      </p>
                    </div>
                    {info && (
                      <div className="text-right">
                        <p className="text-lg font-bold text-primary">#{info.rank}</p>
                        <p className="text-xs text-muted-foreground">
                          {info.entry.totalPoints} pts
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      </div>

      <div className="flex gap-3">
        <CreateRoomDialog />
        <JoinRoomDialog />
      </div>
    </div>
  )
}

function StatCard({
  icon, value, label, highlight, orange,
}: {
  icon: React.ReactNode
  value: number | null
  label: string
  highlight?: boolean
  orange?: boolean
}) {
  return (
    <Card className={cn(highlight && 'border-primary/40 bg-accent/20')}>
      <CardContent className="flex flex-col items-center justify-center p-4 text-center">
        <div className={cn('mb-1', highlight ? 'text-primary' : orange ? 'text-orange-400' : 'text-muted-foreground')}>
          {icon}
        </div>
        {value === null ? (
          <Skeleton className="mb-1 h-8 w-12" />
        ) : (
          <p className={cn('text-3xl font-black', highlight ? 'text-primary' : orange ? 'text-orange-400' : '')}>
            {value}
          </p>
        )}
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  )
}
