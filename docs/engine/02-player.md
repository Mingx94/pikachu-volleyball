# 02 — 玩家狀態機

> 對應原始碼：`src/resources/js/physics.ts`
> 涉及函式：`processPlayerMovementAndSetPlayerPosition`（`FUN_00401fc0`）、`processGameEndFrameFor`（`FUN_004025e0`）、`Player` 類別

每個玩家是個 64×64 的方塊（`PLAYER_LENGTH = 64`），由 7 個 state 控制動作邏輯。

## 1. State 對照表

| `state` | 名稱                                  | 對應動畫             | 可從哪些 state 進入                    |
| ------- | ------------------------------------- | -------------------- | -------------------------------------- |
| 0       | 待機（normal）                        | 慢慢搖手臂           | 1（落地）、3→4（落地）、初始化         |
| 1       | 跳躍中（jumping）                     | 跳躍 5 個 frame 循環 | 0（按上）                              |
| 2       | 空中重擊（jumping_and_power_hitting） | 殺球姿勢             | 1（按 power hit）                      |
| 3       | 撲球中（diving）                      | 飛撲動作             | 0（地面按 power hit + 方向）           |
| 4       | 倒地（lying_down_after_diving）       | 趴在地上             | 3（撲球落地）                          |
| 5       | 勝利（win）                           | 慶祝跳舞             | 0 + `isWinner === true` + `gameEnded`  |
| 6       | 失敗（lost）                          | 哭泣                 | 0 + `isWinner === false` + `gameEnded` |

State 是 `number` 而不是 enum — 這是直譯原作的記憶體佈局（`Player + 0xC0`）。

## 2. 主要欄位

```ts
class Player {
  isPlayer2: boolean         // 在右場（true）還是左場（false）
  isComputer: boolean        // 是否 AI 控制
  x, y                       // 中心座標（玩家是正方形碰撞箱，半長 32）
  yVelocity                  // y 速度（重力下每 frame +1）
  state                      // 上面那 7 種
  frameNumber                // 動畫幀 (0..4)
  divingDirection            // -1 / 0 / 1，撲球方向
  lyingDownDurationLeft      // state=4 時的剩餘 frame 數
  normalStatusArmSwingDirection  // ±1，待機動畫的擺手方向
  delayBeforeNextFrame       // 動畫節奏控制
  isCollisionWithBallHappened    // 是否在上一 frame 已經撞到球（碰撞鎖，見 03 文件）
  isWinner, gameEnded        // 結束畫面的旗標
  computerBoldness           // 電腦勇氣值，僅在 isComputer=true 時用（見 04 文件）
  computerWhereToStandBy     // 電腦的待命位置選擇（見 04 文件）
  sound: { pipikachu, pika, chu }   // 該 frame 觸發的音效旗標
}
```

每回合開始時 `initializeForNewRound()` 重設絕大多數欄位，但 **不重設** `isWinner`、`gameEnded`、`divingDirection`、`computerWhereToStandBy`、`sound` — 這些屬於跨回合狀態。

## 3. 主迴圈：`processPlayerMovementAndSetPlayerPosition`

每 frame 對每個玩家呼叫一次。流程：

```
1. 若是 AI，先讓 letComputerDecideUserInput() 改寫 userInput
2. 若 state === 4（倒地），減少 lyingDownDurationLeft，到期就回 state 0
3. 處理 x 方向移動
4. 處理 x 方向邊界（不能跨過網柱中線）
5. 處理跳躍（按上鍵且站在地上 → yVelocity=-16, state=1）
6. 處理重力（yVelocity++，落地時依 state 進入 0 或 4）
7. 處理 power hit：
   - 在 state=1 → 進 state=2（殺球）
   - 在 state=0 + 有方向 → 進 state=3（撲球）
8. 動畫 frame 推進（依 state）
9. 結束畫面動畫（gameEnded 時）
```

下面分段細看。

## 4. x 方向移動

