// Frontend/lib/api.ts
import axios from 'axios'
import { useAuthStore } from './auth-store'

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1'

// Instancia principal — todas las requests autenticadas
const api = axios.create({ baseURL: BASE_URL, withCredentials: true })

// Instancia separada SOLO para refresh — evita loop infinito en el interceptor
const refreshApi = axios.create({ baseURL: BASE_URL, withCredentials: true })

// Adjunta el access token a cada request
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Cola de requests que llegaron mientras se estaba refrescando
let isRefreshing = false
let failedQueue: Array<{
  resolve: (token: string) => void
  reject: (err: unknown) => void
}> = []

function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach(({ resolve, reject }) =>
    error ? reject(error) : resolve(token!)
  )
  failedQueue = []
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error)
    }

    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        failedQueue.push({ resolve, reject })
      }).then((token) => {
        original.headers.Authorization = `Bearer ${token}`
        return api(original)
      })
    }

    original._retry = true
    isRefreshing = true

    try {
      const { data } = await refreshApi.post<{ accessToken: string; user: import('@/types/api').User }>(
        '/auth/refresh'
      )
      useAuthStore.getState().setAuth(data.accessToken, data.user)
      processQueue(null, data.accessToken)
      original.headers.Authorization = `Bearer ${data.accessToken}`
      return api(original)
    } catch (err) {
      processQueue(err, null)
      useAuthStore.getState().clear()
      if (typeof window !== 'undefined') window.location.href = '/login'
      return Promise.reject(err)
    } finally {
      isRefreshing = false
    }
  }
)

export default api
