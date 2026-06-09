'use client'
import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuthStore } from '@/lib/auth-store'
import api from '@/lib/api'
import type { User } from '@/types/api'

function Spinner() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  )
}

function CallbackInner() {
  const params = useSearchParams()
  const { setAuth } = useAuthStore()
  const router = useRouter()

  useEffect(() => {
    const token = params.get('token')
    if (!token) { router.replace('/login'); return }

    api
      .get<User>('/users/me', {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then(({ data }) => {
        setAuth(token, data)
        router.replace('/')
      })
      .catch(() => router.replace('/login'))
  }, [params, router, setAuth])

  return <Spinner />
}

export default function CallbackPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <CallbackInner />
    </Suspense>
  )
}