```ts
let playerVelocityX = 0;
if (player.state < 5) {
  // state 0..4
  if (player.state < 3) {
    // state 0..2: 由 userInput 控制
    playerVelocityX = userInput.xDirection * 6;
  } else {
    // state 3: 撲球，由 divingDirection 控制
    playerVelocityX = player.divingDirection * 8;
  }
}
// state 4, 5, 6: 不能移動（速度 0）
```

**重點**：

- 待機 / 跳躍 / 殺球時水平速度是 ±6 px/frame；撲球更快，是 ±8 px/frame。
- 撲球時 `userInput.xDirection` 被忽略 — 玩家**一旦撲出去就不能轉向**。方向在進 state=3 的瞬間記到 `divingDirection`（`processPlayerMovementAndSetPlayerPosition` 的 power hit 區塊）。
- 倒地（state 4）、勝利（5）、失敗（6）速度都是 0。

## 5. x 方向邊界

每個玩家被限制在自己那一半的場地：

```ts
if (!player.isPlayer2) {
  // 玩家 1：x 限制在 [PLAYER_HALF_LENGTH, GROUND_HALF_WIDTH - PLAYER_HALF_LENGTH]
  //                = [32, 184]
} else {
  // 玩家 2：x 限制在 [GROUND_HALF_WIDTH + PLAYER_HALF_LENGTH, GROUND_WIDTH - PLAYER_HALF_LENGTH]
  //                = [248, 400]
}
```

也就是說玩家**的方塊邊緣**剛好可以貼到自己的左 / 右牆和網柱中線，但不能跨越。網柱本身寬 50（`NET_PILLAR_HALF_WIDTH * 2 = 50`），所以兩邊玩家都離不開網柱本體 — 這是設計上的禁區。

## 6. 跳躍

```ts
if (
  player.state < 3 &&
  userInput.yDirection === -1 && // 按上
  player.y === PLAYER_TOUCHING_GROUND_Y_COORD // 站在地上
) {
  player.yVelocity = -16;
  player.state = 1;
  player.frameNumber = 0;
  sounds.push({ kind: 'chu', playerSide });
}
```

跳躍是「瞬間給 -16 y 速度」，加上每 frame +1 的重力，玩家會在 2 × 16 = 32 frame 後落地（不算空氣阻力，因為沒有）。

注意條件 `player.state < 3` — 這代表 state 0（待機）、1（跳躍中）、2（空中殺球）都能觸發 `yVelocity = -16`，但只在地面成立。配合 `player.y === PLAYER_TOUCHING_GROUND_Y_COORD` 的等號（不是 `<=`），代表必須**剛好**站在地上才能跳。所以 state 1（已經在跳）配合「沒落地」的時候，這條 if 不會通過 — 不會有「空中再跳」的 bug。

## 7. 重力與落地

```ts
const futurePlayerY = player.y + player.yVelocity;
player.y = futurePlayerY;
if (futurePlayerY < PLAYER_TOUCHING_GROUND_Y_COORD) {
  player.yVelocity += 1; // 在空中，加重力
} else if (futurePlayerY > PLAYER_TOUCHING_GROUND_Y_COORD) {
  // 觸地：釘住 y、清速度、依當前 state 決定下一 state
  player.yVelocity = 0;
  player.y = PLAYER_TOUCHING_GROUND_Y_COORD;
  player.frameNumber = 0;
  if (player.state === 3) {
    // 撲球落地 → 倒地 3 frame
    player.state = 4;
    player.lyingDownDurationLeft = 3;
  } else {
    player.state = 0; // 跳躍 / 殺球落地 → 待機
  }
}
```

注意 `player.y === PLAYER_TOUCHING_GROUND_Y_COORD` 那種「剛好在地上」的情況，兩個分支都不執行（速度也不加重力）— 站著的玩家就維持站著。

## 8. Power Hit：跳躍 + 殺球 vs. 地面 + 撲球

當 `userInput.powerHit === 1`（按下 Z 或 Enter，且不是 auto-repeat 的那個 frame）：

