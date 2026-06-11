import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { getSocket } from '@/lib/socket'
import type { LeaderboardEntry } from '@/types/api'

export function useLeaderboard(roomId: string) {
  const qc = useQueryClient()

  useEffect(() => {
    if (!roomId) return
    const socket = getSocket()
    const handler = () => {
      qc.invalidateQueries({ queryKey: ['rooms', roomId, 'leaderboard'] })
    }
    socket.on('leaderboard:updated', handler)
    return () => { socket.off('leaderboard:updated', handler) }
  }, [qc, roomId])

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
