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
let videoCleanup;
let questionSpeech;
let browserSpeechConsent = false;
let mapObserver;
let puzzleProgress;
let puzzleSelection = null;
let pendingPuzzleMove = null;
let puzzleBusy = false;
let puzzleReady = false;
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
let musicTrack = 'kahoot';
let soundChosen = false;
let roundEndsAt = 0;
let pendingAnswer = null;
let connectionFailures = 0;
let submitting = null;

const announce = (text) => { $('#announcement').textContent = text; };
const themes = { 'red-sox': 'Red Sox Red', 'll-bean': 'LL Bean Green', rit: 'RIT Orange' };
const applyTheme = (value) => {
  const selected = Object.hasOwn(themes, value) ? value : 'red-sox';
  document.documentElement.dataset.theme = selected;
  $('#theme-select').value = selected;
  $('meta[name="theme-color"]').setAttribute('content', getComputedStyle(document.documentElement).getPropertyValue('--primary').trim());
};
try {
  applyTheme(localStorage.getItem('bennett-theme'));
} catch {
  applyTheme('red-sox');
}
$('#theme-select').addEventListener('change', (event) => {
  applyTheme(event.currentTarget.value);
  const selected = document.documentElement.dataset.theme;
  try {
    localStorage.setItem('bennett-theme', selected);
  } catch {
    announce(`${themes[selected]} selected for this visit.`);
    return;
  }
  announce(`${themes[selected]} selected.`);
});
const appearanceMedia = window.matchMedia('(max-width: 600px)');
const updateAppearanceDisclosure = () => {
  const settings = $('#appearance-settings');
  const summary = settings.querySelector('summary');
  const focused = document.activeElement;
  settings.open = !appearanceMedia.matches;
  if (appearanceMedia.matches && focused !== summary && settings.contains(focused)) summary.focus();
  else if (!appearanceMedia.matches && focused === summary) $('#theme-select').focus();
};
updateAppearanceDisclosure();
appearanceMedia.addEventListener('change', updateAppearanceDisclosure);
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
  const option = element('option', '', emoji);
  option.setAttribute('aria-label', name);
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
const musicTracks = {
  kahoot: {
    name: 'Kahoot Inspired', bpm: 118,
    chords: [[60, 64, 67, 71], [57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 65], [60, 64, 67, 71], [62, 65, 69, 72], [53, 57, 60, 64], [55, 59, 62, 67]],
    melody: [
      [76, null, 79, 81, 79, 76, 74, null], [72, 76, null, 79, 76, 72, 71, null],
      [77, null, 81, 79, 77, 76, 72, null], [74, 79, null, 77, 74, 71, 67, null],
      [76, 79, 84, null, 83, 79, 76, 74], [77, null, 81, 84, 81, 77, 74, null],
      [77, 81, null, 84, 81, 79, 77, 76], [74, 71, 67, null, 71, 74, 79, null],
    ],
  },
  lofi: {
    name: 'Low Fi Beats', bpm: 78,
    chords: [[57, 60, 64, 71], [50, 57, 60, 64], [55, 59, 62, 66], [48, 55, 59, 64]],
    melody: [
      [76, null, 71, null, 74, 71, null, 69], [72, null, 69, null, 64, null, 67, null],
      [71, null, 74, 78, null, 74, 71, null], [67, null, 64, null, 71, 67, null, 64],
    ],
  },
  radio: {
    name: 'New England Radio', bpm: 104,
    chords: [[62, 66, 69], [55, 59, 62], [59, 62, 66], [57, 61, 64]],
    melody: [
      [74, 76, 78, null, 76, 74, 69, null], [71, null, 74, 76, 74, 71, 67, null],
      [74, null, 78, 81, 78, 74, 71, null], [73, 76, null, 81, 76, 73, 69, null],
    ],
  },
  noah: {
    name: 'Noah Kahan Radio', bpm: 94,
    chords: [[55, 59, 62], [52, 55, 59], [48, 52, 55], [50, 54, 57]],
    melody: [
      [71, null, 74, 72, 71, null, 67, 69], [67, 71, null, 74, 71, null, 67, null],
      [72, null, 76, 74, 72, 67, null, 64], [69, null, 74, 76, 74, 69, 66, null],
    ],
  },
  taylor: {
    name: 'Taylor Swift Radio', bpm: 112,
    chords: [[60, 64, 67, 71], [57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 69]],
    melody: [
      [79, 76, null, 74, 76, null, 81, 79], [76, null, 72, 74, 76, 79, null, 81],
      [77, 76, 72, null, 69, 72, null, 76], [74, null, 79, 81, 83, 79, 74, null],
    ],
  },
};

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

