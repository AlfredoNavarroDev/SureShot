// Frontend/app/(app)/layout.tsx
'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/auth-store'
import { Sidebar } from '@/components/layout/Sidebar'
import api from '@/lib/api'
import type { AuthResponse } from '@/types/api'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [hydrating, setHydrating] = useState(true)
  const { accessToken, setAuth, clear } = useAuthStore()
  const router = useRouter()

  useEffect(() => {
    if (accessToken) {
      setHydrating(false)
      return
    }
    // Sin token en memoria → intentar rehidratar desde cookie
    api
      .post<AuthResponse>('/auth/refresh')
      .then(({ data }) => setAuth(data.accessToken, data.user))
      .catch(() => {
        clear()
        router.replace('/login')
      })
      .finally(() => setHydrating(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (hydrating) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
