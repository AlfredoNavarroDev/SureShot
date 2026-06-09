import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import type { Room } from '@/types/api'

export function useRoom(id: string) {
  return useQuery({
    queryKey: ['rooms', id],
    queryFn: async () => {
      const { data } = await api.get<Room>(`/rooms/${id}`)
      return data
    },
    staleTime: 30_000,
    enabled: !!id,
  })
}
