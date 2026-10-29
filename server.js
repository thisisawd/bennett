'use strict';

const http = require('node:http');
const { createReadStream } = require('node:fs');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomBytes, randomInt } = require('node:crypto');
const { questions, images, videos } = require('./questions');
const maps = require('./maps');

const PORT = Number(process.env.PORT) || 3000;
const MAX_QUESTIONS = Math.min(30, questions.length);
const ROOM_MS = 6 * 60 * 60 * 1000;
const rooms = new Map();
const limits = new Map();
const allowedOrigins = new Set((process.env.ALLOWED_ORIGINS || '').split(',').map((origin) => origin.trim()).filter(Boolean));
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const token = () => randomBytes(24).toString('hex');
const shuffled = (values) => {
  const order = [...values];
  for (let index = order.length - 1; index > 0; index--) {
    const swap = randomInt(index + 1);
    [order[index], order[swap]] = [order[swap], order[index]];
  }
  return order;
};
function mixedQuestions(count) {
  const puzzle = questions.find((question) => question.type === 'puzzle');
  const dog = questions.find((question) => question.id === 'alex-dog');
  const earlyQuestions = ['alex-childhood-windows', 'lowell-micky-ward'].map((id) => questions.find((question) => question.id === id));
  const garbagePlate = questions.find((question) => question.id === 'plate-ingredients');
  const guaranteedQuestions = [...earlyQuestions, garbagePlate];
  const selected = [...[questions[0], puzzle, dog].slice(0, Math.min(3, count - guaranteedQuestions.length)), ...guaranteedQuestions];
  const handmade = shuffled(questions.filter((question) => question.hostQuestion && !selected.includes(question)));
  while (selected.length < count && handmade.length) {
    const different = handmade.filter((question) => question.topic !== selected.at(-1).topic);
    const question = (different.length ? different : handmade)[0];
    selected.push(question);
    handmade.splice(handmade.indexOf(question), 1);
  }
  const portfolio = shuffled(questions.filter((question) => question.portfolioSite && !selected.includes(question)));
  selected.push(...portfolio.slice(0, count - selected.length));
  const photos = shuffled(questions.filter((question) => question.photoQuestion && !selected.includes(question)));
  const photoCount = Math.max(0, Math.min(count - selected.length, Math.ceil((count - 1) * .55) - selected.filter((question) => question.photoQuestion).length));
  selected.push(...photos.slice(0, photoCount));
  const takeBalanced = (candidates, target) => {
    const available = candidates.filter((question) => !selected.includes(question));
    while (selected.length < target && available.length) {
      const counts = new Map();
      selected.forEach((question) => counts.set(question.topic, (counts.get(question.topic) || 0) + 1));
      const minimum = Math.min(...available.map((question) => counts.get(question.topic) || 0));
      const topics = [...new Set(available.filter((question) => (counts.get(question.topic) || 0) === minimum).map((question) => question.topic))];
      const topic = topics[randomInt(topics.length)];
      const pool = available.filter((question) => question.topic === topic);
      const question = pool[randomInt(pool.length)];
      selected.push(question);
      available.splice(available.indexOf(question), 1);
    }
  };
  // Favor the host's uploads and portfolio; use Rochester mainly as a fallback.
  const isPortfolio = (question) => question.topic === 'design' || question.portfolioSite;
  const portfolioCount = selected.filter(isPortfolio).length;
  takeBalanced(questions.filter(isPortfolio), Math.min(count, selected.length + Math.max(0, Math.ceil(count * .35) - portfolioCount)));
  takeBalanced(questions.filter((question) => question.topic === 'personal' || question.id === 'alex-rit'), count);
  takeBalanced(shuffled(questions.filter((question) => question.topic === 'household')).slice(0, 1), Math.min(count, selected.length + 1));
  takeBalanced(shuffled(questions.filter((question) => images[question.image]?.diagram)).slice(0, 1), Math.min(count, selected.length + 1));
  takeBalanced(shuffled(questions.filter((question) => question.topic === 'rochester')).slice(0, 1), Math.min(count, selected.length + 1));
  takeBalanced(questions.filter((question) => question.topic !== 'rochester'), count);
  takeBalanced(questions, count);
  const order = selected.slice(0, Math.min(count, 3));
  const remaining = selected.slice(order.length);
  while (order.length < count) {
    const recent = order.slice(-2).map((question) => question.topic);
    const counts = new Map();
    remaining.forEach((question) => counts.set(question.topic, (counts.get(question.topic) || 0) + 1));
    const different = remaining.filter((question) => question.topic !== recent.at(-1));
    // Leave enough other topics to separate the remaining questions.
    const viable = different.filter((question) => [...counts].every(([topic, total]) => {
      const selected = topic === question.topic;
      const limit = selected ? Math.floor((remaining.length - 1) / 2) : Math.ceil((remaining.length - 1) / 2);
      return total - Number(selected) <= limit;
    }));
    const spaced = viable.filter((question) => !recent.includes(question.topic));
    const pool = spaced.length ? spaced : viable.length ? viable : different.length ? different : remaining;
    const handmadeCandidates = (viable.length ? viable : different.length ? different : remaining).filter((question) => question.hostQuestion);
    const spacedHandmade = handmadeCandidates.filter((question) => !recent.includes(question.topic));
    const handmadePool = spacedHandmade.length ? spacedHandmade : handmadeCandidates;
    const photosDue = order.slice(-4).every((question) => !question.photoQuestion);
    const photoPool = pool.filter((question) => question.photoQuestion);
    const candidates = handmadePool.length ? handmadePool : photosDue && photoPool.length ? photoPool : pool;
    const earlyRemaining = remaining.filter((question) => earlyQuestions.includes(question));
    const question = earlyRemaining.length && order.length >= 15 - earlyRemaining.length
      ? earlyRemaining[0]
      : order.length === 19 && remaining.includes(garbagePlate) ? garbagePlate : candidates[randomInt(candidates.length)];
    order.push(question);
    remaining.splice(remaining.indexOf(question), 1);
  }
  return order;
}
const fail = (status, message) => Object.assign(new Error(message), { status });
const roundDurationSeconds = (room) => room.questions[room.index].type === 'puzzle' ? 60 : room.questions[room.index].type === 'map' ? 20 : room.questions[room.index].video ? Math.max(30, room.settings.roundSeconds) : room.settings.roundSeconds;
function gameSettings(body, current = { roundSeconds: 15, questionCount: 30 }) {
  const roundSeconds = body.roundSeconds === undefined ? current.roundSeconds : body.roundSeconds;
  const questionCount = body.questionCount === undefined ? current.questionCount : body.questionCount;
  if (!Number.isInteger(roundSeconds) || roundSeconds < 5 || roundSeconds > 120) throw fail(400, 'Choose a whole number of seconds between 5 and 120.');
  if (!Number.isInteger(questionCount) || questionCount < 3 || questionCount > MAX_QUESTIONS) throw fail(400, `Choose a whole number of questions between 3 and ${MAX_QUESTIONS}.`);
  return { roundSeconds, questionCount };
}
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

