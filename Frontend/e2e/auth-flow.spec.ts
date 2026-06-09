import { test, expect } from '@playwright/test'

const randomEmail = () => `test_${Date.now()}@sureshot.test`

test('register → home → see rooms page', async ({ page }) => {
  await page.goto('/register')
  await expect(page.getByRole('heading', { name: 'Crear cuenta' })).toBeVisible()

  await page.getByLabel('Nombre').fill('Test User')
  await page.getByLabel('Email').fill(randomEmail())
  await page.getByLabel('Contraseña').fill('password123')
  await page.getByRole('button', { name: 'Crear cuenta' }).click()

  await expect(page).toHaveURL('/')
  await expect(page.getByText('Mis Salas')).toBeVisible()
})

test('login with wrong password shows error', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill('noexiste@a.com')
  await page.getByLabel('Contraseña').fill('wrongpassword')
  await page.getByRole('button', { name: 'Entrar' }).click()

  await expect(page.getByText('Credenciales inválidas')).toBeVisible()
})

test('unauthenticated redirect to /login', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL('/login')
})
