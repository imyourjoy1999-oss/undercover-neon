
"use strict";

const express = require("express");
const http = require("http");
const helmet = require("helmet");
const { Server } = require("socket.io");
const crypto = require("crypto");

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.static("public", { maxAge: "1h" }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: false },
  maxHttpBufferSize: 1e4
});

const rooms = new Map();

const WORD_PAIRS = [
  ["แมว", "สุนัข"], ["กาแฟ", "ชา"], ["พิซซ่า", "เบอร์เกอร์"],
  ["มะม่วง", "ทุเรียน"], ["ข้าวผัด", "ผัดไทย"],
  ["ก๋วยเตี๋ยว", "บะหมี่"], ["ส้มตำ", "ยำ"],
  ["ไอศกรีม", "บิงซู"], ["โดนัท", "ขนมปัง"],
  ["น้ำเปล่า", "น้ำอัดลม"], ["นม", "โยเกิร์ต"],
  ["ช็อกโกแลต", "ลูกอม"], ["แพนเค้ก", "วาฟเฟิล"],
  ["ซูชิ", "ซาชิมิ"], ["หมูกระทะ", "ชาบู"],
  ["ไข่ดาว", "ไข่เจียว"], ["เฟรนช์ฟรายส์", "มันทอด"],
  ["คุกกี้", "บราวนี่"], ["สเต๊ก", "บาร์บีคิว"],
  ["ข้าวเหนียว", "ข้าวสวย"],
  ["สิงโต", "เสือ"], ["ช้าง", "แรด"],
  ["กระต่าย", "หนู"], ["เป็ด", "ห่าน"],
  ["ไก่", "ไก่งวง"], ["ม้า", "ลา"],
  ["โลมา", "ฉลาม"], ["วาฬ", "โลมา"],
  ["งู", "จระเข้"], ["ผีเสื้อ", "แมลงปอ"],
  ["นกฮูก", "นกอินทรี"], ["แพนด้า", "หมี"],
  ["กบ", "คางคก"], ["ปลาหมึก", "แมงกะพรุน"],
  ["ลิง", "กอริลลา"],
  ["โทรศัพท์", "แท็บเล็ต"], ["คอมพิวเตอร์", "โน้ตบุ๊ก"],
  ["ดินสอ", "ปากกา"], ["เตียง", "โซฟา"],
  ["พัดลม", "เครื่องปรับอากาศ"], ["ตู้เย็น", "ตู้แช่"],
  ["กระเป๋า", "เป้สะพายหลัง"], ["แว่นตา", "คอนแทคเลนส์"],
  ["นาฬิกา", "นาฬิกาปลุก"], ["ร่ม", "เสื้อกันฝน"],
  ["รองเท้า", "รองเท้าแตะ"], ["กล้องถ่ายรูป", "กล้องวิดีโอ"],
  ["รถยนต์", "รถกระบะ"], ["รถจักรยาน", "รถจักรยานยนต์"],
  ["โทรทัศน์", "โปรเจกเตอร์"],
  ["ทะเล", "สระว่ายน้ำ"], ["โรงเรียน", "มหาวิทยาลัย"],
  ["โรงพยาบาล", "คลินิก"], ["สนามบิน", "สถานีรถไฟ"],
  ["ห้างสรรพสินค้า", "ตลาด"],
  ["สวนสัตว์", "พิพิธภัณฑ์สัตว์น้ำ"],
  ["ภูเขา", "น้ำตก"], ["วัด", "โบสถ์"],
  ["โรงหนัง", "โรงละคร"], ["ร้านกาแฟ", "ร้านอาหาร"],
  ["ห้องสมุด", "ร้านหนังสือ"], ["โรงแรม", "รีสอร์ต"],
  ["ดวงจันทร์", "ดวงอาทิตย์"],
  ["ดาวอังคาร", "ดาวพฤหัสบดี"], ["ฝน", "หิมะ"],
  ["ฟ้าร้อง", "ฟ้าผ่า"], ["ภูเขาไฟ", "แผ่นดินไหว"],
  ["ทะเลทราย", "ป่าดิบชื้น"], ["แม่น้ำ", "คลอง"],
  ["สายรุ้ง", "แสงเหนือ"],
  ["หมอ", "พยาบาล"], ["ตำรวจ", "ทหาร"],
  ["เชฟ", "พ่อครัว"], ["นักร้อง", "นักดนตรี"],
  ["นักแสดง", "พิธีกร"], ["นักบิน", "แอร์โฮสเตส"],
  ["ครู", "ติวเตอร์"], ["นักฟุตบอล", "นักบาสเกตบอล"],
  ["ว่ายน้ำ", "ดำน้ำ"], ["วิ่ง", "เดิน"],
  ["ร้องเพลง", "เต้น"], ["วาดรูป", "ระบายสี"],
  ["กลางวัน", "กลางคืน"], ["ฤดูร้อน", "ฤดูหนาว"],
  ["ความรัก", "มิตรภาพ"], ["ผี", "ซอมบี้"],
  ["เจ้าชาย", "เจ้าหญิง"], ["โจร", "นักสืบ"],
  ["เงินสด", "บัตรเครดิต"], ["วันเกิด", "วันครบรอบ"],
  ["ฟุตบอล", "บาสเกตบอล"], ["รถไฟ", "รถเมล์"],
  ["เครื่องบิน", "เฮลิคอปเตอร์"],
  ["โทรศัพท์", "วิทยุสื่อสาร"]
];

