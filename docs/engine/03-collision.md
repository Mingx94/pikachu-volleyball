# 03 — 玩家與球的碰撞

> 對應原始碼：`src/resources/js/physics.ts`
> 涉及函式：`isCollisionBetweenBallAndPlayerHappened`（`FUN_00403070`）、`processCollisionBetweenBallAndPlayer`（`FUN_004030a0`）

球與玩家的碰撞是**離散的事件**：每 frame 偵測一次，若有就修改球的速度，**不修改球的位置**。下一 frame 才會把這個新速度套用到位置上（透過 [01 — 世界與球](./01-world-and-ball.md) 的 `processCollisionBetweenBallAndWorldAndSetBallPosition`）。

## 1. 一個 frame 的順序

`physicsEngine` 內呼叫順序很關鍵：

```
Frame N 開始
├─ processCollisionBetweenBallAndWorldAndSetBallPosition(ball)
│      // 用 frame (N-1) 留下的速度更新球的位置；可能觸地 → 回 true
│
├─ for i in 0..1:
│      processPlayerMovementAndSetPlayerPosition(player[i], userInput, ...)
│      // 玩家移動。可能進入 power hit / dive 狀態
│
└─ for i in 0..1:
       isCollisionBetweenBallAndPlayerHappened(ball, player.x, player.y)
       if collided && !player.isCollisionWithBallHappened:
           processCollisionBetweenBallAndPlayer(ball, player.x, userInput, player.state)
           player.isCollisionWithBallHappened = true
       else if !collided:
           player.isCollisionWithBallHappened = false
```

也就是說**今天的位置是用昨天的速度算的，今天的速度是用今天的位置碰撞算的** — 這是常見的 explicit Euler 順序。

## 2. 碰撞偵測 — 矩形 AABB

```ts
function isCollisionBetweenBallAndPlayerHappened(ball, playerX, playerY) {
  let diff = ball.x - playerX;
  if (Math.abs(diff) <= PLAYER_HALF_LENGTH) {
    // |Δx| <= 32
    diff = ball.y - playerY;
    if (Math.abs(diff) <= PLAYER_HALF_LENGTH) {
      // |Δy| <= 32
      return true;
    }
  }
  return false;
}
```

雖然球是圓的、玩家是「皮卡丘」造型，但碰撞箱**完全是 64×64 正方形對球中心**的 AABB 判定。這是原作的偷懶（也是性能優化），所以才會有「球明明擦過皮卡丘還是被打到」的視覺感。

注意 `<=`（不是嚴格 `<`）— 球的中心剛好等於玩家邊界 32 px 處也算碰撞。

## 3. 碰撞鎖：`isCollisionWithBallHappened`

球的速度可能讓「碰撞偵測為 true」連續發生很多 frame。為了避免**同一次接觸被算成多次碰撞**（每 frame 都把球反彈一次），引擎用 `Player.isCollisionWithBallHappened` 當鎖：

```
碰撞偵測 = true
  ├─ 上一 frame 也碰過 → 不再處理（鎖住）
  └─ 上一 frame 沒碰過 → 處理 collision，並上鎖

碰撞偵測 = false → 解鎖
```

也就是說「一次擊球 = 一次 `processCollisionBetweenBallAndPlayer()` 呼叫」，而不是「碰撞偵測為 true 的每個 frame 都呼叫一次」。這個鎖在每 frame 結尾若偵測為 false 就解開，所以下一次擊球可以正確觸發。

## 4. 一般擊球（非 power hit）

```ts
function processCollisionBetweenBallAndPlayer(ball, playerX, userInput, playerState) {
  // x 速度：球與玩家中心的水平距離 / 3，方向取決於球在哪一側
  if (ball.x < playerX) {
    ball.xVelocity = -((Math.abs(ball.x - playerX) / 3) | 0);
  } else if (ball.x > playerX) {
    ball.xVelocity = (Math.abs(ball.x - playerX) / 3) | 0;
  }
  // 若 x 完全對齊，隨機 -1/0/1
  if (ball.xVelocity === 0) {
    ball.xVelocity = (rand() % 3) - 1;
  }

  // y 速度：絕對值反向，且至少 15
  const ballAbsYVelocity = Math.abs(ball.yVelocity);
  ball.yVelocity = -ballAbsYVelocity;
  if (ballAbsYVelocity < 15) {
    ball.yVelocity = -15;
  }
  // ... 接著處理 power hit（見 §5）
}
```

