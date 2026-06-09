import { loginSchema, registerSchema } from '../auth-schemas'

test('loginSchema rechaza email inválido', () => {
  const r = loginSchema.safeParse({ email: 'no-email', password: '12345678' })
  expect(r.success).toBe(false)
})

test('loginSchema rechaza contraseña corta', () => {
  const r = loginSchema.safeParse({ email: 'a@b.com', password: '123' })
  expect(r.success).toBe(false)
})

test('loginSchema acepta datos válidos', () => {
  const r = loginSchema.safeParse({ email: 'a@b.com', password: '12345678' })
  expect(r.success).toBe(true)
})

test('registerSchema rechaza nombre corto', () => {
  const r = registerSchema.safeParse({ email: 'a@b.com', name: 'A', password: '12345678' })
  expect(r.success).toBe(false)
})

test('registerSchema acepta datos válidos', () => {
  const r = registerSchema.safeParse({ email: 'a@b.com', name: 'Luis', password: '12345678' })
  expect(r.success).toBe(true)
})
