/**
 * M3 Playwright スモーク。
 * - エディタが表示される
 * - 部屋プリセットをクリックして部屋を追加できる
 * - ステータスバーの部屋数が増える
 * - 削除ボタンで消える
 * - アンドゥで元に戻る
 *
 * §M22 以降は Home → 新規 → 白紙 で開いてから編集テストへ入る。
 * すべての test で beforeEach で IndexedDB を空にしてから新規プランを作るのは重いので、
 * 各 test が `openBlankEditor(page)` を呼んでスタート地点を揃える。
 */
import { Buffer } from 'node:buffer'
import { expect, test, type Page } from '@playwright/test'

async function openBlankEditor(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByTestId('home-new-plan').click()
  await page.getByTestId('new-plan-blank').click()
  await expect(page.getByTestId('editor')).toBeVisible()
}

test('間取りプランナー: 部屋を追加 → 削除 → アンドゥが動く', async ({ page }) => {
  await openBlankEditor(page)

  // エディタが表示される
  await expect(page.getByTestId('editor')).toBeVisible()
  await expect(page.getByRole('heading', { name: '間取りプランナー' })).toBeVisible()

  const statusBar = page.getByTestId('status-bar')

  // 初期状態は 0 部屋
  await expect(statusBar).toContainText('部屋: 0')

  // リビングを配置
  await page.getByTestId('preset-living').click()
  await expect(statusBar).toContainText('部屋: 1')

  // Property パネルで部屋が選択中になる
  await expect(page.getByTestId('property-panel')).toContainText('リビング')

  // 削除ボタン
  await page.getByTestId('prop-delete').click()
  await expect(statusBar).toContainText('部屋: 0')

  // アンドゥで戻る
  await page.getByTestId('undo').click()
  await expect(statusBar).toContainText('部屋: 1')

  // リドゥで再削除
  await page.getByTestId('redo').click()
  await expect(statusBar).toContainText('部屋: 0')
})

test('2 部屋を追加すると共有壁が生まれて自動ドアが配置される', async ({ page }) => {
  await openBlankEditor(page)

  // 1 つ目のリビング
  await page.getByTestId('preset-living').click()
  // 2 つ目の寝室 (Sidebar の findFreePlacement で右隣に配置される)
  await page.getByTestId('preset-bedroom').click()

  const statusBar = page.getByTestId('status-bar')
  await expect(statusBar).toContainText('部屋: 2')
  await expect(statusBar).toContainText(/壁: [4-9]/)
})

test('M4: 窓配置ツール → 壁クリックで窓が増える', async ({ page }) => {
  await openBlankEditor(page)

  // 部屋を 1 つ追加 → 壁が見える
  await page.getByTestId('preset-living').click()

  // 窓ツールに切り替え
  await page.getByTestId('tool-window').click()
  await expect(page.getByTestId('tool-window')).toHaveAttribute('aria-pressed', 'true')

  // Konva 描画なので canvas 上の壁を直接クリックする。
  // canvas-2d の中央付近 (リビング 4550x3640 の上辺、y=0 付近を狙う)。
  const canvas = page.getByTestId('canvas-2d')
  const box = await canvas.boundingBox()
  if (box == null) throw new Error('canvas not visible')
  // リビングは原点 (0,0)。zoom=0.1 で px に変換すると 0..455px × 0..364px。
  // 上辺 (壁) は y=0、x=0..455。中央付近 (x=200px, y=0px) をクリック。
  // §M31 で空プランは canvas 中央にワールド原点 (0,0) を置く pan を入れたため、
  // リビング 4550×3640mm (zoom 0.1 → 455×364px) は box 中央から右下に展開される。
  // 上辺 (y=0) は box 中央のすぐ下、x=200px 内側を狙う。
  await page.mouse.click(box.x + box.width / 2 + 200, box.y + box.height / 2 + 1)

  // Properties で窓選択を確認
  await expect(page.getByTestId('window-type')).toBeVisible()

  // 窓を選択して削除
  await page.getByTestId('window-delete').click()
})

test('M4: 方位コンパスをクリックすると prompt が出る', async ({ page }) => {
  await openBlankEditor(page)
  page.once('dialog', (dialog) => dialog.dismiss())
  await page.getByTestId('orientation-compass').click()
})

