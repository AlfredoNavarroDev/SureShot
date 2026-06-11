import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/lib/api'
import { getSocket } from '@/lib/socket'
import type { Prediction } from '@/types/api'

export function usePredictions(roomId: string) {
  const qc = useQueryClient()

  useEffect(() => {
    if (!roomId) return
    const socket = getSocket()
    const handler = (payload: { roomId: string }) => {
      if (payload.roomId === roomId) {
        qc.invalidateQueries({ queryKey: ['rooms', roomId, 'predictions'] })
      }
    }
    socket.on('prediction:saved', handler)
    return () => { socket.off('prediction:saved', handler) }
  }, [qc, roomId])

  return useQuery({
    queryKey: ['rooms', roomId, 'predictions'],
    queryFn: async () => {
      const { data } = await api.get<Prediction[]>(`/rooms/${roomId}/predictions`)
      return data
    },
    staleTime: 15_000,
    enabled: !!roomId,
  })
}

export function usePrediction(roomId: string, matchId: string) {
  return useQuery({
    queryKey: ['rooms', roomId, 'predictions', matchId],
    queryFn: async () => {
      const { data } = await api.get<Prediction>(
        `/rooms/${roomId}/predictions/${matchId}`
      )
      return data
    },
    staleTime: 15_000,
    enabled: !!roomId && !!matchId,
  })
}

export function useCreatePrediction(roomId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: { matchId: string; homeScore: number; awayScore: number }) =>
      api.post<Prediction>(`/rooms/${roomId}/predictions`, dto).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rooms', roomId, 'predictions'] })
      qc.invalidateQueries({ queryKey: ['rooms', roomId, 'leaderboard'] })
      toast.success('Predicción guardada')
    },
    onError: (err: unknown) => {
      const code = (err as { response?: { data?: { error?: { code?: string } } } })?.response?.data?.error?.code
      toast.error(
        code === 'PREDICTION_LOCKED' ? 'Predicción bloqueada (< 10 min)' : 'Error al guardar'
      )
    },
  })
}

export function useUpdatePrediction(roomId: string, matchId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: { homeScore: number; awayScore: number }) =>
      api
        .patch<Prediction>(`/rooms/${roomId}/predictions/${matchId}`, dto)
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rooms', roomId, 'predictions'] })
      toast.success('Predicción actualizada')
    },
    onError: (err: unknown) => {
      const code = (err as { response?: { data?: { error?: { code?: string } } } })?.response?.data?.error?.code
      toast.error(
        code === 'PREDICTION_LOCKED' ? 'Predicción bloqueada (< 10 min)' : 'Error al actualizar'
      )
    },
  })
}
