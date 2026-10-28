'use strict';

const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomBytes, randomInt } = require('node:crypto');

const PORT = Number(process.env.PORT) || 3000;
const QUESTION_MS = 10000;
const ROOM_MS = 6 * 60 * 60 * 1000;
const rooms = new Map();
const limits = new Map();
const allowedOrigins = new Set((process.env.ALLOWED_ORIGINS || '').split(',').map((origin) => origin.trim()).filter(Boolean));
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const portfolio = { label: "Alexander's public portfolio", url: 'https://www.behance.net/alexbennett' };
const presenterGuide = { label: 'Microsoft Presenter+ support', url: 'https://support.microsoft.com/en-us/surface/accessories/certified/use-microsoft-presenter-in-microsoft-teams' };
const garbagePlateGuide = { label: 'Visit Rochester: the Garbage Plate', url: 'https://www.visitrochester.com/restaurants/the-garbage-plate/' };
const questions = [
  { category: 'Meet the designer', prompt: 'Which design discipline does Alexander list in his Microsoft role?', answers: ['Industrial design', 'Landscape architecture', 'Fashion design', 'Editorial design'], correct: 0, explanation: 'His public portfolio lists Industrial Designer at Microsoft: physical products, not just pixels.', source: portfolio },
  { category: 'Inside Microsoft', prompt: 'Which Microsoft team does Alex name in his public bio?', answers: ['Xbox game publishing', 'Devices', 'Azure networking', 'Bing advertising'], correct: 1, explanation: 'Alex describes himself as an industrial designer on Microsoft’s devices team.', source: portfolio },
  { category: 'The Rochester connection', prompt: 'Alex calls himself an “RIT ID Alum.” What does RIT stand for?', answers: ['Rhode Island Technical', 'Richmond Institute of Technology', 'Rochester Institute of Technology', 'Royal Institute of Typography'], correct: 2, explanation: 'RIT is Rochester Institute of Technology. His portfolio explicitly identifies him as an industrial design alum.', source: portfolio },
  { category: 'Prototype mode', prompt: 'What two ingredients does Alex say he uses to “prototype the future”?', answers: ['Clay and watercolor', 'Spreadsheets and surveys', 'Film and photography', 'Electronics and code'], correct: 3, explanation: 'His own bio says “using electronics and code to prototype the future.”', source: portfolio },
  { category: 'Product spotlight', prompt: 'Which Microsoft product has its own project in Alex’s public portfolio?', answers: ['Microsoft Presenter+', 'Surface Studio 2+', 'Xbox Adaptive Controller', 'HoloLens 2'], correct: 0, explanation: 'Microsoft Presenter+ is a named project in Alex’s portfolio. That is a documented connection, not a guess based on his employer.', source: portfolio },
  { category: 'Behind the scenes', prompt: 'Which project title appears alongside Presenter+ in Alex’s portfolio?', answers: ['Datacenter Cooling', 'Hardware Prototyping', 'Flight Simulator Cockpit', 'Quantum Computing'], correct: 1, explanation: '“Hardware Prototyping” is another project listed in his public portfolio.', source: portfolio },
  { category: 'Beyond the day job', prompt: 'Which watch project is listed in Alex’s portfolio?', answers: ['Pixel Watch', 'Apple Watch Ultra', 'Second Surface Watch', 'Galaxy Watch'], correct: 2, explanation: 'The portfolio title is “Second Surface Watch.” A portfolio title is not evidence that he designed a shipped Microsoft watch.', source: portfolio },
  { category: 'Take a seat', prompt: 'Which furniture project is part of Alex’s public design portfolio?', answers: ['Gesture Chair', 'Aeron Chair', 'Embody Chair', 'Invitation Chair'], correct: 3, explanation: '“Invitation Chair” appears in his portfolio: the work extends beyond electronics.', source: portfolio },
  { category: 'Rochester food break', prompt: 'What is Rochester’s famous Garbage Plate?', answers: ['Burgers or hots over sides like macaroni salad and home fries, with meat hot sauce', 'A cold seafood platter with cocktail sauce', 'A breakfast stack of pancakes and fruit', 'A pizza topped with pasta and cheese'], correct: 0, explanation: 'A traditional Garbage Plate layers a protein such as cheeseburgers or hots over sides such as macaroni salad and home fries, usually topped with Rochester-style meat hot sauce. Combinations vary. This is Rochester food trivia, not a claim about Alex’s favorite meal.', source: garbagePlateGuide },
  { category: 'Rochester · The original', prompt: 'Which Rochester restaurant is home to the original Garbage Plate?', answers: ['Dog Town Hots', 'Nick Tahou Hots', 'Dinosaur Bar-B-Que', 'Genesee Brew House'], correct: 1, explanation: 'Nick Tahou Hots originated the Garbage Plate and trademarked the name. Other Rochester restaurants serve their own versions under different names.', source: garbagePlateGuide },
  { category: 'Presenter+ · Meeting room', prompt: 'Presenter+ is a certified remote for which Microsoft app?', answers: ['Outlook', 'OneNote', 'Microsoft Teams', 'Microsoft Whiteboard'], correct: 2, explanation: 'Microsoft describes Presenter+ as a Certified for Microsoft Teams remote for work or school meetings and calls.', source: presenterGuide },
  { category: 'Presenter+ · Cut the cord', prompt: 'How does Presenter+ pair with a Windows PC or Mac?', answers: ['NFC only', 'Wi-Fi Direct', 'An infrared receiver', 'Bluetooth'], correct: 3, explanation: 'Microsoft’s setup instructions start with Bluetooth pairing on a Windows 10/11 PC or Mac.', source: presenterGuide },
  { category: 'Presenter+ · Slide into it', prompt: 'Which Teams feature lets you present slides with Presenter+?', answers: ['PowerPoint Live', 'Excel Live', 'Together mode', 'Loop components'], correct: 0, explanation: 'The documented presentation workflow is Share → PowerPoint Live in a Teams meeting.', source: presenterGuide },
  { category: 'Presenter+ · You’re on mute', prompt: 'The Presenter+ mute button is solid red. What does that mean?', answers: ['Your hand is raised', 'Your microphone is muted', 'The next slide is loading', 'The pointer is active'], correct: 1, explanation: 'Solid red means muted; solid white means unmuted. The physical button makes microphone state visible.', source: presenterGuide },
  { category: 'Presenter+ · Quick contribution', prompt: 'You’re muted and want to speak briefly. What should you do?', answers: ['Double-tap Next', 'Hold the pointer button', 'Hold Mute while speaking, then release', 'Hold Back and Next together'], correct: 2, explanation: 'Holding Mute temporarily unmutes you. Releasing it mutes you again: a physical push-to-talk interaction.', source: presenterGuide },
  { category: 'Presenter+ · Hands up', prompt: 'Which action raises or lowers your hand during a Teams meeting?', answers: ['Double-tap Mute', 'Hold Next', 'Shake the remote', 'Press and hold the Teams button'], correct: 3, explanation: 'Press and hold the Teams button to raise your hand; repeat to lower it.', source: presenterGuide },
  { category: 'Presenter+ · Point taken', prompt: 'How do you activate the pointer while presenting in PowerPoint Live?', answers: ['Hold the laser pointer button', 'Double-tap Back', 'Hold Mute', 'Press the Teams button once'], correct: 0, explanation: 'Press and hold the laser pointer button, then point to the area on the slide you want to discuss.', source: presenterGuide },
  { category: 'Presenter+ · Keep it moving', prompt: 'Which controls move between slides in PowerPoint Live?', answers: ['Mute and Teams', 'Back and Next', 'Volume up and down', 'A scroll wheel'], correct: 1, explanation: 'The remote has dedicated Back and Next buttons for navigating presentation slides.', source: presenterGuide },
  { category: 'Presenter+ · Make it yours', prompt: 'Which app customizes Presenter+ buttons and pointer settings?', answers: ['Microsoft Designer', 'Surface app', 'Microsoft Accessory Center', 'Windows Media Player'], correct: 2, explanation: 'Microsoft Accessory Center provides button, pointer, and other settings for Presenter+.', source: presenterGuide },
  { category: 'Presenter+ · Platform twist', prompt: 'Presenter+ pairs with Macs, but its Accessory Center app requires what?', answers: ['Android', 'iPadOS', 'ChromeOS', 'Windows 10 or 11'], correct: 3, explanation: 'The Microsoft Accessory Center app runs on Windows 10/11 and is not available for macOS. Pairing support and customization support are different things.', source: presenterGuide },
];

