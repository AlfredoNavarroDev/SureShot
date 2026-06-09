import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { Room, LeaderboardEntry } from '@/types/api'

interface Props {
  room: Room
  entry?: LeaderboardEntry
  userId: string
}

export function RoomCard({ room, entry, userId: _userId }: Props) {
  return (
    <Link href={`/rooms/${room.id}`}>
      <Card className="cursor-pointer transition-colors hover:border-primary/50">
        <CardContent className="flex items-center justify-between p-4">
          <div>
            <p className="font-semibold">{room.name}</p>
            {entry && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {entry.predictionsCount} predicciones
              </p>
            )}
          </div>
          {entry ? (
            <div className="text-right">
              <Badge variant="outline" className="border-primary text-primary">
                {entry.totalPoints} pts
              </Badge>
            </div>
          ) : (
            <Badge variant="secondary">Sin predicciones</Badge>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}
