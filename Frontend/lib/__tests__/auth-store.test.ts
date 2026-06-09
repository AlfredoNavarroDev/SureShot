import { renderHook, act } from '@testing-library/react'
import { useAuthStore } from '../auth-store'

beforeEach(() => {
  useAuthStore.setState({ accessToken: null, user: null })
})

const mockUser = {
  id: 'u1', email: 'a@b.com', name: 'Luis', role: 'USER' as const,
  createdAt: '', updatedAt: '',
}

test('setAuth stores token and user', () => {
  const { result } = renderHook(() => useAuthStore())
  act(() => result.current.setAuth('tok123', mockUser))
  expect(result.current.accessToken).toBe('tok123')
  expect(result.current.user).toEqual(mockUser)
})

test('clear resets state', () => {
  const { result } = renderHook(() => useAuthStore())
  act(() => result.current.setAuth('tok123', mockUser))
  act(() => result.current.clear())
  expect(result.current.accessToken).toBeNull()
  expect(result.current.user).toBeNull()
})
