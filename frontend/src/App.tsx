/**
 * §M22 Phase 3: ルーティング。
 *  - `/` → 間取り一覧プラットフォーム (Home)
 *  - `/editor/:id` → 編集画面 (Editor)
 *  - 不明な URL は Home にリダイレクト
 */
import './styles/tokens.css'
import './styles/globals.css'
import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Editor } from '@/routes/Editor'
import { Home } from '@/routes/Home'
import { ensureEquipmentMasterLoaded } from '@/store/equipmentMasterStore'

function App() {
  // §M122 v0.29: 起動時に 137 種の設備マスター JSON を fetch して store に積む
  useEffect(() => {
    void ensureEquipmentMasterLoaded()
  }, [])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/editor/:id" element={<Editor />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
