# 遊戲引擎分析

本資料夾整理了 Pikachu Volleyball 遊戲引擎的詳細技術文件。引擎本身是 1997 年原版 Windows 遊戲（`対戦ぴかちゅ～　ﾋﾞｰﾁﾊﾞﾚｰ編`，SACHI SOFT / SAWAYAKAN Programmers）機器碼的逆向工程結果。每個函式都標註了原始機器碼位址（例如 `FUN_00403dd0` 代表 `0x00403dd0` 位址的原始函式），便於對照原作。

## 文件導覽

| 文件                                    | 主題                                                                  | 對應原始碼                                                                                                      |
| --------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| [01 — 世界與球](./01-world-and-ball.md) | 座標系統、世界邊界、網柱碰撞、Hyper Ball Glitch                       | `physics.ts` 中 `processCollisionBetweenBallAndWorldAndSetBallPosition`、`Ball` 類別                            |
| [02 — 玩家狀態機](./02-player.md)       | 7 種 state、跳躍、撲球、Power Hit、邊界、frame counter                | `physics.ts` 中 `processPlayerMovementAndSetPlayerPosition`、`Player` 類別                                      |
| [03 — 玩家-球碰撞](./03-collision.md)   | 矩形碰撞偵測、`xVelocity` 計算、Power Hit 速度公式、碰撞鎖            | `physics.ts` 中 `isCollisionBetweenBallAndPlayerHappened`、`processCollisionBetweenBallAndPlayer`               |
| [04 — 電腦 AI](./04-computer-ai.md)     | `letComputerDecideUserInput`、`computerBoldness`、虛擬落地點、AI 漏洞 | `ai.ts` 中 `letComputerDecideUserInput`、`decideWhetherInputPowerHit`、`expectedLandingPointXWhenPowerHit`      |
| [05 — 雲與波浪](./05-cloud-and-wave.md) | 背景動畫引擎（裝飾用，不影響遊戲玩法）                                | `cloud_and_wave.ts`                                                                                             |

## 引擎在 MVC 中的位置

整個 codebase 採用 MVC：

- **Model（引擎）** — `src/resources/js/physics.ts`、`src/resources/js/ai.ts`、`src/resources/js/cloud_and_wave.ts`。本資料夾文件只描述這層。
- **View** — `src/resources/js/view.ts`，負責用 PixiJS v8 渲染 Model 算好的座標。
- **Controller** — `src/resources/js/pikavolley.ts`，把 keyboard 輸入餵給 Model，並驅動狀態機（intro → menu → round → ...）。

引擎本身完全不依賴 Pixi、DOM 或 audio。它只接受 `PikaUserInput[]`（每位玩家的方向鍵與 power hit 按鍵狀態），輸出更新後的 `Player[]`／`Ball` 物件，以及一個 `isBallTouchingGround` 旗標。Controller 把這個旗標解讀成「該回合結束」並決定計分。

引擎已從原作的 1v1 寫死，泛化成 N 玩家：`PikaPhysics.players` 長度可以是 2（1v1）或 4（2v2）。1v1 是原作行為的忠實移植；2v2 是本實作對原作的擴充（同隊配對的 AABB 解析），由 `physicsEngine` 在每 tick 的玩家移動之後、球-玩家碰撞之前插入一輪 — 詳見 [02 文件 §12](./02-player.md)。1v1 模式下這輪是 no-op（沒有同隊配對），所以原作 golden snapshot 完全不受影響。

## 確定性（determinism）

引擎是**完全確定性**的：

- 所有座標、速度都用 `| 0` 強制成 32-bit 整數運算（仿原始機器碼的整數除法）。
- 隨機性只來自 `rand.ts`（`rand()` 回傳 `[0, 32767]` 整數，預設用 `Math.random()`，但可以透過 `setCustomRng()` 替換成可重現的 PRNG）。
- Tick rate 由 Controller 控制，預設 `normalFPS = 25`，Pixi `Ticker` 驅動。回合結束的慢動作會降到 `slowMotionFPS = 5`，連續 6 個 frame。

替換成可重現 PRNG 後，整個對局可以 frame-perfect 重現 — 這也是 P2P 多人版本的基礎。

## 一個 frame 的生命週期

每個 normal-FPS frame，Controller 會：

