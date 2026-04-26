# 04 — 電腦 AI

> 對應原始碼：`src/resources/js/ai.ts`
> 涉及函式：`letComputerDecideUserInput`（`FUN_00402360`）、`decideWhetherInputPowerHit`（`FUN_00402630`）、`expectedLandingPointXWhenPowerHit`（`FUN_00402870`）

> AI 過去住在 `physics.ts` 內，但邏輯上是 controller-layer 的決策（決定一個 input 餵進 physics engine），所以拆成獨立檔案。呼叫點仍在 `physics.ts:processPlayerMovementAndSetPlayerPosition` 開頭，相對 `calculateExpectedLandingPointXFor` 的時序與原作完全一致。

電腦 AI 的設計是「**讓 AI 假裝它是個人類玩家**」 — 它不直接修改 `Player.x` / `Ball.xVelocity`，而是改寫 `userInput.xDirection` / `yDirection` / `powerHit` 三個值，然後讓 `processPlayerMovementAndSetPlayerPosition` 像處理人類輸入一樣處理它。

這個設計帶來幾個好處：

- AI 跟人類一樣受 `±6` 移動速度、地面才能跳、撲球後鎖定方向等限制 — 它不能作弊。
- 同一份 `processPlayerMovementAndSetPlayerPosition` 處理兩種來源，不需要分支。
- AI 的所有決策都集中在一個函式裡，容易調整難度。

## 1. 觸發點

`processPlayerMovementAndSetPlayerPosition` 開頭：

```ts
if (player.isComputer === true) {
  letComputerDecideUserInput(player, ball, theOtherPlayer, userInput);
}
```

`letComputerDecideUserInput` 把 `userInput` 三個欄位**全部清零**，然後依當前情境填回去：

```ts
userInput.xDirection = 0;
userInput.yDirection = 0;
userInput.powerHit = 0;
// ...決策邏輯...
```

> **2v2 注意**：`theOtherPlayer` 由 caller (`physics.ts:findNearestOpponent`) 算出，規則是「對隊（`isPlayer2` 與自己相反）中 `|p.x - ball.x|` 最小的那位」。1v1 對隊只有一位，自然退化成原作的固定對手，所以本檔接下來的所有公式（含 `decideWhetherInputPowerHit` 用來避開對手的 `Math.abs(expectedLandingPointX - theOtherPlayer.x) > PLAYER_LENGTH` 那條）在 1v1 完全等價於原作；2v2 則讓每位 AI 自然針對「最可能擊球的對手」做 power-hit 規避。AI 函式本體完全沒改，只是 caller 餵的 `theOtherPlayer` 改了選法。同隊 AI 之間沒有額外協調 — 球權自然由「先到位的人先擊」決定。

## 2. 勇氣值 `computerBoldness`

這是 AI 的「難度旋鈕」，每回合開始時用 `rand() % 5` 隨機取 `[0, 4]` 的整數。值越大，電腦越大膽。它影響三個地方：

| 用法                   | 條件                                                                 | 值越大的效果                         |
| ---------------------- | -------------------------------------------------------------------- | ------------------------------------ |
| 判斷球是否「逛去對面」 | `Math.abs(ball.xVelocity) < computerBoldness + 5`                    | 更容易判定球是對面的問題，自己回中位 |
| 判斷該不該跑           | `Math.abs(VELP - player.x) > computerBoldness + 8`                   | 更早決定「停在原地」                 |
| 跳躍接球的時機         | `ball.y < 10 * computerBoldness + 84`                                | 跳得更早（願意賭遠球）               |
| 撲球門檻               | `Math.abs(ball.x - player.x) > computerBoldness * 5 + PLAYER_LENGTH` | 撲球距離可以更遠                     |

每回合 boldness 都會重新擲，所以 AI **每回合風格略有不同** — 有些回合很主動，有些保守。這個設計避免了固定難度造成的可預測性。

> 註：「VELP」是後文 `virtualExpectedLandingPointX` 的縮寫，見 §3。

## 3. 落地點與「虛擬落地點」

球的 `expectedLandingPointX` 由引擎每 frame 更新（見 [01 文件 §8](./01-world-and-ball.md)）。AI 不直接用它，而是套一層「**虛擬**落地點」：

