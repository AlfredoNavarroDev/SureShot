import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/lib/api'
import type { Match, MatchStatus, MatchStage } from '@/types/api'

interface MatchFilters { status?: MatchStatus; stage?: MatchStage }

export function useMatches(filters: MatchFilters = {}) {
  return useQuery({
    queryKey: ['matches', filters],
    queryFn: async () => {
      const { data } = await api.get<Match[]>('/matches', { params: filters })
      return data
    },
    staleTime: 60_000,
  })
}

export function useMatch(id: string) {
  return useQuery({
    queryKey: ['matches', id],
    queryFn: async () => {
      const { data } = await api.get<Match>(`/matches/${id}`)
      return data
    },
    staleTime: 30_000,
    enabled: !!id,
  })
}

export function useCreateMatch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: {
      homeTeam: string
      awayTeam: string
      matchDatetime: string
      stage: MatchStage
      group?: string
    }) => api.post<Match>('/matches', dto).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['matches'] })
      toast.success('Partido creado')
    },
    onError: () => toast.error('Error al crear partido'),
  })
}

export function useUpdateMatch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...dto }: Partial<Match> & { id: string }) =>
      api.patch<Match>(`/matches/${id}`, dto).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['matches'] })
      toast.success('Partido actualizado')
    },
    onError: () => toast.error('Error al actualizar partido'),
  })
}

export function useDeleteMatch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/matches/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['matches'] })
      toast.success('Partido eliminado')
    },
  })
}