```ts
if (player.state === 1) {
  // 在空中 → 殺球
  player.state = 2;
  player.delayBeforeNextFrame = 5;
  player.frameNumber = 0;
  sounds.push({ kind: 'pika', playerSide });
} else if (player.state === 0 && userInput.xDirection !== 0) {
  // 在地上 + 有方向 → 撲球
  player.state = 3;
  player.frameNumber = 0;
  player.divingDirection = userInput.xDirection; // 鎖定方向
  player.yVelocity = -5; // 小幅向上
  sounds.push({ kind: 'chu', playerSide });
}
```

**設計觀察**：

- 殺球（state 2）只是動畫狀態 — 真正讓球加速的計算在 `processCollisionBetweenBallAndPlayer` 看到 `playerState === 2` 時才會做（見 [03 文件](./03-collision.md)）。
- 撲球時 `yVelocity = -5` 給了一個小拋物線，讓玩家飛起來再落下。
- 地面靜止（`xDirection === 0`）按 power hit 不會撲，會被忽略。
- 空中按 power hit 不在地上，所以不會撲，但若是 state=1（跳起來）會殺球。

## 9. 動畫 frame 推進

每個 state 有不同的 frame 步進邏輯：

```ts
if (player.state === 1) {
  // 跳躍：3 個 frame 循環
  player.frameNumber = (player.frameNumber + 1) % 3;
} else if (player.state === 2) {
  // 殺球：5 個 frame，每 frame 中間延遲 5（共 5 frame 過 5 個動作）
  if (player.delayBeforeNextFrame < 1) {
    player.frameNumber += 1;
    if (player.frameNumber > 4) {
      player.frameNumber = 0;
      player.state = 1; // 動畫播完回到跳躍狀態
    }
  } else {
    player.delayBeforeNextFrame -= 1;
  }
} else if (player.state === 0) {
  // 待機：每 4 frame 換一次手臂位置（0..4 來回）
  player.delayBeforeNextFrame += 1;
  if (player.delayBeforeNextFrame > 3) {
    player.delayBeforeNextFrame = 0;
    const futureFrameNumber = player.frameNumber + player.normalStatusArmSwingDirection;
    if (futureFrameNumber < 0 || futureFrameNumber > 4) {
      player.normalStatusArmSwingDirection = -player.normalStatusArmSwingDirection;
    }
    player.frameNumber = player.frameNumber + player.normalStatusArmSwingDirection;
  }
}
```

State 3（撲球）和 4（倒地）沒有特別的 frame 推進邏輯：3 由 view 層直接讀 `divingDirection` 來決定要顯示哪一張；4 是固定一個倒地 sprite。

## 10. 結束畫面（state 5/6）

當 Controller 偵測到 `winningScore` 已達到，會把兩個玩家的 `gameEnded` 設成 `true` 並各自設 `isWinner`。下一個 frame 進到 `processPlayerMovementAndSetPlayerPosition` 的尾段：

```ts
if (player.gameEnded === true) {
  if (player.state === 0) {
    if (player.isWinner) {
      player.state = 5;
      sounds.push({ kind: 'pipikachu', playerSide }); // 「ピピカチュー」勝利音效
    } else {
      player.state = 6;
    }
    player.delayBeforeNextFrame = 0;
    player.frameNumber = 0;
  }
  processGameEndFrameFor(player); // 推 frame 0..3 後就停在 frame 3
}
```

`processGameEndFrameFor` 是 5 frame 換一次幀，但只推到 frame 3 就停 — 動畫不循環，停在最後一張。

## 11. 聲音事件旗標

`Player.sound` 是個 `{ pipikachu, pika, chu }` 物件。引擎只負責**設旗標為 true**：

- `chu`：跳躍、撲球
- `pika`：殺球
- `pipikachu`：勝利時播放一次

Controller（`pikavolley.ts:playSoundEffect()`）讀完旗標後會呼叫 `audio.sounds.*.play()` 並把旗標重設為 false。這個設計讓引擎本身不依賴音訊系統，方便回放與測試。

下一篇：[03 — 玩家-球碰撞](./03-collision.md)，看看 power hit 是怎麼把球真的加速的。
