const avatars = [
  { emoji: '🦊', name: 'Fox' },
  { emoji: '🐶', name: 'Dog' },
  { emoji: '🐸', name: 'Frog' },
  { emoji: '🐻', name: 'Bear' },
  { emoji: '🦄', name: 'Unicorn' },
  { emoji: '😎', name: 'Cool face' },
];
const $ = (selector) => document.querySelector(selector);
const experience = $('#experience');
let session = null;
let currentState = null;
let renderKey = '';
let pollTimer;
let countdownTimer;
let pollBusy = false;
let soundEnabled = false;
let audioContext;
let activeFeedback = null;
let pendingAnswer = null;
let connectionFailures = 0;
let submitting = false;

const announce = (text) => { $('#announcement').textContent = text; };
const element = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};
const action = (label, callback, primary = false) => {
  const button = element('button', `button ${primary ? 'button-primary' : 'button-outline'}`, label);
  button.type = 'button';
  button.addEventListener('click', callback);
  return button;
};

avatars.forEach(({ emoji, name }, index) => {
  const choice = element('div', 'avatar-choice');
  const input = element('input');
  input.type = 'radio';
  input.name = 'avatar';
  input.id = `avatar-${index}`;
  input.value = String(index);
  input.checked = index === 0;
  const label = element('label', '', emoji);
  label.htmlFor = input.id;
  input.setAttribute('aria-label', name);
  choice.append(input, label);
  $('#avatar-options').append(choice);
});

function playTone(kind) {
  if (!soundEnabled) return;
  try {
    audioContext ??= new (window.AudioContext || window.webkitAudioContext)();
    audioContext.resume();
    const notes = kind === 'win' ? [523, 659, 784, 1047] : kind === 'correct' ? [523, 784] : kind === 'wrong' ? [247, 196] : [440];
    notes.forEach((frequency, index) => {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const start = audioContext.currentTime + index * .13;
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(.055, start + .015);
      gain.gain.exponentialRampToValueAtTime(.001, start + .24);
      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start(start);
      oscillator.stop(start + .25);
    });
  } catch {
    soundEnabled = false;
    updateSoundButton();
    announce('Sound is unavailable in this browser. You can still play without it.');
  }
}

function updateSoundButton() {
  $('#sound-toggle').textContent = `♫ Sound ${soundEnabled ? 'on' : 'off'}`;
  $('#sound-toggle').setAttribute('aria-pressed', String(soundEnabled));
}
$('#sound-toggle').addEventListener('click', () => {
  soundEnabled = !soundEnabled;
  updateSoundButton();
  if (soundEnabled) playTone('tap');
});

