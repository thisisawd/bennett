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
let musicTimer;
let musicGain;
let musicStep = 0;
let soundChosen = false;
let roundEndsAt = 0;
let pendingAnswer = null;
let connectionFailures = 0;
let submitting = null;

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
  $('#sound-toggle').textContent = `♫ Music ${soundEnabled ? 'on' : 'off'}`;
  $('#sound-toggle').setAttribute('aria-pressed', String(soundEnabled));
}
function stopMusic() {
  clearInterval(musicTimer);
  musicTimer = null;
  if (musicGain && audioContext) {
    const previousGain = musicGain;
    previousGain.gain.setTargetAtTime(0, audioContext.currentTime, .04);
    setTimeout(() => previousGain.disconnect(), 350);
    musicGain = null;
  }
}

function startMusic() {
  if (!soundEnabled || musicTimer || document.hidden) return;
  try {
    audioContext ??= new (window.AudioContext || window.webkitAudioContext)();
    audioContext.resume().catch(() => {
      stopMusic();
      soundEnabled = false;
      updateSoundButton();
      announce('Music could not start. You can continue playing without it.');
    });
    musicGain = audioContext.createGain();
    musicGain.gain.value = .025;
    musicGain.connect(audioContext.destination);
    const melody = [523.25, 659.25, 783.99, 659.25, 587.33, 698.46, 880, 698.46, 659.25, 783.99, 1046.5, 783.99, 587.33, 698.46, 783.99, 587.33];
    const bass = [130.81, 146.83, 164.81, 146.83];
    const output = musicGain;
    const beat = () => {
      const start = audioContext.currentTime;
      const notes = [melody[musicStep % melody.length]];
      if (musicStep % 2 === 0) notes.push(bass[Math.floor(musicStep / 4) % bass.length]);
      notes.forEach((frequency, index) => {
        const oscillator = audioContext.createOscillator();
        const envelope = audioContext.createGain();
        oscillator.type = index ? 'sine' : 'triangle';
        oscillator.frequency.value = frequency;
        envelope.gain.setValueAtTime(0, start);
        envelope.gain.linearRampToValueAtTime(.8, start + .02);
        envelope.gain.exponentialRampToValueAtTime(.001, start + .27);
        oscillator.connect(envelope).connect(output);
        oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
        oscillator.start(start);
        oscillator.stop(start + .3);
      });
      musicStep++;
    };
    beat();
    musicTimer = setInterval(beat, 300);
  } catch {
    stopMusic();
    soundEnabled = false;
    updateSoundButton();
    announce('Music is unavailable in this browser. You can still play without it.');
  }
}

function startWelcomeMusic() {
  if (!soundChosen) {
    soundChosen = true;
    soundEnabled = true;
    updateSoundButton();
  }
  startMusic();
}

