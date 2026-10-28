const avatars = [
  { emoji: '🦊', name: 'Fox' },
  { emoji: '🐶', name: 'Dog' },
  { emoji: '🐸', name: 'Frog' },
  { emoji: '🐻', name: 'Bear' },
  { emoji: '🦄', name: 'Unicorn' },
  { emoji: '😎', name: 'Cool face' },
  { emoji: '🦁', name: 'Lion' },
  { emoji: '🐼', name: 'Panda' },
  { emoji: '🐨', name: 'Koala' },
  { emoji: '🐯', name: 'Tiger' },
  { emoji: '🐵', name: 'Monkey' },
  { emoji: '🐧', name: 'Penguin' },
  { emoji: '🦉', name: 'Owl' },
  { emoji: '🦋', name: 'Butterfly' },
  { emoji: '🐙', name: 'Octopus' },
  { emoji: '🦖', name: 'Dinosaur' },
  { emoji: '🐢', name: 'Turtle' },
  { emoji: '🐬', name: 'Dolphin' },
  { emoji: '🦈', name: 'Shark' },
  { emoji: '🐝', name: 'Bee' },
  { emoji: '🦦', name: 'Otter' },
  { emoji: '🦥', name: 'Sloth' },
  { emoji: '🤖', name: 'Robot' },
  { emoji: '👽', name: 'Alien' },
  { emoji: '🚀', name: 'Rocket' },
  { emoji: '⚾', name: 'Baseball' },
];
const $ = (selector) => document.querySelector(selector);
const experience = $('#experience');
let session = null;
let currentState = null;
let renderKey = '';
let pollTimer;
let countdownTimer;
let imageTimer;
let pollBusy = false;
let hostBusy = false;
let settingsBusy = false;
let mapDraft = null;
let soundEnabled = false;
let audioContext;
let musicTimer;
let musicGain;
let musicStep = 0;
let musicNoise;
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

avatars.slice(0, 5).forEach(({ emoji, name }, index) => {
  const choice = element('div', 'avatar-choice');
  const input = element('input');
  input.type = 'radio';
  input.name = 'avatar';
  input.id = `avatar-${index}`;
  input.value = String(index);
  input.checked = index === 0;
  input.addEventListener('change', () => {
    $('#more-avatars').value = '';
    $('#more-avatars').parentElement.classList.remove('avatar-more-selected');
  });
  const label = element('label', '', emoji);
  label.htmlFor = input.id;
  input.setAttribute('aria-label', name);
  choice.append(input, label);
  $('#avatar-options').append(choice);
});
const moreAvatars = element('div', 'avatar-choice avatar-more');
const moreLabel = element('label', 'sr-only', 'More emoji avatars');
moreLabel.htmlFor = 'more-avatars';
const avatarSelect = element('select', 'avatar-select');
avatarSelect.id = 'more-avatars';
const placeholder = element('option', '', '▾');
placeholder.value = '';
placeholder.disabled = true;
placeholder.selected = true;
avatarSelect.append(placeholder);
avatars.slice(5).forEach(({ emoji, name }, index) => {
  const option = element('option', '', `${emoji} ${name}`);
  option.value = String(index + 5);
  avatarSelect.append(option);
});
avatarSelect.addEventListener('change', () => {
  $('#avatar-options').querySelectorAll('input').forEach((input) => { input.checked = false; });
  moreAvatars.classList.add('avatar-more-selected');
});
moreAvatars.append(moreLabel, avatarSelect);
$('#avatar-options').append(moreAvatars);

const noteFrequency = (note) => 440 * 2 ** ((note - 69) / 12);

function synthNote(note, start, duration, volume, type, output, slideTo) {
  const oscillator = audioContext.createOscillator();
  const envelope = audioContext.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(noteFrequency(note), start);
  if (slideTo !== undefined) oscillator.frequency.exponentialRampToValueAtTime(noteFrequency(slideTo), start + duration * .7);
  envelope.gain.setValueAtTime(0, start);
  envelope.gain.linearRampToValueAtTime(volume, start + .012);
  envelope.gain.exponentialRampToValueAtTime(.0001, start + duration);
  oscillator.connect(envelope).connect(output);
  oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
  oscillator.start(start);
  oscillator.stop(start + duration + .02);
}

