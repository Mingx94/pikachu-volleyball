# 05 — 雲與波浪

> 對應原始碼：`src/resources/js/cloud_and_wave.ts`
> 涉及函式：`Cloud` 類別、`Wave` 類別、`cloudAndWaveEngine`（`FUN_00404770`）

這個小引擎控制背景的兩個裝飾元素：天上飄的 10 朵雲，以及螢幕底部的波浪線。它**完全不影響遊戲邏輯**，但仍然是逆向工程的產物，所以保留在 Model 層而不是 View 層。

| 元素 | 數量             | 範圍                                                     |
| ---- | ---------------- | -------------------------------------------------------- |
| 雲   | 10 朵            | 整個天空 (y ∈ [0, 152])                                  |
| 波浪 | `groundWidth/16` | 螢幕底部，每 16 px 一個（1v1：432/16=27；2v2：576/16=36） |

> **per-instance 寬度**：`Cloud` / `Wave` constructor 跟 `cloudAndWaveEngine` 都吃 `groundWidth` 參數，把場地寬度從 module-level 寫死改成 per-instance。下文以 `groundWidth` 通稱（1v1=432、2v2=576），原作機器碼裡是寫死 432。

## 1. `Cloud` 類別

```ts
class Cloud {
  topLeftPointX: number; // 雲的左上角 x
  topLeftPointY: number; // 雲的左上角 y
  topLeftPointXVelocity: number; // x 方向速度（1 或 2）
  sizeDiffTurnNumber: number; // 尺寸動畫的相位 (0..10)
}
```

初始狀態（每朵雲建構時）：

```ts
this.topLeftPointX = -68 + (rand() % (432 + 68)); // x ∈ [-68, 432)，整個畫面 + 左邊 buffer
this.topLeftPointY = rand() % 152; // y ∈ [0, 152)
this.topLeftPointXVelocity = 1 + (rand() % 2); // 速度 = 1 或 2
this.sizeDiffTurnNumber = rand() % 11; // 尺寸相位 ∈ [0, 11)
```

注意 x 可以從 `-68` 開始 — 這是負座標（畫面左外），讓雲「從畫面外飄進來」的視覺更自然。

## 2. 雲的「呼吸」效果

`sizeDiff` 是一個三角波形：

```ts
get sizeDiff(): number {
  // 等價於 [0, 1, 2, 3, 4, 5, 4, 3, 2, 1, 0][this.sizeDiffTurnNumber]
  return 5 - Math.abs(this.sizeDiffTurnNumber - 5);
}
```

| `sizeDiffTurnNumber` | 0   | 1   | 2   | 3   | 4   | 5   | 6   | 7   | 8   | 9   | 10  |
| -------------------- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `sizeDiff`           | 0   | 1   | 2   | 3   | 4   | 5   | 4   | 3   | 2   | 1   | 0   |

這個值控制雲的渲染尺寸：

```ts
get spriteWidth():  number { return 48 + 2 * this.sizeDiff; }  // 48..58
get spriteHeight(): number { return 24 + 2 * this.sizeDiff; }  // 24..34
get spriteTopLeftPointX(): number { return this.topLeftPointX - this.sizeDiff; }  // 中心對齊
get spriteTopLeftPointY(): number { return this.topLeftPointY - this.sizeDiff; }
```

也就是雲在畫面上會緩慢「漲縮」— 每 frame `sizeDiffTurnNumber` 推 1，11 個 frame 一個完整週期。`spriteTopLeftPoint` 同步往左上偏移 `sizeDiff` px，保持中心點不動。

## 3. `cloudAndWaveEngine` — 主迴圈

每 frame 由 Controller（`pikavolley.ts`）透過 `view.drawCloudsAndWave()` 間接呼叫一次：

```ts
export function cloudAndWaveEngine(cloudArray: Cloud[], wave: Wave): void {
  // 移動 10 朵雲
  for (let i = 0; i < 10; i++) {
    const cloud = cloudArray[i];
    cloud.topLeftPointX += cloud.topLeftPointXVelocity;
    if (cloud.topLeftPointX > 432) {
      // 雲飄出畫面右邊 → 重生在畫面左邊外，新 y、新速度
      cloud.topLeftPointX = -68;
      cloud.topLeftPointY = rand() % 152;
      cloud.topLeftPointXVelocity = 1 + (rand() % 2);
    }
    cloud.sizeDiffTurnNumber = (cloud.sizeDiffTurnNumber + 1) % 11;
  }

  // 波浪邏輯（見 §4）
}
```

雲只往右飄，飄出去就重生。`topLeftPointXVelocity` 每次重生時重新隨機（1 或 2），所以同一朵雲每次過畫面的速度都不一樣。

