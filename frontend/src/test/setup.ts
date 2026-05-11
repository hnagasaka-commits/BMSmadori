import '@testing-library/jest-dom/vitest'

// jsdom 環境では crypto.randomUUID は標準で利用可能(Node 19+ / jsdom 22+)。
// 互換性問題が出たら個別にここでパッチを当てる。
