import AxeBuilder from '@axe-core/playwright'
import { compressSync, strToU8 } from 'fflate'
import {
  expect,
  test,
  type APIRequestContext,
  type Browser,
  type BrowserContext,
  type Page,
} from '@playwright/test'

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
)

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function shareHash(payload: unknown): string {
  const bytes = compressSync(strToU8(JSON.stringify(payload)), { level: 9 })
  return `#p=${toBase64Url(bytes)}`
}

async function sourceHash(request: APIRequestContext): Promise<string> {
  const response = await request.get('/data/catalog.v2.json')
  expect(response.ok()).toBe(true)
  const catalog = await response.json()
  return catalog.sourceHash as string
}

async function newShareContext(
  browser: Browser,
  pocketJson: string,
  hash: string,
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await context.addInitScript(({ value }) => {
    if (!window.sessionStorage.getItem('e2e-storage-ready')) {
      window.localStorage.clear()
      window.sessionStorage.setItem('e2e-storage-ready', 'true')
    }
    window.localStorage.setItem('ak-pass:pockets:v1', value)
  }, { value: pocketJson })
  const page = await context.newPage()
  await page.route('https://aak-assets.nslc.top/**', (route) => route.abort('failed'))
  await page.route('https://r2.nsapi.top/**', (route) => route.abort('failed'))
  await page.goto(`/${hash}`)
  return { context, page }
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!window.sessionStorage.getItem('e2e-storage-ready')) {
      window.localStorage.clear()
      window.sessionStorage.setItem('e2e-storage-ready', 'true')
    }
  })
  await page.route('https://aak-assets.nslc.top/**', (route) => route.abort('failed'))
  await page.route('https://r2.nsapi.top/**', (route) => route.abort('failed'))
  await page.goto('/')
  await expect(page.locator('.box-row')).toHaveCount(92)
})

test('search by initial, pinyin, and browse/collect mode behavior', async ({ page }) => {
  const search = page.getByPlaceholder('拼音 / 英文')
  await search.fill('AMY')
  await expect(page.locator('.operator-card h3').first()).toContainText('阿米娅')
  await search.fill('amiya')
  await expect(page.locator('.operator-card h3').first()).toContainText('阿米娅')
  await search.fill('')

  await page.getByRole('button', { name: '浏览' }).click()
  const firstCard = page.locator('.operator-card').first()
  await expect(firstCard.locator('.favorite-zone')).toHaveCount(0)
  await expect(firstCard.locator('.portrait-link')).toHaveAttribute('href', /prts\.wiki\/w\/Amiya/)

  await search.fill('杰斯顿')
  const jestonCard = page.locator('.operator-card').filter({ hasText: '杰斯顿' })
  await expect(jestonCard.locator('.portrait-disabled')).toBeVisible()
  await expect(jestonCard.locator('.portrait-link')).toHaveCount(1)
  await search.fill('')

  await page.getByRole('button', { name: '收藏' }).click()
  await expect(page.locator('.operator-card').first().locator('.favorite-zone')).toHaveCount(2)
})

test('disabled elite-2 zone stays transparent until hover', async ({ page }) => {
  const search = page.getByPlaceholder('拼音 / 英文')
  await search.fill('香草')
  const card = page.locator('.operator-card').filter({ hasText: '香草' }).first()
  const disabledZone = card.locator('.favorite-zone.zone-elite2')
  await expect(disabledZone).toHaveCount(1)
  expect(await disabledZone.evaluate((el) => getComputedStyle(el).opacity)).toBe('0')
  await card.hover()
  expect(await disabledZone.evaluate((el) => getComputedStyle(el).opacity)).toBe('1')
})

test('box sort, reverse sort, and operator aggregation', async ({ page }) => {
  await expect(page.locator('.box-meta h2').first()).toHaveText('1.0')
  await page.getByRole('button', { name: '排序方式' }).click()
  await page.locator('.select-menu button', { hasText: '发行时间' }).click()
  await expect(page.locator('.box-meta h2').first()).toHaveText('1.0')
  await page.getByRole('button', { name: '反向排序' }).click()
  await expect(page.locator('.box-meta h2').first()).not.toHaveText('1.0')
  await expect(page.locator('.box-meta h2').first()).toHaveText('第一期设定集赠品')

  await page.getByRole('button', { name: '按干员' }).click()
  await expect(page.locator('.operator-view-card')).toHaveCount(431)
  await page.getByRole('button', { name: '排序方式' }).click()
  const sortOptions = page.locator('.select-menu button')
  await expect(sortOptions).toHaveText(['入游时间'])
  await expect(sortOptions).not.toHaveText(['类别 · 时间'])
  await page.keyboard.press('Escape')
  const search = page.getByPlaceholder('拼音 / 英文')
  await search.fill('AMY')
  await expect(page.locator('.operator-view-card')).toHaveCount(1)
  await expect(page.locator('.operator-view-card').first().locator('.operator-appearance')).toHaveCount(10)
})