const token = () => randomBytes(24).toString('hex');
const shuffledOptions = () => {
  const order = [0, 1, 2, 3];
  for (let index = order.length - 1; index > 0; index--) {
    const swap = randomInt(index + 1);
    [order[index], order[swap]] = [order[swap], order[index]];
  }
  return order;
};
const fail = (status, message) => Object.assign(new Error(message), { status });
const getRoom = (body) => {
  const room = rooms.get(body.code);
  if (!room || Date.now() - room.createdAt > ROOM_MS) throw fail(404, 'That game was not found or has expired. Ask your host for a new code.');
  return room;
};
const getHost = (body) => {
  const room = getRoom(body);
  if (body.token !== room.hostToken) throw fail(403, 'Only the host can do that. Return to your player screen.');
  return room;
};
const getPlayer = (room, body) => {
  const player = room.players.find((entry) => entry.token === body.token);
  if (!player) throw fail(403, 'Your game session is not valid. Return to the lobby and join with the current code.');
  return player;
};

function updateRound(room, now = Date.now()) {
  if (room.status !== 'playing' || now < room.deadline) return;
  const correctAnswer = room.options[room.index].indexOf(questions[room.index].correct);
  room.players.forEach((player) => {
    const answer = player.answers[room.index];
    if (answer?.selected === correctAnswer) {
      answer.points = 600 + Math.round(400 * Math.max(0, 1 - answer.elapsed / QUESTION_MS));
      player.score += answer.points;
      player.correct++;
    }
  });
  room.status = 'reveal';
}

