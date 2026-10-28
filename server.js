'use strict';

const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomBytes, randomInt } = require('node:crypto');

const PORT = Number(process.env.PORT) || 3000;
const QUESTION_MS = 25000;
const ROOM_MS = 6 * 60 * 60 * 1000;
const rooms = new Map();
const limits = new Map();
const allowedOrigins = new Set((process.env.ALLOWED_ORIGINS || '').split(',').map((origin) => origin.trim()).filter(Boolean));
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const questions = [
  { kind: 'fact', category: 'Origin story', prompt: 'Every legend starts somewhere. Where is Alexander from?', answers: ['New Hampshire', 'New Mexico', 'New Jersey', 'New Zealand'], correct: 0, explanation: 'New Hampshire! The Granite State gets to claim this particular design legend.' },
  { kind: 'fact', category: 'By design', prompt: 'What does Alex do when he’s not being quiz material?', answers: ['Industrial espionage', 'Industrial design', 'Professional leaf peeping', 'Red Sox mascot consulting'], correct: 1, explanation: 'Industrial designer. Making things work better AND look better is a pretty solid superpower.' },
  { kind: 'fact', category: 'The Rochester chapter', prompt: 'Which place belongs in the Alexander Bennett origin story?', answers: ['Rivendell', 'Roswell', 'Rochester', 'Rio de Janeiro'], correct: 2, explanation: 'Rochester! We know he went to Rochester — no invented degree or school name required.' },
  { kind: 'fact', category: 'Very good company', prompt: 'Who is part of the Bennett household’s four-legged delegation?', answers: ['A miniature moose', 'An emotional-support lobster', 'A retired Fenway squirrel', 'A dog'], correct: 3, explanation: 'A dog! Breed, name, and ability to critique a prototype remain delightfully unconfirmed.' },
  { kind: 'fact', category: 'The household soundtrack', prompt: 'Who gets a spot on Alex’s wife’s playlist?', answers: ['Noah Kahan', 'A recording of a leaf blower', 'The dial-up internet sound', 'An audiobook about chair legs'], correct: 0, explanation: 'Noah Kahan. Strong New England energy in the Bennett household soundtrack.' },
  { kind: 'fact', category: 'Excellent taste', prompt: 'Which brand is a known favorite of Alex’s wife?', answers: ['NASA surplus', 'L.L.Bean', 'Formula 1 teamwear', 'Medieval armor outlet'], correct: 1, explanation: 'L.L.Bean! A love of Noah Kahan and L.L.Bean is a very respectable combination.' },
  { kind: 'fact', category: 'Home team advantage', prompt: 'It’s baseball season. Which team has Alex’s allegiance?', answers: ['New York Yankees', 'Los Angeles Dodgers', 'Boston Red Sox', 'The office softball printer team'], correct: 2, explanation: 'The Boston Red Sox. Some loyalties are bigger than a quiz.' },
  { kind: 'fun', category: 'Hypothetical · Design brain', prompt: 'Imagine Alex encounters a wobbly café table. What’s the most designer-energy response?', answers: ['Declare the floor obsolete', 'Only order perfectly balanced food', 'Write the table a performance review', 'Sketch a better table leg on a napkin'], correct: 3, explanation: 'The imaginary answer: sketch a better leg. A design problem is just a napkin sketch waiting to happen.' },
  { kind: 'fun', category: 'Hypothetical · New Hampshire mode', prompt: 'You’re making a fictional Bennett action figure. Which accessory belongs in the box?', answers: ['A tiny mountain and a sketchbook', 'A gold-plated traffic cone', 'A personal desert sandstorm', 'A submarine valet ticket'], correct: 0, explanation: 'Our made-up starter pack goes with a mountain and a sketchbook: New Hampshire meets industrial design.' },
  { kind: 'fun', category: 'Hypothetical · Dog department', prompt: 'If Alex’s dog joined the design team, what job would suit a very good dog?', answers: ['Spreadsheet password auditor', 'Chief Fetch & Feel Officer', 'Head of vacuum appreciation', 'Director of unopened treats'], correct: 1, explanation: 'Chief Fetch & Feel Officer. This fictional appointment includes unlimited positive feedback and probably a tennis ball.' },
  { kind: 'fun', category: 'Hypothetical · Date night', prompt: 'Plan an imaginary outing using BOTH of his wife’s known favorites.', answers: ['A silent disco in a hardware store', 'A Yankees game in flip-flops', 'Noah Kahan on the speakers, an L.L.Bean shopping stop', 'A seminar about printer settings'], correct: 2, explanation: 'Noah Kahan plus L.L.Bean: a playful plan built from two actual favorites, not a real date-night report.' },
  { kind: 'fun', category: 'Hypothetical · Fenway feelings', prompt: 'Which fake out-of-office reply has the most Red Sox fan energy?', answers: ['Gone to count ceiling tiles', 'Currently arguing with my stapler', 'Optimizing my desktop wallpaper', 'At Fenway. Please respect this important research.'], correct: 3, explanation: 'In our imagined universe, Fenway counts as important research. No actual out-of-office messages were inspected.' },
  { kind: 'fun', category: 'Hypothetical · Prototype problems', prompt: 'Alex gets an imaginary magic wand for work. What’s the designer’s dream spell?', answers: ['Make the first prototype work exactly as intended', 'Turn every chair into a beanbag', 'Replace all rulers with noodles', 'Add seven unnecessary charging ports'], correct: 0, explanation: 'A flawless first prototype. This is a fictional designer wish, not evidence that magic has entered the Bennett workflow.' },
  { kind: 'fun', category: 'Hypothetical · Granite State glow-up', prompt: 'Invent a ridiculous New Hampshire superhero name for Alex.', answers: ['Captain Tropical Humidity', 'The Granite State Prototyper', 'The Sultan of Sand Dunes', 'Baron Broken Hinge'], correct: 1, explanation: 'The Granite State Prototyper! Completely invented. Cape ergonomics presumably excellent.' },
  { kind: 'fun', category: 'Hypothetical · Good dog, great pitch', prompt: 'The dog pitches a fictional household product. Which concept wins?', answers: ['A silent doorbell for squirrels only', 'A leash that does tax returns', 'An ergonomically perfect treat dispenser', 'A self-walking empty leash'], correct: 2, explanation: 'The treat dispenser wins this imaginary pitch. Human-centered design meets extremely dog-centered priorities.' },
  { kind: 'fun', category: 'Hypothetical · Road trip rules', prompt: 'Build a pretend Bennett-household road trip. Which combo makes the most sense?', answers: ['Yankees radio and a pet cactus', 'A tropical island and snow tires', 'A silent car full of loose printers', 'Noah Kahan, outdoor layers, and a dog-friendly stop'], correct: 3, explanation: 'The fictional road trip pairs the known household interests with a stop for the very good dog.' },
  { kind: 'fun', category: 'Hypothetical · Design review', prompt: 'Which imaginary compliment would make an industrial designer’s day?', answers: ['“It feels as good as it looks.”', '“I love the seventeen extra screws.”', '“The instructions are longer than my thesis.”', '“Nobody knows which end is up.”'], correct: 0, explanation: '“It feels as good as it looks.” A just-for-fun nod to useful, thoughtful design — not a quote from Alex.' },
  { kind: 'fun', category: 'Hypothetical · Team merch', prompt: 'We’re inventing Bennett fan-club merch. Pick the most on-theme design.', answers: ['A sequined calculator holster', 'A mountain-and-baseball sketchbook', 'A Yankees-branded beach gong', 'A life-size foam fax machine'], correct: 1, explanation: 'Mountains, baseball, and sketching: a fictional fan-club mashup of real Bennett themes.' },
  { kind: 'fun', category: 'Hypothetical · Alternate universe', prompt: 'In a completely fictional Bennett movie, who steals every scene?', answers: ['An unlabelled USB cable', 'A very slow loading screen', 'The dog, obviously', 'A room-temperature glass of water'], correct: 2, explanation: 'The dog gets our imaginary award. That’s not a biographical fact; that’s just strong casting.' },
  { kind: 'fun', category: 'Hypothetical · The grand finale', prompt: 'Choose a fictional tagline for the Alexander Bennett cinematic universe.', answers: ['“No pets. No sketches. No baseball.”', '“Proudly designed without any design.”', '“A lifelong Yankees documentary.”', '“New Hampshire roots. Well-designed adventures.”'], correct: 3, explanation: '“New Hampshire roots. Well-designed adventures.” A made-up tagline to celebrate the real teammate.' },
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

function publicState(room, body) {
  const host = body.token === room.hostToken;
  const player = host ? null : getPlayer(room, body);
  const state = { code: room.code, role: host ? 'host' : 'player', status: room.status, total: questions.length };
  if (host) state.players = room.players.map(({ name, avatar, index }) => ({ name, avatar, done: index === questions.length }));
  if (player) {
    state.player = { name: player.name, avatar: player.avatar, index: player.index, score: player.score, correct: player.correct, done: player.index === questions.length };
    if (room.status === 'playing' && player.index < questions.length) {
      const { prompt, answers, category, kind } = questions[player.index];
      state.question = { prompt, answers: player.options[player.index].map((index) => answers[index]), category, kind, remainingMs: player.startedAt === null ? QUESTION_MS : Math.max(0, QUESTION_MS - (Date.now() - player.startedAt)) };
    }
  }
  if (room.status === 'finished') {
    const ranked = [...room.players].sort((a, b) => b.score - a.score || a.joinedAt - b.joinedAt);
    state.leaderboard = ranked.map((entry, index) => ({
      name: entry.name, avatar: entry.avatar, score: entry.score,
      rank: ranked.findIndex((other) => other.score === entry.score) + 1,
      token: entry === player ? entry.token : undefined,
    }));
  }
  return state;
}

function api(command, body) {
  if (command === 'create') {
    if (rooms.size >= 300) throw fail(503, 'All game rooms are busy. Please try again shortly.');
    let code;
    do { code = Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join(''); } while (rooms.has(code));
    const room = { code, hostToken: token(), status: 'lobby', players: [], createdAt: Date.now() };
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
    const player = { token: token(), name, avatar: body.avatar, index: 0, score: 0, correct: 0, joinedAt: Date.now(), startedAt: null, lastResult: null, options: questions.map(shuffledOptions) };
    room.players.push(player);
    return { token: player.token };
  }
  if (command === 'state') return publicState(getRoom(body), body);
  if (command === 'start') {
    const room = getHost(body);
    if (room.status !== 'lobby') throw fail(409, 'This game has already started.');
    if (!room.players.length) throw fail(409, 'Wait for at least one player to join.');
    room.status = 'playing';
    room.players.forEach((player) => { player.startedAt = Date.now(); });
    return { ok: true };
  }
  if (command === 'answer') {
    const room = getRoom(body);
    const player = getPlayer(room, body);
    if (room.status === 'finished') return { finished: true };
    if (room.status !== 'playing') throw fail(409, 'Wait for your host to start the game.');
    if (!Number.isInteger(body.index) || body.index < 0 || body.index >= questions.length) throw fail(400, 'That question is not valid.');
    if (!Number.isInteger(body.answer) || body.answer < -1 || body.answer > 3) throw fail(400, 'Choose one of the four answers.');
    if (body.index === player.index - 1 && player.lastResult) return player.lastResult;
    if (body.index !== player.index) throw fail(409, 'Your progress has changed. Reconnecting to your current question.');
    if (player.startedAt === null) throw fail(409, 'Open the next question before submitting an answer.');
    const question = questions[player.index];
    const elapsed = Date.now() - player.startedAt;
    const selected = elapsed > QUESTION_MS ? -1 : body.answer;
    const correctAnswer = player.options[player.index].indexOf(question.correct);
    const correct = selected === correctAnswer;
    const points = correct ? 600 + Math.round(400 * Math.max(0, 1 - elapsed / QUESTION_MS)) : 0;
    player.score += points;
    if (correct) player.correct++;
    player.index++;
    // The next timer starts when the player requests the next question, not during answer feedback.
    player.startedAt = null;
    player.lastResult = { correct, correctAnswer, selected, points, explanation: question.explanation, index: body.index };
    return player.lastResult;
  }
  if (command === 'finish') {
    const room = getHost(body);
    if (room.status !== 'playing') throw fail(409, 'There is no active round to finish.');
    if (!body.force && room.players.some((player) => player.index < questions.length)) throw fail(409, 'Some players are still answering. Wait for them or choose End early.');
    room.status = 'finished';
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
      // Clients explicitly acknowledge the answer reveal before starting the next timer.
      if (url.pathname === '/api/state') {
        const room = getRoom(body);
        if (body.token !== room.hostToken) {
          const player = getPlayer(room, body);
          if (room.status === 'playing' && player.index < questions.length && player.startedAt === null && body.advance === true) player.startedAt = Date.now();
        }
      }
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
