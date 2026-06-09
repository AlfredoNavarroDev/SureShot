import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/lib/api'
import type { Room } from '@/types/api'

export function useRooms() {
  return useQuery({
    queryKey: ['rooms'],
    queryFn: async () => {
      const { data } = await api.get<Room[]>('/rooms')
      return data
    },
    staleTime: 30_000,
  })
}

export function useCreateRoom() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) =>
      api.post<Room>('/rooms', { name }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rooms'] })
      toast.success('Sala creada')
    },
    onError: () => toast.error('Error al crear la sala'),
  })
}

export function useJoinRoom() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (inviteCode: string) =>
      api.post<Room>('/rooms/join', { inviteCode }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rooms'] })
      toast.success('Te uniste a la sala')
    },
    onError: (err: unknown) => {
      const code = (err as { response?: { data?: { error?: { code?: string } } } })?.response?.data?.error?.code
      toast.error(code === 'INVALID_INVITE_CODE' ? 'Código inválido' : 'Error al unirse')
    },
  })
}

export function useDeleteRoom() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/rooms/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rooms'] })
      toast.success('Sala eliminada')
    },
  })
}

export function useRotateInviteCode() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      api.post<Room>(`/rooms/${id}/invites`).then((r) => r.data),
    onSuccess: (_, id) => qc.invalidateQueries({ queryKey: ['rooms', id] }),
  })
}
