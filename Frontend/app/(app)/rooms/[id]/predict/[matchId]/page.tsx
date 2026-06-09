'use client'
import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMatch } from '@/hooks/useMatches'
import { usePrediction, useCreatePrediction, useUpdatePrediction } from '@/hooks/usePredictions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, Zap } from 'lucide-react'

const schema = z.object({
  homeScore: z.number().int().min(0, 'Mínimo 0'),
  awayScore: z.number().int().min(0, 'Mínimo 0'),
})
type FormData = z.infer<typeof schema>

export default function PredictPage() {
  const { id: roomId, matchId } = useParams<{ id: string; matchId: string }>()
  const router = useRouter()

  const { data: match, isLoading: matchLoading } = useMatch(matchId)
  const { data: existing } = usePrediction(roomId, matchId)
  const { mutateAsync: create, isPending: creating } = useCreatePrediction(roomId)
  const { mutateAsync: update, isPending: updating } = useUpdatePrediction(roomId, matchId)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  useEffect(() => {
    if (existing) reset({ homeScore: existing.homeScore, awayScore: existing.awayScore })
  }, [existing, reset])

  if (matchLoading) {
    return (
      <div className="p-6 space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  if (!match) return <p className="p-6 text-muted-foreground">Partido no encontrado</p>

  const isLocked = match.status !== 'SCHEDULED'
  const matchDate = new Date(match.matchDatetime)
  const hoursUntilMatch = (matchDate.getTime() - Date.now()) / 36e5
  const earlyBonusAvailable = hoursUntilMatch > 24 && !existing

  const onSubmit = async (data: FormData) => {
    if (existing) {
      await update(data)
    } else {
      await create({ matchId, ...data })
    }
    router.push(`/rooms/${roomId}`)
  }

  return (
    <div className="p-6 max-w-md mx-auto space-y-4">
      <Button variant="ghost" size="icon" onClick={() => router.back()}>
        <ArrowLeft className="h-4 w-4" />
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="text-center text-lg">
            {match.homeTeam} vs {match.awayTeam}
          </CardTitle>
          <p className="text-center text-xs text-muted-foreground">
            {match.stage.replace(/_/g, ' ')} ·{' '}
            {matchDate.toLocaleString('es', {
              weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
            })}
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {earlyBonusAvailable && (
            <div className="flex items-center gap-2 rounded-lg border border-primary/40 bg-accent/30 p-3">
              <Zap className="h-4 w-4 text-primary" />
              <div>
                <p className="text-xs font-bold text-primary">Early bonus disponible</p>
                <p className="text-xs text-muted-foreground">
                  +1 pt por predecir con más de 24h de anticipación
                </p>
              </div>
            </div>
          )}

          {isLocked && (
            <Badge variant="secondary" className="w-full justify-center">
              Predicciones cerradas
            </Badge>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="flex items-center justify-center gap-6">
              <div className="flex flex-col items-center gap-2">
                <Label className="text-xs text-muted-foreground">{match.homeTeam}</Label>
                <Input
                  type="number"
                  min={0}
                  disabled={isLocked}
                  className="h-16 w-16 text-center text-3xl font-black"
                  {...register('homeScore', { valueAsNumber: true })}
                />
                {errors.homeScore && (
                  <p className="text-xs text-destructive">{errors.homeScore.message}</p>
                )}
              </div>
              <span className="text-2xl text-muted-foreground">vs</span>
              <div className="flex flex-col items-center gap-2">
                <Label className="text-xs text-muted-foreground">{match.awayTeam}</Label>
                <Input
                  type="number"
                  min={0}
                  disabled={isLocked}
                  className="h-16 w-16 text-center text-3xl font-black"
                  {...register('awayScore', { valueAsNumber: true })}
                />
                {errors.awayScore && (
                  <p className="text-xs text-destructive">{errors.awayScore.message}</p>
                )}
              </div>
            </div>

            <Button
              type="submit"
              className="w-full font-bold text-black"
              disabled={isLocked || creating || updating}
            >
              {creating || updating
                ? 'Guardando...'
                : existing
                ? 'Actualizar predicción'
                : 'Guardar predicción'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