function synthPercussion(start, snare, output, strength = 1) {
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
  envelope.gain.setValueAtTime((snare ? .17 : .045) * strength, start);
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
  if (!soundEnabled || document.hidden || questionSpeech?.active) return;
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
  $('#sound-toggle').setAttribute('aria-label', `Music ${soundEnabled ? 'on' : 'off'}. Selected track: ${musicTracks[musicTrack].name}`);
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
  if (!soundEnabled || musicTimer || document.hidden || questionSpeech?.active) return;
  const video = experience.querySelector('video');
  if (video && !video.paused && !video.ended) return;
  try {
    audioContext ??= new (window.AudioContext || window.webkitAudioContext)();
    musicGain = audioContext.createGain();
    musicGain.gain.value = currentState?.status === 'playing' ? .028 : .05;
    musicGain.connect(audioContext.destination);
    const output = musicGain;
    audioContext.resume().catch(() => {
      if (musicGain === output) soundUnavailable('Music could not start. You can continue playing without it.');
    });
    const trackId = musicTrack;
    const { chords, melody, bpm } = musicTracks[trackId];
    const stepDuration = 60 / bpm / 2;
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
          if (trackId === 'kahoot') {
            if (step === 0) chord.forEach((note) => synthNote(note, nextAt, 1.65, .065, 'sine', output));
            if (step % 2 === 0) synthNote(chord[step === 4 ? 2 : 0] - 24, nextAt, .23, .32, 'triangle', output);
            if (melody[bar][step] !== null) synthNote(melody[bar][step], nextAt, .18, .19, 'triangle', output);
            if (step % 4 === 0) synthNote(47, nextAt, .16, .5, 'sine', output, 29);
            synthPercussion(nextAt, false, output);
            if (step % 4 === 2) synthPercussion(nextAt, true, output);
          } else if (trackId === 'lofi') {
            if (step === 0) chord.forEach((note) => synthNote(note, nextAt, stepDuration * 7, .055, 'sine', output));
            if (step % 2 === 0) synthNote(chord[0] - 12, nextAt, .35, .24, 'triangle', output);
            if (melody[bar][step] !== null) synthNote(melody[bar][step], nextAt, .34, .12, 'sine', output);
            if (step === 0 || step === 5) synthNote(43, nextAt, .18, .3, 'sine', output, 27);
            if (step % 2) synthPercussion(nextAt, false, output, .35);
            if (step % 4 === 2) synthPercussion(nextAt, true, output, .45);
          } else if (trackId === 'noah') {
            synthNote(chord[step % 3], nextAt, .48, .13, 'triangle', output);
            if (step === 0 || step === 4) synthNote(chord[0] - 12, nextAt, .55, .25, 'sine', output);
            if (melody[bar][step] !== null) synthNote(melody[bar][step], nextAt, .32, .11, 'sine', output);
            if (step % 4 === 2) synthPercussion(nextAt, true, output, .3);
            if (step % 2) synthPercussion(nextAt, false, output, .2);
          } else if (trackId === 'taylor') {
            if (step === 0) chord.forEach((note) => synthNote(note, nextAt, stepDuration * 7, .05, 'sine', output));
            if (step % 2 === 0) {
              synthNote(chord[step === 4 ? 2 : 0] - 12, nextAt, .24, .26, 'triangle', output);
              synthNote(45, nextAt, .15, .3, 'sine', output, 28);
            }
            if (melody[bar][step] !== null) synthNote(melody[bar][step], nextAt, .2, .14, 'triangle', output);
            synthPercussion(nextAt, false, output, .35);
            if (step % 4 === 2) synthPercussion(nextAt, true, output, .55);
          } else {
            if (step % 2 === 0) chord.forEach((note, index) => synthNote(note, nextAt + index * .009, .4, .09, 'triangle', output));
            if (step === 0 || step === 4) {
              synthNote(chord[0] - 12, nextAt, .35, .3, 'triangle', output);
              synthNote(47, nextAt, .15, .28, 'sine', output, 29);
            }
            if (melody[bar][step] !== null) synthNote(melody[bar][step], nextAt, .26, .17, 'sine', output);
            if (step % 2) synthPercussion(nextAt, false, output, .4);
            if (step % 4 === 2) synthPercussion(nextAt, true, output, .6);
          }
          musicStep++;
          nextAt += stepDuration * (trackId === 'lofi' ? step % 2 ? .88 : 1.12 : 1);
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
$('#music-track').addEventListener('change', (event) => {
  const selected = event.currentTarget.value;
  if (!Object.hasOwn(musicTracks, selected)) return;
  musicTrack = selected;
  stopMusic();
  updateSoundButton();
  if (soundEnabled) startMusic();
  announce(`${musicTracks[musicTrack].name} selected.${soundEnabled ? '' : ' Turn Music on to listen.'}`);
});
$('#art-motion-toggle').addEventListener('click', (event) => {
  const animations = illustrationAnimations();
  if (!animations.length) return refreshIllustrationMotion();
  const pause = animations.some((animation) => animation.playState !== 'paused');
  try {
    animations.forEach((animation) => pause ? animation.pause() : animation.play());
    event.currentTarget.textContent = pause ? 'Resume illustration' : 'Pause illustration';
    announce(pause ? 'Illustration paused.' : 'Illustration playing.');
  } catch {
    $('#bennett-art').classList.add('motion-still');
    $('#art-motion-controls').classList.add('hidden');
    if (document.activeElement === event.currentTarget) $('#room-code').focus();
  }
});
function illustrationAnimations() {
  return $('#bennett-art').getAnimations?.({ subtree: true }).filter((animation) => animation.animationName === 'illustration-drift') || [];
}
function refreshIllustrationMotion() {
  const art = $('#bennett-art');
  art.classList.remove('motion-still');
  const animations = illustrationAnimations();
  const available = animations.length > 0;
  art.classList.toggle('motion-still', !available);
  $('#art-motion-controls').classList.toggle('hidden', !available);
  $('#art-motion-toggle').textContent = animations.some((animation) => animation.playState === 'paused') ? 'Resume illustration' : 'Pause illustration';
  if (!available && document.activeElement === $('#art-motion-toggle')) $('#room-code').focus();
}
refreshIllustrationMotion();
window.matchMedia?.('(prefers-reduced-motion: reduce)')?.addEventListener?.('change', refreshIllustrationMotion);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    questionSpeech?.stop();
    stopMusic();
  }
  else {
    startMusic();
    if (session) pollState();
  }
});
window.addEventListener('pagehide', () => {
  questionSpeech?.stop();
  stopMusic();
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
  questionSpeech?.dispose();
  questionSpeech = null;
  videoCleanup?.();
  videoCleanup = null;
  mapObserver?.disconnect();
  saveSession(null);
  currentState = null;
  pendingAnswer = null;
  stopMusic();
  connectionFailures = 0;
  experience.replaceChildren();
  experience.classList.add('hidden');
  $('#landing').classList.remove('hidden');
  refreshIllustrationMotion();
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
  questionSpeech?.dispose();
  questionSpeech = null;
  videoCleanup?.();
  videoCleanup = null;
  mapObserver?.disconnect();
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
  if (pendingPuzzleMove && (pendingPuzzleMove.index !== state.index || state.status !== 'playing')) pendingPuzzleMove = null;
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
  const panel = makePanel('HOST LOBBY', 'Bennett brain trust. Assemble.');
  panel.append(element('p', 'muted', 'Share the code. Gather your challengers. Mild overconfidence encouraged.'));
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
  const start = action('Let’s quiz →', () => hostAction('start'), true);
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
  const text = `${state.settings.questionCount} questions · ${state.settings.roundSeconds}s regular rounds. Puzzle: 60s. Maps: 20s. Videos: 30s+. ${state.role === 'host' ? 'Next shows scores; Next again starts the next question.' : 'Fast answers. Bigger points. The host sets the pace.'}`;
  if (rules.textContent !== text) rules.textContent = text;
}

function renderGameSettings(state, panel) {
  panel.append(element('h2', '', 'Set the stakes.'));
  const form = element('form', 'lobby-settings');
  form.id = 'settings-form';
  form.noValidate = true;
  const fields = element('div', 'settings-fields');
  [
    { id: 'round-seconds', label: 'Seconds per answer', min: 5, max: 120, value: state.settings.roundSeconds, hint: '5–120 seconds. Special rounds use the timers below.' },
    { id: 'question-count', label: 'Questions', min: 1, max: state.maxQuestions, value: state.settings.questionCount, hint: `1–${state.maxQuestions}. No repeats. No mercy.` },
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
      $('#settings-status').textContent = 'Unsaved changes. Save, or start to use them.';
    });
    const description = element('p', 'field-hint', hint);
    description.id = `${id}-hint`;
    field.append(label, input, description);
    fields.append(field);
  });
  const error = element('p', 'form-error');
  error.id = 'settings-error';
  error.setAttribute('role', 'alert');
  const save = element('button', 'button button-outline', 'Save settings');
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
    save.textContent = 'Saving…';
    fields.querySelectorAll('input').forEach((input) => { input.disabled = true; });
    updateHost(currentState);
    try {
      await request('settings', { ...session, ...values });
      status.textContent = 'Saved. Let the guessing begin.';
      await pollState();
    } catch (failure) {
      error.textContent = `${failure.message} Your settings are preserved. Save again to retry.`;
    } finally {
      settingsBusy = false;
      save.disabled = false;
      save.textContent = 'Save settings';
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
  const countInvalid = !Number.isInteger(questionCount) || questionCount < 1 || questionCount > currentState.maxQuestions;
  seconds.setAttribute('aria-invalid', String(secondsInvalid));
  count.setAttribute('aria-invalid', String(countInvalid));
  $('#settings-error').textContent = secondsInvalid ? 'Enter a whole number of seconds between 5 and 120.' : countInvalid ? `Enter a whole number of questions between 1 and ${currentState.maxQuestions}.` : '';
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
  const message = `${state.players.length} ${state.players.length === 1 ? 'challenger' : 'challengers'} in.${state.players.length ? ' Ready when you are.' : ' Send the code. Summon the legends.'}`;
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
  const panel = makePanel(`ROOM ${state.code} · YOU'RE IN`, `${state.player.name}, game face on.`);
  panel.append(element('div', 'waiting-art', avatars[state.player.avatar].emoji));
  panel.append(element('p', 'centered', 'Your host has the launch button. Bring your questionable confidence.'));
  const rules = element('p', 'rules-box');
  rules.id = 'lobby-rules';
  rules.setAttribute('role', 'status');
  panel.append(rules);
  updateLobbyRules(state);
  panel.append(element('p', 'muted centered', 'Pick a soundtrack up top. Original instrumentals, not artist recordings.'));
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
  timer.append(element('span', 'time-value', revealing ? '0s' : `${question.roundSeconds}s`));
  top.append(badge, score, timer);
  panel.insertBefore(top, panel.firstChild);
  const progress = element('progress', 'progress-track');
  progress.max = state.total;
  progress.value = state.index + (revealing ? 1 : 0);
  progress.setAttribute('aria-label', 'Quiz completion');
  panel.insertBefore(progress, panel.querySelector('.eyebrow'));
  panel.append(element('p', 'question-category', question.category));
  questionSpeech = renderQuestionSpeech(state, panel);
  if (question.video) renderQuestionVideo(panel, question.video);
  if (question.image?.identification && question.type !== 'puzzle') renderQuestionImage(panel, question.image);
  if (question.type === 'puzzle') renderPuzzleRound(state, panel);
  else if (question.type === 'map') renderMapRound(state, panel);
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
  if (question.image && !question.image.identification && question.type !== 'puzzle') renderQuestionImage(panel, question.image);
  if (revealing) return renderRoundReveal(state, panel);
  const status = element('p', 'muted');
  status.id = 'round-status';
  status.setAttribute('role', 'status');
  panel.append(status);
  panel.append(element('p', 'muted', question.type === 'puzzle' ? `${question.roundSeconds} seconds maximum. The first completed puzzle ends the round immediately.` : `One choice. ${question.roundSeconds} seconds. No answers revealed until the clock hits zero.`));
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
  questionSpeech?.update();
  const selected = state.player?.selected ?? pendingAnswer?.answer ?? null;
  const expired = performance.now() >= roundEndsAt;
  const isMap = state.question.type === 'map';
  const isPuzzle = state.question.type === 'puzzle';
  if (isPuzzle) updatePuzzleBoard(state);
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
  const message = expired ? 'Time’s up! Revealing the answers…' : isPuzzle ? state.role === 'host' ? `Players are solving their own boards. First to finish wins; the limit is ${state.question.roundSeconds} seconds.` : `${puzzleProgress?.moves || 0} swaps saved. First to finish wins.` : state.role === 'host' ? `${answered} of ${state.players.length} answers locked in. Everyone has the full ${state.question.roundSeconds} seconds.` : pendingAnswer && !pendingAnswer.accepted ? 'Sending your answer… Your choice is saved here while we reconnect.' : hasSelection ? `${isMap ? 'Location' : `Answer ${'ABCD'[selected]}`} locked in. Waiting for the reveal…` : isMap ? 'Place a pin, then lock your location before the timer reaches zero.' : 'Pick your answer before the timer reaches zero.';
  if ($('#round-status') && $('#round-status').textContent !== message) $('#round-status').textContent = message;
}

