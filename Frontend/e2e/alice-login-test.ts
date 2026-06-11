import { test, expect } from '@playwright/test'

test('alice login test', async ({ page }) => {
  // Capture console errors
  const consoleErrors: string[] = []
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })

  // Capture network requests
  const apiRequests: { url: string; status: number; body: string }[] = []
  page.on('response', async (response) => {
    if (response.url().includes('localhost:3000')) {
      let body = ''
      try { body = await response.text() } catch {}
      apiRequests.push({ url: response.url(), status: response.status(), body })
    }
  })

  await page.goto('/login')
  await page.screenshot({ path: '/tmp/1-login-page.png' })

  await page.getByLabel('Email').fill('alice@demo.com')
  await page.getByLabel('Contraseña').fill('Demo1234!')
  await page.getByRole('button', { name: 'Entrar' }).click()

  // Wait a bit for response
  await page.waitForTimeout(3000)
  await page.screenshot({ path: '/tmp/2-after-submit.png' })

  console.log('URL after submit:', page.url())
  console.log('Console errors:', JSON.stringify(consoleErrors))
  console.log('API requests:', JSON.stringify(apiRequests, null, 2))

  // Check for any visible text on page
  const bodyText = await page.locator('body').innerText()
  console.log('Page text:', bodyText.substring(0, 500))
})
