// ─── Constants ────────────────────────────────────────────────

const LEVELS = {
  'easy-peasy': {
    label: 'Easy Peasy',
    emoji: '😊',
    targets: 2,
    memoryMs: 15000,
    gameDurationMs: 120000,
    distractors: 4,
  },
  'middle-for-dibble': {
    label: 'Middle for Dibble',
    emoji: '🤔',
    targets: 3,
    memoryMs: 9000,
    gameDurationMs: 90000,
    distractors: 6,
  },
  'rock-hard': {
    label: 'Rock Hard',
    emoji: '😤',
    targets: 4,
    memoryMs: 5000,
    gameDurationMs: 60000,
    distractors: 8,
  },
};

const CATEGORIES = {
  letters: {
    label: 'Letters',
    emoji: '🔤',
    symbols: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''),
  },
  numbers: {
    label: 'Numbers',
    emoji: '🔢',
    symbols: ['1','2','3','4','5','6','7','8','9','10','11','12','13','14','15'],
  },
  dinosaurs: {
    label: 'Dinosaurs',
    emoji: '🦕',
    symbols: [
      'images/dinosaurs/d1.jpg',
      'images/dinosaurs/d2.png',
      'images/dinosaurs/d3.png',
      'images/dinosaurs/d5.png',
      'images/dinosaurs/d6.png',
      'images/dinosaurs/d7.png',
      'images/dinosaurs/d8.png',
      'images/dinosaurs/d9.png',
      'images/dinosaurs/d10.png',
    ],
  },
  planets: {
    label: 'Planets',
    emoji: '🪐',
    symbols: [
      'images/planets/p1.png',
      'images/planets/p2.png',
      'images/planets/p3.png',
      'images/planets/p4.png',
      'images/planets/p5.png',
    ],
  },
};

const BACKGROUNDS = ['#e53935', '#1e88e5', '#43a047', '#fdd835'];

const AVATARS = ['🐸','🦁','🐬','🦋','🐼','🐯','🚀'];

const TOTAL_ROUNDS = 3;
const MAX_LIVES = 5;
const ROUND_TRANSITION_MS = 1500;
const NEXT_CARD_DELAY_MS = 320;
const COUNTDOWN_SOUND_THRESHOLD = 10;

// ─── State ────────────────────────────────────────────────────

const state = {
  // screens
  currentScreen: 'screen-profiles',
  // profiles
  profiles: [],
  activeProfileId: null,
  // settings
  settings: { category: 'letters', level: 'easy-peasy' },
  // game
  status: 'idle',
  round: 0,
  roundStarsEarned: 0,
  mistakes: 0,
  targets: [],
  foundTargetKeys: new Set(),
  remainingTargetKeys: new Set(),
  deck: [],
  currentCard: null,
  inputLocked: false,
  streak: 0,
  // timer
  timerRaf: null,
  timerToken: 0,
  timerActive: false,
  phaseTimeoutId: null,
  gameDurationMs: 120000,
  gameRemainingMs: 120000,
  lastTickTs: 0,
  lastCountdownSecond: null,
  advanceTimeoutId: null,
  countdownIntervalId: null,
  // audio
  muted: false,
  audioContext: null,
  audioUnlocked: false,
  // touch
  touchStartX: 0,
  touchStartY: 0,
};

// ─── UI element references ────────────────────────────────────

const ui = {
  roundValue:       document.getElementById('roundValue'),
  roundTotalValue:  document.getElementById('roundTotalValue'),
  livesDisplay:     document.getElementById('livesDisplay'),
  timeValue:        document.getElementById('timeValue'),
  timerBar:         document.getElementById('timerBar'),
  messageArea:      document.getElementById('messageArea'),
  boardLabel:       document.getElementById('boardLabel'),
  currentPaneLabel: document.getElementById('currentPaneLabel'),
  targetBoard:      document.getElementById('targetBoard'),
  boardFrame:       document.getElementById('boardFrame'),
  singleCard:       document.getElementById('singleCard'),
  singleCardArea:   document.getElementById('singleCardArea'),
  acceptBtn:        document.getElementById('acceptBtn'),
  rejectBtn:        document.getElementById('rejectBtn'),
  swipeHint:        document.getElementById('swipeHint'),
  keyboardHelp:     document.getElementById('keyboardHelp'),
  streakPill:       document.getElementById('streakPill'),
  toggleMuteBtn:    document.getElementById('toggleMuteBtn'),
  timePill:         document.getElementById('timePill'),
  quitBtn:          document.getElementById('quitBtn'),
};

// ─── Init ─────────────────────────────────────────────────────

function init() {
  loadProfiles();
  loadMuteState();
  bindEvents();
  armAudioUnlock();
  showSplashScreen();
}

// ─── Splash screen ────────────────────────────────────────────

function showSplashScreen() {
  showScreen('screen-splash');
  document.getElementById('screen-splash').addEventListener('click', advanceFromSplash, { once: true });
}

function advanceFromSplash() {
  renderProfileScreen();
}

// ─── Screen navigation ────────────────────────────────────────

function showScreen(id) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
  const screen = document.getElementById(id);
  if (screen) {
    void screen.offsetWidth; // force reflow so screenIn animation re-triggers
    screen.classList.add('active');
  }
  state.currentScreen = id;
}

// ─── Event binding ────────────────────────────────────────────

