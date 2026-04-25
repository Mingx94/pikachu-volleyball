/**
 * Translation tables for en / ko / zh.
 *
 * Keys are dot-style namespaces that mirror the HTML structure
 * (menu.*, options.*, about.*, notice.*, embedded.*, update.*, history.*).
 *
 * Values that contain inline markup (<a>, <span>, <br>) are referenced via
 * `data-i18n-html` in HTML so innerHTML is set; plain values are referenced
 * via `data-i18n` (textContent) or `data-i18n-attr` (attribute).
 *
 * Strings here are static, hand-authored content (not user input), so
 * innerHTML insertion is safe.
 */

export type Locale = 'en' | 'ko' | 'zh';
export type TranslationTable = Record<string, string>;

const ARROW = ' ▶︎'; // "▶︎" trailing the submenu labels in HTML
const TAG = '対戦ぴかちゅ～　ﾋﾞｰﾁﾊﾞﾚｰ編'; // 対戦ぴかちゅ～ ﾋﾞｰﾁﾊﾞﾚｰ編

export const translations: Record<Locale, TranslationTable> = {
  en: {
    // <html lang> / meta
    'meta.title': 'Pikachu Volleyball',
    'meta.description': 'Play the game Pikachu Volleyball',
    'meta.author': 'Kyutae Lee',
    'meta.app_title': 'Pikachu Volleyball',

    // Menu bar
    'menu.game': 'Game',
    'menu.pause': 'Pause',
    'menu.restart': 'Restart',
    'menu.options': 'Options',

    // Options submenus
    'options.graphic_label': 'Graphic' + ARROW,
    'options.sharp': 'sharp',
    'options.soft': 'soft',
    'options.bgm_label': 'BGM' + ARROW,
    'options.on': 'on',
    'options.off': 'off',
    'options.sfx_label': 'SFX' + ARROW,
    'options.stereo': 'stereo',
    'options.mono': 'mono',
    'options.speed_label': 'Speed' + ARROW,
    'options.slow': 'slow',
    'options.medium': 'medium',
    'options.fast': 'fast',
    'options.winning_score_label': 'Winning score' + ARROW,
    'options.score_5': '5 pts',
    'options.score_10': '10 pts',
    'options.score_15': '15 pts',
    'options.practice_label': 'Practice mode' + ARROW,
    'options.practice_on': 'on',
    'options.practice_off': 'off',
    'options.reset': 'Reset to default',

    // About / Play buttons
    'btn.about': 'About',
    'btn.play': 'Play',
    'btn.close': 'close',

    // About box
    'about.title': 'Pikachu Volleyball',
    'about.p2p_html':
      'You can also play <a href="https://gorisanson.github.io/pikachu-volleyball-p2p-online/en/">the P2P online version</a>.',
    'about.super_ai_html':
      'You can also play <a href="https://pika.duckll.tw/en/" target="_blank" rel="noopener">Super AI Edition</a> by <a href="https://blog.duckll.tw/" target="_blank" rel="noopener">DuckLL</a>.',
    'about.original_by_html':
      'The original Pikachu Volleyball (' +
      TAG +
      ') was developed by<br>1997 (C) <span class="no-wrap">SACHI SOFT / SAWAYAKAN Programmers</span><br>1997 (C) <span class="no-wrap">Satoshi Takenouchi</span>',
    'about.reverse_engineered_html':
      'The original game was reverse engineered<br>and implemented into this web version by<br><span class="no-wrap"><a href="https://gorisanson.github.io/">Kyutae Lee</a></span>',
    'about.source_code_html':
      'You can view the source code on <a href="https://github.com/gorisanson/pikachu-volleyball" target="_blank" rel="noopener">GitHub</a>.',
    'about.release_date': 'Release Date: 2020-03-26',
    'about.update_history_link_html':
      '<a href="./update-history/" target="_self">Update history</a>',

    'about.screenshot_alt': 'Pikachu Volleyball game screenshot',
    'about.intro1':
      'Pikachu Volleyball is an old Windows game which was developed in Japan in 1997. The game was popular in Korea when I was young. I had played it with my friends.',
    'about.intro2':
      'This web version is made by reverse engineering the original game and implementing it to JavaScript. It is executed directly on the web browser so, unlike the original game, you can play it regardless of the operating system of your computer.',
    'about.controls_label': 'Controls:',
    'about.controls_image_src': 'resources/assets/images/controls.png',
    'about.controls_alt': 'game controls',
    'about.controls_note':
      'If you have a Bluetooth keyboard, you can play also on your touch/mobile devices.',

    'about.tip1_label': 'Tip 1:',
    'about.tip1_html':
      'Like the original game, when you select <span class="no_wrap">"1人でぴかちゅ~"</span> to play against the computer, you would play as player 1 if you select by pressing the "Z" key, or you would play as player 2 if you select by pressing the Enter key.',
    'about.tip2_label': 'Tip 2:',
    'about.tip2_html':
      'Player 1 has the "V" key as an additional down key. The "V" key works differently compared to the "F" key, so you can try using it. (<span class="no-wrap"><a href="https://twitter.com/repeat_c/status/1256494157884841984" target="_blank" rel="noopener">Thanks to @repeat_c</a></span>, this characteristic of the original game could be reflected in this web version.)',
    'about.tip3_label': 'Tip 3:',
    'about.tip3_html': 'If you want to hide/show the game menu bar, press the Esc key.',
    'about.tip4_label': 'Tip 4:',
    'about.tip4_html':
      'I\'ve added a practice mode which is not in the original game, you can turn on this mode at <span class="no_wrap">"Options → Practice mode → on"</span>.',
    'about.tip5_label': 'Tip 5:',
    'about.tip5_html':
      'If you want to play this game without the need for an internet connection, you can install this page as an app on your device. On a computer, <a href="https://support.google.com/chrome/answer/9658361" target="_blank" rel="noopener">use the Chrome browser to install</a>. On a mobile device, "Add to Home Screen" this page.',

    // Notice boxes
    'notice.score_reached_html':
      'The winning score can not be set to the <span id="winning-score-in-notice-box-1"></span> pts, since the score is already reached.',
    'notice.no_point_in_practice_html':
      'There\'s no point adjusting the winning score in practice mode.<br>You can turn off practice mode at <span class="no_wrap">"Options → Practice mode → off"</span>.',
    'notice.ok': 'OK',

    // Loading
    'loading.message': 'Loading the game assets...',

    // Update prompt
    'update.message': 'A new version is available. Update now?',
    'update.now': 'Update Now (current game state will be lost)',
    'update.later': 'Later (automatically at relaunching the browser)',

    // Embedded-in-other-website warning
    'embedded.message_html':
      'It seems that you are playing this web version of <span class="no-wrap">Pikachu Volleyball</span> in some foreign website. If you visit the following link directly, you can play the game in a pleasant environment without ads.',
    'embedded.original_address_html':
      'The original address of this web version of Pikachu Volleyball:<br><a href="https://gorisanson.github.io/pikachu-volleyball/" target="_blank" rel="noopener">https://gorisanson.github.io/pikachu-volleyball/</a>',

    // Update history page
    'history.title': 'Pikachu Volleyball update history',
    'history.description': 'Update history for Pikachu Volleyball P2P Online',
    'history.heading_main': 'Pikachu Volleyball',
    'history.heading_sub': 'update history',
    'history.back_html': 'Back to <a href="../">the offline web version</a>',
    'history.only_major': 'Only major updates are recorded here.',
    'history.entries_html':
      '<p><span class="bold">2020-03-26</span> Release</p>' +
      '<p><span class="bold">2020-04-19</span> Fix Pikachu\'s diving direction. (<a href="https://github.com/gorisanson/pikachu-volleyball/pull/1" target="_blank" rel="noopener">Fixed by <span class="no-wrap">@djsjukr</span></a>)</p>' +
      '<p><span class="bold">2020-05-03</span> Fix left side keyboard mapping to the same as the original Pikachu Volleyball game. (<a href="https://github.com/gorisanson/pikachu-volleyball/issues/3" target="_blank" rel="noopener">Thanks to <span class="no-wrap">@repeat_c</span></a>)</p>' +
      '<p><span class="bold">2020-06-27</span> Create this update history page. (<a href="https://github.com/gorisanson/pikachu-volleyball-p2p-online/issues/7" target="_blank" rel="noopener">Suggested by <span class="no-wrap">@e6p77Bi8CW7zRBg</span></a>)</p>' +
      '<p><span class="bold">2020-06-28</span> Add Chinese translation. (<a href="https://github.com/gorisanson/pikachu-volleyball/pull/4" target="_blank" rel="noopener">Translated by <span class="no-wrap">@oToToT</span>, reviewed by <span class="no-wrap">@david942j</span></a>)</p>' +
      '<p><span class="bold">2022-01-17</span> Introduce dark mode.</p>' +
      '<p><span class="bold">2022-05-06</span> Game options (BGM, SFX, speed and winning score) are now saved.</p>' +
      '<p><span class="bold">2023-10-02</span> Options for graphic — "sharp" and "soft" — are added. (<a href="https://twitter.com/DuckLL_tw" target="_blank" rel="noopener">Suggested by <span class="no-wrap">@DuckLL_tw</span></a>)</p>',
  },

  ko: {
    'meta.title': '피카츄 배구',
    'meta.description': '피카츄 배구 게임',
    'meta.author': '이규태',
    'meta.app_title': 'Pikachu Volleyball',

    'menu.game': '게임',
    'menu.pause': '일시정지',
    'menu.restart': '다시시작',
    'menu.options': '설정',

    'options.graphic_label': '그래픽' + ARROW,
    'options.sharp': '예리하게',
    'options.soft': '부드럽게',
    'options.bgm_label': '배경음악' + ARROW,
    'options.on': '켜기',
    'options.off': '끄기',
    'options.sfx_label': '효과음' + ARROW,
    'options.stereo': '스테레오',
    'options.mono': '모노',
    'options.speed_label': '속도' + ARROW,
    'options.slow': '느리게',
    'options.medium': '보통',
    'options.fast': '빠르게',
    'options.winning_score_label': '승리점수' + ARROW,
    'options.score_5': '5점',
    'options.score_10': '10점',
    'options.score_15': '15점',
    'options.practice_label': '연습모드' + ARROW,
    'options.practice_on': '켜기',
    'options.practice_off': '끄기',
    'options.reset': '설정 초기화',

    'btn.about': '게임 소개',
    'btn.play': '게임 시작',
    'btn.close': '닫기',

    'about.title': '피카츄 배구',
    'about.p2p_html':
      '<a href="https://gorisanson.github.io/pikachu-volleyball-p2p-online/ko/">P2P 온라인 버전</a>도 있습니다.',
    'about.super_ai_html':
      '<a href="https://pika.duckll.tw/ko/" target="_blank" rel="noopener">슈퍼 AI 버전</a>(만든 사람: <a href="https://blog.duckll.tw/" target="_blank" rel="noopener">DuckLL</a>)도 있습니다.',
    'about.original_by_html':
      '원조 피카츄 배구 (' +
      TAG +
      ') 게임은 다음 분들이 만들었습니다.<br>1997 (C) <span class="no-wrap">SACHI SOFT / SAWAYAKAN Programmers</span><br>1997 (C) <span class="no-wrap">Satoshi Takenouchi</span>',
    'about.reverse_engineered_html':
      '원조 피카츄 배구 게임을 리버스 엔지니어링하여 웹 버전으로 만들었습니다.<br>웹 버전으로 만든 사람: <span class="no-wrap"><a href="https://gorisanson.github.io/">이규태</a></span>',
    'about.source_code_html':
      '소스 코드를 <a href="https://github.com/gorisanson/pikachu-volleyball" target="_blank" rel="noopener">GitHub</a>에서 볼 수 있습니다.',
    'about.release_date': '공개한 날: 2020-03-26',
    'about.update_history_link_html':
      '<a href="./update-history/" target="_self">업데이트 기록</a>',

    'about.screenshot_alt': 'Pikachu Volleyball game screenshot',
    'about.intro1':
      "피카츄 배구는 일본에서 1997년에 만들어진 윈도우용 게임입니다. 이 게임을 처음 접한 건 아마 초등학교 컴퓨터실에서였던 것으로 기억합니다. 친구들과 같이하면 정말 재미있지요. 어떤 분이 일본어 스프라이트를 한국어로 번역한 '피카츄 버전 한글판'이 나오기도 했습니다. (이 '피카츄 버전 한글판'의 한국어 스프라이트를 이 한국어 웹 버전에서도 사용했습니다.)",
    'about.intro2':
      '이 웹 버전은 원조 피카츄 배구 게임을 리버스 엔지니어링하여 이를 자바스크립트 코드로 구현한 것입니다. 이 웹 버전 게임은 웹 브라우저 상에서 직접 돌아가기 때문에 컴퓨터 운영체제에 상관 없이 플레이할 수 있습니다.',
    'about.controls_label': '조작법:',
    'about.controls_image_src': 'resources/assets/images/controls_ko.png',
    'about.controls_alt': 'game controls',
    'about.controls_note':
      '블루투스 키보드를 연결하면 스마트폰이나 태블릿에서도 플레이할 수 있습니다.',

    'about.tip1_label': '팁 1:',
    'about.tip1_html':
      '원조 게임에서도 그랬듯이, <span class="no_wrap">"혼자서재미있게~"</span>를 선택할 때 "Z" 키를 눌러서 선택하면, 왼쪽 피카츄(1P)를 선택하여 컴퓨터와 플레이할 수 있습니다. 엔터(Enter) 키를 눌러서 선택하면, 오른쪽 피카츄(2P)를 선택하여 컴퓨터와 플레이할 수 있고요.',
    'about.tip2_label': '팁 2:',
    'about.tip2_html':
      '왼쪽 피카츄(1P)의 경우 아래 방향키로 "V" 키가 추가로 있습니다. "V" 키는 "F" 키와 작동 방식에 차이가 있으므로, 직접 사용해볼 수 있습니다. (<span class="no-wrap"><a href="https://twitter.com/repeat_c/status/1256494157884841984" target="_blank" rel="noopener">@repeat_c님의 제보</a></span> 덕분에, 원조 게임의 이 특성을 이 웹 버전에 반영할 수 있었습니다.)',
    'about.tip3_label': '팁 3:',
    'about.tip3_html': '메뉴 바를 숨기려면 (또는 다시 보이게 하려면), Esc 키를 누르면 됩니다.',
    'about.tip4_label': '팁 4:',
    'about.tip4_html':
      '원조 피카츄 배구에는 없는 "연습모드"를 추가했습니다. <span class="no_wrap">"설정 → 연습모드 → 켜기"</span>를 누르면 활성화가 됩니다.',
    'about.tip5_label': '팁 5:',
    'about.tip5_html':
      '인터넷 연결 없이도 게임을 플레이 하고 싶은 경우에는 이 페이지를 앱으로 설치하면 됩니다. 컴퓨터에서는 <a href="https://support.google.com/chrome/answer/9658361" target="_blank" rel="noopener">크롬 브라우저를 이용해 설치</a>할 수 있습니다. 스마트폰이나 태블릿에서는 이 페이지를 "홈 화면에 추가"하면 됩니다.',

    'notice.score_reached_html':
      '승리점수를 <span id="winning-score-in-notice-box-1"></span>점으로 바꿀 수 없습니다. 이미 이 점수가 됐거나 넘어버렸습니다.',
    'notice.no_point_in_practice_html':
      '연습모드에서 승리점수를 바꾸는 건 의미가 없습니다.<br>연습모드를 끄려면 <span class="no_wrap">"설정 → 연습모드 → 끄기"</span>를 눌러주세요.',
    'notice.ok': '알겠어요',

    'loading.message': '게임 스프라이트/사운드 로드 중...',

    'update.message': '새 버전이 나왔습니다. 지금 업데이트할까요?',
    'update.now': '지금 업데이트 (게임 상태가 초기화됩니다)',
    'update.later': '나중에 (브라우저 다시 켤 때 자동 업데이트)',

    'embedded.message_html':
      '타 사이트 상에서 피카츄 배구 웹 버전을 실행하고 있는 것 같습니다. 다음 주소로 직접 방문하면 광고 없는 쾌적한 환경에서 플레이할 수 있습니다.',
    'embedded.original_address_html':
      '피카츄 배구 웹 버전 원 주소:<br><a href="https://gorisanson.github.io/pikachu-volleyball/" target="_blank" rel="noopener">https://gorisanson.github.io/pikachu-volleyball/</a>',

    'history.title': '피카츄 배구 업데이트 기록',
    'history.description': 'Update history for Pikachu Volleyball P2P Online',
    'history.heading_main': '피카츄 배구',
    'history.heading_sub': '업데이트 기록',
    'history.back_html': '<a href="../">오프라인 웹 버전</a>으로 돌아가기',
    'history.only_major': '주요 업데이트만 기록합니다.',
    'history.entries_html':
      '<p><span class="bold">2020-03-26</span> 공개</p>' +
      '<p><span class="bold">2020-04-19</span> 오프라인 웹 버전 변경 반영: 피카츄 다이빙 방향 오류 수정 (<a href="https://github.com/gorisanson/pikachu-volleyball/pull/1" target="_blank" rel="noopener"><span class="no-wrap">@djsjukr</span>님이 수정함</a>)</p>' +
      '<p><span class="bold">2020-05-03</span> 왼편 키보드 매핑을 원조 피카츄 배구 게임과 동일하도록 수정 (<a href="https://github.com/gorisanson/pikachu-volleyball/issues/3" target="_blank" rel="noopener"><span class="no-wrap">@repeat_c</span>님의 제보</a>)</p>' +
      '<p><span class="bold">2020-06-27</span> 이 업데이트 기록 페이지를 만듦 (<a href="https://github.com/gorisanson/pikachu-volleyball-p2p-online/issues/7" target="_blank" rel="noopener"><span class="no-wrap">@e6p77Bi8CW7zRBg</span>님의 제안</a>)</p>' +
      '<p><span class="bold">2020-06-28</span> 중국어 번역 추가 (<a href="https://github.com/gorisanson/pikachu-volleyball/pull/4" target="_blank" rel="noopener"><span class="no-wrap">@oToToT</span>님이 번역함, <span class="no-wrap">@david942j</span>님이 검토함</a>)</p>' +
      '<p><span class="bold">2022-01-17</span> 다크 모드 도입</p>' +
      '<p><span class="bold">2022-05-06</span> 게임 설정(배경음악, 효과음, 속도, 승리점수)이 저장되도록 함</p>' +
      '<p><span class="bold">2023-10-02</span> 그래픽 옵션 ("예리하게", "부드럽게") 추가 (<a href="https://twitter.com/DuckLL_tw" target="_blank" rel="noopener"><span class="no-wrap">@DuckLL_tw</span>님의 제안</a>)</p>',
  },

  zh: {
    'meta.title': '皮卡丘打排球',
    'meta.description': '線上玩皮卡丘打排球',
    'meta.author': 'Kyutae Lee',
    'meta.app_title': '皮卡丘打排球',

    'menu.game': '遊戲',
    'menu.pause': '暫停',
    'menu.restart': '重來',
    'menu.options': '選項',

    'options.graphic_label': 'Graphic' + ARROW,
    'options.sharp': 'sharp',
    'options.soft': 'soft',
    'options.bgm_label': '背景音樂' + ARROW,
    'options.on': '開',
    'options.off': '關',
    'options.sfx_label': 'SFX' + ARROW,
    'options.stereo': 'stereo',
    'options.mono': 'mono',
    'options.speed_label': '速度' + ARROW,
    'options.slow': '慢速',
    'options.medium': '普通',
    'options.fast': '快速',
    'options.winning_score_label': '遊戲分數' + ARROW,
    'options.score_5': '5分',
    'options.score_10': '10分',
    'options.score_15': '15分',
    'options.practice_label': '練習模式' + ARROW,
    'options.practice_on': '開',
    'options.practice_off': '關',
    'options.reset': '恢復至預設值',

    'btn.about': '關於',
    'btn.play': '開始',
    'btn.close': '關閉',

    'about.title': '皮卡丘打排球',
    'about.p2p_html':
      '你也可以遊玩<a href="https://gorisanson.github.io/pikachu-volleyball-p2p-online/en/">線上玩家對戰版本</a>。',
    'about.super_ai_html':
      '你也可以遊玩由 <a href="https://blog.duckll.tw/" target="_blank" rel="noopener">DuckLL</a> 開發的<a href="https://pika.duckll.tw/zh/" target="_blank" rel="noopener">超級 AI 版本</a>。',
    'about.original_by_html':
      '原始版的的皮卡丘打排球 (' +
      TAG +
      ') 是由<br>1997 (C) <span class="no-wrap">SACHI SOFT / SAWAYAKAN Programmers</span><br>1997 (C) <span class="no-wrap">Satoshi Takenouchi</span><br>所開發的',
    'about.reverse_engineered_html':
      '此遊戲是由 <span class="no-wrap"><a href="https://gorisanson.github.io/">Kyutae Lee</a></span><br>透過逆向工程技術解析原始遊戲並將其實作至此線上版本',
    'about.source_code_html':
      '你可以前往<a href="https://github.com/gorisanson/pikachu-volleyball" target="_blank" rel="noopener">GitHub</a>檢視原始碼',
    'about.release_date': '釋出日期: 2020-03-26',
    'about.update_history_link_html': '<a href="./update-history/" target="_self">更新紀錄</a>',

    'about.screenshot_alt': '皮卡丘打排球之遊戲截圖',
    'about.intro1':
      '皮卡丘打排球是1997年時由日本開發的一款Windows遊戲。此遊戲在我小的時候於韓國非常流行。我時常與朋友一同遊玩此遊戲。',
    'about.intro2':
      '此線上版本是透過對原始遊戲作逆向工程，並將其利用JavaScript實做出來。此遊戲能直接在瀏覽器上執行，因此有別於原先的遊戲，可以不受作業系統的限制。',
    'about.controls_label': 'Controls:',
    'about.controls_image_src': 'resources/assets/images/controls.png',
    'about.controls_alt': 'game controls',
    'about.controls_note': '如果你有藍牙鍵盤，你也可以嘗試在觸控/行動裝置上遊玩。',

    'about.tip1_label': '小提示 1:',
    'about.tip1_html':
      '與原始遊戲相同，在選擇 <span class="no_wrap">"1人でぴかちゅ~"</span> 來與電腦遊戲對戰時， 透過按下「Z鍵」開始玩可成為 1P ，而若是按下「Enter鍵」遊玩則會成為 2P。',
    'about.tip2_label': '小提示 2:',
    'about.tip2_html':
      '1P可以透過「V鍵」來當作額外的下鍵。「V鍵」與原先的「F鍵」略有不同，你可以嘗試看看使用它。 (<span class="no-wrap"><a href="https://twitter.com/repeat_c/status/1256494157884841984" target="_blank" rel="noopener">特別感謝 @repeat_c 告知</a></span>，此原遊戲之特點能在本線上版中呈現。)',
    'about.tip3_label': '小提示 3:',
    'about.tip3_html': '如果你想 隱藏/顯示 遊戲選單控制列，請按下「Esc鍵」。',
    'about.tip4_label': '小提示 4:',
    'about.tip4_html':
      '我增加了原始遊戲中沒有的練習模式，你可以透過 <span class="no_wrap">"選項 → 練習模式 → 開"</span> 開啟練習模式。',
    'about.tip5_label': '小提示 5:',
    'about.tip5_html':
      '如果你想在無網路的環境下遊玩此遊戲，你可以將此頁面安裝成App。在電腦上，你可以參考 <a href="https://support.google.com/chrome/answer/9658361" target="_blank" rel="noopener">使用Chrome瀏覽器來安裝</a>。 在手機上，你可以在此頁面上點選 「加到主螢幕」。',

    'notice.score_reached_html':
      '遊戲分數無法設定成 <span id="winning-score-in-notice-box-1"></span> 分，因為此分數已於先前達到',
    'notice.no_point_in_practice_html':
      '在練習模式中並沒有分數設定。<br>你可以在 <span class="no_wrap">"選項 → 練習模式 → 關"</span> 關閉練習模式',
    'notice.ok': 'OK',

    'loading.message': '載入遊戲資源中...',

    'update.message': '有新版本釋出。是否更新？',
    'update.now': '現在更新 (將會失去當前的遊戲狀態)',
    'update.later': '待會再說 (於瀏覽器重開後自動更新)',

    'embedded.message_html':
      'It seems that you are playing this web version of <span class="no-wrap">Pikachu Volleyball</span> in some foreign website. If you visit the following link directly, you can play the game in a pleasant environment without ads.',
    'embedded.original_address_html':
      'The original address of this web version of Pikachu Volleyball:<br><a href="https://gorisanson.github.io/pikachu-volleyball/" target="_blank" rel="noopener">https://gorisanson.github.io/pikachu-volleyball/</a>',

    'history.title': '皮卡丘打排球更新紀錄',
    'history.description': '線上玩皮卡丘打排球之更新紀錄',
    'history.heading_main': '皮卡丘打排球',
    'history.heading_sub': '更新紀錄',
    'history.back_html': '回到 <a href="../">可離線之網頁版本</a>',
    'history.only_major': '僅在此列出重大更新.',
    'history.entries_html':
      '<p><span class="bold">2020-03-26</span> 釋出</p>' +
      '<p><span class="bold">2020-04-19</span> 修正皮卡丘的撲球方向。 (<a href="https://github.com/gorisanson/pikachu-volleyball/pull/1" target="_blank" rel="noopener">由 <span class="no-wrap">@djsjukr</span> 修正</a>)</p>' +
      '<p><span class="bold">2020-05-03</span> 修正左側鍵盤配置以與原皮卡丘打排球相同。 (<a href="https://github.com/gorisanson/pikachu-volleyball/issues/3" target="_blank" rel="noopener">感謝 <span class="no-wrap">@repeat_c</span></a>)</p>' +
      '<p><span class="bold">2020-06-27</span> 新增此更新紀錄頁面. (<a href="https://github.com/gorisanson/pikachu-volleyball-p2p-online/issues/7" target="_blank" rel="noopener">由 <span class="no-wrap">@e6p77Bi8CW7zRBg</span> 建議</a>)</p>' +
      '<p><span class="bold">2020-06-28</span> 新增中文翻譯 (<a href="https://github.com/gorisanson/pikachu-volleyball/pull/4" target="_blank" rel="noopener">由 <span class="no-wrap">@oToToT</span> 翻譯, 並由 <span class="no-wrap">@david942j</span> 查核</a>)</p>' +
      '<p><span class="bold">2022-01-17</span> Introduce dark mode.</p>' +
      '<p><span class="bold">2022-05-06</span> Game options (BGM, SFX, speed and winning score) are now saved.</p>' +
      '<p><span class="bold">2023-10-02</span> Options for graphic — "sharp" and "soft" — are added. (<a href="https://twitter.com/DuckLL_tw" target="_blank" rel="noopener">Suggested by <span class="no-wrap">@DuckLL_tw</span></a>)</p>',
  },
};
