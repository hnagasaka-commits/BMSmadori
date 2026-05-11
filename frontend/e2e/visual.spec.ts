/**
 * TC-V §12.1 視覚回帰 (Phase 1 ベースライン)。
 *
 * Playwright の `toHaveScreenshot` で主要画面の見た目を固定する。
 *
 * §M22 以降は Home が起点なので、最初に Home を撮ってから新規 → エディタ → テンプレへ遷移する。
 *
 * ベースラインは `npx playwright test --update-snapshots` で初回作成。
 * Konva canvas はピクセル単位で揺らぐので `maxDiffPixelRatio` を緩めに設定。
 */
import { expect, test, type Page } from '@playwright/test'

test.use({ viewport: { width: 1280, height: 800 } })

async function openBlankEditor(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByTestId('home-new-plan').click()
  await page.getByTestId('new-plan-blank').click()
  await page.getByTestId('editor').waitFor()
}

test('visual: エディタ初期状態', async ({ page }) => {
  await openBlankEditor(page)
  // Konva の初回描画とコンパス SVG が安定するまで待つ
  await page.waitForTimeout(200)
  await expect(page).toHaveScreenshot('editor-initial.png', {
    maxDiffPixelRatio: 0.02,
    fullPage: false,
  })
})

test('visual: 平屋 1LDK テンプレロード後', async ({ page }) => {
  await openBlankEditor(page)
  await page.getByTestId('open-template').click()
  await page.getByTestId('template-house-flat-1ldk-20').click()
  await page.waitForTimeout(400) // compliance debounce
  await expect(page).toHaveScreenshot('editor-template-1ldk.png', {
    maxDiffPixelRatio: 0.02,
    fullPage: false,
  })
})
