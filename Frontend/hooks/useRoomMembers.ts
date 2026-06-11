import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/lib/api'
import { getSocket } from '@/lib/socket'
import type { RoomMember } from '@/types/api'

export function useRoomMembers(roomId: string) {
  const qc = useQueryClient()

  useEffect(() => {
    if (!roomId) return
    const socket = getSocket()
    const handler = (payload: { roomId: string }) => {
      if (payload.roomId === roomId) {
        qc.invalidateQueries({ queryKey: ['rooms', roomId, 'members'] })
      }
    }
    socket.on('member:updated', handler)
    return () => { socket.off('member:updated', handler) }
  }, [qc, roomId])

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