```ts
let virtualExpectedLandingPointX = ball.expectedLandingPointX;

if (Math.abs(ball.x - player.x) > 100 && Math.abs(ball.xVelocity) < player.computerBoldness + 5) {
  // 球在遠處 + 速度不快 → 認為「球是對面的事」
  const leftBoundary = Number(player.isPlayer2) * GROUND_HALF_WIDTH;
  // 對玩家1：leftBoundary = 0;     對玩家2：leftBoundary = 216
  if (
    (ball.expectedLandingPointX <= leftBoundary ||
      ball.expectedLandingPointX >= Number(player.isPlayer2) * GROUND_WIDTH + GROUND_HALF_WIDTH) &&
    player.computerWhereToStandBy === 0
  ) {
    // 預測球確實會掉到對方場地，且 AI 偏好「中位待命」
    // → 把虛擬落地點改成自己場地的「中央」
    virtualExpectedLandingPointX = leftBoundary + ((GROUND_HALF_WIDTH / 2) | 0);
    // 玩家1：→ 108（左場中央）
    // 玩家2：→ 324（右場中央）
  }
}
```

也就是說 AI 不會盯著球「跟它一起飄到對面」 — 它會選擇「**回中位**」或「**靠網**」（由 `computerWhereToStandBy` 控制，見 §4）。

## 4. 待命位置：`computerWhereToStandBy`

當 AI 不需要追球時（虛擬落地點離自己很近），會偶爾擲骰決定要待在中位還是貼網：

```ts
if (Math.abs(virtualExpectedLandingPointX - player.x) > player.computerBoldness + 8) {
  // 還要往落地點移動 → 設定 xDirection
  userInput.xDirection = player.x < virtualExpectedLandingPointX ? 1 : -1;
} else if (rand() % 20 === 0) {
  // 已經到位 + 5% 機率：重新擲一次待命模式
  player.computerWhereToStandBy = rand() % 2; // 0 = 中位，1 = 靠網
}
```

`computerWhereToStandBy` 跨回合保留（不會被 `initializeForNewRound` 清掉），所以 AI 的「站姿偏好」會緩慢漂移 — 看起來像有思考。

## 5. State 0（待機）：跳躍接球與撲球

當 AI 玩家在 state 0 時，會評估兩件事：

**(a) 跳起來接從上方來的球**

```ts
if (
  Math.abs(ball.xVelocity) < player.computerBoldness + 3 &&
  Math.abs(ball.x - player.x) < PLAYER_HALF_LENGTH && // 球在玩家正上方
  ball.y > -36 && // 球還在合理範圍內
  ball.y < 10 * player.computerBoldness + 84 && // 球夠近才跳（boldness=4 時 124，boldness=0 時 84）
  ball.yVelocity > 0 // 球在掉下來
) {
  userInput.yDirection = -1; // 按上 → 跳
}
```

**(b) 撲球（預判式遠球救援）**

```ts
const leftBoundary = Number(player.isPlayer2) * GROUND_HALF_WIDTH;
const rightBoundary = (Number(player.isPlayer2) + 1) * GROUND_HALF_WIDTH;
if (
  ball.expectedLandingPointX > leftBoundary &&
  ball.expectedLandingPointX < rightBoundary && // 球會掉自己場地
  Math.abs(ball.x - player.x) > player.computerBoldness * 5 + PLAYER_LENGTH &&
  // 球離我夠遠
  ball.x > leftBoundary &&
  ball.x < rightBoundary && // 球已經在自己場地
  ball.y > 174 // 球已經夠低
) {
  userInput.powerHit = 1;
  userInput.xDirection = player.x < ball.x ? 1 : -1;
}
```

撲球的條件特別嚴格 — 必須球在自己場地、離自己很遠、已經接近地面才會撲。這避免 AI 撲到還在高處的球（撲不到、自己卻倒地）。

## 6. State 1/2（跳躍中 / 殺球中）：殺球決策

```ts
} else if (player.state === 1 || player.state === 2) {
  // 維持靠近球的水平方向
  if (Math.abs(ball.x - player.x) > 8) {
    userInput.xDirection = (player.x < ball.x) ? 1 : -1;
  }
  // 球到面前 + 同高 → 考慮殺球
  if (Math.abs(ball.x - player.x) < 48 && Math.abs(ball.y - player.y) < 48) {
    const willInputPowerHit = decideWhetherInputPowerHit(player, ball, theOtherPlayer, userInput);
    if (willInputPowerHit) {
      userInput.powerHit = 1;
      // 若對手太近，強制把球往上挑（避開對手攔網）
      if (Math.abs(theOtherPlayer.x - player.x) < 80 && userInput.yDirection !== -1) {
        userInput.yDirection = -1;
      }
    }
  }
}
```

最有趣的是 `decideWhetherInputPowerHit` — AI 會**模擬不同方向組合的擊球結果**，挑一個最能繞過對手的。

## 7. `decideWhetherInputPowerHit` — 9 種方向組合的暴力搜尋

