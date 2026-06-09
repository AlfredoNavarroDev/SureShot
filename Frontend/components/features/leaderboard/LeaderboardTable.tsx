'use client'
import { useAuthStore } from '@/lib/auth-store'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import type { LeaderboardEntry } from '@/types/api'

export function LeaderboardTable({ entries }: { entries: LeaderboardEntry[] }) {
  const userId = useAuthStore((s) => s.user?.id)

  return (
    <div className="space-y-2">
      {entries.map((entry, idx) => {
        const isMe = entry.user.id === userId
        return (
          <div
            key={entry.user.id}
            className={cn(
              'flex items-center gap-3 rounded-lg border p-3 transition-colors',
              isMe ? 'border-primary/50 bg-accent/30' : 'border-border bg-card'
            )}
          >
            <span className={cn(
              'w-6 text-center text-sm font-bold',
              idx === 0 ? 'text-primary' : 'text-muted-foreground'
            )}>
              #{idx + 1}
            </span>
            <Avatar className="h-8 w-8">
              <AvatarImage src={entry.user.avatar} />
              <AvatarFallback>{entry.user.name[0].toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-semibold">
                {entry.user.name}
                {isMe && <span className="ml-1 text-xs text-muted-foreground">(tú)</span>}
              </p>
              <p className="text-xs text-muted-foreground">
                base {entry.basePoints} · early +{entry.earlyBonuses} · racha +{entry.streakBonus}
              </p>
            </div>
            <span className={cn(
              'text-lg font-black',
              idx === 0 ? 'text-primary' : ''
            )}>
              {entry.totalPoints}
            </span>
          </div>
        )
      })}
    </div>
  )
}
