# 01 — 世界與球

> 對應原始碼：`src/resources/js/physics.ts`
> 涉及函式：`processCollisionBetweenBallAndWorldAndSetBallPosition`（`FUN_00402dc0`）、`Ball` 類別、`calculateExpectedLandingPointXFor`（`FUN_004031b0`）

本文件描述球如何在沒有玩家干預時，與「世界」（牆、地、網柱）互動。

## 1. 座標系與場地佈局

整個場地是 432 × 304 的矩形：

```
x ────────────► 432
y                                  ┌─ y = 0   (上邊界)
│                                  │
▼                                  │
                                   │
        Pikachu1                   │       Pikachu2
        (左場)        ┌─網柱─┐      │       (右場)
                      │ 網頂 │              ←  y = 176  (NET_PILLAR_TOP_TOP)
                      │      │              ←  y = 192  (NET_PILLAR_TOP_BOTTOM)
                      │      │
        ──────────────┴──────┴──────────────  ←  y = 244  (玩家站立 y)
                                              ←  y = 252  (球觸地 y)
                                              ←  y = 304  (下邊界)
        x = 0                                       x = 432
                          x = 216 (GROUND_HALF_WIDTH，也是網柱 x)
```

注意 y 是向**下**增加的（螢幕座標），所以「天花板」是 `y = 0`、「地板」在 `y = 252`。

## 2. `Ball` 類別的欄位

```ts
class Ball {
  x, y                                    // 中心座標（整數）
  xVelocity, yVelocity                    // 每 frame 位移量
  expectedLandingPointX                   // 預測落地點（給 AI 用）
  rotation, fineRotation                  // 旋轉動畫狀態（見下文 §6）
  punchEffectX, punchEffectY, punchEffectRadius  // 觸地或被打時的紅圈特效
  previousX, previousY                    // 上一 frame 的位置（給 ball trail 特效）
  previousPreviousX, previousPreviousY    // 上上 frame 的位置
  isPowerHit                              // 是否處於 hyper 狀態（畫 hyper 球與 trail）
  sound: { powerHit, ballTouchesGround }  // 該 frame 是否觸發音效
}
```

`Ball` 的初始狀態（每回合開始時呼叫 `initializeForNewRound(isPlayer2Serve)`）：

- `x = 56`（玩家 1 發球）或 `432 - 56 = 376`（玩家 2 發球）
- `y = 0`（從天花板落下）
- `xVelocity = 0`，`yVelocity = 1`（往下，輕微加速）

## 3. 重力與速度更新

每 frame，`processCollisionBetweenBallAndWorldAndSetBallPosition(ball)` 會：

1. 把 `previous*` 往前推一格（為 ball trail 特效保留軌跡）。
2. 處理旋轉動畫（見 §6）。
3. 處理 x 方向的「世界邊界」（左牆、右牆）。
4. 處理 y 方向的「上邊界」。
5. 處理網柱碰撞（見 §5）。
6. 判斷是否觸地（見 §7）。
7. 若還沒觸地，更新位置：`ball.y += yVelocity; ball.x += xVelocity; yVelocity += 1`（重力是每 frame +1）。

注意這個函式同時做**碰撞偵測**和**位置更新**，兩件事不分開。原作就是這樣寫的。

## 4. 牆壁（左右邊界）

```ts
if (futureBallX < BALL_RADIUS || futureBallX > GROUND_WIDTH) {
  ball.xVelocity = -ball.xVelocity; // 反彈
}
```

**重要的不對稱**：左邊界是 `futureBallX < BALL_RADIUS`（即球的中心 < 20，球緣碰到牆才反彈），右邊界卻是 `futureBallX > GROUND_WIDTH`（即球的中心 > 432，球已經完全跑出去才反彈）。

如果為了左右對稱把右邊界改成 `futureBallX > GROUND_WIDTH - BALL_RADIUS`，會導致 `expectedLandingPointXWhenPowerHit` 的迴圈在某些情況下**不會終止**。這也是為什麼 `INFINITE_LOOP_LIMIT = 1000` 這個安全防線會被加進來。

> 這可能是原作作者的 bug，也可能是他**故意**為了避開無窮迴圈才這樣設定。詳見 `physics.ts` 中 `processCollisionBetweenBallAndWorldAndSetBallPosition` 的長註解。

## 5. 網柱碰撞

網柱位於 `x = 216`（`GROUND_HALF_WIDTH`），半寬 25 px，頂端介於 y = [176, 192] 之間。