function bindEvents() {
  document.getElementById('addPlayerBtn').addEventListener('click', () => {
    document.getElementById('addPlayerForm').classList.remove('hidden');
    document.getElementById('addPlayerBtn').classList.add('hidden');
    renderAvatarPicker();
  });

  ui.rejectBtn.addEventListener('click', () => handleChoice(false));
  ui.acceptBtn.addEventListener('click', () => handleChoice(true));

  ui.toggleMuteBtn.addEventListener('click', () => {
    state.muted = !state.muted;
    ui.toggleMuteBtn.textContent = state.muted ? '🔇' : '🔊';
    try { localStorage.setItem('memMatch_muted', String(state.muted)); } catch (_) {}
    if (!state.muted) unlockAudio();
  });

  ui.quitBtn.addEventListener('click', () => {
    cancelGameTimer();
    clearPhaseTimeout();
    clearAdvanceTimeout();
    clearCountdownInterval();
    state.status = 'idle';
    state.inputLocked = true;
    renderSetupScreen();
  });

  window.addEventListener('keydown', handleKeyDown);

  ui.singleCardArea.addEventListener('touchstart', (e) => {
    if (state.status !== 'test') return;
    const touch = e.changedTouches[0];
    state.touchStartX = touch.clientX;
    state.touchStartY = touch.clientY;
  }, { passive: true });

  ui.singleCardArea.addEventListener('touchend', (e) => {
    if (state.status !== 'test') return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - state.touchStartX;
    const dy = touch.clientY - state.touchStartY;
    if (Math.abs(dx) > 55 && Math.abs(dy) < 90) handleChoice(dx > 0);
  }, { passive: true });

  // Tap round-complete screen to skip auto-advance
  document.getElementById('screen-round-complete').addEventListener('click', () => {
    if (state.currentScreen !== 'screen-round-complete') return;
    clearAdvanceTimeout();
    advanceFromRoundComplete();
  });

  document.getElementById('playBtn').addEventListener('click', startGame);
  document.getElementById('playAgainBtn').addEventListener('click', () => renderSetupScreen());
  document.getElementById('changeLevelBtn').addEventListener('click', () => renderSetupScreen());
  document.getElementById('tryAgainBtn').addEventListener('click', () => renderSetupScreen());
}

function handleKeyDown(event) {
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    if (state.status !== 'test') return;
    event.preventDefault();
    handleChoice(event.key === 'ArrowRight');
    return;
  }

  if ((event.key === ' ' || event.key === 'Enter') &&
      state.currentScreen === 'screen-round-complete') {
    event.preventDefault();
    clearAdvanceTimeout();
    advanceFromRoundComplete();
  }
}

// ─── Profile system ───────────────────────────────────────────

function loadProfiles() {
  try {
    const raw = localStorage.getItem('memMatch_profiles');
    state.profiles = raw ? JSON.parse(raw) : [];
  } catch (_) { state.profiles = []; }

  try {
    state.activeProfileId = localStorage.getItem('memMatch_activeProfile') || null;
  } catch (_) { state.activeProfileId = null; }
}

function saveProfiles() {
  try { localStorage.setItem('memMatch_profiles', JSON.stringify(state.profiles)); } catch (_) {}
}

function getActiveProfile() {
  return state.profiles.find((p) => p.id === state.activeProfileId) || null;
}

function addProfile(name, avatar) {
  const profile = {
    id: String(Date.now()),
    name: name.trim(),
    avatar,
    stars: 0,
    trophies: 0,
    gamesPlayed: 0,
  };
  state.profiles.push(profile);
  saveProfiles();
  return profile;
}

function awardStar() {
  const profile = getActiveProfile();
  if (!profile) return;
  profile.stars += 1;
  saveProfiles();
}

function awardTrophy() {
  const profile = getActiveProfile();
  if (!profile) return;
  profile.trophies += 1;
  saveProfiles();
}

function incrementGamesPlayed() {
  const profile = getActiveProfile();
  if (!profile) return;
  profile.gamesPlayed += 1;
  saveProfiles();
}

// ─── Avatar helpers ───────────────────────────────────────────

function isImageAvatar(avatar) {
  return /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(avatar);
}

function makeAvatarElement(avatar, size) {
  if (isImageAvatar(avatar)) {
    const img = document.createElement('img');
    img.src = avatar;
    img.style.cssText = `width:${size};height:${size};border-radius:50%;object-fit:cover;vertical-align:middle;`;
    return img;
  }
  const span = document.createElement('span');
  span.textContent = avatar;
  span.style.fontSize = size;
  return span;
}

// ─── Profile screen ───────────────────────────────────────────

function renderProfileScreen() {
  showScreen('screen-profiles');

  const list    = document.getElementById('profileList');
  const form    = document.getElementById('addPlayerForm');
  const addBtn  = document.getElementById('addPlayerBtn');

  list.innerHTML = '';
  form.classList.add('hidden');

  if (state.profiles.length === 0) {
    addBtn.classList.add('hidden');
    form.classList.remove('hidden');
    renderAvatarPicker();
    return;
  }

  addBtn.classList.remove('hidden');

  state.profiles.forEach((profile) => {
    const wrap = document.createElement('div');
    wrap.className = 'profile-card-wrap';

    const card = document.createElement('div');
    card.className = 'profile-card';

    const avatarWrap = document.createElement('div');
    avatarWrap.className = 'profile-card-avatar';
    avatarWrap.appendChild(makeAvatarElement(profile.avatar, '2.6rem'));

    const name = document.createElement('div');
    name.className = 'profile-name';
    name.textContent = profile.name;

    const stats = document.createElement('div');
    stats.className = 'profile-stats';
    stats.textContent = `⭐ ${profile.stars}  🏆 ${profile.trophies}`;

    card.appendChild(avatarWrap);
    card.appendChild(name);
    card.appendChild(stats);
    card.addEventListener('click', () => selectProfile(profile.id));

    // Delete button
    const delBtn = document.createElement('button');
    delBtn.className = 'profile-delete-btn';
    delBtn.type = 'button';
    delBtn.setAttribute('aria-label', `Delete ${profile.name}`);
    delBtn.textContent = '🗑';
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      showDeleteConfirm(wrap, profile);
    });

    wrap.appendChild(card);
    wrap.appendChild(delBtn);
    list.appendChild(wrap);
  });

  renderLeaderboard();
}

