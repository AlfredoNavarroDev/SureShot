import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import type { LeaderboardEntry } from '@/types/api'

export function useLeaderboard(roomId: string) {
  return useQuery({
    queryKey: ['rooms', roomId, 'leaderboard'],
    queryFn: async () => {
      const { data } = await api.get<LeaderboardEntry[]>(
        `/rooms/${roomId}/leaderboard`
      )
      return data
    },
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    enabled: !!roomId,
  })
}