test('theme and compact avatar persist after reload', async ({ page }) => {
  await page.getByRole('button', { name: '夜间', exact: true }).click()
  await page.getByRole('button', { name: '紧凑', exact: true }).click()

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  const portrait = page.locator('.operator-card .portrait-wrap').first()
  await expect(portrait.locator('.lazy-image')).toHaveClass(/size-compact/)
  const box = await portrait.boundingBox()
  expect(box?.width).toBeGreaterThan(45)
  expect(box?.width).toBeLessThan(60)
  expect(box?.height).toBeGreaterThan(45)
  expect(box?.height).toBeLessThan(60)
  await expect(page.locator('.box-meta dl').first()).toBeHidden()
  await expect(page.locator('.operator-card h3').first()).toBeHidden()
  await expect(page.locator('.topbar')).toHaveCSS('background-color', 'rgba(32, 36, 39, 0.97)')
  await expect(page.locator('.workspace-layout > .pocket-panel .pocket-header')).toHaveCSS('background-color', 'rgb(17, 20, 22)')

  await page.reload()
  await expect(page.locator('.box-row')).toHaveCount(92)
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(page.locator('.operator-card .lazy-image').first()).toHaveClass(/size-compact/)
  await expect(page.locator('html')).toHaveClass(/theme-ready/)
})

test('share hash merges and de-duplicates in a new browser context', async ({ browser, request }) => {
  const hash = await sourceHash(request)
  const itemA = '["1.0","阿米娅","ELITE1"]'
  const itemB = '["1.0","阿米娅","ELITE2"]'
  const existing = JSON.stringify({
    version: 1,
    currentPocketId: 'a',
    pockets: [{ id: 'a', name: '收藏夹', items: [itemA] }],
  })
  const url = shareHash({ version: 1, pocketName: '收藏夹', items: [itemA, itemA, itemB], sourceHash: hash })
  const { context, page } = await newShareContext(browser, existing, url)
  try {
    await expect(page.locator('.notice')).toContainText('已合并')
    const panel = page.locator('.workspace-layout > .pocket-panel')
    await expect(panel.locator('.pocket-item')).toHaveCount(2)
    await expect(panel.locator('.pocket-item')).toContainText(['阿米娅', '阿米娅'])
    await expect.poll(() => page.evaluate(() => window.location.hash)).toBe('')
  } finally {
    await context.close()
  }
})

test('share hash reports cross-catalog data and rejects malformed input', async ({ browser, request }) => {
  const hash = await sourceHash(request)
  const existing = JSON.stringify({ version: 1, currentPocketId: 'a', pockets: [{ id: 'a', name: '收藏夹', items: [] }] })
  const cross = shareHash({ version: 1, pocketName: '收藏夹', items: ['["1.0","阿米娅","ELITE1"]'], sourceHash: 'other-hash' })
  const first = await newShareContext(browser, existing, cross)
  try {
    await expect(first.page.locator('.notice')).toContainText('数据版本不同')
    await first.context.close()
  } catch (error) {
    await first.context.close()
    throw error
  }

  const second = await newShareContext(browser, existing, '#p=not-a-valid-payload')
  try {
    await expect(second.page.locator('.notice')).toContainText('分享链接无效')
    await expect(second.page.locator('.workspace-layout > .pocket-panel .pocket-item')).toHaveCount(0)
    await second.context.close()
  } catch (error) {
    await second.context.close()
    throw error
  }
})

