import { Badge } from '@/components/ui/badge'
import { CheckCircle2, Clock, Lock } from 'lucide-react'
import type { MatchStatus } from '@/types/api'

interface Props {
  predicted: boolean
  matchStatus: MatchStatus
  homeScore?: number
  awayScore?: number
}

export function PredictionBadge({ predicted, matchStatus, homeScore, awayScore }: Props) {
  if (matchStatus === 'FINISHED' && !predicted) {
    return (
      <Badge variant="secondary" className="gap-1">
        <Lock className="h-3 w-3" /> Sin predecir
      </Badge>
    )
  }
  if (predicted && homeScore !== undefined && awayScore !== undefined) {
    return (
      <Badge className="gap-1 bg-primary/20 text-primary border-primary/40">
        <CheckCircle2 className="h-3 w-3" />
        {homeScore} - {awayScore}
      </Badge>
    )
  }
  if (matchStatus !== 'SCHEDULED') {
    return (
      <Badge variant="secondary" className="gap-1">
        <Lock className="h-3 w-3" /> Cerrado
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="gap-1 border-yellow-500/50 text-yellow-500">
      <Clock className="h-3 w-3" /> Sin predecir
    </Badge>
  )
}
