import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/lib/api'
import type { RoomMember } from '@/types/api'

export function useRoomMembers(roomId: string) {
  return useQuery({
    queryKey: ['rooms', roomId, 'members'],
    queryFn: async () => {
      const { data } = await api.get<RoomMember[]>(`/rooms/${roomId}/members`)
      return data
    },
    staleTime: 30_000,
    enabled: !!roomId,
  })
}

export function useKickMember(roomId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) =>
      api.delete(`/rooms/${roomId}/members/${userId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rooms', roomId, 'members'] })
      toast.success('Miembro eliminado')
    },
  })
}