## 4. `Wave` 類別與波浪邏輯

```ts
class Wave {
  verticalCoord = 0; // 波浪整體的垂直位移
  verticalCoordVelocity = 2; // 垂直位移的變化速度
  yCoords: number[] = []; // 27 個取樣點的 y 座標（畫面寬 / 16）
}
```

初始時每個 `yCoords[i] = 314`（在畫面下方 10 px 處 — 注意畫面高 304，所以 314 在下邊界外一點）。

`cloudAndWaveEngine` 對波浪做兩件事：

**(a) 整體垂直位移振盪**

```ts
wave.verticalCoord += wave.verticalCoordVelocity;
if (wave.verticalCoord > 32) {
  // 升到頂 → 反向往下
  wave.verticalCoord = 32;
  wave.verticalCoordVelocity = -1;
} else if (wave.verticalCoord < 0 && wave.verticalCoordVelocity < 0) {
  // 下降到 0 以下且還在下降 → 反彈往上 + 隨機跳到一個負值
  wave.verticalCoordVelocity = 2;
  wave.verticalCoord = -(rand() % 40);
}
```

這個邏輯看起來怪：

- 上升時速度是 +2（每 frame +2）
- 一旦升到 32 就反向，速度變成 -1（每 frame -1，下降比較慢）
- 下降到 0 以下會「跳到 -(0..39) 之間」，然後速度立刻變成 +2 重新上升

也就是波浪的整體振盪不是對稱的正弦波 — 上升快、下降慢、底部會「搶答」一下重新跳到負位置。視覺上像海浪自然不規則的拍打。

**(b) 每個取樣點加雜訊**

```ts
for (let i = 0; i < 432 / 16; i++) {
  wave.yCoords[i] = 314 - wave.verticalCoord + (rand() % 3);
}
```

每個取樣點是 `314 - verticalCoord + 隨機[0, 2]`：基準在 314（底部），減去整體位移（`verticalCoord` 越大，波浪越往上），再加 0–2 px 的雜訊讓波線看起來不那麼平。

當 `verticalCoord = 32`（最上面）時，`y ≈ 282`，波浪頂端高出基準 32 px。
當 `verticalCoord = -39`（最下面）時，`y ≈ 353`，波浪沒入螢幕下方。

## 5. 為什麼這個是 Model 而不是 View？

嚴格來說雲和波浪只影響畫面，沒有遊戲意義。但因為：

1. 它們的運動是逆向工程出來的（`FUN_00404770`），而不是現代重寫的純視覺動畫；
2. 原作就是把它放在和 player/ball 並列的 model layer。

所以本實作把它放在 `cloud_and_wave.ts`，由 `view.ts` 的 `GameView` 持有 10 朵 `Cloud` + 1 個 `Wave`，每 frame 呼叫 `cloudAndWaveEngine()` 後再讀座標渲染。

**RNG 隔離**：原作所有 `rand()` 共用同一個 LCG，所以雲/浪的隨機抽樣會干擾物理層的 PRNG 序列。本實作刻意讓 `cloud_and_wave.ts` 用獨立的 `Math.random()` 而不是共用的 `rand()`：因為 controller 的 `startReplay` 會跳過 `startOfNewGame` 那 71 個 fade-in tick（每 tick `cloudAndWaveEngine` 消耗 ~27 個 rand），如果共用 PRNG，replay 起手 AI 的 RNG 軌跡會和錄影錯位上千個 rand，整場放出來會發散。雲與浪純視覺，所以獨立 RNG 是最便宜的解。

## 6. 數字快查

| 常數                    | 值                        | 來源                            |
| ----------------------- | ------------------------- | ------------------------------- |
| 雲的數量                | 10                        | view.ts: `NUM_OF_CLOUDS`        |
| 雲尺寸週期              | 11 frame                  | `sizeDiffTurnNumber` 模數       |
| 雲基準寬高              | 48 × 24                   | `Cloud.spriteWidth/Height` 公式 |
| 雲最大尺寸              | 58 × 34（`sizeDiff = 5`） | 同上                            |
| 雲速度                  | 1 或 2 px/frame           | `topLeftPointXVelocity`         |
| 雲重生 x                | -68                       | 主迴圈                          |
| 雲 y 範圍               | [0, 152)                  | 重生公式                        |
| 波浪取樣點              | 27（432 / 16）            | 主迴圈                          |
| 波浪基準 y              | 314                       | 公式                            |
| 波浪 verticalCoord 振幅 | [-39, 32]                 | 主迴圈邏輯                      |
| 波浪每點雜訊            | [0, 2]                    | 公式                            |

回到 [README](./README.md)。