```ts
if (
  Math.abs(ball.x - GROUND_HALF_WIDTH) < NET_PILLAR_HALF_WIDTH &&
  ball.y > NET_PILLAR_TOP_TOP_Y_COORD
) {
  if (ball.y <= NET_PILLAR_TOP_BOTTOM_Y_COORD) {
    // 球從網柱上方落下，撞到網柱頂面 → y 速度反向（彈起）
    if (ball.yVelocity > 0) {
      ball.yVelocity = -ball.yVelocity;
    }
  } else {
    // 球已經沉到網柱腰側 → x 速度被「推」回原本那邊
    if (ball.x < GROUND_HALF_WIDTH) {
      ball.xVelocity = -Math.abs(ball.xVelocity); // 球在左場，往左推
    } else {
      ball.xVelocity = Math.abs(ball.xVelocity); // 球在右場，往右推
    }
  }
}
```

直觀理解：網柱的**上半部**像個橫向的天花板（撞到反彈向上）；**下半部**像個垂直的牆（會把球橫向推回原本進入的那一側）。這個分法讓「殺球碰網彈回」的物理感受變得自然。

## 6. 旋轉動畫與 Hyper Ball Glitch

球的旋轉幀由 `fineRotation` 與 `rotation` 控制：

```ts
// 每 frame，fineRotation 會根據 xVelocity / 2 增減
let futureFineRotation = ball.fineRotation + ((ball.xVelocity / 2) | 0);
if (futureFineRotation < 0) futureFineRotation += 50;
else if (futureFineRotation > 50) futureFineRotation += -50;
ball.fineRotation = futureFineRotation;
ball.rotation = (ball.fineRotation / 10) | 0; // 0..5
```

`rotation` 是個 0–4 的索引（球的 5 個旋轉幀），但 `(50 / 10) | 0 === 5` 卻會選到第 6 個 sprite，那是 **hyper ball**（紫紅色閃電）。

**Hyper ball glitch** 的觸發條件：當 `futureFineRotation` 剛好等於 50 時，上面兩個分支都不會執行（因為條件是嚴格 `<` 與 `>`），於是 `fineRotation` 留在 50，`rotation` 變成 5。

更糟的是：

- 在每回合開始時，`xVelocity` 被重設為 0，但 `fineRotation` 不會重設。
- 如果上一回合最後一刻 `fineRotation` 剛好停在 50，新回合開始後球會**持續顯示成 hyper 球**直到下一次碰撞改變 `fineRotation`。

這個行為是原作就有的 glitch（不是 bug 實作），所以本專案保留。

## 7. 觸地

```ts
const futureBallY = ball.y + ball.yVelocity;
if (futureBallY > BALL_TOUCHING_GROUND_Y_COORD) {
  // y > 252
  sounds.push({ kind: 'ballTouchesGround', x: ball.x });
  ball.yVelocity = -ball.yVelocity; // 反彈（雖然之後不會再 tick 球，但給視覺一個收尾）
  ball.punchEffectX = ball.x;
  ball.y = BALL_TOUCHING_GROUND_Y_COORD; // 釘在地面
  ball.punchEffectRadius = BALL_RADIUS;
  ball.punchEffectY = BALL_TOUCHING_GROUND_Y_COORD + BALL_RADIUS;
  return true; // → Controller 拿到 isBallTouchingGround = true
}
```

觸地後，函式提前 `return true`，引擎這個 frame 就不再更新球的位置。Controller 看到 `true` 就：

- 加分給對方
- 進入慢動作（`SLOW_MOTION_FRAMES_NUM = 6` 個 frame，以 `slowMotionFPS = 5` 播放）
- 慢動作結束後 fade out 回合

球觸地的同時，紅色「punch effect」圓圈會從球落地點向下放射 — 這也是 view 層讀 `punchEffect*` 來畫的。

## 8. 預測落地點 — `calculateExpectedLandingPointXFor`

這個函式不會改動真實球，而是**複製**一份 `copyBall` 跑一個無玩家干預的預測：每 frame 模擬重力與牆 / 網碰撞，直到 `copyBall.y > BALL_TOUCHING_GROUND_Y_COORD` 或迴圈跑超過 `INFINITE_LOOP_LIMIT = 1000` 次（原作沒有這個上限）。最後把 `copyBall.x` 寫回 `ball.expectedLandingPointX`。

這個預測值是**給電腦 AI 用的**：AI 知道球大概會掉在哪，才能決定該往哪邊跑。詳見 [04 — 電腦 AI](./04-computer-ai.md)。

預測迴圈裡有一個與真實 `processCollisionBetweenBallAndWorldAndSetBallPosition` 不同的小差異：網柱頂端的判定用 `<` 而非 `<=`：

```ts
// 在預測函式裡
if (copyBall.y < NET_PILLAR_TOP_BOTTOM_Y_COORD) { ... }

// 在真實 frame 裡
if (ball.y <= NET_PILLAR_TOP_BOTTOM_Y_COORD) { ... }
```

原始碼註解標註了：「It maybe should be <= NET_PILLAR_TOP_BOTTOM_Y_COORD as in FUN_00402dc0, is it the original game author's mistake?」— 也就是說這可能是原作的小 bug，但沒人改。

下一篇：[02 — 玩家狀態機](./02-player.md)。
