import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/lib/api'
import { useAuthStore } from '@/lib/auth-store'
import type { User } from '@/types/api'

export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const { data } = await api.get<User>('/users/me')
      return data
    },
    staleTime: 5 * 60_000,
  })
}

export function useUpdateMe() {
  const qc = useQueryClient()
  const { setAuth, accessToken } = useAuthStore()
  return useMutation({
    mutationFn: (dto: { name?: string; avatar?: string }) =>
      api.patch<User>('/users/me', dto).then((r) => r.data),
    onSuccess: (user) => {
      qc.setQueryData(['me'], user)
      if (accessToken) setAuth(accessToken, user)
      toast.success('Perfil actualizado')
    },
    onError: () => toast.error('Error al actualizar perfil'),
  })
}