$('#sound-toggle').addEventListener('click', () => {
  soundChosen = true;
  soundEnabled = !soundEnabled;
  updateSoundButton();
  if (soundEnabled) startMusic();
  else stopMusic();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopMusic();
  else {
    startMusic();
    if (session) pollState();
  }
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
  startWelcomeMusic();
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
$('#host-button').addEventListener('click', () => {
  startWelcomeMusic();
  $('#host-dialog').showModal();
});
$('#close-host').addEventListener('click', () => $('#host-dialog').close());
$('#create-room').addEventListener('click', async () => {
  startWelcomeMusic();
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
  pendingAnswer = null;
  stopMusic();
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
  const requestedSession = session;
  try {
    const requestedAt = performance.now();
    const state = await request('state', requestedSession);
    if (session !== requestedSession) return;
    if (!session) return;
    if (state.status === 'playing') roundEndsAt = performance.now() + Math.max(0, state.question.remainingMs - (performance.now() - requestedAt) / 2);
    currentState = state;
    connectionFailures = 0;
    $('#connection-notice')?.remove();
    renderState(state);
  } catch (error) {
    if (session !== requestedSession) return;
    connectionFailures++;
    const fatal = error.status === 404 || error.status === 403;
    showConnectionError(error.message, fatal);
    if (fatal) clearInterval(countdownTimer);
    if (fatal) return;
  } finally {
    pollBusy = false;
  }
  if (session && currentState?.status !== 'finished') {
    pollTimer = setTimeout(pollState, Math.min(750 * Math.max(1, connectionFailures), 6000));
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
  if (pendingAnswer && (pendingAnswer.index !== state.index || state.status !== 'playing' || state.player?.selected !== null)) pendingAnswer = null;
  const key = `${state.role}-${state.status}-${state.index}`;
  if (key === renderKey) {
    if (state.status === 'lobby' && state.role === 'host') updateHost(state);
    if (state.status === 'playing') updateLiveRound(state);
    return;
  }
  renderKey = key;
  if (state.status === 'finished') return renderResults(state);
  if (state.status === 'lobby' && state.role === 'host') return renderHost(state);
  if (state.status === 'lobby') return renderPlayerLobby(state);
  renderQuestion(state);
}

function renderHost(state) {
  const panel = makePanel('HOST LOBBY · LIVE TOGETHER', 'A room full of Bennett experts.');
  panel.append(element('p', 'muted', 'Share the invite link below. Everyone joins on their own device; this host screen is ready to share on a call or projector.'));
  panel.append(element('div', 'room-code', state.code));
  const share = element('div', 'panel-actions');
  const inviteUrl = new URL(location.pathname, location.origin);
  inviteUrl.searchParams.set('room', state.code);
  const invite = element('a', 'invite-link', inviteUrl.href);
  invite.href = inviteUrl.href;
  panel.append(invite);
  share.append(action('Copy invite link ↗', async (event) => {
    const button = event.currentTarget;
    try {
      await navigator.clipboard.writeText(inviteUrl.href);
      announce('Invite link copied.');
      button.textContent = 'Copied ✓';
    } catch { announce('Copy is unavailable. Select the invite link above and copy it, or share this page address and game code.'); }
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
  const start = action('Everyone’s here. Let’s start →', () => hostAction('start'), true);
  start.id = 'host-start';
  buttons.append(start);
  panel.append(buttons);
  panel.append(element('div', 'rules-box', '20 researched questions · 10 seconds per round · Same question and answer order for everyone. Answers stay private until time runs out, then everyone sees who got it right. You choose when to start the next round. Rooms expire after 6 hours; restarting the server clears games.'));
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
      item.append(element('span', '', avatars[player.avatar].emoji), element('span', '', player.name));
      list.append(item);
    });
  }
  const message = `${state.players.length} ${state.players.length === 1 ? 'player' : 'players'} joined${state.players.length ? ' — ready when you are.' : ' — waiting for the first legend.'}`;
  if ($('#host-status').textContent !== message) $('#host-status').textContent = message;
  $('#host-start').disabled = !state.players.length;
}

async function hostAction(command) {
  startWelcomeMusic();
  const buttons = experience.querySelectorAll('button');
  buttons.forEach((button) => { button.disabled = true; });
  try {
    await request(command, { ...session, index: currentState.index });
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
  panel.append(element('div', 'rules-box', 'Everyone gets the same question at the same time. Pick one answer within 10 seconds. Your first choice is final, and correct, faster answers earn more points. When time runs out, see who got it right. The host starts the next question.'));
  panel.append(element('p', 'muted centered', 'An original upbeat loop plays after you join. Use Music in the header to mute it at any time.'));
  announce('You joined the game. Waiting for the host to start.');
}

function renderQuestion(state) {
  const question = state.question;
  if (!question) return;
  const revealing = state.status === 'reveal';
  const panel = makePanel(`LIVE · QUESTION ${state.index + 1} OF ${state.total}`, question.prompt);
  const top = element('div', 'panel-top');
  const badge = element('div', 'player-badge');
  badge.append(element('span', '', state.role === 'host' ? '📡' : avatars[state.player.avatar].emoji), element('span', '', state.role === 'host' ? 'Host · Share this screen' : state.player.name));
  const score = element('span', 'score-pill', state.role === 'host' ? `Room ${state.code}` : `${state.player.score.toLocaleString()} pts`);
  const timer = element('span', 'timer');
  timer.id = 'question-timer';
  timer.setAttribute('role', 'timer');
  timer.setAttribute('aria-label', 'Time remaining');
  timer.append(element('span', 'time-value', revealing ? '0s' : '10s'));
  top.append(badge, score, timer);
  panel.insertBefore(top, panel.firstChild);
  const progress = element('progress', 'progress-track');
  progress.max = state.total;
  progress.value = state.index + (revealing ? 1 : 0);
  progress.setAttribute('aria-label', 'Quiz completion');
  panel.insertBefore(progress, panel.querySelector('.eyebrow'));
  panel.append(element('p', 'question-category', question.category));
  const grid = element('div', 'answer-grid');
  question.answers.forEach((answer, index) => {
    const interactive = state.role === 'player' && !revealing;
    const button = element(interactive ? 'button' : 'div', 'answer-button');
    button.append(element('span', 'answer-letter', 'ABCD'[index]), element('span', '', answer));
    button.dataset.answer = index;
    if (interactive) {
      button.type = 'button';
      button.setAttribute('aria-pressed', 'false');
      button.addEventListener('click', () => submitAnswer(index));
    }
    if (revealing && index === state.reveal.correctAnswer) {
      button.classList.add('correct');
      button.append(element('span', 'answer-mark', '✓ Correct'));
    }
    if (revealing && index === state.player?.selected) {
      button.classList.add(index === state.reveal.correctAnswer ? 'correct' : 'incorrect');
      button.append(element('span', 'answer-mark', 'Your answer'));
    }
    grid.append(button);
  });
  panel.append(grid);
  if (revealing) return renderRoundReveal(state, panel);
  const status = element('p', 'muted');
  status.id = 'round-status';
  status.setAttribute('role', 'status');
  panel.append(status);
  panel.append(element('p', 'muted', 'One choice. Ten seconds. No answers revealed until the clock hits zero.'));
  let warned = false;
  let expired = false;
  const tick = () => {
    const remaining = Math.max(0, Math.ceil((roundEndsAt - performance.now()) / 1000));
    timer.querySelector('.time-value').textContent = `${remaining}s`;
    timer.setAttribute('aria-label', `${remaining} seconds remaining`);
    timer.classList.toggle('urgent', remaining <= 5);
    if (remaining <= 5 && !warned) { warned = true; announce('Five seconds or less remaining.'); }
    updateLiveRound(currentState);
    if (!remaining && !expired) {
      expired = true;
      announce('Time is up. Waiting for the server to reveal the answers.');
      pollState();
    }
  };
  tick();
  countdownTimer = setInterval(tick, 100);
  playTone('tap');
}

function updateLiveRound(state) {
  if (state?.status !== 'playing') return;
  const selected = state.player?.selected ?? pendingAnswer?.answer ?? null;
  const expired = performance.now() >= roundEndsAt;
  experience.querySelectorAll('button.answer-button').forEach((button) => {
    const chosen = Number(button.dataset.answer) === selected;
    button.disabled = selected !== null || expired;
    button.classList.toggle('selected', chosen);
    button.setAttribute('aria-pressed', String(chosen));
  });
  const answered = state.players.filter((player) => player.answered).length;
  const message = expired ? 'Time’s up! Revealing the answers…' : state.role === 'host' ? `${answered} of ${state.players.length} answers locked in. Everyone has the full 10 seconds.` : pendingAnswer && !pendingAnswer.accepted ? 'Sending your answer… Your choice is saved here while we reconnect.' : selected !== null ? `Answer ${'ABCD'[selected]} locked in. Waiting for the reveal…` : 'Pick your answer before the timer reaches zero.';
  if ($('#round-status') && $('#round-status').textContent !== message) $('#round-status').textContent = message;
}

function renderRoundReveal(state, panel) {
  const reveal = state.reveal;
  const feedback = element('div', 'answer-feedback');
  feedback.append(element('h2', '', 'Time’s up. Who got it right?'), element('p', '', reveal.explanation));
  const source = element('a', 'source-link', `Source: ${reveal.source.label}`);
  source.href = reveal.source.url;
  source.target = '_blank';
  source.rel = 'noopener noreferrer';
  source.append(element('span', 'sr-only', ' (opens in a new tab)'));
  feedback.append(source);
  const list = element('ul', 'round-results');
  reveal.players.forEach((player) => {
    const row = element('li', `round-result${player.correct ? ' round-correct' : ''}`);
    const outcome = player.selected === null ? 'No answer' : player.correct ? 'Correct ✓' : `Incorrect · picked ${'ABCD'[player.selected]}`;
    row.append(element('span', 'round-player', `${avatars[player.avatar].emoji} ${player.name}`), element('span', '', outcome), element('span', '', `+${player.points} · ${player.score.toLocaleString()} total`));
    list.append(row);
  });
  feedback.append(list);
  panel.append(feedback);
  if (state.role === 'host') {
    const controls = element('div', 'panel-actions');
    controls.append(action(state.index === state.total - 1 ? 'Reveal final podium →' : 'Next question →', () => hostAction('next'), true));
    panel.append(controls);
  } else {
    panel.append(element('p', 'muted', 'The host will start the next round when everyone is ready.'));
  }
  const correctCount = reveal.players.filter((player) => player.correct).length;
  announce(`Time is up. Correct answer: ${state.question.answers[reveal.correctAnswer]}. ${correctCount} of ${reveal.players.length} players got it right.`);
  playTone(state.role === 'player' && state.player.selected !== reveal.correctAnswer ? 'wrong' : 'correct');
}

async function submitAnswer(answer) {
  if (submitting?.index === currentState?.index || currentState?.status !== 'playing' || currentState.player?.selected !== null || performance.now() >= roundEndsAt) return;
  pendingAnswer ??= { index: currentState.index, answer };
  const submission = pendingAnswer;
  const answerSession = session;
  submitting = submission;
  updateLiveRound(currentState);
  try {
    const result = await request('answer', { ...answerSession, index: submission.index, answer: submission.answer });
    if (session !== answerSession || currentState?.index !== submission.index || currentState.status !== 'playing') return;
    currentState.player.selected = result.selected;
    submission.answer = result.selected;
    submission.accepted = true;
    $('#answer-error')?.remove();
    updateLiveRound(currentState);
    announce(`Answer ${'ABCD'[result.selected]} locked in.`);
    playTone('tap');
  } catch (error) {
    if (session !== answerSession || currentState?.index !== submission.index || currentState.status !== 'playing' || currentState.player.selected !== null) return;
    if (error.status === 409) {
      pendingAnswer = null;
      return pollState();
    }
    $('#answer-error')?.remove();
    const notice = element('div', 'connection-notice', error.message);
    notice.id = 'answer-error';
    notice.setAttribute('role', 'alert');
    notice.append(action('Retry same answer', () => submitAnswer(submission.answer)));
    experience.querySelector('.game-panel')?.append(notice);
  } finally {
    if (submitting === submission) submitting = null;
  }
}

function renderResults(state) {
  pendingAnswer = null;
  const leaders = state.leaderboard;
  const winners = leaders.filter((player) => player.score === leaders[0]?.score);
  const panel = makePanel('THE OFFICIAL BENNETT BRAGGING RIGHTS', winners.length > 1 ? 'A tie at the top. Double the legends.' : `${leaders[0]?.name || 'The team'} knows Bennett best.`);
  const celebration = element('div', 'confetti');
  celebration.setAttribute('aria-hidden', 'true');
  ['✦', '🏆', '✦'].forEach((symbol) => celebration.append(element('span', '', symbol)));
  panel.append(celebration);
  panel.append(element('p', 'muted centered', 'Twenty live rounds. A little design knowledge. A lot of Bennett energy.'));
  const list = element('ol', 'leaderboard');
  leaders.forEach((player) => {
    const row = element('li', 'leader-row');
    row.append(element('span', '', `#${player.rank}`), element('span', 'leader-avatar', avatars[player.avatar].emoji), element('span', 'leader-name', `${player.name}${player.isYou ? ' (you)' : ''}`), element('span', 'leader-points', `${player.score.toLocaleString()} pts`));
    list.append(row);
  });
  panel.append(list);
  panel.append(element('p', 'muted', 'Correct answers earn 600–1,000 points based on speed. Equal scores share a place. Sources include Alexander’s public portfolio, Microsoft documentation, and Visit Rochester. Portfolio entries do not imply sole authorship or a shipped product.'));
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