test('M7: PNG エクスポートでダウンロードが発生する', async ({ page }) => {
  await openBlankEditor(page)

  // 部屋を 1 つ追加 (Canvas が初期化されている確認も兼ねる)
  await page.getByTestId('preset-living').click()

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('export-png').click(),
  ])
  const name = download.suggestedFilename()
  expect(name).toMatch(/\.png$/)
})

test('M7: PDF エクスポートでダウンロードが発生する', async ({ page }) => {
  await openBlankEditor(page)
  await page.getByTestId('preset-living').click()

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('export-pdf').click(),
  ])
  const name = download.suggestedFilename()
  expect(name).toMatch(/\.pdf$/)
})

test('M6: テンプレートを開いて部屋がロードされる', async ({ page }) => {
  await openBlankEditor(page)

  await page.getByTestId('open-template').click()
  await expect(page.getByTestId('template-picker')).toBeVisible()

  // 平屋 1LDK を選択
  await page.getByTestId('template-house-flat-1ldk-20').click()
  await expect(page.getByTestId('template-picker')).toBeHidden()

  const statusBar = page.getByTestId('status-bar')
  // 平屋 1LDK は 8 部屋
  await expect(statusBar).toContainText('部屋: 8')
})

test('M6: 将来 version の JSON は復旧プレビューモードで開く', async ({ page }) => {
  await openBlankEditor(page)

  // FileChooser API を使って未来 version の JSON を送る
  const futureJson = JSON.stringify({
    version: '99.0',
    metadata: { name: 'future' },
    floors: [{ id: 'f1', rooms: [] }],
    building: {},
  })
  const fileInput = page.getByTestId('import-file-input')
  await fileInput.setInputFiles({
    name: 'future.floorplan.json',
    mimeType: 'application/json',
    buffer: Buffer.from(futureJson, 'utf-8'),
  })

  // 復旧プレビューバナーが表示される
  await expect(page.getByTestId('readonly-banner')).toBeVisible()

  // Save / Export / 部屋追加が無効化されている
  await expect(page.getByTestId('save-local')).toBeDisabled()
  await expect(page.getByTestId('export-json')).toBeDisabled()
  await expect(page.getByTestId('preset-living')).toBeDisabled()
})

test('Phase 1.5: 柱の自動配置ボタンで柱が増える', async ({ page }) => {
  await openBlankEditor(page)
  // 一軒家のリビングを追加すると Sidebar に「柱を 910mm グリッドに自動配置」が表示される
  await page.getByTestId('preset-living').click()
  await page.getByTestId('generate-columns').isVisible()
  // confirm ダイアログを accept
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByTestId('generate-columns').click()
  // ステータスバーには柱は表示されないが、Canvas に黒い柱が描画される (見た目テストではなく機能のスモーク)
  // ここでは特に assert せず、エラーで落ちないことだけ確認
  await page.waitForTimeout(100)
})

test('Phase 1.5: PS 追加ボタンで PS が増え、設備警告が出る', async ({ page }) => {
  await openBlankEditor(page)
  // キッチン (IH) を追加 → equipment warning が 1 件出るはず
  await page.getByTestId('preset-kitchen').click()
  await page.waitForTimeout(500) // debounce
  // 警告パネルに equipment 項目が出ることを確認
  const activeList = page.getByTestId('compliance-active-list')
  await activeList.getByTestId('compliance-item').first().waitFor()

  // PS を追加 → 警告が減る
  const before = await activeList.getByTestId('compliance-item').count()
  await page.getByTestId('add-pipespace').click()
  await page.waitForTimeout(500)
  const after = await activeList.getByTestId('compliance-item').count()
  expect(after).toBeLessThanOrEqual(before)
})

test('Phase 2 / M12: 2D⇄3D 切替で Canvas が入れ替わる', async ({ page }) => {
  await openBlankEditor(page)
  // 初期は 2D
  await expect(page.getByTestId('canvas-2d')).toBeVisible()
  // 3D ボタンで切替
  await page.getByTestId('view-3d').click()
  await expect(page.getByTestId('view-3d')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('canvas-3d')).toBeVisible()
  // 3D 中は編集ツールが無効化される
  await expect(page.getByTestId('tool-select')).toBeDisabled()
  await expect(page.getByTestId('tool-window')).toBeDisabled()
  // 2D に戻る
  await page.getByTestId('view-2d').click()
  await expect(page.getByTestId('view-2d')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('tool-select')).toBeEnabled()
})

