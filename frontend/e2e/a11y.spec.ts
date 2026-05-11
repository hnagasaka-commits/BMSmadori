/**
 * TC-T §12.1 アクセシビリティ。
 *
 * @axe-core/playwright で主要画面をスキャンする。
 *
 * Phase 1 では critical 違反だけを厳しくチェックする。
 * serious (主にカラーコントラスト) は §14.3 デザイントークンの全面見直しが必要で、
 * Phase 2 「ミニマル UI 演出仕上げ」で対応する。Phase 1 では warning として残す。
 *
 * Canvas (Konva) 内の描画要素は axe スキャン対象外 (HTML 要素ではない) なので除外。
 */
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

async function openBlankEditor(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByTestId('home-new-plan').click()
  await page.getByTestId('new-plan-blank').click()
  await page.getByTestId('editor').waitFor()
}

test('a11y: エディタ画面に critical 違反がない', async ({ page }) => {
  await openBlankEditor(page)

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .exclude('[data-testid="canvas-2d"]')
    // color-contrast (serious) は §14.3 全面見直しで Phase 2 対応
    .disableRules(['color-contrast'])
    .analyze()

  const critical = results.violations.filter((v) => v.impact === 'critical')
  if (critical.length > 0) {
    console.log('Critical a11y violations:', JSON.stringify(critical, null, 2))
  }
  expect(critical).toEqual([])
})

test('a11y: テンプレ選択モーダルに critical 違反がない', async ({ page }) => {
  await openBlankEditor(page)
  await page.getByTestId('open-template').click()
  await page.getByTestId('template-picker').waitFor()

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .include('[data-testid="template-picker"]')
    .disableRules(['color-contrast'])
    .analyze()

  const critical = results.violations.filter((v) => v.impact === 'critical')
  if (critical.length > 0) console.log(JSON.stringify(critical, null, 2))
  expect(critical).toEqual([])
})