function distanceKm(first, second) {
  const radians = (degrees) => degrees * Math.PI / 180;
  const lat = radians(second.lat - first.lat);
  const lng = radians(second.lng - first.lng);
  const arc = Math.sin(lat / 2) ** 2 + Math.cos(radians(first.lat)) * Math.cos(radians(second.lat)) * Math.sin(lng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(arc), Math.sqrt(Math.max(0, 1 - arc)));
}

function updateRound(room, now = Date.now()) {
  if (room.status !== 'playing') return;
  const question = room.questions[room.index];
  if (question.type === 'puzzle') {
    if (!room.puzzleWinner && now < room.deadline) return;
    if (room.puzzleWinner) {
      const winner = room.puzzleWinner;
      winner.answers[room.index] = { selected: true, completed: true, elapsed: Math.max(0, roundDurationSeconds(room) * 1000 - (room.deadline - now)), points: 1000 };
      winner.score += 1000;
      winner.correct++;
    }
    room.status = 'reveal';
    return;
  }
  if (now < room.deadline) return;
  if (question.type === 'map') {
    const map = maps[question.mapId || 'new-hampshire'];
    const answers = room.players.map((player) => player.answers[room.index]).filter(Boolean);
    answers.forEach((answer) => { answer.distanceKm = distanceKm(answer.selected, question.target); });
    const closest = Math.min(...answers.map((answer) => answer.distanceKm));
    room.players.forEach((player) => {
      const answer = player.answers[room.index];
      if (!answer) return;
      answer.closest = Math.abs(answer.distanceKm - closest) < .000001;
      answer.points = answer.closest ? 1000 : Math.min(999, Math.round(1000 * Math.exp(-(answer.distanceKm - closest) / map.distanceScaleKm)));
      player.score += answer.points;
      if (answer.closest) player.correct++;
    });
    room.status = 'reveal';
    return;
  }
  const correctAnswer = room.options[room.index].indexOf(question.correct);
  room.players.forEach((player) => {
    const answer = player.answers[room.index];
    if (answer?.selected === correctAnswer) {
      answer.points = 600 + Math.round(400 * Math.max(0, 1 - answer.elapsed / (roundDurationSeconds(room) * 1000)));
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
  const state = { code: room.code, role: host ? 'host' : 'player', status: room.status, total: room.settings.questionCount, bankSize: questions.length, maxQuestions: MAX_QUESTIONS, settings: room.settings, index: room.index };
  state.players = room.players.map((entry) => ({ name: entry.name, avatar: entry.avatar, answered: Boolean(entry.answers[room.index]) }));
  if (player) {
    state.player = { name: player.name, avatar: player.avatar, score: player.score, correct: player.correct, selected: player.answers[room.index]?.selected ?? null };
  }
  if (['playing', 'reveal', 'results'].includes(room.status)) {
    const { type = 'choice', mapId = 'new-hampshire', prompt, answers, category, explanation, source, image, video, revealImage, resultsImage, target } = room.questions[room.index];
    state.question = { type, prompt, category, roundSeconds: roundDurationSeconds(room), remainingMs: room.status === 'playing' ? Math.max(0, room.deadline - Date.now()) : 0 };
    if (type === 'map') state.question.mapId = mapId;
    if (type === 'choice') state.question.answers = room.options[room.index].map((index) => answers[index]);
    if (type === 'puzzle') {
      state.question.board = host ? room.puzzleOrder : player.puzzleBoard;
      if (player) state.question.moves = player.puzzleMoves;
    }
    if (!revealImage) state.question.image = images[image];
    if (video) state.question.video = videos[video];
    if (room.status === 'reveal' || room.status === 'results') {
      const correctAnswer = type === 'choice' ? room.options[room.index].indexOf(room.questions[room.index].correct) : null;
      state.reveal = {
        correctAnswer, explanation, source, target,
        image: revealImage ? images[image] : undefined,
      };
      if (type === 'map') {
        state.reveal.guesses = room.players.map((entry) => {
          const answer = entry.answers[room.index];
          return { name: entry.name, avatar: entry.avatar, location: answer?.selected ?? null, distanceKm: answer?.distanceKm };
        });
      }
      if (type === 'puzzle') {
        state.reveal.winner = room.puzzleWinner ? { name: room.puzzleWinner.name, avatar: room.puzzleWinner.avatar, elapsedMs: room.puzzleWinner.answers[room.index].elapsed } : null;
      }
      if (room.status === 'results') {
        if (resultsImage) state.reveal.resultsImage = images[resultsImage];
        state.reveal.players = room.players.map((entry) => {
          const answer = entry.answers[room.index];
          return { name: entry.name, avatar: entry.avatar, selected: answer?.selected ?? null, correct: type === 'map' ? Boolean(answer?.closest) : type === 'puzzle' ? Boolean(answer?.completed) : answer?.selected === correctAnswer, distanceKm: answer?.distanceKm, ...(type === 'puzzle' ? { moves: entry.puzzleMoves, elapsedMs: answer?.elapsed } : {}), points: answer?.points || 0, score: entry.score };
        });
      }
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
    const room = { code, hostToken: token(), status: 'lobby', players: [], createdAt: Date.now(), index: -1, deadline: null, settings: gameSettings(body), questions: [], options: [] };
    rooms.set(code, room);
    return { code, token: room.hostToken };
  }
  if (command === 'join') {
    const room = getRoom(body);
    if (room.status !== 'lobby') throw fail(409, 'This game has already started. Ask your host to create a new room for the next round.');
    if (room.players.length >= 100) throw fail(409, 'This room is full (100 players). Ask your host to create another game.');
    if (typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > 24 || /[\u0000-\u001f\u007f]/.test(body.name)) throw fail(400, 'Enter a name between 1 and 24 characters, without control characters.');
    if (!Number.isInteger(body.avatar) || body.avatar < 0 || body.avatar >= 26) throw fail(400, 'Choose an emoji avatar from the row or the arrow dropdown.');
    const name = body.name.trim();
    if (room.players.some((player) => player.name.toLocaleLowerCase() === name.toLocaleLowerCase())) throw fail(409, 'Someone is already using that name. Add an initial or choose a nickname.');
    const player = { token: token(), name, avatar: body.avatar, score: 0, correct: 0, joinedAt: Date.now(), answers: [] };
    room.players.push(player);
    return { token: player.token };
  }
  if (command === 'state') return publicState(getRoom(body), body);
  if (command === 'settings') {
    const room = getHost(body);
    if (room.status !== 'lobby') throw fail(409, 'Game settings are locked once the game starts.');
    room.settings = gameSettings(body, room.settings);
    return { settings: room.settings };
  }
  if (command === 'start') {
    const room = getHost(body);
    if (room.status !== 'lobby') throw fail(409, 'This game has already started.');
    if (!room.players.length) throw fail(409, 'Wait for at least one player to join.');
    room.settings = gameSettings(body, room.settings);
    room.questions = mixedQuestions(room.settings.questionCount);
    room.options = room.questions.map(() => shuffled([0, 1, 2, 3]));
    do { room.puzzleOrder = shuffled(Array.from({ length: 9 }, (_, index) => index)); } while (room.puzzleOrder.every((piece, index) => piece === index));
    room.players.forEach((player) => {
      player.puzzleBoard = [...room.puzzleOrder];
      player.puzzleMoves = 0;
      player.lastPuzzleMove = null;
    });
    room.status = 'playing';
    room.index = 0;
    room.deadline = Date.now() + roundDurationSeconds(room) * 1000;
    return { ok: true };
  }
  if (command === 'puzzle-move') {
    const room = getRoom(body);
    const player = getPlayer(room, body);
    const now = Date.now();
    updateRound(room, now);
    if (body.index !== room.index || room.questions[room.index]?.type !== 'puzzle') throw fail(409, 'Reconnect to the current puzzle round.');
    if (![body.from, body.to].every((position) => Number.isInteger(position) && position >= 0 && position < 9) || body.from === body.to || !Number.isInteger(body.moveNumber) || body.moveNumber < 1) throw fail(400, 'Choose two different puzzle pieces to swap.');
    const reply = () => ({ board: player.puzzleBoard, moves: player.puzzleMoves, status: room.status });
    if (body.moveNumber === player.puzzleMoves && player.lastPuzzleMove?.from === body.from && player.lastPuzzleMove?.to === body.to) return reply();
    if (room.status !== 'playing') throw fail(409, 'This puzzle round has ended. Reconnecting to the results.');
    if (body.moveNumber !== player.puzzleMoves + 1) throw fail(409, 'Your puzzle has changed. Reconnecting to your current board.');
    [player.puzzleBoard[body.from], player.puzzleBoard[body.to]] = [player.puzzleBoard[body.to], player.puzzleBoard[body.from]];
    player.puzzleMoves++;
    player.lastPuzzleMove = { from: body.from, to: body.to };
    if (player.puzzleBoard.every((piece, index) => piece === index)) {
      room.puzzleWinner = player;
      updateRound(room, now);
    }
    return reply();
  }
  if (command === 'answer') {
    const room = getRoom(body);
    const player = getPlayer(room, body);
    const now = Date.now();
    updateRound(room, now);
    if (!Number.isInteger(body.index) || body.index < 0 || body.index >= room.settings.questionCount) throw fail(400, 'That question is not valid.');
    if (body.index !== room.index) throw fail(409, 'The host has moved to another question. Reconnecting to the live round.');
    if (room.questions[room.index]?.type === 'puzzle') throw fail(400, 'Complete the puzzle by swapping its pieces.');
    const isMap = room.questions[room.index]?.type === 'map';
    if (isMap) {
      const { bounds } = maps[room.questions[room.index].mapId || 'new-hampshire'];
      const point = body.location;
      if (!point || !Number.isFinite(point.lat) || !Number.isFinite(point.lng) || point.lat < bounds.south || point.lat > bounds.north || point.lng < bounds.west || point.lng > bounds.east) throw fail(400, 'Place a pin within the displayed map.');
    } else if (!Number.isInteger(body.answer) || body.answer < 0 || body.answer > 3) throw fail(400, 'Choose one of the four answers.');
    if (player.answers[room.index]) return { accepted: true, selected: player.answers[room.index].selected };
    if (room.status !== 'playing') throw fail(409, 'Answers are closed. Wait for the host to start the next question.');
    const selected = isMap ? { lat: body.location.lat, lng: body.location.lng } : body.answer;
    player.answers[room.index] = { selected, elapsed: roundDurationSeconds(room) * 1000 - (room.deadline - now), points: 0 };
    return { accepted: true, selected };
  }
  if (command === 'results') {
    const room = getHost(body);
    updateRound(room);
    if (body.index !== room.index || room.status !== 'reveal') throw fail(409, 'Wait for this round to finish, or reconnect to the current question.');
    room.status = 'results';
    return { ok: true };
  }
  if (command === 'next') {
    const room = getHost(body);
    if (body.index !== room.index || room.status !== 'results') throw fail(409, 'Show the player results before starting the next question. Reconnect if the host has already moved on.');
    if (room.index === room.questions.length - 1) room.status = 'finished';
    else {
      room.index++;
      room.status = 'playing';
      room.deadline = Date.now() + roundDurationSeconds(room) * 1000;
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
  ['/nh-map.js', ['nh-map.js', 'text/javascript; charset=utf-8']],
  ['/europe-map.js', ['europe-map.js', 'text/javascript; charset=utf-8']],
  ['/maps.js', ['maps.js', 'text/javascript; charset=utf-8']],
]);
for (const image of Object.values(images)) {
  for (const src of [image.src, image.animationSrc].filter(Boolean)) {
    if (!src.startsWith('/images/')) continue;
    const type = src.endsWith('.png') ? 'image/png' : src.endsWith('.gif') ? 'image/gif' : 'image/jpeg';
    staticFiles.set(src, [path.join('images', path.basename(src)), type]);
  }
}
for (const video of Object.values(videos)) {
  if (!video.src.startsWith('/videos/')) continue;
  staticFiles.set(video.src, [path.join('videos', path.basename(video.src)), 'video/mp4']);
}
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
    if (file[1] === 'video/mp4') {
      const filename = path.join(__dirname, file[0]);
      const { size } = await fs.stat(filename);
      let start = 0;
      let end = size - 1;
      const range = request.headers.range;
      if (range) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(range);
        if (match && (match[1] || match[2])) {
          start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
          end = match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
        }
        if (!match || (!match[1] && !match[2]) || !Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= size || end < start || (!match[1] && Number(match[2]) === 0)) {
          response.writeHead(416, { 'Content-Range': `bytes */${size}`, 'Accept-Ranges': 'bytes' });
          response.end();
          return;
        }
      }
      response.writeHead(range ? 206 : 200, {
        'Content-Type': 'video/mp4', 'Accept-Ranges': 'bytes',
        'Content-Length': end - start + 1, 'Cache-Control': 'public, max-age=86400',
        ...(range ? { 'Content-Range': `bytes ${start}-${end}/${size}` } : {}),
      });
      if (request.method === 'HEAD') response.end();
      else {
        const stream = createReadStream(filename, { start, end });
        stream.on('error', () => response.destroy());
        response.on('close', () => stream.destroy());
        stream.pipe(response);
      }
      return;
    }
    const content = await fs.readFile(path.join(__dirname, file[0]));
    response.writeHead(200, { 'Content-Type': file[1], 'Cache-Control': file[1].startsWith('image/') ? 'public, max-age=86400' : 'no-cache' });
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