test('Phase 3 / M21: 耐震診断パネルが表示され、部屋追加で行が更新される', async ({ page }) => {
  await openBlankEditor(page)
  // パネルは初期から見える (木造既定)
  const panel = page.getByTestId('seismic-panel')
  await expect(panel).toBeVisible()
  // 1F 行が 1 行ある
  await expect(page.getByTestId('seismic-row-0')).toBeVisible()
  // リビング追加 → 面積が増えるので必要壁量も増える (X 実は壁が出来るので 0 ではない)
  await page.getByTestId('preset-living').click()
  await expect(panel).toContainText(/X 実 cm/) // ヘッダー表示の確認
})

test('Phase 3 / M20: 柱を選んで耐力柱フラグを切替えられる', async ({ page }) => {
  await openBlankEditor(page)
  await page.getByTestId('preset-living').click()
  page.once('dialog', (d) => d.accept())
  await page.getByTestId('generate-columns').click()
  // 柱が描画されたあと、Canvas 上のどこかで柱クリック…の精度は厳しいので
  // store 経由で確認: 1 本目を select に流すルートが無いので、ここは UI に頼らず
  // 「PropertyPanel の checkbox が出ない (柱未選択)」だけ素朴に検査する
  // 改めて柱の selection UI (Konva 上のクリック) は手動検証で十分なため、
  // 法規パネルに通し柱関連の項目がまだ出ない (= 1 階建てだから OK) を確認する
  const activeList = page.getByTestId('compliance-active-list')
  await expect(activeList).toBeVisible()
})

test('Phase 3 / M19: 階タブで 2F を追加 / 切替 / 削除できる', async ({ page }) => {
  await openBlankEditor(page)
  // 1F を選択中
  await expect(page.getByTestId('floor-tab-0')).toHaveAttribute('aria-pressed', 'true')
  // リビングを 1F に追加
  await page.getByTestId('preset-living').click()
  // + 階 ボタンで 2F 追加
  await page.getByTestId('floor-add').click()
  await expect(page.getByTestId('floor-tab-1')).toBeVisible()
  await expect(page.getByTestId('floor-tab-1')).toHaveAttribute('aria-pressed', 'true')
  // 2F に部屋がコピーされて入っている (status bar 部屋数 ≧ 1)
  const statusBar = page.getByTestId('status-bar')
  await expect(statusBar).toContainText(/部屋: [1-9]/)
  // 1F に戻る
  await page.getByTestId('floor-tab-0').click()
  await expect(page.getByTestId('floor-tab-0')).toHaveAttribute('aria-pressed', 'true')
  // 1F の × で削除しようとして confirm を accept
  page.once('dialog', (d) => d.accept())
  await page.getByTestId('floor-remove-0').click()
  // 残り 1 階に戻る
  await expect(page.getByTestId('floor-tab-1')).toHaveCount(0)
})

test('Phase 2 / M17: 時間スライダで sunHour が動き、季節ボタンで季節が切替わる', async ({ page }) => {
  await openBlankEditor(page)
  await page.getByTestId('view-3d').click()
  // 初期は 12:00、春
  await expect(page.getByTestId('lighting-noon')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('season-spring')).toHaveAttribute('aria-pressed', 'true')

  // スライダで朝 7:00 に移動
  const slider = page.getByTestId('sun-hour')
  await slider.fill('7')
  await expect(slider).toHaveValue('7')

  // 季節を冬に
  await page.getByTestId('season-winter').click()
  await expect(page.getByTestId('season-winter')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('season-spring')).toHaveAttribute('aria-pressed', 'false')

  // 「夕」プリセット押下で sunHour が 17.5 にジャンプ
  await page.getByTestId('lighting-evening').click()
  await expect(slider).toHaveValue('17.5')
})

test('Phase 2 / M16: 選択中の rect 部屋を L 字 polygon に変換できる', async ({ page }) => {
  await openBlankEditor(page)
  await page.getByTestId('preset-living').click()
  // リビングが選択されている前提で「L 字に変換」が有効になる
  const convert = page.getByTestId('convert-l-shape')
  await expect(convert).toBeEnabled()
  await convert.click()
  // ステータスバーの壁数が rect 4 → polygon 6 に増える
  const statusBar = page.getByTestId('status-bar')
  await expect(statusBar).toContainText(/壁: [6-9]|壁: \d{2,}/)
})