function publicState(room, body) {
  updateRound(room);
  const host = body.token === room.hostToken;
  const player = host ? null : getPlayer(room, body);
  const state = { code: room.code, role: host ? 'host' : 'player', status: room.status, total: questions.length, index: room.index };
  state.players = room.players.map((entry) => ({ name: entry.name, avatar: entry.avatar, answered: Boolean(entry.answers[room.index]) }));
  if (player) {
    state.player = { name: player.name, avatar: player.avatar, score: player.score, correct: player.correct, selected: player.answers[room.index]?.selected ?? null };
  }
  if (room.status === 'playing' || room.status === 'reveal') {
    const { prompt, answers, category, explanation, source } = questions[room.index];
    state.question = { prompt, answers: room.options[room.index].map((index) => answers[index]), category, remainingMs: Math.max(0, room.deadline - Date.now()) };
    if (room.status === 'reveal') {
      const correctAnswer = room.options[room.index].indexOf(questions[room.index].correct);
      state.reveal = {
        correctAnswer, explanation, source,
        players: room.players.map((entry) => {
          const answer = entry.answers[room.index];
          return { name: entry.name, avatar: entry.avatar, selected: answer?.selected ?? null, correct: answer?.selected === correctAnswer, points: answer?.points || 0, score: entry.score };
        }),
      };
    }
  }
  if (room.status === 'finished') {
    const ranked = [...room.players].sort((a, b) => b.score - a.score || a.joinedAt - b.joinedAt);
    state.leaderboard = ranked.map((entry) => ({
      name: entry.name, avatar: entry.avatar, score: entry.score,
      rank: ranked.findIndex((other) => other.score === entry.score) + 1,
      isYou: entry === player,
    }));
  }
  return state;
}

function api(command, body) {
  if (command === 'create') {
    if (rooms.size >= 300) throw fail(503, 'All game rooms are busy. Please try again shortly.');
    let code;
    do { code = Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join(''); } while (rooms.has(code));
    const room = { code, hostToken: token(), status: 'lobby', players: [], createdAt: Date.now(), index: -1, deadline: null, options: questions.map(shuffledOptions) };
    rooms.set(code, room);
    return { code, token: room.hostToken };
  }
  if (command === 'join') {
    const room = getRoom(body);
    if (room.status !== 'lobby') throw fail(409, 'This game has already started. Ask your host to create a new room for the next round.');
    if (room.players.length >= 100) throw fail(409, 'This room is full (100 players). Ask your host to create another game.');
    if (typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > 24 || /[\u0000-\u001f\u007f]/.test(body.name)) throw fail(400, 'Enter a name between 1 and 24 characters, without control characters.');
    if (!Number.isInteger(body.avatar) || body.avatar < 0 || body.avatar > 5) throw fail(400, 'Choose one of the six emoji avatars.');
    const name = body.name.trim();
    if (room.players.some((player) => player.name.toLocaleLowerCase() === name.toLocaleLowerCase())) throw fail(409, 'Someone is already using that name. Add an initial or choose a nickname.');
    const player = { token: token(), name, avatar: body.avatar, score: 0, correct: 0, joinedAt: Date.now(), answers: [] };
    room.players.push(player);
    return { token: player.token };
  }
  if (command === 'state') return publicState(getRoom(body), body);
  if (command === 'start') {
    const room = getHost(body);
    if (room.status !== 'lobby') throw fail(409, 'This game has already started.');
    if (!room.players.length) throw fail(409, 'Wait for at least one player to join.');
    room.status = 'playing';
    room.index = 0;
    room.deadline = Date.now() + QUESTION_MS;
    return { ok: true };
  }
  if (command === 'answer') {
    const room = getRoom(body);
    const player = getPlayer(room, body);
    const now = Date.now();
    updateRound(room, now);
    if (!Number.isInteger(body.index) || body.index < 0 || body.index >= questions.length) throw fail(400, 'That question is not valid.');
    if (!Number.isInteger(body.answer) || body.answer < 0 || body.answer > 3) throw fail(400, 'Choose one of the four answers.');
    if (body.index !== room.index) throw fail(409, 'The host has moved to another question. Reconnecting to the live round.');
    if (player.answers[room.index]) return { accepted: true, selected: player.answers[room.index].selected };
    if (room.status !== 'playing') throw fail(409, 'Answers are closed. Wait for the host to start the next question.');
    player.answers[room.index] = { selected: body.answer, elapsed: QUESTION_MS - (room.deadline - now), points: 0 };
    return { accepted: true, selected: body.answer };
  }
  if (command === 'next') {
    const room = getHost(body);
    updateRound(room);
    if (body.index !== room.index || room.status !== 'reveal') throw fail(409, 'Wait for this round to finish, or reconnect to the current question.');
    if (room.index === questions.length - 1) room.status = 'finished';
    else {
      room.index++;
      room.status = 'playing';
      room.deadline = Date.now() + QUESTION_MS;
    }
    return { ok: true };
  }
  throw fail(404, 'That game action was not found.');
}