test('R2 image failure falls back to tiny, mobile drawer and settings work', async ({ page }, testInfo) => {
  await page.route('**/tiny.webp', (route) => route.fulfill({ contentType: 'image/png', body: TINY_PNG }))
  const firstLazy = page.locator('.operator-card .lazy-image').first()
  await expect(firstLazy).toHaveClass(/is-tiny-fallback|is-missing/)

  if (testInfo.project.name === 'mobile') {
    await page.getByRole('button', { name: /打开口袋/ }).click()
    await expect(page.locator('.pocket-panel.drawer')).toBeVisible()
    await page.getByLabel('关闭口袋').click()
    await page.getByRole('button', { name: '夜间', exact: true }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  }
  await page.screenshot({ path: testInfo.outputPath('catalog.png'), fullPage: false })
})

test('@a11y has no automatically detectable serious violations', async ({ page }) => {
  test.setTimeout(180_000)
  const results = await new AxeBuilder({ page }).analyze()
  const serious = results.violations.filter((violation) => (
    violation.impact === 'critical' || violation.impact === 'serious'
  ))
  expect(serious).toEqual([])
})

test('URL route #52 filters to a single numeric box', async ({ page }) => {
  await page.goto('/#52')
  await expect(page.locator('.box-row')).toHaveCount(1)
  await expect(page.locator('.box-meta h2')).toHaveText('52.0')
})

test('URL path /52 filters to a single box and canonicalizes to #52', async ({ page }) => {
  await page.goto('/52')
  await expect(page.locator('.box-row')).toHaveCount(1)
  await expect(page.locator('.box-meta h2')).toHaveText('52.0')
  await expect.poll(() => page.evaluate(() => window.location.hash)).toBe('#52')
})

test('URL route #52+50+7 shows exactly those three boxes', async ({ page }) => {
  await page.goto('/#52+50+7')
  await expect(page.locator('.box-row')).toHaveCount(3)
  const titles = await page.locator('.box-meta h2').allTextContents()
  expect([...titles].sort()).toEqual(['7.0', '50.0', '52.0'].sort())
})

test('URL route with an encoded special box name filters to that box', async ({ page }) => {
  await page.goto(`/#${encodeURIComponent('特别通行认证')}`)
  await expect(page.locator('.box-row')).toHaveCount(1)
  await expect(page.locator('.box-meta h2')).toHaveText('特别通行认证')
})

test('manual box filter dialog syncs selection back to the URL route', async ({ page }) => {
  await page.getByRole('button', { name: /盒款筛选/ }).click()
  const dialog = page.locator('.filter-dialog')
  await expect(dialog).toBeVisible()
  await dialog.locator('.selection-actions button', { hasText: '清空' }).click()
  const grid = dialog.locator('.box-choice-grid')
  for (const id of ['52.0', '50.0', '7.0']) {
    const label = grid.locator('label', {
      has: page.locator('strong', { hasText: new RegExp(`^${id.replace(/\./g, '\\.')}$`) }),
    })
    await label.click()
  }
  await dialog.locator('.primary-button', { hasText: '应用筛选' }).click()
  await expect(page.locator('.box-row')).toHaveCount(3)
  await expect.poll(() => page.evaluate(() => window.location.hash)).toBe('#52+50+7')
})

test('share hash coexists with a box route filter', async ({ browser, request }) => {
  const hash = await sourceHash(request)
  const existing = JSON.stringify({ version: 1, currentPocketId: 'a', pockets: [{ id: 'a', name: '收藏夹', items: [] }] })
  const url = `${shareHash({ version: 1, pocketName: '收藏夹', items: ['["1.0","阿米娅","ELITE1"]'], sourceHash: hash })}&52`
  const { context, page } = await newShareContext(browser, existing, url)
  try {
    await expect(page.locator('.notice')).toContainText('已合并')
    await expect(page.locator('.box-row')).toHaveCount(1)
    await expect(page.locator('.box-meta h2')).toHaveText('52.0')
    await expect.poll(() => page.evaluate(() => window.location.hash)).toBe('#52')
  } finally {
    await context.close()
  }
})

test('URL route type=numeric shows all numeric boxes', async ({ page }) => {
  await page.goto('/#type=numeric')
  await expect(page.locator('.box-row')).toHaveCount(54)
  await expect(page.locator('.catalog-status')).toContainText('54 盒')
})

test('clearing an empty query route resets the URL route', async ({ page }) => {
  await page.goto('/#q=__no_such_box_query__')
  await expect(page.locator('.box-row')).toHaveCount(0)
  await page.getByRole('button', { name: '清除当前查询' }).click()
  await expect(page.locator('.box-row')).toHaveCount(92)
  await expect.poll(() => page.evaluate(() => window.location.hash)).toBe('')
})