function showDeleteConfirm(wrap, profile) {
  // Remove any existing overlay first
  const existing = wrap.querySelector('.profile-confirm-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'profile-confirm-overlay';

  const text = document.createElement('div');
  text.className = 'profile-confirm-text';
  text.textContent = `Delete ${profile.name}?`;

  const btns = document.createElement('div');
  btns.className = 'profile-confirm-btns';

  const yes = document.createElement('button');
  yes.className = 'profile-confirm-yes';
  yes.type = 'button';
  yes.textContent = 'Yes, delete';
  yes.addEventListener('click', (e) => {
    e.stopPropagation();
    deleteProfile(profile.id);
  });

  const no = document.createElement('button');
  no.className = 'profile-confirm-no';
  no.type = 'button';
  no.textContent = 'Keep';
  no.addEventListener('click', (e) => {
    e.stopPropagation();
    overlay.remove();
  });

  btns.appendChild(yes);
  btns.appendChild(no);
  overlay.appendChild(text);
  overlay.appendChild(btns);
  wrap.appendChild(overlay);
}

function deleteProfile(id) {
  state.profiles = state.profiles.filter((p) => p.id !== id);
  if (state.activeProfileId === id) state.activeProfileId = null;
  saveProfiles();
  try { if (state.activeProfileId === null) localStorage.removeItem('memMatch_activeProfile'); } catch (_) {}
  renderProfileScreen();
}

function renderLeaderboard() {
  const el = document.getElementById('leaderboard');
  if (!el) return;

  if (state.profiles.length < 2) {
    el.classList.add('hidden');
    return;
  }

  const sorted = [...state.profiles].sort((a, b) =>
    b.trophies !== a.trophies ? b.trophies - a.trophies : b.stars - a.stars
  );

  const medals = ['🥇', '🥈', '🥉'];

  el.innerHTML = '';
  const title = document.createElement('p');
  title.className = 'leaderboard-title';
  title.textContent = '🏆 Leaderboard';
  el.appendChild(title);

  sorted.forEach((profile, i) => {
    const row = document.createElement('div');
    row.className = 'leaderboard-row';

    const rank = document.createElement('div');
    rank.className = 'leaderboard-rank';
    rank.textContent = medals[i] || String(i + 1);

    const avatarWrap = document.createElement('div');
    avatarWrap.className = 'leaderboard-avatar';
    avatarWrap.appendChild(makeAvatarElement(profile.avatar, '1.5rem'));

    const name = document.createElement('div');
    name.className = 'leaderboard-name';
    name.textContent = profile.name;

    const stats = document.createElement('div');
    stats.className = 'leaderboard-stats';
    stats.textContent = `🏆 ${profile.trophies}  ⭐ ${profile.stars}`;

    row.appendChild(rank);
    row.appendChild(avatarWrap);
    row.appendChild(name);
    row.appendChild(stats);
    el.appendChild(row);
  });

  el.classList.remove('hidden');
}

function renderAvatarPicker() {
  const grid = document.getElementById('avatarGrid');
  grid.innerHTML = '';
  let selectedAvatar = AVATARS[0];

  AVATARS.forEach((avatar) => {
    const btn = document.createElement('div');
    btn.className = 'avatar-option' + (avatar === selectedAvatar ? ' selected' : '');

    btn.appendChild(makeAvatarElement(avatar, '1.7rem'));

    btn.addEventListener('click', () => {
      selectedAvatar = avatar;
      grid.querySelectorAll('.avatar-option').forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
    grid.appendChild(btn);
  });

  const saveBtn = document.getElementById('savePlayerBtn');
  saveBtn.onclick = () => {
    const nameInput = document.getElementById('playerNameInput');
    const name = nameInput.value.trim();
    if (!name) { nameInput.focus(); return; }
    const profile = addProfile(name, selectedAvatar);
    nameInput.value = '';
    selectProfile(profile.id);
  };
}

function selectProfile(id) {
  state.activeProfileId = id;
  try { localStorage.setItem('memMatch_activeProfile', id); } catch (_) {}
  renderSetupScreen();
}

// ─── Setup screen ─────────────────────────────────────────────

const CATEGORY_DESCRIPTIONS = {
  letters:   'Match alphabet cards A to Z!',
  numbers:   'Match number cards 1 to 15!',
  dinosaurs: 'Match prehistoric dino pals!',
  planets:   'Match planets of the solar system!',
};

function renderSetupScreen() {
  showScreen('screen-setup');
  renderSetupGreeting();
  renderCategoryHero();
  renderLevelPills();
}

function renderSetupGreeting() {
  const greeting = document.getElementById('setupGreeting');
  greeting.innerHTML = '';
  const profile = getActiveProfile();
  if (!profile) return;

  const avatarEl = makeAvatarElement(profile.avatar, '1.4rem');
  greeting.appendChild(avatarEl);

  const nameText = document.createElement('span');
  nameText.className = 'greeting-name';
  nameText.textContent = profile.name;
  greeting.appendChild(nameText);

  const stats = document.createElement('span');
  stats.className = 'greeting-stats';
  stats.textContent = `⭐ ${profile.stars}  🏆 ${profile.trophies}`;
  greeting.appendChild(stats);

  const changeBtn = document.createElement('button');
  changeBtn.className = 'change-player-link';
  changeBtn.type = 'button';
  changeBtn.textContent = 'Change';
  changeBtn.addEventListener('click', () => renderProfileScreen());
  greeting.appendChild(changeBtn);
}

function renderCategoryHero() {
  const keys = Object.keys(CATEGORIES);
  let idx = Math.max(0, keys.indexOf(state.settings.category));
  state.settings.category = keys[idx];

  function updateHero() {
    const key = keys[idx];
    const cat = CATEGORIES[key];
    state.settings.category = key;
    document.getElementById('heroEmoji').textContent = cat.emoji;
    document.getElementById('heroName').textContent  = cat.label;
    document.getElementById('heroDesc').textContent  = CATEGORY_DESCRIPTIONS[key] || '';

    const dotsEl = document.getElementById('heroDots');
    dotsEl.innerHTML = '';
    keys.forEach((_, i) => {
      const dot = document.createElement('span');
      dot.className = 'hero-dot' + (i === idx ? ' active' : '');
      dotsEl.appendChild(dot);
    });
  }

  updateHero();

  document.getElementById('categoryPrevBtn').onclick = () => {
    idx = (idx - 1 + keys.length) % keys.length;
    updateHero();
  };
  document.getElementById('categoryNextBtn').onclick = () => {
    idx = (idx + 1) % keys.length;
    updateHero();
  };
}

function renderLevelPills() {
  const container = document.getElementById('levelBtns');
  container.innerHTML = '';
  Object.entries(LEVELS).forEach(([key, lv]) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'level-pill' + (state.settings.level === key ? ' selected' : '');
    btn.innerHTML = `${lv.emoji} <span>${lv.label}</span>`;
    btn.addEventListener('click', () => {
      state.settings.level = key;
      container.querySelectorAll('.level-pill').forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
    container.appendChild(btn);
  });
}

// ─── Game start ───────────────────────────────────────────────

function startGame() {
  unlockAudio();
  clearAdvanceTimeout();
  clearPhaseTimeout();
  clearCountdownInterval();

  const level = LEVELS[state.settings.level];

  state.round            = 0;
  state.roundStarsEarned = 0;
  state.mistakes         = 0;
  state.targets          = [];
  state.foundTargetKeys  = new Set();
  state.remainingTargetKeys = new Set();
  state.deck             = [];
  state.currentCard      = null;
  state.streak           = 0;
  state.gameDurationMs   = level.gameDurationMs;
  state.gameRemainingMs  = level.gameDurationMs;
  state.lastTickTs       = 0;
  state.lastCountdownSecond = null;
  state.timerActive      = false;

  showScreen('screen-game');

  ui.roundTotalValue.textContent = String(TOTAL_ROUNDS);
  renderLivesDisplay();
  renderStreakDisplay();
  updateTimeDisplay(state.gameRemainingMs);
  updateTimerVisuals();
  setMessage('Get ready…');
  setControlsEnabled(false);
  startGameTimerLoop();
  startNextRound();
}

// ─── Round loop ───────────────────────────────────────────────

function startNextRound() {
  clearAdvanceTimeout();
  clearPhaseTimeout();
  clearCountdownInterval();
  pauseGameTimer();

  if (!hasTimeRemaining()) { finishGame(false, 'time'); return; }

  state.round += 1;
  state.status = 'memorise';
  document.getElementById('playfield').classList.add('preview-mode');
  state.targets = generateTargetSet();
  state.streak = 0;
  renderStreakDisplay();
  state.foundTargetKeys = new Set();
  state.remainingTargetKeys = new Set(state.targets.map((c) => c.key));
  state.deck = [];
  state.currentCard = null;
  state.inputLocked = true;

  const level    = LEVELS[state.settings.level];
  const profile  = getActiveProfile();
  const name     = profile ? profile.name : '';
  const catLabel = CATEGORIES[state.settings.category].label.toLowerCase();

  ui.roundValue.textContent = String(state.round);
  renderLivesDisplay();
  renderTargetBoard('showTargets', true);
  playMemoriseSound();
  setControlsEnabled(false);

  ui.boardLabel.textContent = `Memorise these ${level.targets} ${catLabel}!`;
  ui.currentPaneLabel.textContent = 'Preview';

  const greeting = name ? `${name}, r` : 'R';
  setMessage(`${greeting}ound ${state.round}: Memorise these ${level.targets} ${catLabel}!`);

  startPreviewCountdown(level.memoryMs);
  startPhaseTimer(level.memoryMs, () => beginTestPhase());
}

function beginTestPhase() {
  clearCountdownInterval();
  if (!hasTimeRemaining()) { finishGame(false, 'time'); return; }

  state.status = 'test';
  document.getElementById('playfield').classList.remove('preview-mode');
  state.inputLocked = false;
  renderTargetBoard('testBoard', true);
  setControlsEnabled(true);
  updateSwipeHintVisibility();

  const catLabel = CATEGORIES[state.settings.category].label.toLowerCase();
  ui.boardLabel.textContent = 'Fill your board!';
  ui.currentPaneLabel.textContent = 'Current card';
  setMessage(`Accept ${catLabel} that belong on the board. Reject everything else.`);
  resumeGameTimer();
  showNextCard();
}

function showNextCard() {
  if (!hasTimeRemaining()) { finishGame(false, 'time'); return; }
  if (state.remainingTargetKeys.size === 0) { completeRound(); return; }
  if (state.deck.length === 0) state.deck = buildDeck();
  state.currentCard = state.deck.shift();
  renderSingleCard(state.currentCard);
  state.inputLocked = false;
}

function buildDeck() {
  const deck = [];
  const deckKeys = new Set();
  const allTargetKeys = new Set(state.targets.map((c) => c.key));
  const remaining = state.targets.filter((c) => state.remainingTargetKeys.has(c.key));

  remaining.forEach((c) => { deck.push({ ...c }); deckKeys.add(c.key); });

  const distractorCount = LEVELS[state.settings.level].distractors;
  while (deck.length < remaining.length + distractorCount) {
    const d = generateDistractor(allTargetKeys, deckKeys);
    deck.push(d);
    deckKeys.add(d.key);
  }

  return shuffle(deck);
}

// ─── Choice handling ──────────────────────────────────────────

async function handleChoice(isAccept) {
  if (state.status !== 'test' || state.inputLocked || !state.currentCard) return;
  if (!hasTimeRemaining()) { finishGame(false, 'time'); return; }

  state.inputLocked = true;

  const isTarget  = state.remainingTargetKeys.has(state.currentCard.key);
  const isCorrect = (isAccept && isTarget) || (!isAccept && !isTarget);

  if (isCorrect) {
    if (isAccept && isTarget) {
      state.streak += 1;
      vibrate(12);
      playSuccessSound();
      await animateCardToBoard(state.currentCard);
      state.foundTargetKeys.add(state.currentCard.key);
      state.remainingTargetKeys.delete(state.currentCard.key);
      renderTargetBoard('testBoard');
      highlightFilledSlot(state.currentCard.key);

      const profile = getActiveProfile();
      const name = profile ? profile.name : '';
      if (state.streak >= 3) {
        const combos = ['🔥 COMBO x' + state.streak + '!', '⚡ ON FIRE!', '💥 UNSTOPPABLE!'];
        const combo = state.streak >= 5 ? combos[2] : state.streak >= 4 ? combos[1] : combos[0];
        renderStreakDisplay(true);
        showPopupFeedback(combo, true);
        setMessage(combo);
      } else {
        renderStreakDisplay(true);
        showPopupFeedback(state.streak >= 2 ? '✨ Nice streak!' : '✅ Match!', true);
        setMessage(name ? `Well done, ${name}!` : 'Well done!');
      }
    } else {
      state.streak += 1;
      vibrate(12);
      renderStreakDisplay(true);
      playSuccessSound();
      flashSingleCard(true);
      showPopupFeedback('👍 Good reject!', true);
      setMessage('Good reject! That one didn\'t belong.');
    }
  } else {
    state.streak = 0;
    renderStreakDisplay();
    state.mistakes += 1;
    vibrate(80);
    playFailureSound();
    flashSingleCard(false);
    renderLivesDisplay(true);
    showPopupFeedback('💔 Oops!', false);

    if (isAccept) {
      setMessage('Oops! That card doesn\'t belong on the board.');
    } else {
      setMessage('Oops! You should have accepted that one.');
    }

    if (state.mistakes >= MAX_LIVES) {
      window.setTimeout(() => finishGame(false, 'lives'), 260);
      return;
    }
  }

  window.setTimeout(() => showNextCard(), NEXT_CARD_DELAY_MS);
}

// ─── Round/game completion ────────────────────────────────────

function completeRound() {
  clearAdvanceTimeout();
  clearPhaseTimeout();
  clearCountdownInterval();
  pauseGameTimer();

  state.status = 'roundComplete';
  state.inputLocked = true;
  setControlsEnabled(false);

  // Award and save star immediately
  state.roundStarsEarned += 1;
  awardStar();

  const profile = getActiveProfile();
  const name = profile ? profile.name : 'You';

  playWinSound(false);

  if (state.round >= TOTAL_ROUNDS) {
    state.status = 'gameWon';
    state.advanceTimeoutId = window.setTimeout(() => showGameWonScreen(), ROUND_TRANSITION_MS);
    return;
  }

  // Show round complete screen then auto-advance
  document.getElementById('roundCompleteTitle').textContent = `Amazing, ${name}!`;
  document.getElementById('roundCompleteText').textContent = `Round ${state.round} complete! ⭐`;
  renderStarsRow('roundStars', state.roundStarsEarned, TOTAL_ROUNDS);
  showScreen('screen-round-complete');
  triggerAnimation(document.querySelector('#screen-round-complete .reward-emoji'), 'reward-bounce');

  state.advanceTimeoutId = window.setTimeout(() => advanceFromRoundComplete(), ROUND_TRANSITION_MS);
}

function advanceFromRoundComplete() {
  showScreen('screen-game');
  startNextRound();
}

function finishGame(didWin, reason) {
  if (state.status === 'gameWon' || state.status === 'gameLost') return;

  clearAdvanceTimeout();
  clearPhaseTimeout();
  clearCountdownInterval();
  pauseGameTimer();

  state.inputLocked = true;
  setControlsEnabled(false);

  if (didWin) {
    state.status = 'gameWon';
    showGameWonScreen();
  } else {
    state.status = 'gameLost';
    showGameOverScreen(reason);
  }
}

function showGameWonScreen() {
  const profile = getActiveProfile();
  const name = profile ? profile.name : 'You';

  awardTrophy();
  incrementGamesPlayed();

  document.getElementById('wonTitle').textContent = `You did it, ${name}! 🎉`;
  document.getElementById('wonText').textContent  = `All ${TOTAL_ROUNDS} rounds cleared!`;
  renderStarsRow('wonStars', state.roundStarsEarned, TOTAL_ROUNDS);

  showScreen('screen-won');
  triggerAnimation(document.querySelector('#screen-won .reward-emoji'), 'reward-bounce');
  playWinSound(true);
  triggerConfetti();
}

function showGameOverScreen(reason) {
  incrementGamesPlayed();

  const profile = getActiveProfile();
  const name = profile ? profile.name : 'You';

  const msg = reason === 'lives'
    ? 'You ran out of lives. Keep practising!'
    : 'Time ran out. Keep practising!';

  document.getElementById('gameoverTitle').textContent = `Good try, ${name}!`;
  document.getElementById('gameoverText').textContent  = msg;
  renderStarsRow('gameoverStars', state.roundStarsEarned, TOTAL_ROUNDS);

  showScreen('screen-gameover');
  triggerAnimation(document.querySelector('#screen-gameover .reward-emoji'), 'reward-bounce');
  playFailureSound();
}

// ─── Card generation ──────────────────────────────────────────

function generateTargetSet() {
  const count   = LEVELS[state.settings.level].targets;
  const symbols = CATEGORIES[state.settings.category].symbols;
  const targets = [];
  const used    = new Set();

  while (targets.length < count) {
    const card = generateRandomCard(symbols, used);
    targets.push(card);
    used.add(card.key);
  }

  return targets;
}

function generateDistractor(allTargetKeys, deckKeys) {
  const symbols  = CATEGORIES[state.settings.category].symbols;
  const targets  = state.targets;

  for (let attempt = 0; attempt < 300; attempt++) {
    let card;

    if (Math.random() < 0.65 && targets.length > 0) {
      const base        = pickRandom(targets);
      const variantType = Math.random() < 0.5 ? 'symbol' : 'bg';
      card = { ...base };

      if (variantType === 'symbol') {
        const others = symbols.filter((s) => s !== base.symbol);
        card.symbol = pickRandom(others.length > 0 ? others : symbols);
      } else {
        const others = BACKGROUNDS.filter((b) => b !== base.bg);
        card.bg = pickRandom(others.length > 0 ? others : BACKGROUNDS);
      }
      card.key = makeCardKey(card);
    } else {
      card = generateRandomCard(symbols, new Set());
    }

    if (!allTargetKeys.has(card.key) && !deckKeys.has(card.key)) return card;
  }

  return generateRandomCard(symbols, new Set([...allTargetKeys, ...deckKeys]));
}

function generateRandomCard(symbols, excludedKeys) {
  for (let attempt = 0; attempt < 500; attempt++) {
    const symbol = pickRandom(symbols);
    const bg     = pickRandom(BACKGROUNDS);
    const card   = { symbol, bg, fg: '#fff' };
    card.key = makeCardKey(card);
    if (!excludedKeys.has(card.key)) return card;
  }
  const fallback = { symbol: symbols[0], bg: BACKGROUNDS[0], fg: '#fff' };
  fallback.key = makeCardKey(fallback);
  return fallback;
}

function makeCardKey(card) {
  return `${card.symbol}|${card.bg}`;
}

// ─── Board rendering ──────────────────────────────────────────

function renderTargetBoard(mode, animate = false) {
  const targetCount = state.targets.length || LEVELS[state.settings.level].targets;

  ui.targetBoard.className = `target-board target-board-${targetCount}`;
  ui.boardFrame.className  = 'board-frame';
  ui.targetBoard.innerHTML = '';

  const cards = state.targets.length ? state.targets : new Array(targetCount).fill(null);

  cards.forEach((card, index) => {
    if (mode === 'showTargets' && card) {
      const el = createCardElement(card, 'memory-card');
      el.dataset.cardKey   = card.key;
      el.dataset.slotIndex = String(index);
      if (animate) {
        el.classList.add('deal-in');
        el.style.animationDelay = `${index * 90}ms`;
      }
      ui.targetBoard.appendChild(el);
      return;
    }

    if (mode === 'testBoard' && card && state.foundTargetKeys.has(card.key)) {
      const el = createCardElement(card, 'board-slot');
      el.dataset.cardKey   = card.key;
      el.dataset.slotIndex = String(index);
      ui.targetBoard.appendChild(el);
      return;
    }

    const slot = document.createElement('div');
    slot.className = 'board-slot empty reveal-dot';
    slot.dataset.slotIndex = String(index);
    slot.dataset.cardKey   = card ? card.key : '';
    slot.textContent       = '•';
    if (animate && mode === 'testBoard') {
      slot.classList.add('slot-flip-in');
      slot.style.animationDelay = `${index * 60}ms`;
    }
    ui.targetBoard.appendChild(slot);
  });
}

function renderSingleCard(card) {
  ui.singleCard.className         = 'single-card';
  void ui.singleCard.offsetWidth;
  ui.singleCard.classList.add('card-enter');
  ui.singleCard.style.background  = card.bg;
  ui.singleCard.style.color       = card.fg;
  ui.singleCard.style.borderColor = '#1a2430';
  ui.singleCard.style.opacity     = '1';
  if (isImageAvatar(card.symbol)) {
    ui.singleCard.textContent = '';
    const img = document.createElement('img');
    img.src       = card.symbol;
    img.className = 'card-img';
    ui.singleCard.appendChild(img);
  } else {
    ui.singleCard.textContent = card.symbol;
  }
}

function setSingleCardPlaceholder(text) {
  ui.singleCard.className         = 'single-card placeholder-card';
  ui.singleCard.textContent       = text;
  ui.singleCard.style.background  = '';
  ui.singleCard.style.color       = '';
  ui.singleCard.style.borderColor = '';
  ui.singleCard.style.opacity     = '1';
}

function createCardElement(card, className) {
  const el = document.createElement('div');
  el.className         = className;
  el.style.background  = card.bg;
  el.style.color       = card.fg;
  el.style.borderColor = '#1a2430';
  if (isImageAvatar(card.symbol)) {
    const img = document.createElement('img');
    img.src       = card.symbol;
    img.className = 'card-img';
    el.appendChild(img);
  } else {
    el.textContent = card.symbol;
  }
  return el;
}


// ─── Popup feedback ───────────────────────────────────────────

function showPopupFeedback(text, isGood) {
  const el = document.createElement('div');
  el.className = 'popup-feedback' + (isGood ? ' popup-good' : ' popup-bad');
  el.textContent = text;
  document.body.appendChild(el);
  // Position near singleCard
  const rect = ui.singleCard.getBoundingClientRect();
  el.style.left = (rect.left + rect.width / 2) + 'px';
  el.style.top  = (rect.top - 10) + 'px';
  window.setTimeout(() => el.remove(), 900);
}

// ─── Status display ───────────────────────────────────────────

function renderLivesDisplay(justLost = false) {
  if (!ui.livesDisplay) return;
  ui.livesDisplay.innerHTML = '';
  const livesLeft = Math.max(0, MAX_LIVES - state.mistakes);
  for (let i = 0; i < MAX_LIVES; i++) {
    const heart = document.createElement('span');
    heart.textContent = i < livesLeft ? '❤️' : '🖤';
    if (justLost && i === livesLeft) heart.classList.add('life-lost');
    ui.livesDisplay.appendChild(heart);
  }
}


function renderStreakDisplay(bump = false) {
  if (!ui.streakPill) return;
  const s = state.streak;
  ui.streakPill.textContent = s >= 5 ? '🔥🔥 ' + s : s >= 3 ? '🔥 ' + s : '✨ ' + s;
  ui.streakPill.style.borderColor = s >= 5 ? '#ff9100' : s >= 3 ? '#ffd600' : 'rgba(255,255,255,0.25)';
  ui.streakPill.style.color = s >= 5 ? '#ff9100' : s >= 3 ? '#ffd600' : 'rgba(255,255,255,0.6)';
  if (bump) {
    ui.streakPill.classList.remove('streak-bump');
    void ui.streakPill.offsetWidth;
    ui.streakPill.classList.add('streak-bump');
  }
}

function renderStarsRow(containerId, earned, total) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  for (let i = 0; i < total; i++) {
    const star = document.createElement('span');
    const isEarned = i < earned;
    star.className   = 'reward-star' + (isEarned ? ' earned' : ' empty');
    star.textContent = '⭐';
    if (isEarned) star.style.animationDelay = `${i * 180}ms`;
    container.appendChild(star);
  }
}

function setMessage(text) {
  ui.messageArea.textContent = text;
  ui.messageArea.classList.remove('msg-pop');
  void ui.messageArea.offsetWidth;
  ui.messageArea.classList.add('msg-pop');
}

function setControlsEnabled(enabled) {
  ui.acceptBtn.disabled = !enabled;
  ui.rejectBtn.disabled = !enabled;
  ui.keyboardHelp.textContent = enabled ? '← Reject  |  Accept →' : '';
  ui.keyboardHelp.setAttribute('aria-hidden', String(!enabled));
  updateSwipeHintVisibility();
}

function updateSwipeHintVisibility() {
  const isTouch = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  const show    = isTouch && state.status === 'test';
  ui.swipeHint.classList.toggle('hidden', !show);
}

// ─── Confetti ─────────────────────────────────────────────────

function triggerConfetti() {
  const container = document.getElementById('confettiContainer');
  if (!container) return;
  container.innerHTML = '';
  const colors = ['#e53935','#1e88e5','#43a047','#fdd835','#fb8c00','#ab47bc'];

  for (let i = 0; i < 70; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left              = `${Math.random() * 100}%`;
    piece.style.background        = colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDelay    = `${Math.random() * 0.8}s`;
    piece.style.animationDuration = `${0.8 + Math.random() * 0.9}s`;
    piece.style.width             = `${6 + Math.random() * 8}px`;
    piece.style.height            = `${6 + Math.random() * 8}px`;
    container.appendChild(piece);
  }

  window.setTimeout(() => { container.innerHTML = ''; }, 3500);
}

// ─── Card fly animation ───────────────────────────────────────

async function animateCardToBoard(card) {
  const slot = Array.from(ui.targetBoard.children).find((c) => c.dataset.cardKey === card.key);
  if (!slot) { flashSingleCard(true); return; }

  const src = ui.singleCard.getBoundingClientRect();
  const dst = slot.getBoundingClientRect();
  if (!src.width || !dst.width) { flashSingleCard(true); return; }

  const fly = document.createElement('div');
  fly.className = 'fly-card';
  if (isImageAvatar(card.symbol)) {
    const img = document.createElement('img');
    img.src       = card.symbol;
    img.className = 'card-img';
    fly.appendChild(img);
  } else {
    fly.textContent = card.symbol;
  }
  fly.style.background   = card.bg;
  fly.style.color        = card.fg;
  fly.style.left         = `${src.left}px`;
  fly.style.top          = `${src.top}px`;
  fly.style.width        = `${src.width}px`;
  fly.style.height       = `${src.height}px`;
  fly.style.fontSize     = window.getComputedStyle(ui.singleCard).fontSize;

  document.body.appendChild(fly);
  ui.singleCard.style.opacity = '0.18';
  slot.style.opacity          = '0.3';

  await new Promise((resolve) => {
    requestAnimationFrame(() => {
      fly.style.left     = `${dst.left}px`;
      fly.style.top      = `${dst.top}px`;
      fly.style.width    = `${dst.width}px`;
      fly.style.height   = `${dst.height}px`;
      fly.style.fontSize = window.getComputedStyle(slot).fontSize;
      fly.style.opacity  = '0.98';
    });
    window.setTimeout(resolve, 430);
  });

  slot.style.opacity          = '1';
  ui.singleCard.style.opacity = '1';
  fly.remove();
}

function highlightFilledSlot(cardKey) {
  const slot = Array.from(ui.targetBoard.children).find((c) => c.dataset.cardKey === cardKey);
  if (!slot) return;
  slot.classList.remove('arrival-highlight');
  void slot.offsetWidth;
  slot.classList.add('arrival-highlight');
}

function flashSingleCard(isCorrect) {
  ui.singleCard.classList.remove('correct-flash', 'wrong-flash');
  void ui.singleCard.offsetWidth;
  ui.singleCard.classList.add(isCorrect ? 'correct-flash' : 'wrong-flash');
}

// ─── Timer ────────────────────────────────────────────────────

function startGameTimerLoop() {
  cancelGameTimer();
  const token = ++state.timerToken;
  state.lastTickTs = 0;

  function step(now) {
    if (token !== state.timerToken) return;
    if (!state.lastTickTs) state.lastTickTs = now;

    if (state.timerActive) {
      const delta = now - state.lastTickTs;
      state.gameRemainingMs = Math.max(0, state.gameRemainingMs - delta);
    }

    state.lastTickTs = now;
    updateTimeDisplay(state.gameRemainingMs);
    updateTimerVisuals();

    if (state.timerActive) maybePlayCountdownTick();

    if (state.gameRemainingMs <= 0 &&
        state.status !== 'gameWon' && state.status !== 'gameLost') {
      finishGame(false, 'time');
      return;
    }

    state.timerRaf = window.requestAnimationFrame(step);
  }

  updateTimeDisplay(state.gameRemainingMs);
  updateTimerVisuals();
  state.timerRaf = window.requestAnimationFrame(step);
}

function pauseGameTimer()  { state.timerActive = false; state.lastCountdownSecond = null; }
function resumeGameTimer() { state.lastTickTs = 0; state.lastCountdownSecond = null; state.timerActive = true; }

function cancelGameTimer() {
  state.timerToken += 1;
  if (state.timerRaf) { window.cancelAnimationFrame(state.timerRaf); state.timerRaf = null; }
}

function startPhaseTimer(durationMs, onExpire) {
  clearPhaseTimeout();
  state.phaseTimeoutId = window.setTimeout(() => {
    state.phaseTimeoutId = null;
    onExpire();
  }, durationMs);
}

function clearPhaseTimeout() {
  if (state.phaseTimeoutId) { window.clearTimeout(state.phaseTimeoutId); state.phaseTimeoutId = null; }
}

function clearAdvanceTimeout() {
  if (state.advanceTimeoutId) { window.clearTimeout(state.advanceTimeoutId); state.advanceTimeoutId = null; }
}

function clearCountdownInterval() {
  if (state.countdownIntervalId) { window.clearInterval(state.countdownIntervalId); state.countdownIntervalId = null; }
}

function hasTimeRemaining() { return state.gameRemainingMs > 0; }

function updateTimeDisplay(remainingMs) {
  const safe    = Math.max(0, remainingMs);
  const total   = Math.ceil(safe / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  ui.timeValue.textContent = `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function updateTimerVisuals() {
  const pct = state.gameDurationMs > 0
    ? (state.gameRemainingMs / state.gameDurationMs) * 100 : 0;
  ui.timerBar.style.width = `${Math.max(0, pct)}%`;
  ui.timerBar.classList.remove('warning', 'urgent');
  if (state.gameRemainingMs <= 5000)       ui.timerBar.classList.add('urgent');
  else if (state.gameRemainingMs <= 10000) ui.timerBar.classList.add('warning');

  if (ui.timePill) ui.timePill.classList.toggle('time-urgent', state.gameRemainingMs <= 10000 && state.timerActive);
}

function startPreviewCountdown(durationMs) {
  clearCountdownInterval();
  let secsLeft = Math.round(durationMs / 1000);

  function showCountdown(n) {
    setSingleCardPlaceholder(String(n));
    void ui.singleCard.offsetWidth;
    ui.singleCard.classList.add('count-tick');
  }

  showCountdown(secsLeft);

  state.countdownIntervalId = window.setInterval(() => {
    secsLeft -= 1;
    if (secsLeft > 0 && state.status === 'memorise') {
      showCountdown(secsLeft);
    } else {
      clearCountdownInterval();
    }
  }, 1000);
}

// ─── Audio ────────────────────────────────────────────────────

function loadMuteState() {
  try {
    const saved = localStorage.getItem('memMatch_muted');
    if (saved !== null) {
      state.muted = saved === 'true';
      ui.toggleMuteBtn.textContent = state.muted ? '🔇' : '🔊';
    }
  } catch (_) {}
}

function vibrate(ms) {
  try { if (navigator.vibrate) navigator.vibrate(ms); } catch (_) {}
}

function armAudioUnlock() {
  const once = () => {
    unlockAudio();
    window.removeEventListener('pointerdown', once);
    window.removeEventListener('touchend', once);
    window.removeEventListener('keydown', once);
  };
  window.addEventListener('pointerdown', once, { passive: true });
  window.addEventListener('touchend',    once, { passive: true });
  window.addEventListener('keydown',     once);
}

function unlockAudio() {
  if (!window.AudioContext && !window.webkitAudioContext) return;
  if (!state.audioContext) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    state.audioContext = new Ctor();
  }
  if (state.audioContext.state === 'suspended') state.audioContext.resume().catch(() => {});
  if (state.audioUnlocked) return;
  try {
    const buf = state.audioContext.createBuffer(1, 1, 22050);
    const src = state.audioContext.createBufferSource();
    src.buffer = buf;
    src.connect(state.audioContext.destination);
    src.start(0);
    state.audioUnlocked = true;
  } catch (_) {}
}

function playSuccessSound() {
  unlockAudio();
  if (state.muted || !state.audioContext) return;
  const t = state.audioContext.currentTime;
  const semitones = Math.min(Math.max(0, state.streak - 1), 8);
  const factor = Math.pow(2, semitones / 12);
  playTone(523 * factor, 0.08, t,        'sine', 0.05);
  playTone(659 * factor, 0.10, t + 0.09, 'sine', 0.045);
}

function playFailureSound() {
  unlockAudio();
  if (state.muted || !state.audioContext) return;
  const t = state.audioContext.currentTime;
  playTone(260, 0.12, t,       'triangle', 0.05);
  playTone(180, 0.16, t + 0.1, 'triangle', 0.045);
}

function playMemoriseSound() {
  unlockAudio();
  if (state.muted || !state.audioContext) return;
  const t = state.audioContext.currentTime;
  playTone(440, 0.15, t,        'sine', 0.03);
  playTone(554, 0.18, t + 0.18, 'sine', 0.028);
}

function playWinSound(isBigWin) {
  unlockAudio();
  if (state.muted || !state.audioContext) return;
  const t = state.audioContext.currentTime;
  playTone(523,  0.10, t,        'sine', 0.05);
  playTone(659,  0.10, t + 0.10, 'sine', 0.05);
  playTone(784,  0.12, t + 0.20, 'sine', 0.05);
  if (isBigWin) {
    playTone(1047, 0.18, t + 0.33, 'sine', 0.06);
    playTone(1319, 0.22, t + 0.48, 'sine', 0.055);
  }
}

function maybePlayCountdownTick() {
  const secsLeft = Math.ceil(Math.max(0, state.gameRemainingMs) / 1000);
  if (secsLeft > COUNTDOWN_SOUND_THRESHOLD || secsLeft <= 0) return;
  if (state.lastCountdownSecond === secsLeft) return;
  state.lastCountdownSecond = secsLeft;
  playCountdownTick(secsLeft);
}

function playCountdownTick(secsLeft) {
  unlockAudio();
  if (state.muted || !state.audioContext) return;
  const t      = state.audioContext.currentTime;
  const urgent = secsLeft <= 5;
  const freq   = urgent ? 1040 : 820;
  playTone(freq, urgent ? 0.1 : 0.08, t, 'square', urgent ? 0.05 : 0.04);
  if (urgent) playTone(freq * 0.78, 0.07, t + 0.11, 'square', 0.03);
}

function playTone(frequency, duration, startTime, type, gainValue) {
  const osc  = state.audioContext.createOscillator();
  const gain = state.audioContext.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, startTime);
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(gainValue, startTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  osc.connect(gain);
  gain.connect(state.audioContext.destination);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.02);
}

// ─── Utilities ────────────────────────────────────────────────

function triggerAnimation(el, className) {
  if (!el) return;
  el.classList.remove(className);
  void el.offsetWidth;
  el.classList.add(className);
}

function pickRandom(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// ─── Boot ─────────────────────────────────────────────────────
init();