function send(response, status, data) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(data));
}

const staticFiles = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/style.css', ['style.css', 'text/css; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/config.js', ['config.js', 'text/javascript; charset=utf-8']],
]);
const server = http.createServer(async (request, response) => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'same-origin');
  response.setHeader('X-Frame-Options', 'SAMEORIGIN');
  try {
    const url = new URL(request.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) {
      const origin = request.headers.origin;
      const sameOrigin = !origin || origin === `http://${request.headers.host}` || origin === `https://${request.headers.host}`;
      if (!sameOrigin && !allowedOrigins.has(origin)) throw fail(403, 'This site is not allowed to connect to the game server. Ask the host to configure ALLOWED_ORIGINS.');
      if (origin && allowedOrigins.has(origin)) {
        response.setHeader('Access-Control-Allow-Origin', origin);
        response.setHeader('Vary', 'Origin');
        response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        response.setHeader('Access-Control-Max-Age', '600');
      }
      if (request.method === 'OPTIONS') {
        response.writeHead(204);
        response.end();
        return;
      }
      if (request.method !== 'POST') throw fail(405, 'Use POST for game actions.');
      if (!request.headers['content-type']?.startsWith('application/json')) throw fail(415, 'Game requests must use JSON.');
      const key = request.socket.remoteAddress;
      const now = Date.now();
      let limit = limits.get(key);
      if (!limit || now - limit.since > 60000) {
        limit = { since: now, count: 0, creates: 0 };
        limits.set(key, limit);
      }
      if (++limit.count > 12000) throw fail(429, 'Too many requests. Wait a minute and retry.');
      if (url.pathname === '/api/create' && ++limit.creates > 20) throw fail(429, 'Too many rooms created. Wait a minute and retry.');
      let raw = '';
      for await (const chunk of request) {
        raw += chunk;
        if (Buffer.byteLength(raw) > 4096) throw fail(413, 'That game request is too large.');
      }
      let body;
      try { body = JSON.parse(raw); } catch { throw fail(400, 'That request could not be read. Please retry.'); }
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw fail(400, 'Game requests must contain an object.');
      send(response, 200, api(url.pathname.slice(5), body));
      return;
    }
    if (!['GET', 'HEAD'].includes(request.method)) throw fail(405, 'This page supports GET requests.');
    const file = staticFiles.get(url.pathname);
    if (!file) throw fail(404, 'That page was not found.');
    const content = await fs.readFile(path.join(__dirname, file[0]));
    response.writeHead(200, { 'Content-Type': file[1], 'Cache-Control': 'no-cache' });
    response.end(request.method === 'HEAD' ? undefined : content);
  } catch (error) {
    if (!response.headersSent) send(response, error.status || 500, { error: error.status ? error.message : 'The game server had a problem. Your input is preserved; please retry.' });
    else response.end();
    if (!error.status) console.error(error);
  }
});
server.requestTimeout = 15000;
server.headersTimeout = 10000;
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) if (now - room.createdAt > ROOM_MS) rooms.delete(code);
  for (const [key, limit] of limits) if (now - limit.since > 60000) limits.delete(key);
}, 60000).unref();
server.listen(PORT, () => console.log(`The Bennett Quiz is ready on port ${PORT}. Open the existing preview or visit your configured host.`));
