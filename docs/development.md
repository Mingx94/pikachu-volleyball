# 開發指南

本指南用於本機開發 Pikachu Volleyball。

## 系統需求

- Node.js `^20.19.0` 或 `>=22.12.0`。此範圍符合 Vite 8 的需求。
- npm。Node.js 安裝程式會一併提供 npm。
- 有 WebGL 的現代瀏覽器，用於執行 PixiJS 遊戲畫面。

## 安裝與啟動

在專案根目錄執行：

```sh
npm ci
npm run start
```

開發伺服器預設使用 `http://localhost:8080`。修改來源檔案後，Vite 會重新載入頁面。

若要測試繁體中文介面，開啟 `http://localhost:8080/?lang=zh`。語系選擇順序是網址參數、瀏覽器儲存空間、瀏覽器語言、英文。

## 常用命令

| 命令 | 用途 |
| --- | --- |
| `npm run start` | 啟動 Vite 開發伺服器。 |
| `npm run typecheck` | 執行 TypeScript 型別檢查。 |
| `npm run lint` | 執行 oxlint。 |
| `npm test` | 執行 Vitest 的物理與重播測試。 |
| `npm run format:check` | 檢查來源檔與 Vite 設定的格式。 |
| `npm run format` | 寫入格式化結果。只在需要格式化來源檔時執行。 |
| `npm run build` | 產生正式版本到 `dist/`。 |
| `npm run preview` | 預覽已建置的 `dist/`。 |

建置前至少執行：

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

`dist/` 是建置產物，已在 `.gitignore` 中排除。

## 手動驗證

自動測試無法驗證 PixiJS 畫面、鍵盤焦點與 PWA 行為。依改動範圍檢查下列項目：

1. 首頁可完成資源載入，並能進入選單。
2. 1v1 的 P1、P2 操作與 CPU 欄位可正常開始對局。
3. 2v2 模式可切換四個欄位、調整畫布寬度，並正常結束一回合。
4. 選項變更後重新整理頁面，確認需要保存的設定仍有效。
5. 儲存重播後，可從「觀看最近重播」及檔案載入兩種方式播放。
6. 正式建置後，用 `npm run preview` 檢查 service worker 更新提示與離線資源。

## 改動位置

| 需求 | 主要位置 |
| --- | --- |
| 遊戲物理、玩家與球 | `src/resources/js/physics.ts` |
| 電腦控制 | `src/resources/js/ai.ts` |
| 遊戲流程與模式選單 | `src/resources/js/pikavolley.ts` |
| PixiJS 畫面 | `src/resources/js/view.ts` |
| 頁面按鈕、選項與重播檔 | `src/resources/js/ui.ts`、`src/resources/js/replay.ts` |
| 鍵盤控制 | `src/resources/js/keyboard.ts` |
| 語系 | `src/resources/js/i18n/` |
| 圖片與音效 | `public/resources/assets/` |

修改物理引擎前，先閱讀[架構總覽](./architecture.md)與[遊戲引擎分析](./engine/README.md)。
