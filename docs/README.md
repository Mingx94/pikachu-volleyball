# Pikachu Volleyball 文件

本文件說明目前的 Web 版本。Pikachu Volleyball 是 1997 年 Windows 遊戲的逆向工程重實作。專案使用 TypeScript，在瀏覽器中執行。

## 文件導覽

| 文件 | 用途 |
| --- | --- |
| [開發指南](./development.md) | 安裝、啟動、本機預覽、測試與建置。 |
| [架構總覽](./architecture.md) | 執行流程、模組邊界、遊戲迴圈、語系與儲存資料。 |
| [遊戲引擎分析](./engine/README.md) | 物理、玩家、碰撞、電腦 AI、雲與波浪的詳細說明。 |

## 專案功能

- 支援 1v1 與 2v2 對戰。每個玩家欄位可設定為人類或 CPU。
- 支援英文、韓文與繁體中文。網址可用 `?lang=zh` 指定繁體中文。
- 支援圖像、背景音樂、音效、速度、勝利分數與練習模式設定。
- 可將進行中的對局儲存成 `.replay.json`，再從瀏覽器儲存空間或檔案播放。
- 以 PWA 發布；正式建置會產生 service worker，讓使用者可安裝及離線使用。

## 操作方式

遊戲選單中，使用該玩家的「強力擊／確認」鍵切換人類或 CPU，並在 `START` 列開始對局。方向鍵在選單中也可移動游標。

| 玩家 | 左 | 右 | 上 | 下 | 強力擊／確認 |
| --- | --- | --- | --- | --- | --- |
| P1 | `D` | `G` | `R` | `V` | `Z` |
| P2 | `←` | `→` | `↑` | `↓` | `Enter` |
| P3（僅 2v2） | `J` | `L` | `I` | `K` | `U` |
| P4（僅 2v2） | NumPad `4` | NumPad `6` | NumPad `8` | NumPad `2` | NumPad `0` |

P1 的 `F` 是原作相容按鍵。它會同時輸入「右」和「下」。

## 快速開始

```sh
npm ci
npm run start
```

Vite 預設在 [http://localhost:8080](http://localhost:8080) 提供開發站台。完整流程請看[開發指南](./development.md)。

## 修改前先知道

- `src/resources/js/physics.ts` 的整數運算、亂數呼叫與原始函式位址註解，都是重現原作行為的重要部分。
- 2v2 使用較寬的場地及隊友碰撞規則。修改 1v1 的物理行為時，也要確認 2v2。
- 新增或修改 UI 文案時，要同步更新 `src/resources/js/i18n/translations.ts` 的 `en`、`ko` 與 `zh`。
- 修改引擎時，請更新相對應的 [引擎文件](./engine/README.md) 與測試。