function synthPercussion(start, snare, output) {
  if (!musicNoise) {
    musicNoise = audioContext.createBuffer(1, Math.floor(audioContext.sampleRate * .15), audioContext.sampleRate);
    const samples = musicNoise.getChannelData(0);
    for (let index = 0; index < samples.length; index++) samples[index] = Math.random() * 2 - 1;
  }
  const source = audioContext.createBufferSource();
  const filter = audioContext.createBiquadFilter();
  const envelope = audioContext.createGain();
  source.buffer = musicNoise;
  filter.type = 'highpass';
  filter.frequency.value = snare ? 1200 : 6500;
  const duration = snare ? .13 : .04;
  envelope.gain.setValueAtTime(snare ? .17 : .045, start);
  envelope.gain.exponentialRampToValueAtTime(.0001, start + duration);
  source.connect(filter).connect(envelope).connect(output);
  source.onended = () => { source.disconnect(); filter.disconnect(); envelope.disconnect(); };
  source.start(start);
  source.stop(start + duration);
}

function soundUnavailable(message) {
  stopMusic();
  soundEnabled = false;
  updateSoundButton();
  announce(message);
}

function playTone(kind) {
  if (!soundEnabled || document.hidden) return;
  try {
    audioContext ??= new (window.AudioContext || window.webkitAudioContext)();
    audioContext.resume().catch(() => soundUnavailable('Sound could not start. You can still play without it.'));
    const notes = kind === 'win' ? [72, 76, 79, 84, 83, 84] : kind === 'correct' ? [72, 76, 79, 84] : kind === 'wrong' ? [64, 60] : kind === 'reveal' ? [67, 72, 76] : [72];
    notes.forEach((note, index) => synthNote(note, audioContext.currentTime + index * .09, .2, .035, 'sine', audioContext.destination));
    if (kind === 'win') [60, 64, 67].forEach((note) => synthNote(note, audioContext.currentTime + .45, .55, .025, 'triangle', audioContext.destination));
  } catch {
    soundUnavailable('Sound is unavailable in this browser. You can still play without it.');
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
    musicGain = audioContext.createGain();
    musicGain.gain.value = currentState?.status === 'playing' ? .028 : .05;
    musicGain.connect(audioContext.destination);
    const output = musicGain;
    audioContext.resume().catch(() => {
      if (musicGain === output) soundUnavailable('Music could not start. You can continue playing without it.');
    });
    const chords = [[60, 64, 67, 71], [57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 65], [60, 64, 67, 71], [62, 65, 69, 72], [53, 57, 60, 64], [55, 59, 62, 67]];
    const melody = [
      [76, null, 79, 81, 79, 76, 74, null], [72, 76, null, 79, 76, 72, 71, null],
      [77, null, 81, 79, 77, 76, 72, null], [74, 79, null, 77, 74, 71, 67, null],
      [76, 79, 84, null, 83, 79, 76, 74], [77, null, 81, 84, 81, 77, 74, null],
      [77, 81, null, 84, 81, 79, 77, 76], [74, 71, 67, null, 71, 74, 79, null],
    ];
    const stepDuration = 60 / 118 / 2;
    let nextAt = audioContext.currentTime + .04;
    musicStep = 0;
    const schedule = () => {
      if (audioContext.state === 'suspended') { nextAt = audioContext.currentTime + .04; return; }
      try {
        if (nextAt < audioContext.currentTime) nextAt = audioContext.currentTime + .02;
        while (nextAt < audioContext.currentTime + .12) {
          const bar = Math.floor(musicStep / 8) % chords.length;
          const step = musicStep % 8;
          const chord = chords[bar];
          if (step === 0) chord.forEach((note) => synthNote(note, nextAt, 1.65, .065, 'sine', output));
          if (step % 2 === 0) synthNote(chord[step === 4 ? 2 : 0] - 24, nextAt, .23, .32, 'triangle', output);
          if (melody[bar][step] !== null) synthNote(melody[bar][step], nextAt, .18, .19, 'triangle', output);
          if (step % 4 === 0) synthNote(47, nextAt, .16, .5, 'sine', output, 29);
          synthPercussion(nextAt, false, output);
          if (step % 4 === 2) synthPercussion(nextAt, true, output);
          musicStep++;
          nextAt += stepDuration;
        }
      } catch {
        soundUnavailable('Music stopped because audio is unavailable. The game still works; use Music to retry.');
      }
    };
    musicTimer = setInterval(schedule, 35);
    schedule();
  } catch {
    soundUnavailable('Music is unavailable in this browser. You can still play without it.');
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
    const data = await request('join', { code, name, avatar: Number($('input[name="avatar"]:checked')?.value ?? avatarSelect.value) });
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
  clearTimeout(imageTimer);
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
  clearTimeout(imageTimer);
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
    if (state.status === 'lobby') updateLobbyRules(state);
    if (state.status === 'playing') updateLiveRound(state);
    return;
  }
  renderKey = key;
  if (musicGain) musicGain.gain.setTargetAtTime(state.status === 'playing' ? .028 : .05, audioContext.currentTime, .15);
  if (state.status === 'finished') return renderResults(state);
  if (state.status === 'results') return renderRoundResults(state);
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
  renderGameSettings(state, panel);
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
  const rules = element('p', 'rules-box');
  rules.id = 'lobby-rules';
  panel.append(rules);
  updateLobbyRules(state);
  updateHost(state);
}