async function request(path, body) {
  const apiOrigin = (window.BENNETT_API_ORIGIN || '').replace(/\/+$/, '');
  if (!apiOrigin && location.hostname.endsWith('.github.io')) {
    throw new Error('The quiz page is online, but its multiplayer server is not connected yet. The host needs to set the server address in config.js.');
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);
  try {
    const response = await fetch(`${apiOrigin}/api/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: 'no-store',
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const error = new Error(data?.error || 'The game server is unavailable. Please try again.');
      error.status = response.status;
      throw error;
    }
    if (!data) throw new Error('The game server returned an unexpected response. Please try again.');
    return data;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('The server took too long to respond. Check your connection and retry.');
    if (error instanceof TypeError) throw new Error('Cannot reach the game server. Check your connection and retry. This quiz needs its Node.js server running.');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function saveSession(value) {
  session = value;
  try {
    if (value) sessionStorage.setItem('bennett-session', JSON.stringify(value));
    else sessionStorage.removeItem('bennett-session');
  } catch {
    announce('Browser storage is unavailable. Keep this tab open to stay in the game.');
  }
}

function enterGame(value) {
  saveSession(value);
  $('#host-dialog').close();
  $('#landing').classList.add('hidden');
  $('#how-it-works').classList.add('hidden');
  experience.classList.remove('hidden');
  $('#host-button').classList.add('hidden');
  renderKey = '';
  pollState();
}

$('#join-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const code = $('#room-code').value.trim().toUpperCase();
  const name = $('#player-name').value.trim();
  const codeInvalid = !/^[A-Z2-9]{6}$/.test(code);
  $('#room-code').setAttribute('aria-invalid', String(codeInvalid));
  $('#player-name').setAttribute('aria-invalid', String(!name));
  if (codeInvalid || !name) {
    $('#form-error').textContent = codeInvalid ? 'Enter the six-character game code from your host.' : 'Enter a name so the team knows who is playing.';
    $(codeInvalid ? '#room-code' : '#player-name').focus();
    return;
  }
  const button = $('#join-submit');
  button.disabled = true;
  button.textContent = 'Joining your game…';
  $('#form-error').textContent = '';
  try {
    const data = await request('join', { code, name, avatar: Number($('input[name="avatar"]:checked').value) });
    enterGame({ code, token: data.token, role: 'player' });
    playTone('correct');
  } catch (error) {
    $('#form-error').textContent = error.message;
  } finally {
    button.disabled = false;
    button.textContent = "Let's play →";
  }
});
$('#room-code').addEventListener('input', () => {
  $('#room-code').value = $('#room-code').value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  $('#room-code').removeAttribute('aria-invalid');
});
$('#player-name').addEventListener('input', () => $('#player-name').removeAttribute('aria-invalid'));
$('#host-button').addEventListener('click', () => $('#host-dialog').showModal());
$('#close-host').addEventListener('click', () => $('#host-dialog').close());
$('#create-room').addEventListener('click', async () => {
  $('#create-room').disabled = true;
  $('#create-room').textContent = 'Making room for the team…';
  $('#host-error').textContent = '';
  try {
    const data = await request('create', {});
    enterGame({ code: data.code, token: data.token, role: 'host' });
  } catch (error) {
    $('#host-error').textContent = error.message;
  } finally {
    $('#create-room').disabled = false;
    $('#create-room').textContent = 'Create a game →';
  }
});

function resetHome() {
  clearTimeout(pollTimer);
  clearInterval(countdownTimer);
  saveSession(null);
  currentState = null;
  activeFeedback = null;
  pendingAnswer = null;
  connectionFailures = 0;
  experience.replaceChildren();
  experience.classList.add('hidden');
  $('#landing').classList.remove('hidden');
  $('#how-it-works').classList.remove('hidden');
  $('#host-button').classList.remove('hidden');
  $('#room-code').focus();
}

function showConnectionError(message, fatal = false) {
  let notice = $('#connection-notice');
  if (!notice) {
    notice = element('div', 'connection-notice');
    notice.id = 'connection-notice';
    notice.setAttribute('role', 'alert');
    experience.prepend(notice);
  }
  notice.replaceChildren(element('span', '', message));
  notice.append(action(fatal ? 'Back to lobby' : 'Retry now', fatal ? resetHome : pollState));
}

async function pollState() {
  if (!session || pollBusy) return;
  clearTimeout(pollTimer);
  pollBusy = true;
  try {
    const state = await request('state', { ...session, advance: !activeFeedback && !pendingAnswer });
    if (!session) return;
    currentState = state;
    connectionFailures = 0;
    $('#connection-notice')?.remove();
    renderState(state);
  } catch (error) {
    connectionFailures++;
    const fatal = error.status === 404 || error.status === 403;
    showConnectionError(error.message, fatal);
    if (fatal) clearInterval(countdownTimer);
    if (fatal) return;
  } finally {
    pollBusy = false;
  }
  if (session && currentState?.status !== 'finished') {
    pollTimer = setTimeout(pollState, Math.min(1500 * Math.max(1, connectionFailures), 6000));
  }
}

function makePanel(eyebrow, title) {
  clearInterval(countdownTimer);
  experience.replaceChildren();
  const panel = element('div', 'game-panel');
  panel.append(element('p', 'eyebrow', eyebrow));
  const heading = element('h1', '', title);
  heading.id = 'experience-title';
  heading.tabIndex = -1;
  panel.append(heading);
  experience.append(panel);
  heading.focus({ preventScroll: true });
  return panel;
}

function renderState(state) {
  if (pendingAnswer && !activeFeedback && state.status === 'playing') return;
  if (state.role === 'player' && activeFeedback && state.status === 'playing') {
    if (state.player.index === activeFeedback.index + 1) return;
    activeFeedback = null;
  }
  const key = `${state.role}-${state.status}-${state.player?.index ?? ''}`;
  if (key === renderKey) {
    if (state.role === 'host') updateHost(state);
    return;
  }
  renderKey = key;
  if (state.status === 'finished') return renderResults(state);
  if (state.role === 'host') return renderHost(state);
  if (state.status === 'lobby') return renderPlayerLobby(state);
  if (state.player.done) return renderWaiting(state);
  renderQuestion(state);
}

function renderHost(state) {
  const playing = state.status === 'playing';
  const panel = makePanel(playing ? 'THE GAME IS ON' : 'HOST LOBBY', playing ? 'Let the Bennett instincts take over.' : 'A room full of Bennett experts.');
  panel.append(element('p', 'muted', playing ? 'Everyone is playing privately. The podium unlocks when all players finish.' : 'Share this code with your team. Keep this tab open as your host screen.'));
  panel.append(element('div', 'room-code', state.code));
  const share = element('div', 'panel-actions');
  share.append(action('Copy invite link ↗', async (event) => {
    const button = event.currentTarget;
    try {
      const url = new URL(location.pathname, location.origin);
      url.searchParams.set('room', state.code);
      await navigator.clipboard.writeText(url.href);
      announce('Invite link copied.');
      button.textContent = 'Copied ✓';
    } catch { announce(`Copy is unavailable. Share code ${state.code} and this page address.`); }
  }));
  panel.append(share);
  const heading = element('h2', '', 'Who’s in?');
  heading.id = 'players-title';
  panel.append(heading);
  const list = element('ul', 'players-list');
  list.id = 'players-list';
  list.setAttribute('aria-labelledby', 'players-title');
  panel.append(list);
  const status = element('p', 'muted');
  status.id = 'host-status';
  status.setAttribute('role', 'status');
  panel.append(status);
  const buttons = element('div', 'panel-actions');
  const start = action(playing ? 'Reveal the podium →' : 'Everyone’s here. Let’s start →', () => hostAction(playing ? 'finish' : 'start'), true);
  start.id = 'host-start';
  buttons.append(start);
  if (playing) {
    const end = action('End early…', () => {
      const confirmation = $('#end-confirmation');
      confirmation.classList.remove('hidden');
      confirmation.querySelector('button').focus();
    });
    buttons.append(end);
  }
  panel.append(buttons);
  if (playing) {
    const confirmation = element('div', 'rules-box hidden');
    confirmation.id = 'end-confirmation';
    confirmation.append(element('p', '', 'Reveal now? Unfinished players keep only their points earned so far. This cannot be undone.'));
    confirmation.append(action('Yes, end and reveal', () => hostAction('finish', true)));
    confirmation.append(action('Keep playing', () => {
      confirmation.classList.add('hidden');
      buttons.lastChild.focus();
    }));
    panel.append(confirmation);
  }
  panel.append(element('div', 'rules-box', '20 questions · 25 seconds each · Up to 1,000 points per correct answer. Seven real facts, thirteen playful hypotheticals. No account needed. Rooms expire after 6 hours; restarting the server clears games.'));
  updateHost(state);
}

function updateHost(state) {
  const list = $('#players-list');
  if (!list) return;
  const signature = JSON.stringify(state.players);
  if (list.dataset.signature !== signature) {
    list.dataset.signature = signature;
    list.replaceChildren();
    state.players.forEach((player) => {
      const item = element('li', 'player-chip');
      item.append(element('span', '', avatars[player.avatar].emoji), element('span', '', `${player.name}${player.done ? ' · Finished ✓' : ''}`));
      list.append(item);
    });
  }
  const finished = state.players.filter((player) => player.done).length;
  const message = state.status === 'lobby' ? `${state.players.length} ${state.players.length === 1 ? 'player' : 'players'} joined${state.players.length ? ' — ready when you are.' : ' — waiting for the first legend.'}` : `${finished} of ${state.players.length} finished. ${finished === state.players.length ? 'Everyone is back. Time for the big reveal!' : 'Let everyone finish, or use “End early” if someone has left.'}`;
  if ($('#host-status').textContent !== message) $('#host-status').textContent = message;
  $('#host-start').disabled = state.status === 'lobby' ? !state.players.length : finished !== state.players.length;
}

async function hostAction(command, force = false) {
  const buttons = experience.querySelectorAll('button');
  buttons.forEach((button) => { button.disabled = true; });
  try {
    await request(command, { ...session, force });
    await pollState();
    playTone(command === 'start' ? 'correct' : 'win');
  } catch (error) {
    showConnectionError(error.message);
  } finally {
    buttons.forEach((button) => { button.disabled = false; });
    if (currentState && $('#host-start')) updateHost(currentState);
  }
}

function renderPlayerLobby(state) {
  const panel = makePanel(`ROOM ${state.code} · YOU'RE IN`, `Looking good, ${state.player.name}.`);
  panel.append(element('div', 'waiting-art', avatars[state.player.avatar].emoji));
  panel.append(element('p', 'centered', 'Your host will start the game when the team is ready.'));
  panel.append(element('div', 'rules-box', 'Your screen. Your answers. No spoilers. You have 25 seconds per question, and correct, faster answers earn more points. After each reveal, choose when to move on. Keep this tab open for the final podium.'));
  panel.append(element('p', 'muted centered', 'Sound is optional — switch it on in the header for a little extra fanfare.'));
  announce('You joined the game. Waiting for the host to start.');
}

function renderQuestion(state) {
  const question = state.question;
  if (!question) return;
  submitting = false;
  const panel = makePanel(`QUESTION ${state.player.index + 1} OF ${state.total}`, question.prompt);
  const top = element('div', 'panel-top');
  const badge = element('div', 'player-badge');
  badge.append(element('span', '', avatars[state.player.avatar].emoji), element('span', '', state.player.name));
  const score = element('span', 'score-pill', `${state.player.score.toLocaleString()} pts`);
  const timer = element('span', 'timer');
  timer.id = 'question-timer';
  timer.setAttribute('aria-label', 'Time remaining');
  timer.append(element('span', '', '◷'), element('span', 'time-value', '25s'));
  top.append(badge, score, timer);
  panel.insertBefore(top, panel.firstChild);
  const progress = element('progress', 'progress-track');
  progress.max = state.total;
  progress.value = state.player.index;
  progress.setAttribute('aria-label', 'Quiz completion');
  panel.insertBefore(progress, panel.querySelector('.eyebrow'));
  panel.append(element('p', 'question-category', question.category));
  const grid = element('div', 'answer-grid');
  question.answers.forEach((answer, index) => {
    const button = element('button', 'answer-button');
    button.type = 'button';
    button.append(element('span', 'answer-letter', 'ABCD'[index]), element('span', '', answer));
    button.dataset.answer = index;
    button.addEventListener('click', () => submitAnswer(index));
    grid.append(button);
  });
  panel.append(grid);
  panel.append(element('p', 'muted', question.kind === 'fact' ? 'THE REAL DEAL · Based on a fact shared by the team.' : 'JUST FOR FUN · An imagined scenario, not a claim about Alex. Pick the most Bennett-energy answer.'));
  const remainingAtSync = question.remainingMs;
  const syncedAt = performance.now();
  let warned = false;
  const tick = () => {
    const remaining = Math.max(0, Math.ceil((remainingAtSync - (performance.now() - syncedAt)) / 1000));
    timer.querySelector('.time-value').textContent = `${remaining}s`;
    timer.classList.toggle('urgent', remaining <= 5);
    if (remaining <= 5 && !warned) { warned = true; announce('Five seconds or less remaining.'); }
    if (!remaining) {
      clearInterval(countdownTimer);
      submitAnswer(-1);
    }
  };
  tick();
  if (!submitting) countdownTimer = setInterval(tick, 200);
  playTone('tap');
}

async function submitAnswer(answer) {
  if (submitting || activeFeedback || (!pendingAnswer && !currentState?.question)) return;
  submitting = true;
  clearInterval(countdownTimer);
  pendingAnswer ??= { index: currentState.player.index, answer };
  const { index } = pendingAnswer;
  const buttons = experience.querySelectorAll('.answer-button');
  buttons.forEach((button) => { button.disabled = true; });
  try {
    const result = await request('answer', { ...session, ...pendingAnswer });
    pendingAnswer = null;
    if (currentState?.status === 'finished') return;
    if (result.finished) {
      activeFeedback = null;
      submitting = false;
      renderKey = '';
      return pollState();
    }
    activeFeedback = { ...result, index };
    $('#answer-error')?.remove();
    buttons.forEach((button, position) => {
      if (position === result.correctAnswer) {
        button.classList.add('correct');
        button.append(element('span', '', '✓'));
      } else if (position === result.selected) {
        button.classList.add('incorrect');
        button.append(element('span', '', '✕'));
      }
    });
    const feedback = element('div', `answer-feedback${result.correct ? '' : ' wrong'}`);
    const heading = element('h3', '', result.correct ? `That's Bennett. +${result.points} points!` : result.selected === -1 ? 'Time’s up. Meet the answer.' : 'Not quite. A little more Bennett lore.');
    heading.tabIndex = -1;
    feedback.append(heading, element('p', '', result.explanation));
    feedback.append(action(index === currentState.total - 1 ? 'Head to the reunion →' : 'Next question →', () => {
      activeFeedback = null;
      submitting = false;
      renderKey = '';
      pollState();
    }, true));
    experience.querySelector('.game-panel').append(feedback);
    heading.focus({ preventScroll: true });
    announce(`${result.correct ? 'Correct.' : 'Incorrect.'} ${result.points} points earned. ${result.explanation}`);
    playTone(result.correct ? 'correct' : 'wrong');
  } catch (error) {
    submitting = false;
    if (error.status === 409) {
      pendingAnswer = null;
      activeFeedback = null;
      renderKey = '';
      return pollState();
    }
    $('#answer-error')?.remove();
    const notice = element('div', 'connection-notice', error.message);
    notice.id = 'answer-error';
    notice.setAttribute('role', 'alert');
    notice.append(action('Retry answer', () => submitAnswer(answer)));
    experience.querySelector('.game-panel')?.append(notice);
  }
}

function renderWaiting(state) {
  const panel = makePanel('20 QUESTIONS. MAXIMUM BENNETT.', 'You’ve done your part. Now, the suspense.');
  panel.append(element('div', 'waiting-art', '🏆'));
  panel.append(element('p', 'centered', `${state.player.score.toLocaleString()} points · ${state.player.correct} of ${state.total} correct`));
  panel.append(element('p', 'muted centered', 'Your score is saved in this room. Keep this tab open — the final leaderboard appears here when your host reveals the winner.'));
  announce('Quiz complete. Waiting for the host to reveal the final leaderboard.');
}

function renderResults(state) {
  activeFeedback = null;
  pendingAnswer = null;
  const leaders = state.leaderboard;
  const winners = leaders.filter((player) => player.score === leaders[0]?.score);
  const panel = makePanel('THE OFFICIAL BENNETT BRAGGING RIGHTS', winners.length > 1 ? 'A tie at the top. Double the legends.' : `${leaders[0]?.name || 'The team'} knows Bennett best.`);
  const celebration = element('div', 'confetti');
  celebration.setAttribute('aria-hidden', 'true');
  ['✦', '🏆', '✦'].forEach((symbol) => celebration.append(element('span', '', symbol)));
  panel.append(celebration);
  panel.append(element('p', 'muted centered', 'New Hampshire roots. Industrial design instincts. A team that knows a little more about Alex.'));
  const list = element('ol', 'leaderboard');
  leaders.forEach((player) => {
    const row = element('li', 'leader-row');
    row.append(element('span', '', `#${player.rank}`), element('span', 'leader-avatar', avatars[player.avatar].emoji), element('span', 'leader-name', `${player.name}${player.token === session.token ? ' (you)' : ''}`), element('span', 'leader-points', `${player.score.toLocaleString()} pts`));
    list.append(row);
  });
  panel.append(list);
  panel.append(element('p', 'muted', 'Correct answers earn 600–1,000 points based on speed. Equal scores share a place. Hypothetical answers were just for fun, not biographical facts.'));
  panel.append(action('Back to the lobby ↗', resetHome, true));
  playTone('win');
  announce(winners.length > 1 ? 'The results are in. It is a tie!' : `The results are in. ${leaders[0]?.name} wins!`);
}

function applyIllustrativeState(detail) {
  if (!detail?.id) return;
  const notice = $('#runtime-notice');
  if (detail.phase === 'inactive') {
    notice.classList.add('hidden');
    notice.replaceChildren();
    return;
  }
  notice.classList.remove('hidden');
  notice.dataset.stateId = detail.id;
  if (detail.phase === 'pending') {
    notice.textContent = 'Connecting to the game… Hang tight.';
    return;
  }
  if (detail.phase === 'active') {
    const messages = {
      'network-failure': 'The connection dropped. Your entries are still here. Check your connection and retry.',
      'server-failure': 'The game server is having a moment. Please retry.',
      'permission-denied': 'This game is not available to join. Ask your host for the current code.',
      'not-found': 'We could not find that game. Check the code with your host.',
      'timeout': 'The connection took too long. Please retry.',
      'empty': 'No players yet. Share your game code to bring the team in.',
    };
    notice.replaceChildren(element('span', '', messages[detail.id] || 'The game could not connect. Your entries are preserved. Please retry.'));
    notice.append(action('Retry', () => {
      notice.classList.add('hidden');
      announce('Ready to retry. Your entries are preserved.');
    }));
  }
}

window.addEventListener('vibe:error-state', (event) => applyIllustrativeState(event.detail));
const errorRuntime = window.__vibeErrorStateRuntime;
for (const [phase, value] of [['pending', errorRuntime?.getPending()], ['active', errorRuntime?.getActive()]]) {
  const states = Array.isArray(value) ? value : value ? [value] : [];
  states.forEach((state) => applyIllustrativeState(typeof state === 'string' ? { id: state, phase } : { ...state, phase }));
}

const inviteCode = new URLSearchParams(location.search).get('room');
if (inviteCode && /^[A-Z2-9]{6}$/.test(inviteCode)) $('#room-code').value = inviteCode;
try {
  const saved = JSON.parse(sessionStorage.getItem('bennett-session'));
  if (saved?.code && saved?.token && ['player', 'host'].includes(saved.role)) enterGame(saved);
} catch { /* A fresh lobby remains available when session storage cannot be read. */ }