const cleanName = s =>
  String(s || "").trim().replace(/[<>]/g, "").slice(0, 18);

const code = () =>
  crypto.randomInt(100000, 1000000).toString();

const publicRoom = room => ({
  code: room.code,
  phase: room.phase,
  hostId: room.hostId,
  players: [...room.players.values()].map(p => ({
    id: p.id,
    name: p.name,
    alive: p.alive,
    connected: p.connected,
    voted: room.votes.has(p.id)
  })),
  discussionDurationMinutes: room.discussionDurationMinutes,
  discussionEndsAt: room.discussionEndsAt,
  round: room.round,
  winner: room.winner
});

function sendState(room) {
  io.to(room.code).emit("state", publicRoom(room));
}

function getRoom(socket) {
  const room = rooms.get(socket.data.roomCode);
  if (!room || !room.players.has(socket.id)) return null;
  return room;
}

function clearDiscussionTimer(room) {
  if (room.discussionTimer) {
    clearTimeout(room.discussionTimer);
    room.discussionTimer = null;
  }

  room.discussionEndsAt = null;
}

function beginVoting(room) {
  if (room.phase !== "discussion") return;

  clearDiscussionTimer(room);
  room.phase = "voting";
  room.votes.clear();

  sendState(room);
}

function beginDiscussion(room) {
  clearDiscussionTimer(room);

  room.phase = "discussion";
  room.discussionEndsAt =
    Date.now() + room.discussionDurationMinutes * 60 * 1000;

  const expectedEnd = room.discussionEndsAt;

  room.discussionTimer = setTimeout(() => {
    if (
      room.phase === "discussion" &&
      room.discussionEndsAt === expectedEnd
    ) {
      beginVoting(room);
    }
  }, room.discussionDurationMinutes * 60 * 1000);

  sendState(room);
}

function assignRoles(room) {
  const players = [...room.players.values()];
  const shuffled = players.sort(() => Math.random() - 0.5);

  const undercoverCount = players.length >= 9 ? 2 : 1;
  const mrWhiteCount = players.length >= 7 ? 1 : 0;

  const pair = WORD_PAIRS[crypto.randomInt(WORD_PAIRS.length)];

  shuffled.forEach((p, i) => {
    p.role =
      i < undercoverCount
        ? "undercover"
        : i < undercoverCount + mrWhiteCount
          ? "mrwhite"
          : "civilian";

    p.word =
      p.role === "civilian"
        ? pair[0]
        : p.role === "undercover"
          ? pair[1]
          : null;

    io.to(p.id).emit("secret", {
      role: p.role,
      word: p.word
    });
  });

  room.round = 1;
  room.votes.clear();
  room.winner = null;

  beginDiscussion(room);
}

function evaluate(room) {
  const alive = [...room.players.values()].filter(p => p.alive);

  const undercover =
    alive.filter(p => p.role === "undercover").length;

  const civilians =
    alive.filter(p => p.role !== "undercover").length;

  if (undercover === 0) return "civilian";
  if (undercover >= civilians) return "undercover";

  return null;
}