function updateLobbyRules(state) {
  const rules = $('#lobby-rules');
  if (!rules) return;
  const text = `${state.settings.questionCount} questions from a bank of ${state.bankSize} · ${state.settings.roundSeconds} seconds per answer. First, pin Alex’s hometown on a New Hampshire map; the rest are shuffled with no repeats. The closest pin gets 1,000 points; other pins earn less with distance. Everyone shares the same rounds. When time ends, see the answer; the host clicks Next to show player results, then Next again for the following question. Personal facts come from the host; other trivia has linked sources. Rooms expire after 6 hours; restarting the server clears games.`;
  if (rules.textContent !== text) rules.textContent = text;
}

function renderGameSettings(state, panel) {
  panel.append(element('h2', '', 'Make it your game.'));
  const form = element('form', 'lobby-settings');
  form.id = 'settings-form';
  form.noValidate = true;
  const fields = element('div', 'settings-fields');
  [
    { id: 'round-seconds', label: 'Seconds per answer', min: 5, max: 120, value: state.settings.roundSeconds, hint: '5–120 seconds. Choose a longer round for more reading time.' },
    { id: 'question-count', label: 'Number of questions', min: 1, max: state.bankSize, value: state.settings.questionCount, hint: `1–${state.bankSize} questions. No repeats within a game.` },
  ].forEach(({ id, label: text, min, max, value, hint }) => {
    const field = element('div', 'field');
    const label = element('label', '', text);
    label.htmlFor = id;
    const input = element('input');
    input.id = id;
    input.type = 'number';
    input.min = String(min);
    input.max = String(max);
    input.step = '1';
    input.required = true;
    input.value = String(value);
    input.setAttribute('aria-describedby', `${id}-hint settings-error`);
    input.addEventListener('input', () => {
      form.dataset.dirty = 'true';
      input.removeAttribute('aria-invalid');
      $('#settings-status').textContent = 'Settings changed. Save them, or start the game to apply them.';
    });
    const description = element('p', 'field-hint', hint);
    description.id = `${id}-hint`;
    field.append(label, input, description);
    fields.append(field);
  });
  const error = element('p', 'form-error');
  error.id = 'settings-error';
  error.setAttribute('role', 'alert');
  const save = element('button', 'button button-outline', 'Save game settings');
  save.id = 'save-settings';
  save.type = 'submit';
  const status = element('p', 'muted');
  status.id = 'settings-status';
  status.setAttribute('role', 'status');
  form.append(fields, error, save, status);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const values = readGameSettings();
    if (!values || settingsBusy || hostBusy) return;
    settingsBusy = true;
    save.disabled = true;
    save.textContent = 'Saving settings…';
    fields.querySelectorAll('input').forEach((input) => { input.disabled = true; });
    updateHost(currentState);
    try {
      await request('settings', { ...session, ...values });
      status.textContent = 'Settings saved. Players will see the updated round details.';
      await pollState();
    } catch (failure) {
      error.textContent = `${failure.message} Your settings are preserved. Save again to retry.`;
    } finally {
      settingsBusy = false;
      save.disabled = false;
      save.textContent = 'Save game settings';
      fields.querySelectorAll('input').forEach((input) => { input.disabled = false; });
      if (currentState?.status === 'lobby') updateHost(currentState);
    }
  });
  panel.append(form);
}