function normalizeSpeech(text) {
  return text.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/&/g, ' and ').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function matchSpokenAnswer(text, state) {
  const spoken = normalizeSpeech(text).replace(/^(?:(?:my|the) answer is|i choose|answer is|option|choice|answer|choose|pick|select|letter|pin|place) /, '');
  if (state.question.type === 'puzzle') {
    const swap = spoken.match(/^(?:swap|switch)(?: positions?| pieces?)? (\w+) (?:and|with) (\w+)$/);
    if (!swap) return null;
    const numbers = { one: 1, two: 2, to: 2, too: 2, three: 3, four: 4, for: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9 };
    const [from, to] = swap.slice(1).map((value) => (numbers[value] ?? Number(value)) - 1);
    if (![from, to].every((value) => Number.isInteger(value) && value >= 0 && value < 9) || from === to) return null;
    return { type: 'puzzle', from, to, moves: puzzleProgress?.moves, label: `Swap positions ${from + 1} and ${to + 1}` };
  }
  if (state.question.type === 'map') {
    const towns = window.BENNETT_MAPS?.[state.question.mapId || 'new-hampshire']?.towns || [];
    const matches = towns.map((town, index) => ({ ...town, index })).filter((town) => normalizeSpeech(town.name) === spoken);
    return matches.length === 1 ? { type: 'map', ...matches[0], label: matches[0].name } : null;
  }
  const aliases = [['a', 'ay', 'one', '1'], ['b', 'be', 'bee', 'two', 'to', 'too', '2'], ['c', 'see', 'sea', 'three', '3'], ['d', 'dee', 'four', 'for', '4']];
  const matches = state.question.answers.map((answer, index) => ({ answer, index })).filter(({ answer, index }) => normalizeSpeech(answer) === spoken || aliases[index]?.includes(spoken));
  return matches.length === 1 ? { type: 'choice', answer: matches[0].index, label: `${'ABCD'[matches[0].index]}: ${matches[0].answer}` } : null;
}