1. 凍結所有玩家的 keyboard 輸入到 `PikaUserInput[]`（`keyboard.ts:getInput()`），長度等於 `physics.players.length`。
2. 呼叫 `PikaPhysics.runEngineForNextFrame(userInputArray)`，內部執行 `physicsEngine()`：
   1. **球-世界碰撞** — `processCollisionBetweenBallAndWorldAndSetBallPosition(ball)`：先處理旋轉、左右牆、上邊界、網柱、地面。回傳 `isBallTouchingGround`。
   2. **每個玩家的移動** — 對 `i = 0..players.length-1`：先算虛擬落地點 `calculateExpectedLandingPointXFor(ball)`（給 AI 用），再呼叫 `processPlayerMovementAndSetPlayerPosition()`（如果是電腦控制，先讓 `letComputerDecideUserInput()` 改寫 `userInput`，`theOtherPlayer` 由 `findNearestOpponent` 挑出對隊中最靠近球的那位）。
   3. **隊友碰撞解析（2v2-only no-op in 1v1）** — `processPlayerToPlayerCollisions(players)`：對每組同隊配對做 AABB，垂直主導 → 疊頭頂並設 `hasPlayerOnHead` / `standingOnTeammate`；水平主導 → 對半推開並 clamp 到自己半場。
   4. **球-玩家碰撞** — 對 `i = 0..players.length-1`：偵測碰撞，若有且這個玩家上一 frame 沒碰到過，呼叫 `processCollisionBetweenBallAndPlayer()` 設定球的新速度。
3. 若 `isBallTouchingGround === true`，Controller 加分、判斷是否結束遊戲、進入慢動作。
4. 把 `PhysicsTickResult.sounds`（一個 `SoundEvent[]`，由 engine 在 tick 內按發生順序 push）依序丟給 audio 層播放。Engine 本身不持有任何播放狀態，所以也不需要重設旗標。
5. View 從 `Player[]`／`Ball` 讀取座標渲染。

## 載入用的常數

`physics.ts` 開頭定義了一組 `const` 常數，這些都是「load-bearing」，動到任何一個都可能讓行為與原作不一致：

| 常數                             | 值   | 含義                                                               |
| -------------------------------- | ---- | ------------------------------------------------------------------ |
| `GROUND_WIDTH`                   | 432  | 1v1 場地寬度；2v2 改用 `GROUND_WIDTH_2V2 = 576`                    |
| `GROUND_WIDTH_2V2`               | 576  | 2v2 場地寬度（4/3 倍寬，多塞一組前後排不擠）                       |
| `GROUND_HALF_WIDTH`              | 216  | 1v1 場地半寬，也是 1v1 網柱 x 座標                                 |
| `PLAYER_LENGTH`                  | 64   | Pikachu 寬高（皮卡丘是正方形碰撞箱）                               |
| `PLAYER_HALF_LENGTH`             | 32   | Pikachu 半長                                                       |
| `PLAYER_TOUCHING_GROUND_Y_COORD` | 244  | 玩家站在地上時的 y                                                 |
| `BALL_RADIUS`                    | 20   | 球半徑                                                             |
| `BALL_TOUCHING_GROUND_Y_COORD`   | 252  | 球觸地的 y                                                         |
| `NET_PILLAR_HALF_WIDTH`          | 25   | 網柱半寬（physics 用，與精靈圖大小不同）                           |
| `NET_PILLAR_TOP_TOP_Y_COORD`     | 176  | 網柱頂端的上緣 y                                                   |
| `NET_PILLAR_TOP_BOTTOM_Y_COORD`  | 192  | 網柱頂端的下緣 y                                                   |
| `INFINITE_LOOP_LIMIT`            | 1000 | 預測落地點迴圈的安全上限（**這個是本實作新增的**，原始機器碼沒有） |

座標系：1v1 是 x ∈ [0, 432]，2v2 是 x ∈ [0, 576]；y ∈ [0, 304]（向下增加）。

**per-instance 寬度**：本實作把場地寬度從 module-level 常數泛化成 `PikaPhysics.groundWidth` / `Player.groundWidth` / `Ball.groundWidth`（在 PikaPhysics 建構時鏡射），所以引擎內部所有 free function（牆壁反彈、半場 clamp、網柱判斷、AI 預測落地點……）都是讀傳進來的物件的 `groundWidth` / `groundHalfWidth`，不是讀 const。1v1 走預設 432，行為與原作完全一致；2v2 走 576。下面各章引用的「`GROUND_WIDTH`」描述的是「世界寬度」這個概念，1v1 下等於常數，2v2 下值不同但邏輯一致。

## 可重現原作行為的注意事項

當你修改引擎時，請記得：

- **不要把 `| 0` 改成 `Math.floor()`**。對負數兩者結果不同，會跟原作機器碼分歧。
- **不要把 `rand()` 改成 `Math.random()`**。`rand()` 模仿 Visual Studio C runtime 的 `_rand()`，回傳整數 [0, 32767]，模數運算結果與原作匹配。
- **保留 `FUN_xxxxxxxx` 註解**。它們是回去原始機器碼比對的線索。
- **保留 bit-trick 寫法**，例如 `(GROUND_WIDTH / 2) | 0` 不能換成 `GROUND_WIDTH / 2`（前者是整數除法，後者是浮點）。

各個子系統的細節與已知 quirk 請見對應文件。