function readGameSettings() {
  const seconds = $('#round-seconds');
  const count = $('#question-count');
  const roundSeconds = Number(seconds.value);
  const questionCount = Number(count.value);
  const secondsInvalid = !Number.isInteger(roundSeconds) || roundSeconds < 5 || roundSeconds > 120;
  const countInvalid = !Number.isInteger(questionCount) || questionCount < 1 || questionCount > currentState.bankSize;
  seconds.setAttribute('aria-invalid', String(secondsInvalid));
  count.setAttribute('aria-invalid', String(countInvalid));
  $('#settings-error').textContent = secondsInvalid ? 'Enter a whole number of seconds between 5 and 120.' : countInvalid ? `Enter a whole number of questions between 1 and ${currentState.bankSize}.` : '';
  if (secondsInvalid || countInvalid) {
    (secondsInvalid ? seconds : count).focus();
    return null;
  }
  return { roundSeconds, questionCount };
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
  $('#host-start').disabled = !state.players.length || hostBusy || settingsBusy;
  const form = $('#settings-form');
  if (form && !settingsBusy) {
    const seconds = $('#round-seconds');
    const count = $('#question-count');
    if (Number(seconds.value) === state.settings.roundSeconds && Number(count.value) === state.settings.questionCount) form.dataset.dirty = '';
    if (!form.dataset.dirty) {
      seconds.value = String(state.settings.roundSeconds);
      count.value = String(state.settings.questionCount);
    }
  }
}

async function hostAction(command) {
  if (hostBusy || settingsBusy) return;
  const settings = command === 'start' ? readGameSettings() : {};
  if (!settings) return;
  hostBusy = true;
  startWelcomeMusic();
  const controls = experience.querySelectorAll('button, input');
  controls.forEach((control) => { control.disabled = true; });
  try {
    await request(command, { ...session, ...settings, index: currentState.index });
    await pollState();
  } catch (error) {
    showConnectionError(error.message);
  } finally {
    hostBusy = false;
    controls.forEach((control) => { control.disabled = false; });
    if (currentState && $('#host-start')) updateHost(currentState);
  }
}

function renderPlayerLobby(state) {
  const panel = makePanel(`ROOM ${state.code} · YOU'RE IN`, `Looking good, ${state.player.name}.`);
  panel.append(element('div', 'waiting-art', avatars[state.player.avatar].emoji));
  panel.append(element('p', 'centered', 'Your host will start the game when the team is ready.'));
  const rules = element('p', 'rules-box');
  rules.id = 'lobby-rules';
  rules.setAttribute('role', 'status');
  panel.append(rules);
  updateLobbyRules(state);
  panel.append(element('p', 'muted centered', 'An original quiz-night groove plays after you join: melody, warm chords, bass and drums. It gets quieter during questions. Use Music in the header to mute it.'));
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
  const score = element('span', 'score-pill', revealing ? 'Answer reveal' : state.role === 'host' ? `Room ${state.code}` : `${state.player.score.toLocaleString()} pts`);
  const timer = element('span', 'timer');
  timer.id = 'question-timer';
  timer.setAttribute('role', 'timer');
  timer.setAttribute('aria-label', 'Time remaining');
  timer.append(element('span', 'time-value', revealing ? '0s' : `${state.settings.roundSeconds}s`));
  top.append(badge, score, timer);
  panel.insertBefore(top, panel.firstChild);
  const progress = element('progress', 'progress-track');
  progress.max = state.total;
  progress.value = state.index + (revealing ? 1 : 0);
  progress.setAttribute('aria-label', 'Quiz completion');
  panel.insertBefore(progress, panel.querySelector('.eyebrow'));
  panel.append(element('p', 'question-category', question.category));
  if (question.image?.identification) renderQuestionImage(panel, question.image);
  if (question.type === 'map') renderMapRound(state, panel);
  else {
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
  }
  if (question.image && !question.image.identification) renderQuestionImage(panel, question.image);
  if (revealing) return renderRoundReveal(state, panel);
  const status = element('p', 'muted');
  status.id = 'round-status';
  status.setAttribute('role', 'status');
  panel.append(status);
  panel.append(element('p', 'muted', `One choice. ${state.settings.roundSeconds} seconds. No answers revealed until the clock hits zero.`));
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
  const isMap = state.question.type === 'map';
  if (isMap) {
    const locked = state.player?.selected ?? pendingAnswer?.location;
    experience.querySelectorAll('.map-control').forEach((control) => { control.disabled = Boolean(locked) || expired; });
    if ($('#map-confirm')) $('#map-confirm').disabled = Boolean(locked) || expired || !mapDraft;
    if (locked) positionMapPin(locked);
  }
  experience.querySelectorAll('button.answer-button').forEach((button) => {
    const chosen = Number(button.dataset.answer) === selected;
    button.disabled = selected !== null || expired;
    button.classList.toggle('selected', chosen);
    button.setAttribute('aria-pressed', String(chosen));
  });
  const answered = state.players.filter((player) => player.answered).length;
  const hasSelection = selected !== null || (isMap && Boolean(pendingAnswer?.location));
  const message = expired ? 'Time’s up! Revealing the answers…' : state.role === 'host' ? `${answered} of ${state.players.length} answers locked in. Everyone has the full ${state.settings.roundSeconds} seconds.` : pendingAnswer && !pendingAnswer.accepted ? 'Sending your answer… Your choice is saved here while we reconnect.' : hasSelection ? `${isMap ? 'Location' : `Answer ${'ABCD'[selected]}`} locked in. Waiting for the reveal…` : isMap ? 'Place a pin, then lock your location before the timer reaches zero.' : 'Pick your answer before the timer reaches zero.';
  if ($('#round-status') && $('#round-status').textContent !== message) $('#round-status').textContent = message;
}