function renderQuestionSpeech(state, panel) {
  const speechSession = session;
  const area = element('div', 'question-speech');
  area.setAttribute('role', 'group');
  area.setAttribute('aria-label', 'Question speech controls');
  const controls = element('div', 'speech-actions');
  const status = element('p', 'muted speech-status');
  status.id = 'speech-status';
  status.setAttribute('role', 'status');
  const help = element('p', 'muted speech-help');
  help.id = 'speech-help';
  const preview = element('p', 'speech-preview hidden');
  const isPlayer = state.role === 'player' && state.status === 'playing';
  const hint = state.question.type === 'puzzle' ? 'Say swap 1 and 2, using positions 1–9.' : state.question.type === 'map' ? 'Say a place from the location dropdown.' : 'Say A, B, C, or D, or the full answer.';
  help.textContent = isPlayer ? `${hint} Review before confirming. The clock keeps running.` : 'Hear the question and its choices using your browser’s voice.';
  let disposed = false;
  let mode = '';
  let operation = '';
  let generation = 0;
  let audioTimer;
  let utterance;
  let candidate = null;
  let recognition;
  let localCapable = false;
  let localAttempt = false;
  const waits = new Set();
  const synthesis = window.speechSynthesis;
  const canRead = Boolean(synthesis && window.SpeechSynthesisUtterance);
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (isPlayer && window.isSecureContext && Recognition) {
    try {
      recognition = new Recognition();
      localCapable = 'processLocally' in recognition && typeof Recognition.available === 'function';
      recognition.lang = 'en-US';
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
    } catch { recognition = null; }
  }
  const consent = element('div', 'speech-consent');
  const consentInput = element('input');
  consentInput.type = 'checkbox';
  consentInput.id = 'browser-speech-consent';
  consentInput.checked = browserSpeechConsent;
  const consentLabel = element('label', '', 'Allow browser speech for this visit if local recognition is unavailable. Audio may be sent to your browser provider.');
  consentLabel.htmlFor = consentInput.id;
  consentInput.addEventListener('change', () => {
    browserSpeechConsent = consentInput.checked;
    if (!browserSpeechConsent && mode && mode !== 'reading' && !localAttempt) stop();
    say(browserSpeechConsent ? 'Browser speech allowed for this visit. Local mode is still preferred. Choose Speak answer to begin.' : 'Browser speech is off. Only on-device recognition will be used.');
    update();
  });
  consent.append(consentInput, consentLabel);
  const say = (text, error = false) => {
    status.className = `${error ? 'form-error' : 'muted'} speech-status`;
    status.textContent = text;
  };
  const setupFailure = (error) => ['NotAllowedError', 'SecurityError'].includes(error?.name) ? 'This page or browser blocks speech. Check microphone and speech permissions, then retry, or use the on-screen controls.' : error?.message || 'Speech setup failed. Try again, or use the on-screen controls.';
  const current = () => !disposed && session === speechSession && currentState?.index === state.index && currentState?.status === state.status && area.isConnected;
  const canAnswer = () => current() && isPlayer && currentState.status === 'playing' && performance.now() < roundEndsAt && currentState.player?.selected === null && !pendingAnswer && (state.question.type !== 'puzzle' || (puzzleReady && !puzzleBusy && !pendingPuzzleMove)) && (state.question.type !== 'map' || Boolean($('#map-town')));
  const update = () => {
    read.disabled = !canRead;
    speak.disabled = !recognition || (!localCapable && !browserSpeechConsent) || !canAnswer() || Boolean(operation);
    install.disabled = !canAnswer() || Boolean(operation);
    confirm.disabled = !candidate || !canAnswer() || Boolean(operation);
    if ((mode || operation) && (!current() || document.hidden || (state.status === 'playing' && performance.now() >= roundEndsAt) || (mode !== 'reading' && !canAnswer()))) stop();
  };
  const stop = (resumeMusic = true) => {
    const previous = mode || operation;
    generation++;
    operation = '';
    waits.forEach((cancel) => cancel());
    waits.clear();
    clearTimeout(audioTimer);
    mode = '';
    if (utterance) {
      utterance.onend = utterance.onerror = utterance.onstart = null;
      utterance = null;
      synthesis.cancel();
    }
    if (recognition) {
      recognition.onresult = recognition.onerror = recognition.onend = recognition.onstart = null;
      try { recognition.abort(); } catch { /* Recognition may already be stopped. */ }
    }
    read.textContent = 'Read question';
    speak.textContent = 'Speak answer';
    if (!disposed) {
      if (previous) say('Speech stopped. Your on-screen controls still work.');
      update();
    }
    if (resumeMusic) startMusic();
  };
  const waitFor = (promise, milliseconds) => new Promise((resolve, reject) => {
    const cancel = () => { clearTimeout(timer); waits.delete(cancel); reject(new Error('Speech setup cancelled.')); };
    const timer = setTimeout(() => { waits.delete(cancel); reject(new Error('Speech setup timed out. Check your connection or browser settings, then retry.')); }, milliseconds);
    waits.add(cancel);
    Promise.resolve(promise).then(resolve, reject).finally(() => { clearTimeout(timer); waits.delete(cancel); });
  });
  const startAudio = (nextMode) => {
    mode = nextMode;
    stopMusic();
    experience.querySelector('video')?.pause();
    if (audioContext?.state === 'running') audioContext.suspend().catch(() => {});
  };
  const read = action('Read question', () => {
    if (mode === 'reading') return stop();
    stop(false);
    if (!canRead || !current()) return;
    try {
      const choices = state.question.answers?.map((answer, index) => `${'ABCD'[index]}. ${answer}.`).join(' ') || '';
      utterance = new window.SpeechSynthesisUtterance(`${state.question.prompt} ${choices}`);
      utterance.lang = 'en-US';
      utterance.volume = 1;
      const token = generation;
      const failed = (message) => { if (!current() || token !== generation) return; stop(); say(message, true); };
      utterance.onstart = () => {
        if (!current() || token !== generation) return;
        clearTimeout(audioTimer);
        say('Reading the question. Choose Stop reading to stop.');
        audioTimer = setTimeout(() => failed('Reading timed out. Try again, or read the question on screen.'), Math.min(120000, Math.max(15000, utterance.text.length * 100)));
      };
      utterance.onend = () => { if (current() && token === generation) { stop(); say('Question read.'); } };
      utterance.onerror = () => failed('Your browser could not read the question. Check its voice or audio settings, then retry.');
      startAudio('reading');
      read.textContent = 'Stop reading';
      say('Starting your browser’s voice…');
      audioTimer = setTimeout(() => failed('Speech playback did not start. Check your browser’s voice settings and try again.'), 8000);
      synthesis.resume();
      synthesis.speak(utterance);
    } catch { stop(); say('Speech playback is unavailable. You can still read the question on screen.', true); }
  });
  const speak = action('Speak answer', async () => {
    if (mode === 'listening' || mode === 'starting') return stop();
    stop(false);
    if (!recognition || (!localCapable && !browserSpeechConsent) || !canAnswer()) return;
    candidate = null;
    confirm.classList.add('hidden');
    const token = generation;
    try {
      let availability = 'unavailable';
      if (localCapable) {
        operation = 'checking';
        say('Checking on-device speech recognition…');
        update();
        try {
          availability = await waitFor(Recognition.available({ langs: ['en-US'], processLocally: true }), 8000);
        } catch (error) {
          if (!browserSpeechConsent) throw error;
        }
      }
      if (!current() || token !== generation || !canAnswer()) return;
      operation = '';
      install.classList.toggle('hidden', availability !== 'downloadable' || typeof Recognition.install !== 'function');
      localAttempt = availability === 'available';
      if (!localAttempt && !browserSpeechConsent) {
        say(availability === 'downloadable' ? 'Download the English speech pack once to recognize answers on this device. The timer keeps running.' : availability === 'downloading' ? 'The speech pack is still downloading. Use the on-screen controls, then try Speak answer again.' : 'On-device English recognition is unavailable in this browser. Use the on-screen controls.', true);
        return;
      }
      if ('processLocally' in recognition) recognition.processLocally = localAttempt;
      if (localAttempt && recognition.processLocally !== true) throw new Error('This browser cannot guarantee on-device recognition. Use the on-screen controls.');
      recognition.onstart = () => {
        if (!current() || token !== generation) return;
        mode = 'listening';
        say(localAttempt ? 'Listening on this device… Speak now, or choose Stop listening.' : 'Listening through your browser’s speech service… Speak now, or choose Stop listening.');
      };
      recognition.onresult = (event) => {
        if (!current() || token !== generation || !canAnswer()) return;
        const result = event.results[event.resultIndex];
        if (!result?.isFinal) return;
        const transcript = result[0]?.transcript?.trim() || '';
        stop();
        candidate = transcript ? matchSpokenAnswer(transcript, currentState) : null;
        preview.textContent = transcript ? `Heard: “${transcript}”${candidate ? ` · ${candidate.label}` : ''}` : '';
        preview.classList.toggle('hidden', !transcript);
        confirm.classList.toggle('hidden', !candidate);
        say(candidate ? 'Check the match, then choose Confirm spoken answer.' : `No clear match. ${hint} Try again or use the on-screen controls.`, !candidate);
        update();
      };
      recognition.onerror = (event) => {
        if (!current() || token !== generation) return;
        const messages = {
          'not-allowed': 'Microphone access was denied. Allow it in your browser’s site settings, then try Speak answer again.',
          'service-not-allowed': 'Speech recognition is blocked. Allow speech and microphone access in browser or device settings, then retry.',
          'audio-capture': 'No usable microphone was found. Connect or enable one, then try again.',
          'no-speech': 'No speech was heard. Try again, or use the on-screen controls.',
          'language-not-supported': localAttempt ? 'The English speech pack is missing. Choose Speak answer to check setup again.' : 'Your browser’s speech service does not support English here. Use the on-screen controls.',
          network: 'The speech service could not connect. Check your connection, then try again or use the on-screen controls.',
        };
        stop();
        say(messages[event.error] || (localAttempt ? 'Local recognition could not finish. Try again, or use the on-screen controls. No cloud fallback was used.' : 'Browser speech could not finish. Try again, or use the on-screen controls.'), true);
      };
      recognition.onend = () => {
        if (!current() || token !== generation) return;
        stop();
        say('No answer captured. Try Speak answer again, or use the on-screen controls.');
      };
      startAudio('starting');
      speak.textContent = 'Stop listening';
      say('Starting the microphone… Allow access if your browser asks.');
      audioTimer = setTimeout(() => { if (current() && token === generation) { stop(); say('Listening timed out. Try again, or use the on-screen controls.', true); } }, 12000);
      recognition.start();
    } catch (error) {
      if (current() && token === generation) { stop(); say(setupFailure(error), true); }
    } finally {
      if (current() && token === generation) { operation = ''; update(); startMusic(); }
    }
  });
  const install = action('Download English speech pack', async () => {
    if (!recognition || !localCapable || typeof Recognition.install !== 'function' || !canAnswer() || operation) return;
    stop();
    const token = generation;
    operation = 'installing';
    say('Downloading the English speech pack… It may finish after this round. The timer keeps running.');
    update();
    try {
      const installed = await waitFor(Recognition.install({ langs: ['en-US'] }), 60000);
      if (!current() || token !== generation) return;
      install.classList.toggle('hidden', installed);
      say(installed ? 'Speech pack ready. Choose Speak answer to start.' : 'The speech pack could not download. Check your connection and retry, or use the on-screen controls.', !installed);
    } catch (error) {
      if (current() && token === generation) say(setupFailure(error), true);
    } finally {
      if (current() && token === generation) { operation = ''; update(); }
    }
  });
  const confirm = action('Confirm spoken answer', () => {
    if (!candidate || !canAnswer()) return;
    const answer = candidate;
    stop();
    if (answer.type === 'puzzle') {
      if (answer.moves !== puzzleProgress?.moves) { candidate = null; confirm.classList.add('hidden'); say('Your board changed. Speak the swap again, or use the puzzle controls.', true); return; }
      puzzleSelection = null;
      selectPuzzlePiece(answer.from);
      selectPuzzlePiece(answer.to);
    } else if (answer.type === 'map') {
      const towns = $('#map-town');
      towns.value = String(answer.index);
      towns.dispatchEvent(new Event('change', { bubbles: true }));
      if (mapDraft) submitAnswer({ ...mapDraft });
    } else submitAnswer(answer.answer);
    candidate = null;
    confirm.classList.add('hidden');
    update();
  }, true);
  install.classList.add('hidden');
  confirm.classList.add('hidden');
  read.setAttribute('aria-describedby', 'speech-help speech-status');
  speak.setAttribute('aria-describedby', 'speech-help speech-status');
  controls.append(read);
  if (isPlayer) controls.append(speak, install, confirm);
  area.append(controls, help);
  if (isPlayer && recognition) area.append(consent);
  area.append(status, preview);
  panel.append(area);
  if (!canRead || (isPlayer && !recognition)) say(`${!canRead ? 'Browser text-to-speech is unavailable. ' : ''}${isPlayer && !recognition ? 'Microphone speech is unavailable here. Use the normal answer controls; browser support and HTTPS are required.' : ''}`);
  else if (isPlayer && !localCapable && !browserSpeechConsent) say('Enable Allow browser speech to use Speak answer. Your browser provider may process the audio.');
  update();
  return {
    get active() { return Boolean(mode); },
    update,
    stop,
    dispose() { disposed = true; stop(); },
  };
}