**直觀理解**：

- 球碰到玩家**正中央**附近 → x 速度幾乎 0，球幾乎垂直彈起。剛好在中央時，引擎偷偷加 ±1 的隨機，避免球在原地反覆掉落。
- 球碰到玩家**邊緣** → x 速度大，球往外彈得遠。最遠的情況是 |Δx| = 32（剛好在邊界 AABB 上），所以最大 |xVelocity| = 32/3 = 10。
- 不論球落下的速度多慢，反彈後最少有 |yVelocity| = 15（往上）。這保證球至少會跳到一定高度，不會在原地慢慢「死」掉。

## 5. Power Hit（殺球）

接著在同一個函式裡：

```ts
if (playerState === 2) {
  // 玩家在跳躍 + power hit 狀態
  // 強制 x 方向往「對方場地」打
  if (ball.x < GROUND_HALF_WIDTH) {
    ball.xVelocity = (Math.abs(userInput.xDirection) + 1) * 10; // → 往右打
  } else {
    ball.xVelocity = -(Math.abs(userInput.xDirection) + 1) * 10; // ← 往左打
  }
  ball.punchEffectX = ball.x;
  ball.punchEffectY = ball.y;

  // y 方向由玩家輸入決定
  ball.yVelocity = Math.abs(ball.yVelocity) * userInput.yDirection * 2;
  ball.punchEffectRadius = BALL_RADIUS;
  sounds.push({ kind: 'powerHit', x: ball.x });
  ball.isPowerHit = true;
} else {
  ball.isPowerHit = false;
}
```

`(|userInput.xDirection| + 1) * 10` 的計算很巧妙：

| `userInput.xDirection` | `abs(x) + 1` | x 速度大小 |
| ---------------------- | ------------ | ---------- |
| 0（沒按方向）          | 1            | 10         |
| ±1（按左 / 右）        | 2            | 20         |

也就是按方向鍵的殺球比沒按的殺球**快兩倍**。

`yVelocity` 公式：`|現有 yVelocity| × yDirection × 2`。如果玩家沒按 y 方向（`yDirection = 0`），結果是 0 — 球**水平射出**。

| `userInput.yDirection` | y 速度結果                             |
| ---------------------- | -------------------------------------- |
| -1（按上）             | 強制負（往上方斜射）                   |
| 0（沒按）              | 0（水平射出）                          |
| +1（按下）             | 強制正（往地面砸下去）— 這是常見的扣殺 |

注意**只有在 `playerState === 2`**（空中重擊）時才走這條路徑。地面撲球（state 3）走的是普通的 `(Δx)/3` 公式（撲球本身不算 power hit），但因為撲球時球通常已經在地附近，球的反彈方向和速度仍然由 `Δx` 決定。

## 6. `isPowerHit` 的視覺意義

碰撞函式最後會把 `ball.isPowerHit` 設成 true（殺球）或 false（普通彈）。View 層會根據這個旗標：

- 在球的位置畫紅色 punch effect 圓（`punchEffectX/Y/Radius`）
- 持續顯示「hyper ball」精靈（紫紅色閃電球）和殘影 trail，直到下次碰撞把 `isPowerHit` 重設為 false

注意這跟 [01 文件](./01-world-and-ball.md) 的 **hyper ball glitch** 不同：那個 glitch 是 `rotation = 5` 觸發 hyper sprite，但 `isPowerHit` 還是 false（沒有 trail 與紅圈）。兩者視覺類似但語義不同。

## 7. 預測：碰撞會一併刷新 `expectedLandingPointX`

```ts
calculateExpectedLandingPointXFor(ball);
```

`processCollisionBetweenBallAndPlayer` 結尾會呼叫一次 [01 文件 §8](./01-world-and-ball.md) 講的預測函式。這代表 **AI 在球被擊出的當下就知道球大概會掉哪** — 而不是每個 frame 等預測值「自然更新」。沒有這個刷新，AI 會慢一拍。

下一篇：[04 — 電腦 AI](./04-computer-ai.md)，看 AI 怎麼用這些預測值決定動作。