function renderRoundReveal(state, panel) {
  const reveal = state.reveal;
  const feedback = element('div', 'answer-feedback');
  const isMap = state.question.type === 'map';
  feedback.append(element('h2', '', isMap ? 'Time’s up. Here’s the town!' : 'Time’s up. Here’s the answer!'), element('p', '', reveal.explanation));
  const source = element(reveal.source.url ? 'a' : 'p', 'source-link', `Source: ${reveal.source.label}`);
  if (reveal.source.url) {
    source.href = reveal.source.url;
    source.target = '_blank';
    source.rel = 'noopener noreferrer';
    source.append(element('span', 'sr-only', ' (opens in a new tab)'));
  }
  feedback.append(source);
  panel.append(feedback);
  if (reveal.image) renderQuestionImage(panel, reveal.image);
  if (state.role === 'host') {
    const controls = element('div', 'panel-actions');
    controls.append(action('Next: see player results →', () => hostAction('results'), true));
    panel.append(controls);
  } else {
    panel.append(element('p', 'muted', 'The host will show everyone’s results next.'));
  }
  announce(isMap ? `Time is up. Alex came from ${reveal.target.name}. The host will show player results next.` : `Time is up. Correct answer: ${state.question.answers[reveal.correctAnswer]}. The host will show player results next.`);
  playTone('reveal');
}

