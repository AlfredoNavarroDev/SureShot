'use client'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import type { MatchStage, MatchStatus } from '@/types/api'

const STAGES: MatchStage[] = [
  'GROUP', 'ROUND_OF_16', 'QUARTER_FINAL', 'SEMI_FINAL', 'FINAL',
]
const STAGE_LABELS: Record<MatchStage, string> = {
  GROUP: 'Fase de Grupos',
  ROUND_OF_16: 'Octavos de Final',
  QUARTER_FINAL: 'Cuartos de Final',
  SEMI_FINAL: 'Semifinal',
  FINAL: 'Final',
}
const STATUSES: MatchStatus[] = ['SCHEDULED', 'IN_PROGRESS', 'FINISHED']
const STATUS_LABELS: Record<MatchStatus, string> = {
  SCHEDULED: 'Programado',
  IN_PROGRESS: 'En juego',
  FINISHED: 'Finalizado',
}

const schema = z.object({
  homeTeam: z.string().min(1, 'Requerido'),
  awayTeam: z.string().min(1, 'Requerido'),
  matchDatetime: z.string().min(1, 'Requerido'),
  stage: z.enum(['GROUP', 'ROUND_OF_16', 'QUARTER_FINAL', 'SEMI_FINAL', 'FINAL']),
  group: z.string().optional(),
  status: z.enum(['SCHEDULED', 'IN_PROGRESS', 'FINISHED']).optional(),
  homeScore: z.number().int().min(0).optional().nullable(),
  awayScore: z.number().int().min(0).optional().nullable(),
})
export type MatchFormData = z.infer<typeof schema>

interface Props {
  defaultValues?: Partial<MatchFormData>
  onSubmit: (data: MatchFormData) => Promise<void>
  isPending: boolean
  isEdit?: boolean
}

export function AdminMatchForm({ defaultValues, onSubmit, isPending, isEdit }: Props) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<MatchFormData>({ resolver: zodResolver(schema), defaultValues })

  useEffect(() => { if (defaultValues) reset(defaultValues) }, [defaultValues, reset])

  const stage = watch('stage')

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>Equipo local</Label>
          <Input placeholder="Argentina" {...register('homeTeam')} />
          {errors.homeTeam && <p className="text-xs text-destructive">{errors.homeTeam.message}</p>}
        </div>
        <div className="space-y-1">
          <Label>Equipo visitante</Label>
          <Input placeholder="Francia" {...register('awayTeam')} />
          {errors.awayTeam && <p className="text-xs text-destructive">{errors.awayTeam.message}</p>}
        </div>
      </div>

      <div className="space-y-1">
        <Label>Fecha y hora</Label>
        <Input type="datetime-local" {...register('matchDatetime')} />
        {errors.matchDatetime && <p className="text-xs text-destructive">{errors.matchDatetime.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>Fase</Label>
          <Select
            defaultValue={defaultValues?.stage}
            onValueChange={(v) => setValue('stage', v as MatchStage)}
          >
            <SelectTrigger><SelectValue placeholder="Seleccionar fase" /></SelectTrigger>
            <SelectContent>
              {STAGES.map((s) => (
                <SelectItem key={s} value={s}>{STAGE_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.stage && <p className="text-xs text-destructive">{errors.stage.message}</p>}
        </div>

        {stage === 'GROUP' && (
          <div className="space-y-1">
            <Label>Grupo</Label>
            <Input placeholder="A" maxLength={1} {...register('group')} />
          </div>
        )}
      </div>

      {isEdit && (
        <>
          <div className="space-y-1">
            <Label>Estado</Label>
            <Select
              defaultValue={defaultValues?.status}
              onValueChange={(v) => setValue('status', v as MatchStatus)}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Goles local</Label>
              <Input type="number" min={0} {...register('homeScore', { valueAsNumber: true })} />
            </div>
            <div className="space-y-1">
              <Label>Goles visitante</Label>
              <Input type="number" min={0} {...register('awayScore', { valueAsNumber: true })} />
            </div>
          </div>
        </>
      )}

      <Button type="submit" className="w-full font-bold text-black" disabled={isPending}>
        {isPending ? 'Guardando...' : isEdit ? 'Actualizar partido' : 'Crear partido'}
      </Button>
    </form>
  )
}