function finish(room, winner) {
  clearDiscussionTimer(room);

  room.phase = "ended";
  room.winner = winner;

  sendState(room);

  io.to(room.code).emit("reveal", {
    winner,
    players: [...room.players.values()].map(p => ({
      id: p.id,
      name: p.name,
      role: p.role,
      word: p.word,
      alive: p.alive
    }))
  });
}

function tally(room) {
  const counts = new Map();

  for (const target of room.votes.values()) {
    counts.set(target, (counts.get(target) || 0) + 1);
  }

  if (counts.size === 0) {
    beginDiscussion(room);
    return;
  }

  const max = Math.max(...counts.values());

  const leaders = [...counts]
    .filter(([, n]) => n === max)
    .map(([id]) => id);

  if (leaders.length !== 1) {
    room.votes.clear();
    room.round++;

    io.to(room.code).emit("roundResult", {
      tie: true,
      message: "คะแนนเสมอ ไม่มีใครถูกคัดออก"
    });

    beginDiscussion(room);
    return;
  }

  const eliminated = room.players.get(leaders[0]);

  if (eliminated) eliminated.alive = false;

  io.to(room.code).emit("roundResult", {
    tie: false,
    eliminated: eliminated
      ? {
          id: eliminated.id,
          name: eliminated.name
        }
      : null
  });

  const winner = evaluate(room);

  if (winner) {
    finish(room, winner);
  } else {
    room.round++;
    room.votes.clear();
    beginDiscussion(room);
  }
}

io.use((socket, next) => {
  const origin = socket.handshake.headers.origin;

  if (
    origin &&
    !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) &&
    process.env.NODE_ENV !== "production"
  ) {
    return next(new Error("Origin not allowed"));
  }

  next();
});