```ts
function decideWhetherInputPowerHit(player, ball, theOtherPlayer, userInput) {
  if (rand() % 2 === 0) {
    // 模式 A：xDirection: 1 → 0 → -1, yDirection: -1 → 0 → 1
    for (let xDirection = 1; xDirection > -1; xDirection--) {
      for (let yDirection = -1; yDirection < 2; yDirection++) {
        // 試這組方向
        ...
      }
    }
  } else {
    // 模式 B：xDirection: 1 → 0 → -1, yDirection: 1 → 0 → -1
    for (let xDirection = 1; xDirection > -1; xDirection--) {
      for (let yDirection = 1; yDirection > -2; yDirection--) {
        ...
      }
    }
  }
  return false;
}
```

兩種模式的差別只是 `yDirection` 的搜尋順序（向上優先 vs 向下優先） — `rand() % 2` 隨機選一種，避免 AI 偏好過於明顯。每個組合會：

```ts
const expectedLandingPointX = expectedLandingPointXWhenPowerHit(xDirection, yDirection, ball);
if (
  // 球會掉到對方場地外（即落到對手側的「死角」）
  (expectedLandingPointX <= Number(player.isPlayer2) * GROUND_HALF_WIDTH ||
    expectedLandingPointX >= Number(player.isPlayer2) * GROUND_WIDTH + GROUND_HALF_WIDTH) &&
  // 落點離對手 > 一個玩家寬度（對手追不到）
  Math.abs(expectedLandingPointX - theOtherPlayer.x) > PLAYER_LENGTH
) {
  userInput.xDirection = xDirection;
  userInput.yDirection = yDirection;
  return true; // 找到好方向！
}
```

**關鍵觀察**：搜尋從 `xDirection = 1`（往右）開始，`yDirection = -1`（往上）或 `+1`（往下）。第一個滿足條件的方向就被採用 — 所以 AI 是 **greedy**，不一定挑最佳，但夠快。

如果**九個組合都打不到對方場地的好位置**，函式回 false，AI 就不殺球（讓它變成普通的擊球）。

## 8. AI 的內建漏洞 — 網柱反彈

`expectedLandingPointXWhenPowerHit` 內部模擬球的飛行時，網柱碰撞的處理是**簡化版**：

```ts
if (
  Math.abs(copyBall.x - GROUND_HALF_WIDTH) < NET_PILLAR_HALF_WIDTH &&
  copyBall.y > NET_PILLAR_TOP_TOP_Y_COORD
) {
  // 簡化：只把 y 速度反向，不處理 x 反彈
  if (copyBall.yVelocity > 0) {
    copyBall.yVelocity = -copyBall.yVelocity;
  }
}
```

對照真實的 `processCollisionBetweenBallAndWorldAndSetBallPosition`（見 [01 文件 §5](./01-world-and-ball.md)），真實版會**根據球進入網柱的位置**，把球往左 / 右推。但 AI 的預測版**只反彈 y 方向**，於是當球從網柱腰側打進去，AI 預測「球會穿透網柱繼續飛」，但實際上會**被推回它打過來的那邊**。

原始碼的註解明確標註：

> The code below maybe is intended to make computer do mistakes.

這是**故意**留下的破綻 — 讓 AI 偶爾會把球打進網柱然後反彈回自己場地，造成失誤。原作者甚至附上了「正確版本」的註解（如果你想做出更聰明的 AI）：

```ts
// An alternative code for making the computer not do those mistakes is as below.
// if (copyBall.y <= NET_PILLAR_TOP_BOTTOM_Y_COORD) {
//   if (copyBall.yVelocity > 0) {
//     copyBall.yVelocity = -copyBall.yVelocity;
//   }
// } else {
//   if (copyBall.x < GROUND_HALF_WIDTH) {
//     copyBall.xVelocity = -Math.abs(copyBall.xVelocity);
//   } else {
//     copyBall.xVelocity = Math.abs(copyBall.xVelocity);
//   }
// }
```

## 9. AI 的「人性」總結

整個 AI 設計透過幾個層次模擬人類：

1. **隨機性**：`computerBoldness` 每回合不同；`computerWhereToStandBy` 偶爾擲骰；殺球方向搜尋順序隨機。
2. **能力上限**：移動速度、跳躍規則跟人類一模一樣 — 它不能瞬移、不能空中跳。
3. **預測能力受限**：`virtualExpectedLandingPointX` 不會跟著球到對面場地（boldness 影響此判斷）。
4. **故意的盲點**：對網柱反彈的預測有 bug，會吃下手對手的彈牆球。

這也是為什麼這個 1997 年的 AI 至今玩起來仍有「真人感」 — 它不是完美機器，是個有偏好、有失誤的對手。

下一篇：[05 — 雲與波浪](./05-cloud-and-wave.md)，背景動畫的小引擎。