function renderRoundReveal(state, panel) {
  const reveal = state.reveal;
  const feedback = element('div', 'answer-feedback');
  const isMap = state.question.type === 'map';
  const isPuzzle = state.question.type === 'puzzle';
  const puzzleResult = isPuzzle ? reveal.winner ? `${avatars[reveal.winner.avatar].emoji} ${reveal.winner.name} finished first in ${(reveal.winner.elapsedMs / 1000).toFixed(1)} seconds!` : 'Time’s up. Nobody completed the puzzle.' : '';
  feedback.append(element('h2', '', isPuzzle ? puzzleResult : isMap ? 'Time’s up. Here’s the place!' : 'Time’s up. Here’s the answer!'), element('p', '', reveal.explanation));
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
  announce(isPuzzle ? `${puzzleResult} The host will show player points next.` : isMap ? `Time is up. Correct location: ${reveal.target.name}. Player guesses and distances in miles are listed below the map. The host will show points next.` : `Time is up. Correct answer: ${state.question.answers[reveal.correctAnswer]}. The host will show player results next.`);
  playTone('reveal');
}

function renderRoundResults(state) {
  const reveal = state.reveal;
  const isMap = state.question.type === 'map';
  const isPuzzle = state.question.type === 'puzzle';
  const panel = makePanel(`ROUND ${state.index + 1} OF ${state.total} · SCORE CHECK`, isPuzzle ? 'Who finished first?' : isMap ? 'Who got closest?' : 'Who got it right?');
  panel.classList.add('round-results-panel');
  const emblem = element('div', 'results-emblem', isMap ? '🎯' : '📊');
  emblem.setAttribute('aria-hidden', 'true');
  panel.append(emblem);
  const correctCount = reveal.players.filter((player) => player.correct).length;
  const answered = reveal.players.filter((player) => player.selected !== null).length;
  const summary = isPuzzle ? reveal.winner ? `${avatars[reveal.winner.avatar].emoji} ${reveal.winner.name} wins the puzzle round!` : 'No completed puzzle. Zero points this round.' : isMap ? answered ? `${correctCount} closest ${correctCount === 1 ? 'pin' : 'pins'} · ${answered} ${answered === 1 ? 'location' : 'locations'} locked in.` : 'No pins submitted. Zero points this round.' : `${correctCount} of ${reveal.players.length} got it right.`;
  panel.append(element('p', 'results-summary', summary));
  panel.append(element('p', 'muted', isPuzzle ? 'The first completed board earns 1,000 points; other players receive zero.' : isMap ? `Correct location: ${reveal.target.name}.` : `Correct answer: ${state.question.answers[reveal.correctAnswer]}.`));
  if (isMap) renderMapRound(state, panel);
  const list = element('ul', 'round-results');
  reveal.players.forEach((player, index) => {
    const row = element('li', `round-result${player.correct ? ' round-correct' : ''}`);
    const isYou = player.name === state.player?.name;
    if (isYou) row.classList.add('round-is-you');
    const outcome = isPuzzle ? `${player.correct ? `Winner ✓ · ${(player.elapsedMs / 1000).toFixed(1)} seconds` : 'Not completed'} · ${player.moves} swaps` : player.selected === null ? 'No answer' : isMap ? `${formatMiles(player.distanceKm)} away${player.correct ? ' · Closest ✓' : ''}` : `${player.correct ? 'Correct ✓' : 'Incorrect'} · ${'ABCD'[player.selected]}: ${state.question.answers[player.selected]}`;
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

const puzzleDescriptions = [
  'Arena banners, upper seating, and the basketball hoop',
  'Arena lights and stands beside the edge of a person’s hair',
  'A person’s hair, glasses, and upper face',
  'Players and basketball court behind spectators',
  'Court beside the left shoulder of a striped shirt',
  'A smiling lower face and upper striped shirt',
  'Rows of dark courtside seats',
  'A striped sleeve beside dark courtside seats',
  'The lower part of a striped shirt',
];

function renderPuzzleRound(state, panel) {
  if (state.status !== 'playing') {
    renderQuestionImage(panel, state.question.image);
    return;
  }
  if (state.role === 'host') {
    panel.append(element('p', 'rules-box', `Puzzle race! Everyone has the same shuffled photo in nine square pieces. Players drag pieces or select two to swap them. First to finish wins. This round lasts at most ${state.question.roundSeconds} seconds.`));
    return;
  }
  puzzleProgress = { index: state.index, board: [...state.question.board], moves: state.question.moves };
  puzzleSelection = null;
  puzzleReady = false;
  const help = element('p', 'muted', 'Put the photo back together. Drag one piece onto another, or select two pieces to swap them. Keyboard: Tab between pieces and press Enter or Space to select. All nine pieces are square; the photo is cropped to a square. First to finish wins!');
  help.id = 'puzzle-help';
  const notice = element('p', 'muted', `Loading puzzle photo… Your ${state.question.roundSeconds}-second timer is running.`);
  notice.id = 'puzzle-photo-status';
  notice.setAttribute('role', 'status');
  const board = element('div', 'puzzle-board');
  board.id = 'puzzle-board';
  board.setAttribute('role', 'group');
  board.setAttribute('aria-label', 'Nine-piece photo puzzle');
  board.setAttribute('aria-describedby', 'puzzle-help puzzle-status');
  board.setAttribute('aria-busy', 'true');
  const status = element('p', 'muted', 'Select a piece, then select another to swap them.');
  status.id = 'puzzle-status';
  status.setAttribute('role', 'status');
  const photoParts = [];
  const loaded = new Set();
  const failed = () => {
    if (!board.isConnected) return;
    clearTimeout(imageTimer);
    puzzleReady = false;
    board.setAttribute('aria-busy', 'false');
    notice.textContent = 'The puzzle photo could not load. Retry to keep your saved board. The round timer continues.';
    if (!$('#puzzle-photo-retry')) {
      const retry = action('Retry puzzle photo', load);
      retry.id = 'puzzle-photo-retry';
      panel.append(retry);
    }
    updatePuzzleBoard(currentState);
  };
  const load = () => {
    clearTimeout(imageTimer);
    loaded.clear();
    puzzleReady = false;
    board.setAttribute('aria-busy', 'true');
    notice.textContent = `Loading puzzle photo… Your ${state.question.roundSeconds}-second timer is running.`;
    const url = new URL(state.question.image.src, window.BENNETT_API_ORIGIN || location.origin).href;
    photoParts.forEach((image) => {
      image.removeAttribute('href');
      image.setAttribute('href', url);
    });
    imageTimer = setTimeout(failed, 7000);
    updatePuzzleBoard(currentState);
  };
  state.question.board.forEach((piece, index) => {
    const button = element('button', 'puzzle-piece');
    button.type = 'button';
    button.dataset.position = index;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    const image = document.createElementNS('http://www.w3.org/2000/svg', 'image');
    Object.entries({ x: 0, y: 0, width: 3, height: 3, preserveAspectRatio: 'xMidYMid slice' }).forEach(([key, value]) => image.setAttribute(key, value));
    image.addEventListener('load', () => {
      if (!board.isConnected) return;
      loaded.add(index);
      if (loaded.size !== 9) return;
      clearTimeout(imageTimer);
      puzzleReady = true;
      board.setAttribute('aria-busy', 'false');
      notice.textContent = 'Photo loaded. Swap pieces to complete the picture.';
      $('#puzzle-photo-retry')?.remove();
      updatePuzzleBoard(currentState);
    });
    image.addEventListener('error', failed);
    photoParts.push(image);
    svg.append(image);
    button.append(svg, element('span', 'puzzle-position', String(index + 1)));
    button.addEventListener('click', () => selectPuzzlePiece(index));
    button.addEventListener('dragstart', (event) => {
      if (button.disabled) return event.preventDefault();
      puzzleSelection = index;
      event.dataTransfer.setData('text/plain', String(index));
      event.dataTransfer.effectAllowed = 'move';
      updatePuzzleBoard(currentState);
    });
    button.addEventListener('dragover', (event) => {
      if (!button.disabled && puzzleSelection !== null) event.preventDefault();
    });
    button.addEventListener('drop', (event) => {
      event.preventDefault();
      selectPuzzlePiece(index);
    });
    board.append(button);
  });
  panel.append(help, notice, board, status);
  load();
}

function updatePuzzleBoard(state) {
  if (state?.question.type !== 'puzzle' || !puzzleProgress || puzzleProgress.index !== state.index) return;
  if (state.question.moves >= puzzleProgress.moves) {
    puzzleProgress.board = [...state.question.board];
    puzzleProgress.moves = state.question.moves;
  }
  if (pendingPuzzleMove && puzzleProgress.moves >= pendingPuzzleMove.moveNumber) {
    pendingPuzzleMove = null;
    puzzleSelection = null;
    $('#puzzle-error')?.remove();
    $('#puzzle-move-retry')?.remove();
  }
  const blocked = state.status !== 'playing' || performance.now() >= roundEndsAt || !puzzleReady || puzzleBusy || Boolean(pendingPuzzleMove);
  experience.querySelectorAll('.puzzle-piece').forEach((button, index) => {
    const piece = puzzleProgress.board[index];
    button.disabled = blocked;
    button.draggable = !blocked;
    button.setAttribute('aria-pressed', String(puzzleSelection === index));
    button.setAttribute('aria-label', `Position ${index + 1}, row ${Math.floor(index / 3) + 1}, column ${index % 3 + 1}: ${puzzleDescriptions[piece]}.`);
    button.querySelector('svg').setAttribute('viewBox', `${piece % 3} ${Math.floor(piece / 3)} 1 1`);
  });
}

function selectPuzzlePiece(index) {
  if (currentState?.status !== 'playing' || currentState.question.type !== 'puzzle' || !puzzleReady || puzzleBusy || pendingPuzzleMove || performance.now() >= roundEndsAt) return;
  if (puzzleSelection === null) {
    puzzleSelection = index;
    $('#puzzle-status').textContent = `Position ${index + 1} selected. Select a different piece to swap, or select this piece again to cancel.`;
    return updatePuzzleBoard(currentState);
  }
  if (puzzleSelection === index) {
    puzzleSelection = null;
    $('#puzzle-status').textContent = 'Selection cancelled. Select a piece to start a swap.';
    return updatePuzzleBoard(currentState);
  }
  pendingPuzzleMove = { index: currentState.index, from: puzzleSelection, to: index, moveNumber: puzzleProgress.moves + 1 };
  sendPuzzleMove();
}

async function sendPuzzleMove() {
  if (!pendingPuzzleMove || puzzleBusy) return;
  const move = pendingPuzzleMove;
  const moveSession = session;
  puzzleBusy = true;
  $('#puzzle-status').textContent = 'Saving your swap…';
  updatePuzzleBoard(currentState);
  try {
    const result = await request('puzzle-move', { ...moveSession, ...move });
    if (session !== moveSession || currentState?.index !== move.index || currentState.status !== 'playing') return;
    if (result.moves >= puzzleProgress.moves) puzzleProgress = { index: move.index, board: result.board, moves: result.moves };
    pendingPuzzleMove = null;
    puzzleSelection = null;
    $('#puzzle-error')?.remove();
    $('#puzzle-move-retry')?.remove();
    $('#puzzle-status').textContent = 'Swap saved. Select the next two pieces.';
    playTone('tap');
    if (result.status !== 'playing') await pollState();
  } catch (error) {
    if (session !== moveSession || currentState?.index !== move.index || currentState.status !== 'playing' || puzzleProgress.moves >= move.moveNumber) return;
    if (error.status === 409) {
      pendingPuzzleMove = null;
      puzzleSelection = null;
      return pollState();
    }
    let message = $('#puzzle-error');
    if (!message) {
      message = element('p', 'form-error');
      message.id = 'puzzle-error';
      message.setAttribute('role', 'alert');
      experience.querySelector('.game-panel').append(message);
      const retry = action('Retry saved swap', sendPuzzleMove);
      retry.id = 'puzzle-move-retry';
      experience.querySelector('.game-panel').append(retry);
    }
    message.textContent = `Your swap could not be confirmed. ${error.message} Your board and pending swap are saved; retry before the timer ends.`;
  } finally {
    puzzleBusy = false;
    updateLiveRound(currentState);
  }
}

function formatMiles(distanceKm) {
  return `${(distanceKm / 1.609344).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} miles`;
}

function mapPosition(point, data) {
  const { bounds, width, height } = data;
  return { x: (point.lng - bounds.west) / (bounds.east - bounds.west) * width, y: (bounds.north - point.lat) / (bounds.north - bounds.south) * height };
}

function positionMapPin(point) {
  const marker = $('#map-guess-marker');
  const data = window.BENNETT_MAPS?.[currentState?.question.mapId || 'new-hampshire'];
  if (!marker || !data) return;
  const { x, y } = mapPosition(point, data);
  marker.setAttribute('cx', x);
  marker.setAttribute('cy', y);
  marker.classList.remove('hidden');
}

function renderMapRound(state, panel) {
  const data = window.BENNETT_MAPS?.[state.question.mapId || 'new-hampshire'];
  if (!data?.outlines?.length) {
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
  const area = element('div', `map-round${state.question.mapId === 'europe' ? ' map-europe' : ''}`);
  const canvas = element(interactive ? 'button' : 'div', `map-canvas${interactive ? ' map-control' : ''}`);
  const svg = svgNode('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': revealing ? `Map of ${data.name} with the correct location and player guesses. Names and distances in miles are listed below.` : `Unlabelled map of ${data.name}, with north at the top.` });
  data.outlines.forEach((outline) => svg.append(svgNode('polygon', { points: outline.map(([lng, lat]) => {
    const { x, y } = mapPosition({ lat, lng }, data);
    return `${x},${y}`;
  }).join(' '), class: 'map-state', 'vector-effect': 'non-scaling-stroke' })));
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
    renderMapGuesses(state, svg, area, data, svgNode);
    return;
  }
  if (!interactive) {
    area.append(element('p', 'muted', 'Players place their pins on their own devices. Guesses and the correct location appear only after the timer ends.'));
    return;
  }
  mapDraft = state.player.selected || null;
  const marker = svgNode('circle', { id: 'map-guess-marker', cx: 0, cy: 0, r: 7, class: 'map-draft hidden' });
  svg.append(marker);
  canvas.type = 'button';
  canvas.setAttribute('aria-label', `Place your guess on the ${data.name} map`);
  canvas.setAttribute('aria-describedby', 'map-help map-pin-status');
  const help = element('p', 'muted', `Click or tap to place a pin. Keyboard: focus the map, use arrow keys to move, Shift + arrows for bigger steps, and Enter or Space to place the center pin. You can also choose a ${data.place} below. Then lock your location.`);
  help.id = 'map-help';
  area.append(help);
  const pinStatus = element('p', 'muted', 'No pin placed yet.');
  pinStatus.id = 'map-pin-status';
  pinStatus.setAttribute('role', 'status');
  area.append(pinStatus);
  const field = element('div', 'field');
  const label = element('label', '', `Jump to a ${data.place} (optional)`);
  label.htmlFor = 'map-town';
  const towns = element('select', 'map-control map-town');
  towns.id = 'map-town';
  const empty = element('option', '', `Choose a ${data.place} or use the map`);
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
    pinStatus.textContent = `Pin at ${Math.abs(mapDraft.lat).toFixed(3)}° ${mapDraft.lat < 0 ? 'S' : 'N'}, ${Math.abs(mapDraft.lng).toFixed(3)}° ${mapDraft.lng < 0 ? 'W' : 'E'}. Choose Lock this location to submit.`;
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
    const step = data.step * (event.shiftKey ? 10 : 1);
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

function renderMapGuesses(state, svg, area, data, svgNode) {
  const targetPoint = mapPosition(state.reveal.target, data);
  const labels = [];
  const guesses = state.reveal.guesses || [];
  const legend = element('ul', 'map-guess-list');
  guesses.forEach((player, index) => {
    const avatar = avatars[player.avatar]?.emoji || '🙂';
    const row = element('li', '', `#${index + 1} ${avatar} ${player.name} — ${player.location ? `${formatMiles(player.distanceKm)} away` : 'No pin submitted'}`);
    legend.append(row);
    if (!player.location) return;
    const point = mapPosition(player.location, data);
    svg.append(svgNode('path', { d: `M${targetPoint.x},${targetPoint.y} L${point.x},${point.y}`, pathLength: 1, class: `map-result-line${state.status === 'reveal' ? ` map-line-animate map-line-delay-${index % 4}` : ''}`, 'vector-effect': 'non-scaling-stroke' }));
    const pin = svgNode('circle', { cx: point.x, cy: point.y, r: 6, class: 'map-player-pin', 'vector-effect': 'non-scaling-stroke' });
    const label = svgNode('g', { class: `map-guess-label${state.status === 'reveal' ? ' map-label-animate' : ''}` });
    const plate = svgNode('rect', { rx: 5, class: 'map-label-plate', 'vector-effect': 'non-scaling-stroke' });
    const name = [...player.name];
    const lines = [`${avatar} ${name.slice(0, 12).join('')}`, ...(name.length > 12 ? [name.slice(12).join('')] : []), formatMiles(player.distanceKm)];
    const texts = lines.map((line) => {
      const text = svgNode('text', {});
      text.textContent = line;
      return text;
    });
    label.append(plate, ...texts);
    svg.append(pin, label);
    labels.push({ point, pin, plate, texts });
  });
  const target = svgNode('rect', { class: 'map-target', 'vector-effect': 'non-scaling-stroke' });
  const targetLabel = svgNode('text', { class: 'map-target-label' });
  targetLabel.textContent = state.reveal.target.name;
  svg.append(target, targetLabel);
  const layout = () => {
    const renderedWidth = svg.getBoundingClientRect().width || data.width;
    const scale = data.width / renderedWidth;
    const labelWidth = Math.min(data.width, 148 * scale);
    labels.forEach(({ point, pin, plate, texts }) => {
      const labelHeight = (texts.length * 18 + 10) * scale;
      const x = Math.max(0, Math.min(data.width - labelWidth, point.x + 8 * scale));
      const y = Math.max(0, Math.min(data.height - labelHeight, point.y + 10 * scale));
      pin.setAttribute('r', 5 * scale);
      Object.entries({ x, y, width: labelWidth, height: labelHeight }).forEach(([key, value]) => plate.setAttribute(key, value));
      texts.forEach((text, index) => {
        Object.entries({ x: x + 7 * scale, y: y + (19 + index * 18) * scale, 'font-size': 14 * scale }).forEach(([key, value]) => text.setAttribute(key, value));
      });
    });
    Object.entries({ x: targetPoint.x - 6 * scale, y: targetPoint.y - 6 * scale, width: 12 * scale, height: 12 * scale }).forEach(([key, value]) => target.setAttribute(key, value));
    targetLabel.setAttribute('x', Math.max(6 * scale, Math.min(data.width - state.reveal.target.name.length * 8 * scale, targetPoint.x + 10 * scale)));
    targetLabel.setAttribute('y', Math.max(20 * scale, targetPoint.y - 14 * scale));
    targetLabel.setAttribute('font-size', 14 * scale);
  };
  layout();
  if (typeof ResizeObserver !== 'undefined') {
    mapObserver = new ResizeObserver(layout);
    mapObserver.observe(svg);
  }
  area.append(element('p', 'muted', `The square marks ${state.reveal.target.name}. Lines connect it to each submitted pin. Overlapping labels? Every name and distance is also listed below.`));
  if (!guesses.some((player) => player.location)) area.append(element('p', 'muted', 'No pins were submitted this round.'));
  if (state.status === 'reveal') area.append(legend);
}

function renderQuestionVideo(panel, data) {
  const figure = element('figure', 'question-media');
  const video = element('video', 'question-video');
  video.controls = true;
  video.playsInline = true;
  video.preload = 'metadata';
  if (data.poster) video.poster = new URL(data.poster, window.BENNETT_API_ORIGIN || location.origin).href;
  video.setAttribute('aria-label', data.caption);
  const status = element('p', 'muted', 'Loading video…');
  status.setAttribute('role', 'status');
  const caption = element('figcaption', 'photo-caption', `${data.caption} Press Play to watch. The round timer keeps running.`);
  if (data.source) {
    const source = element('a', '', data.sourceLabel || 'Video source');
    source.href = data.source;
    caption.append(element('span', '', ' '), source);
  }
  const retry = action('Retry video', () => {
    load();
    video.focus();
  });
  retry.classList.add('hidden');
  let timer;
  let disposed = false;
  const failed = () => {
    if (disposed || !figure.isConnected) return;
    clearTimeout(timer);
    figure.setAttribute('aria-busy', 'false');
    status.textContent = 'The video could not load or play. Retry it, or answer the question without the clip. Your answer is preserved and the timer keeps running.';
    retry.classList.remove('hidden');
  };
  const load = () => {
    clearTimeout(timer);
    figure.setAttribute('aria-busy', 'true');
    status.textContent = 'Loading video…';
    retry.classList.add('hidden');
    video.src = new URL(data.src, window.BENNETT_API_ORIGIN || location.origin).href;
    timer = setTimeout(failed, 10000);
    video.load();
  };
  const ready = () => {
    if (disposed || !figure.isConnected) return;
    clearTimeout(timer);
    figure.setAttribute('aria-busy', 'false');
    status.textContent = 'Video ready. Use Play to watch or replay the clip.';
    retry.classList.add('hidden');
  };
  video.addEventListener('loadedmetadata', ready);
  video.addEventListener('playing', ready);
  video.addEventListener('waiting', () => {
    if (disposed || !figure.isConnected) return;
    clearTimeout(timer);
    status.textContent = 'Buffering video… The round timer keeps running.';
    timer = setTimeout(failed, 10000);
  });
  video.addEventListener('error', failed);
  video.addEventListener('play', stopMusic);
  video.addEventListener('pause', () => { if (!disposed) startMusic(); });
  video.addEventListener('ended', () => { if (!disposed) startMusic(); });
  figure.append(video, status, caption, retry);
  if (data.description) {
    const description = element('p', 'muted', `Video description: ${data.description}`);
    description.id = 'video-description';
    video.setAttribute('aria-describedby', description.id);
    figure.append(description);
  }
  panel.append(figure);
  videoCleanup = () => {
    disposed = true;
    clearTimeout(timer);
    video.pause();
    video.removeAttribute('src');
    video.load();
    startMusic();
  };
  load();
}

function renderQuestionImage(panel, data) {
  const figure = element('figure', 'question-media');
  const image = element('img', `question-photo${data.diagram ? ' question-diagram' : ''} hidden`);
  image.alt = data.alt;
  image.decoding = 'async';
  let animating = false;
  const animationControl = data.animationSrc ? action('Play animation', () => {
    animating = !animating;
    animationControl.textContent = animating ? 'Stop animation' : 'Play animation';
    animationControl.setAttribute('aria-pressed', String(animating));
    load();
  }) : null;
  animationControl?.setAttribute('aria-pressed', 'false');
  const status = element('p', 'muted', 'Loading photo…');
  status.setAttribute('role', 'status');
  const caption = element('figcaption', 'photo-caption');
  caption.append(element('span', '', `${data.caption} ${data.creditLabel || 'Photo'}: ${data.author}. `));
  const original = element(data.source ? 'a' : 'span', '', data.sourceLabel || 'Wikimedia Commons source');
  if (data.source) original.href = data.source;
  caption.append(original, element('span', '', ' · '));
  const license = element(data.licenseUrl ? 'a' : 'span', '', data.license);
  if (data.licenseUrl) license.href = data.licenseUrl;
  caption.append(license, element('span', '', ' · Resized for display.'));
  let retry;
  const unavailable = () => {
    if (!figure.isConnected) return;
    clearTimeout(imageTimer);
    image.classList.add('hidden');
    status.textContent = data.identification ? `Photo unavailable. Visual description: ${data.alt} You can answer from this description or retry the photo. The timer keeps running.` : 'Photo unavailable. The question and answers still work.';
    if (!retry) {
      retry = action('Retry photo', load);
      figure.append(retry);
    }
  };
  const load = () => {
    clearTimeout(imageTimer);
    image.classList.add('hidden');
    status.textContent = 'Loading photo…';
    figure.setAttribute('aria-busy', 'true');
    const origin = window.BENNETT_API_ORIGIN || location.origin;
    image.src = new URL(animating ? data.animationSrc : data.src, origin).href;
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
    status.textContent = data.animationSrc ? animating ? 'Animation playing. Use Stop animation to return to the still image.' : 'Still image. Use Play animation to watch.' : '';
  });
  image.addEventListener('error', () => {
    if (!figure.isConnected) return;
    figure.setAttribute('aria-busy', 'false');
    unavailable();
  });
  figure.append(image, status, caption);
  if (animationControl) figure.append(animationControl);
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
  panel.append(element('p', 'muted', 'The closest map pin earns 1,000 points; other map scores decrease with extra distance. The first puzzle finisher wins 1,000 points; other players receive zero for that round. Multiple-choice answers earn 600–1,000 points based on speed. Equal scores share a place. Personal facts and personal photos are supplied by the host; other trivia has linked sources. Illustrative stock photos are labelled and are not family photos or proof of product authorship.'));
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