io.on("connection", socket => {

  socket.on("createRoom", ({ name } = {}, ack = () => {}) => {
    const playerName = cleanName(name);

    if (!playerName) {
      return ack({ error: "กรุณาใส่ชื่อผู้เล่น" });
    }

    if (rooms.size > 5000) {
      return ack({
        error: "ขณะนี้มีห้องจำนวนมาก ลองใหม่อีกครั้ง"
      });
    }

    let roomCode;

    do {
      roomCode = code();
    } while (rooms.has(roomCode));

    const player = {
      id: socket.id,
      name: playerName,
      alive: true,
      connected: true
    };

    const room = {
      code: roomCode,
      hostId: socket.id,
      players: new Map([[socket.id, player]]),
      phase: "lobby",
      votes: new Map(),
      round: 0,
      winner: null,
      discussionDurationMinutes: 2,
      discussionEndsAt: null,
      discussionTimer: null
    };

    rooms.set(roomCode, room);

    socket.join(roomCode);
    socket.data.roomCode = roomCode;

    ack({ ok: true, code: roomCode });
    sendState(room);
  });

  socket.on("joinRoom", ({ code: roomCode, name } = {}, ack = () => {}) => {
    roomCode = String(roomCode || "")
      .replace(/\D/g, "")
      .slice(0, 6);

    const playerName = cleanName(name);
    const room = rooms.get(roomCode);

    if (!playerName) {
      return ack({ error: "กรุณาใส่ชื่อผู้เล่น" });
    }

    if (!room) {
      return ack({ error: "ไม่พบห้องนี้ ตรวจสอบรหัสอีกครั้ง" });
    }

    if (room.phase !== "lobby") {
      return ack({
        error: "เกมเริ่มแล้ว ไม่สามารถเข้าร่วมห้องนี้ได้"
      });
    }

    if (room.players.size >= 12) {
      return ack({ error: "ห้องเต็มแล้ว (สูงสุด 12 คน)" });
    }

    if (
      [...room.players.values()].some(
        p => p.name.toLowerCase() === playerName.toLowerCase()
      )
    ) {
      return ack({ error: "ชื่อนี้มีคนใช้แล้ว" });
    }

    room.players.set(socket.id, {
      id: socket.id,
      name: playerName,
      alive: true,
      connected: true
    });

    socket.join(roomCode);
    socket.data.roomCode = roomCode;

    ack({ ok: true, code: roomCode });
    sendState(room);
  });

  socket.on("setDiscussionDuration", (minutes, ack = () => {}) => {
    const room = getRoom(socket);

    if (!room) {
      return ack({ error: "ไม่พบห้อง" });
    }

    if (socket.id !== room.hostId) {
      return ack({
        error: "เฉพาะเจ้าของห้องตั้งเวลาได้"
      });
    }

    if (room.phase !== "lobby") {
      return ack({
        error: "เปลี่ยนเวลาได้เฉพาะก่อนเริ่มเกม"
      });
    }

    const duration = Number(minutes);

    if (![2, 5, 7, 10].includes(duration)) {
      return ack({ error: "เวลาไม่ถูกต้อง" });
    }

    room.discussionDurationMinutes = duration;

    sendState(room);
    ack({ ok: true });
  });

  socket.on("chatMessage", (raw, ack = () => {}) => {
    const room = getRoom(socket);

    if (!room) {
      return ack({ error: "คุณยังไม่ได้เข้าห้อง" });
    }

    const player = room.players.get(socket.id);
    const message = String(raw || "").trim().slice(0, 300);

    if (!message) {
      return ack({ error: "กรุณาพิมพ์ข้อความ" });
    }

    io.to(room.code).emit("chatMessage", {
      name: player.name,
      message
    });

    ack({ ok: true });
  });

  socket.on("startGame", (_data, ack = () => {}) => {
    const room = getRoom(socket);

    if (!room) {
      return ack?.({ error: "ไม่พบห้อง" });
    }

    if (socket.id !== room.hostId) {
      return ack?.({
        error: "เฉพาะเจ้าของห้องเริ่มเกมได้"
      });
    }

    if (room.phase !== "lobby" || room.players.size < 5) {
      return ack?.({
        error: "ต้องมีผู้เล่น 5–12 คน"
      });
    }

    assignRoles(room);
    ack?.({ ok: true });
  });

  socket.on("startVoting", ack => {
    const room = getRoom(socket);

    if (!room || room.phase !== "discussion") {
      return ack?.({ error: "ยังไม่อยู่ในช่วงพูดคุย" });
    }

    if (socket.id !== room.hostId) {
      return ack?.({
        error: "เฉพาะเจ้าของห้องเริ่มโหวตได้"
      });
    }

    beginVoting(room);
    ack?.({ ok: true });
  });

  socket.on("vote", ({ targetId } = {}, ack = () => {}) => {
    const room = getRoom(socket);
    const voter = room?.players.get(socket.id);
    const target = room?.players.get(targetId);

    if (!room || room.phase !== "voting") {
      return ack({ error: "ยังไม่อยู่ในช่วงโหวต" });
    }

    if (
      !voter?.alive ||
      !target?.alive ||
      target.id === voter.id
    ) {
      return ack({
        error: "ไม่สามารถโหวตผู้เล่นนี้ได้"
      });
    }

    if (room.votes.has(socket.id)) {
      return ack({ error: "คุณโหวตไปแล้ว" });
    }

    room.votes.set(socket.id, targetId);

    ack({ ok: true });
    sendState(room);

    const living = [...room.players.values()]
      .filter(p => p.alive);

    if (living.every(p => room.votes.has(p.id))) {
      tally(room);
    }
  });

  socket.on("playAgain", ack => {
    const room = getRoom(socket);

    if (
      !room ||
      socket.id !== room.hostId ||
      room.phase !== "ended"
    ) {
      return ack?.({
        error: "ไม่สามารถเริ่มเกมใหม่ได้"
      });
    }

    clearDiscussionTimer(room);

    for (const p of room.players.values()) {
      p.alive = true;
      delete p.role;
      delete p.word;
    }

    room.phase = "lobby";
    room.votes.clear();
    room.winner = null;
    room.round = 0;

    io.to(room.code).emit("reset");
    sendState(room);

    ack?.({ ok: true });
  });

  socket.on("disconnect", () => {
    const room = rooms.get(socket.data.roomCode);

    if (!room) return;

    const player = room.players.get(socket.id);

    if (player) player.connected = false;

    sendState(room);

    if ([...room.players.values()].every(p => !p.connected)) {
      clearDiscussionTimer(room);
      rooms.delete(room.code);
    }
  });

});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`UNDERCOVER Neon running on port ${PORT}`);
});