function renderRoundResults(state) {
  const reveal = state.reveal;
  const isMap = state.question.type === 'map';
  const panel = makePanel(`ROUND ${state.index + 1} OF ${state.total} · SCORE CHECK`, isMap ? 'Who got closest?' : 'Who got it right?');
  panel.classList.add('round-results-panel');
  const emblem = element('div', 'results-emblem', isMap ? '🎯' : '📊');
  emblem.setAttribute('aria-hidden', 'true');
  panel.append(emblem);
  const correctCount = reveal.players.filter((player) => player.correct).length;
  const answered = reveal.players.filter((player) => player.selected !== null).length;
  const summary = isMap ? answered ? `${correctCount} closest ${correctCount === 1 ? 'pin' : 'pins'} · ${answered} ${answered === 1 ? 'location' : 'locations'} locked in.` : 'No pins submitted. Zero points this round.' : `${correctCount} of ${reveal.players.length} got it right.`;
  panel.append(element('p', 'results-summary', summary));
  panel.append(element('p', 'muted', isMap ? `Correct town: ${reveal.target.name}.` : `Correct answer: ${state.question.answers[reveal.correctAnswer]}.`));
  if (isMap) renderMapRound(state, panel);
  const list = element('ul', 'round-results');
  reveal.players.forEach((player, index) => {
    const row = element('li', `round-result${player.correct ? ' round-correct' : ''}`);
    const isYou = player.name === state.player?.name;
    if (isYou) row.classList.add('round-is-you');
    const outcome = player.selected === null ? 'No answer' : isMap ? `${player.distanceKm.toFixed(1)} km away${player.correct ? ' · Closest ✓' : ''}` : `${player.correct ? 'Correct ✓' : 'Incorrect'} · ${'ABCD'[player.selected]}: ${state.question.answers[player.selected]}`;
    row.append(element('span', 'round-player', `${isMap ? `#${index + 1} ` : ''}${avatars[player.avatar].emoji} ${player.name}${isYou ? ' (you)' : ''}`), element('span', '', outcome), element('span', 'round-score-points', `+${player.points} points · ${player.score.toLocaleString()} total`));
    list.append(row);
  });
  panel.append(list);
  if (state.role === 'host') {
    const controls = element('div', 'panel-actions');
    controls.append(action(state.index === state.total - 1 ? 'Reveal final podium →' : 'Next question →', () => hostAction('next'), true));
    panel.append(controls);
  } else {
    panel.append(element('p', 'muted', 'The host will start the next round when everyone is ready.'));
  }
  announce(`Round ${state.index + 1} results. ${summary} Each player’s answer, points and total score are listed.`);
  const gotIt = reveal.players.find((player) => player.name === state.player?.name)?.correct;
  playTone(state.role === 'player' && !gotIt ? 'wrong' : 'correct');
}

function mapPosition(point) {
  const { bounds, width, height } = window.BENNETT_MAP;
  return { x: (point.lng - bounds.west) / (bounds.east - bounds.west) * width, y: (bounds.north - point.lat) / (bounds.north - bounds.south) * height };
}

function positionMapPin(point) {
  const marker = $('#map-guess-marker');
  if (!marker || !window.BENNETT_MAP) return;
  const { x, y } = mapPosition(point);
  marker.setAttribute('cx', x);
  marker.setAttribute('cy', y);
  marker.classList.remove('hidden');
}

function renderMapRound(state, panel) {
  const data = window.BENNETT_MAP;
  if (!data) {
    panel.append(element('p', 'form-error', 'The map could not load. Reload the page to reconnect; the game timer will keep running.'));
    panel.append(action('Reload game', () => location.reload()));
    return;
  }
  const revealing = state.status === 'reveal' || state.status === 'results';
  const interactive = state.role === 'player' && !revealing;
  const { bounds, width, height } = data;
  const svgNode = (tag, attributes) => {
    const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.entries(attributes).forEach(([name, value]) => node.setAttribute(name, value));
    return node;
  };
  const area = element('div', 'map-round');
  const canvas = element(interactive ? 'button' : 'div', `map-canvas${interactive ? ' map-control' : ''}`);
  const svg = svgNode('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': state.status === 'results' ? 'Map of New Hampshire with the correct town and numbered player guesses. Distances are listed in the results.' : revealing ? 'Map of New Hampshire with the correct town marked by a square.' : 'Outline map of New Hampshire, with north at the top.' });
  svg.append(svgNode('polygon', { points: data.outline.map(([lng, lat]) => {
    const { x, y } = mapPosition({ lat, lng });
    return `${x},${y}`;
  }).join(' '), class: 'map-state' }));
  const north = svgNode('text', { x: 24, y: 30, class: 'map-label' });
  north.textContent = 'N ↑';
  svg.append(north);
  canvas.append(svg);
  area.append(canvas);
  const credit = element('p', 'photo-caption');
  const source = element('a', '', 'Map data: Natural Earth (public domain)');
  source.href = 'https://www.naturalearthdata.com/about/terms-of-use/';
  credit.append(source);
  area.append(credit);
  panel.append(area);
  if (revealing) {
    (state.reveal.players || []).forEach((player, index) => {
      if (!player.selected) return;
      const { x, y } = mapPosition(player.selected);
      svg.append(svgNode('circle', { cx: x, cy: y, r: 10, class: 'map-player-pin' }));
      const label = svgNode('text', { x, y: y + 4, 'text-anchor': 'middle', class: 'map-pin-number' });
      label.textContent = String(index + 1);
      svg.append(label);
    });
    const { x, y } = mapPosition(state.reveal.target);
    svg.append(svgNode('rect', { x: x - 6, y: y - 6, width: 12, height: 12, class: 'map-target' }));
    const target = svgNode('text', { x: x + 10, y: y - 12, class: 'map-target-label' });
    target.textContent = state.reveal.target.name;
    svg.append(target);
    area.append(element('p', 'muted', state.status === 'results' ? 'The square marks the correct town. Numbered circles match the player results below.' : 'The square marks the correct town. Player pins and distances appear on the next screen.'));
    return;
  }
  if (!interactive) {
    area.append(element('p', 'muted', 'Players place their pins on their own devices. Guesses and the correct town appear only after the timer ends.'));
    return;
  }
  mapDraft = state.player.selected || null;
  const marker = svgNode('circle', { id: 'map-guess-marker', cx: 0, cy: 0, r: 7, class: 'map-draft hidden' });
  svg.append(marker);
  canvas.type = 'button';
  canvas.setAttribute('aria-label', 'Place your hometown guess on the New Hampshire map');
  canvas.setAttribute('aria-describedby', 'map-help map-pin-status');
  const help = element('p', 'muted', 'Click or tap to place a pin. Keyboard: focus the map, use arrow keys to move, Shift + arrows for bigger steps, and Enter or Space to place the center pin. You can also choose a town below. Then lock your location.');
  help.id = 'map-help';
  area.append(help);
  const pinStatus = element('p', 'muted', 'No pin placed yet.');
  pinStatus.id = 'map-pin-status';
  pinStatus.setAttribute('role', 'status');
  area.append(pinStatus);
  const field = element('div', 'field');
  const label = element('label', '', 'Jump to a town (optional)');
  label.htmlFor = 'map-town';
  const towns = element('select', 'map-control map-town');
  towns.id = 'map-town';
  const empty = element('option', '', 'Choose a town or use the map');
  empty.value = '';
  towns.append(empty);
  data.towns.forEach((town, index) => {
    const option = element('option', '', town.name);
    option.value = String(index);
    towns.append(option);
  });
  field.append(label, towns);
  area.append(field);
  const confirm = action('Lock this location →', () => {
    if (mapDraft) submitAnswer({ ...mapDraft });
  }, true);
  confirm.id = 'map-confirm';
  confirm.classList.add('map-control');
  confirm.disabled = !mapDraft;
  area.append(confirm);
  const center = { lat: (bounds.north + bounds.south) / 2, lng: (bounds.west + bounds.east) / 2 };
  const place = (point, town = '') => {
    if (performance.now() >= roundEndsAt || currentState.player?.selected !== null || pendingAnswer) return;
    mapDraft = { lat: Math.max(bounds.south, Math.min(bounds.north, point.lat)), lng: Math.max(bounds.west, Math.min(bounds.east, point.lng)) };
    positionMapPin(mapDraft);
    towns.value = town;
    pinStatus.textContent = `Pin at ${mapDraft.lat.toFixed(3)}° N, ${Math.abs(mapDraft.lng).toFixed(3)}° W. Choose Lock this location to submit.`;
    confirm.disabled = false;
  };
  canvas.addEventListener('click', (event) => {
    if (event.detail === 0) return place(mapDraft || center);
    const rectangle = svg.getBoundingClientRect();
    place({ lat: bounds.north - (event.clientY - rectangle.top) / rectangle.height * (bounds.north - bounds.south), lng: bounds.west + (event.clientX - rectangle.left) / rectangle.width * (bounds.east - bounds.west) });
  });
  canvas.addEventListener('keydown', (event) => {
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    const step = event.shiftKey ? .1 : .01;
    const point = mapDraft || center;
    place({ lat: point.lat + (event.key === 'ArrowUp' ? step : event.key === 'ArrowDown' ? -step : 0), lng: point.lng + (event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0) });
  });
  towns.addEventListener('change', () => {
    if (towns.value !== '') place(data.towns[Number(towns.value)], towns.value);
  });
  if (mapDraft) {
    positionMapPin(mapDraft);
    pinStatus.textContent = 'Your location is locked in. Waiting for the reveal.';
  }
}

function renderQuestionImage(panel, data) {
  const figure = element('figure', 'question-media');
  const image = element('img', 'question-photo hidden');
  image.alt = data.alt;
  image.decoding = 'async';
  const status = element('p', 'muted', 'Loading photo…');
  status.setAttribute('role', 'status');
  const caption = element('figcaption', 'photo-caption');
  caption.append(element('span', '', `${data.caption} Photo: ${data.author}. `));
  const original = element('a', '', data.sourceLabel || 'Wikimedia Commons source');
  original.href = data.source;
  caption.append(original, element('span', '', ' · '));
  const license = element(data.licenseUrl ? 'a' : 'span', '', data.license);
  if (data.licenseUrl) license.href = data.licenseUrl;
  caption.append(license, element('span', '', ' · Resized for display.'));
  const unavailable = () => {
    if (!figure.isConnected) return;
    clearTimeout(imageTimer);
    image.classList.add('hidden');
    status.textContent = data.identification ? `Photo unavailable. Visual description: ${data.alt} You can answer from this description or retry the photo. The timer keeps running.` : 'Photo unavailable. The question and answers still work.';
    if (!figure.querySelector('button')) figure.append(action('Retry photo', load));
  };
  const load = () => {
    clearTimeout(imageTimer);
    image.classList.add('hidden');
    status.textContent = 'Loading photo…';
    figure.setAttribute('aria-busy', 'true');
    const origin = window.BENNETT_API_ORIGIN || location.origin;
    image.src = new URL(data.src, origin).href;
    imageTimer = setTimeout(() => {
      figure.setAttribute('aria-busy', 'false');
      unavailable();
    }, 7000);
  };
  image.addEventListener('load', () => {
    if (!figure.isConnected) return;
    clearTimeout(imageTimer);
    figure.setAttribute('aria-busy', 'false');
    image.classList.remove('hidden');
    status.textContent = '';
  });
  image.addEventListener('error', () => {
    if (!figure.isConnected) return;
    figure.setAttribute('aria-busy', 'false');
    unavailable();
  });
  figure.append(image, status, caption);
  panel.append(figure);
  load();
}

async function submitAnswer(answer) {
  if (submitting?.index === currentState?.index || currentState?.status !== 'playing' || currentState.player?.selected !== null || performance.now() >= roundEndsAt) return;
  const isMap = currentState.question.type === 'map';
  pendingAnswer ??= { index: currentState.index, ...(isMap ? { location: answer } : { answer }) };
  const submission = pendingAnswer;
  const answerSession = session;
  submitting = submission;
  updateLiveRound(currentState);
  try {
    const result = await request('answer', { ...answerSession, index: submission.index, ...(isMap ? { location: submission.location } : { answer: submission.answer }) });
    if (session !== answerSession || currentState?.index !== submission.index || currentState.status !== 'playing') return;
    currentState.player.selected = result.selected;
    if (isMap) submission.location = result.selected;
    else submission.answer = result.selected;
    submission.accepted = true;
    $('#answer-error')?.remove();
    updateLiveRound(currentState);
    announce(isMap ? 'Your map location is locked in.' : `Answer ${'ABCD'[result.selected]} locked in.`);
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
    notice.append(action('Retry same answer', () => submitAnswer(isMap ? submission.location : submission.answer)));
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
  panel.append(element('p', 'muted centered', `${state.total} live rounds. A little design knowledge. A lot of Bennett energy.`));
  const list = element('ol', 'leaderboard');
  leaders.forEach((player) => {
    const row = element('li', 'leader-row');
    row.append(element('span', '', `#${player.rank}`), element('span', 'leader-avatar', avatars[player.avatar].emoji), element('span', 'leader-name', `${player.name}${player.isYou ? ' (you)' : ''}`), element('span', 'leader-points', `${player.score.toLocaleString()} pts`));
    list.append(row);
  });
  panel.append(list);
  panel.append(element('p', 'muted', 'The closest map pin earns 1,000 points; other map scores decrease with extra distance. Multiple-choice answers earn 600–1,000 points based on speed. Equal scores share a place. Personal facts are supplied by the host; other trivia has linked sources. Illustrative photos are not family photos or proof of product authorship.'));
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