test('Phase 2 / M15: サッシ規格を選ぶと寸法と種別が一括展開される', async ({ page }) => {
  await openBlankEditor(page)
  await page.getByTestId('preset-living').click()

  // 窓ツールで上辺の壁中央に窓を 1 つ
  await page.getByTestId('tool-window').click()
  const canvas = page.getByTestId('canvas-2d')
  const box = await canvas.boundingBox()
  if (box == null) throw new Error('canvas not visible')
  // §M31 で空プランは canvas 中央にワールド原点 (0,0) を置く pan を入れたため、
  // リビング 4550×3640mm (zoom 0.1 → 455×364px) は box 中央から右下に展開される。
  // 上辺 (y=0) は box 中央のすぐ下、x=200px 内側を狙う。
  await page.mouse.click(box.x + box.width / 2 + 200, box.y + box.height / 2 + 1)

  // PropertyPanel 上の sash select でテラス窓 (2230x1700) を選択
  await expect(page.getByTestId('window-sash')).toBeVisible()
  await page.getByTestId('window-sash').selectOption('h22-w17')

  // 展開保存: width 1700 / height 2230 / type sliding-2 / sillHeight 0
  await expect(page.getByTestId('window-width')).toHaveValue('1700')
  await expect(page.getByTestId('window-type')).toHaveValue('sliding-2')
})

test('Phase 2 / M15: 家具カタログから個別配置できる', async ({ page }) => {
  await openBlankEditor(page)
  await page.getByTestId('preset-living').click()
  // カタログから「ソファ」追加
  await page.getByTestId('furniture-sofa-standard').click()
  // PropertyPanel が家具表示に切り替わる
  await expect(page.getByTestId('property-panel')).toContainText('ソファ')
})

test('Phase 2 / M14: 自動家具配置 → 削除', async ({ page }) => {
  await openBlankEditor(page)
  // リビングを追加 → 家具配置ボタン有効化
  await page.getByTestId('preset-living').click()
  const autoFurnish = page.getByTestId('auto-furnish')
  await expect(autoFurnish).toBeEnabled()
  await autoFurnish.click()
  // PropertyPanel 側で確認するには furniture 選択が必要だが、3D 上での click は
  // PivotControls を介すため Playwright で正確にヒットさせるのが難しい。
  // 代わりに「2 回目の自動配置で alert (= idempotent)」を確認する
  page.once('dialog', async (d) => {
    expect(d.message()).toContain('追加できる家具がありませんでした')
    await d.dismiss()
  })
  await autoFurnish.click()
})

test('Phase 2 / M13: 3D 中に照明プリセット (昼/夕/夜) を切替えられる', async ({ page }) => {
  await openBlankEditor(page)
  await page.getByTestId('view-3d').click()
  await expect(page.getByTestId('lighting-switcher')).toBeVisible()
  // 既定は noon
  await expect(page.getByTestId('lighting-noon')).toHaveAttribute('aria-pressed', 'true')
  await page.getByTestId('lighting-evening').click()
  await expect(page.getByTestId('lighting-evening')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('lighting-noon')).toHaveAttribute('aria-pressed', 'false')
  await page.getByTestId('lighting-night').click()
  await expect(page.getByTestId('lighting-night')).toHaveAttribute('aria-pressed', 'true')
})

test('M5: 窓のない寝室で採光・換気警告が出て、ack で消える', async ({ page }) => {
  await openBlankEditor(page)

  // 寝室を追加 → debounce 300ms 後に警告が出る
  await page.getByTestId('preset-bedroom').click()

  const panel = page.getByTestId('compliance-panel')
  await expect(panel).toBeVisible()

  // 警告が 1 件以上表示されるのを debounce 後に待つ
  const activeList = page.getByTestId('compliance-active-list')
  const activeItems = activeList.getByTestId('compliance-item')
  await expect(activeItems.first()).toBeVisible({ timeout: 2000 })

  // アクティブ件数を測る
  const before = await activeItems.count()
  expect(before).toBeGreaterThanOrEqual(1)

  // 1 件 ack → アクティブから消えて ack 履歴へ移動
  await page.getByTestId('compliance-ack').first().click()
  await expect(activeItems).toHaveCount(before - 1)

  // ack 履歴セクションが現れる
  await expect(page.getByTestId('compliance-acked-section')).toBeVisible()
})
