
"use strict";

const socket = io();

const $ = id => document.getElementById(id);

let myRoom = null;
let isHost = false;
let mySecret = null;
let latestState = null;
let hasVoted = false;
let timerInterval = null;
let lastResult = null;


function showScreen(screenId) {
  document.querySelectorAll(".screen").forEach(screen => {
    const isActive = screen.id === screenId;

    screen.classList.toggle("active", isActive);
    screen.classList.toggle("hidden", !isActive);
  });
}


function notice(message = "", elementId = "homeError") {
  const el = $(elementId);
  if (el) el.textContent = message;
}

function toast(message) {
  const el = $("toast");
  if (!el) return;

  el.textContent = message;
  el.classList.add("show");

  setTimeout(() => el.classList.remove("show"), 2500);
}

function ackAction(event, data, onSuccess) {
  socket.emit(event, data, result => {
    if (result?.error) {
      toast(result.error);
      return;
    }

    if (result?.ok && onSuccess) onSuccess(result);
  });
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function renderPlayers(containerId, players, options = {}) {
  const container = $(containerId);
  if (!container) return;

  container.innerHTML = "";

  players.forEach(player => {
    const item = document.createElement("div");
    item.className = "player-item";

    if (!player.alive) item.classList.add("player-dead");

    const name = document.createElement("span");
    name.className = "player-name";
    name.textContent = player.name;

    const status = document.createElement("span");
    status.className = "player-status";

    if (!player.connected) {
      status.textContent = "ออฟไลน์";
    } else if (!player.alive) {
      status.textContent = "ถูกคัดออก";
    } else if (player.id === latestState?.hostId) {
      status.textContent = "HOST";
    }

    item.append(name, status);

    if (options.voting) {
      const me = players.find(p => p.id === socket.id);

      const button = document.createElement("button");
      button.className = "btn btn-small";
      button.textContent = "โหวต";

      button.disabled =
        !player.alive ||
        player.id === socket.id ||
        hasVoted ||
        !me?.alive;

      button.addEventListener("click", () => {
        if (hasVoted) return;

        button.disabled = true;

        ackAction("vote", { targetId: player.id }, () => {
          hasVoted = true;
          updateVoteButtons();
          if ($("voteStatus")) {
            $("voteStatus").textContent = "คุณส่งคะแนนโหวตแล้ว";
          }
        });
      });

      item.appendChild(button);
    }

    container.appendChild(item);
  });
}

function updateVoteButtons() {
  document.querySelectorAll("#votingPlayers button").forEach(button => {
    button.disabled = true;
  });
}

function updateDurationSettings(state) {
  const settings = $("durationSettings");
  const select = $("discussionDuration");
  const hint = $("durationHint");

  if (!settings || !select) return;

  const host = state.hostId === socket.id;
  const inLobby = state.phase === "lobby";

  settings.classList.toggle("hidden", !inLobby);
  select.disabled = !host || !inLobby;

  select.value = String(
    state.discussionDurationMinutes || 2
  );

  if (hint) {
    hint.textContent = host
      ? "คุณเป็นเจ้าของห้อง สามารถเลือกเวลาพูดคุยได้"
      : "เจ้าของห้องเป็นผู้เลือกเวลาพูดคุย";
  }
}

function formatTime(milliseconds) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(seconds / 60);
  const remainSeconds = seconds % 60;

  return (
    String(minutes).padStart(2, "0") +
    ":" +
    String(remainSeconds).padStart(2, "0")
  );
}

function updateDiscussionTimer() {
  const timer = $("discussionTimer");
  if (!timer || !latestState) return;

  if (
    latestState.phase !== "discussion" ||
    !latestState.discussionEndsAt
  ) {
    timer.textContent = "--:--";
    timer.classList.remove("timer-ending");
    return;
  }

  const remaining = latestState.discussionEndsAt - Date.now();

  timer.textContent = formatTime(remaining);
  timer.classList.toggle("timer-ending", remaining <= 10000);
}

function startTimer() {
  if (timerInterval) clearInterval(timerInterval);

  updateDiscussionTimer();

  timerInterval = setInterval(() => {
    updateDiscussionTimer();
  }, 250);
}

function renderState(state) {
  latestState = state;

  const players = state.players || [];
  const me = players.find(player => player.id === socket.id);

  isHost = state.hostId === socket.id;

  if ($("roomCodeDisplay")) {
    $("roomCodeDisplay").textContent = state.code;
  }

  if ($("playerCount")) {
    $("playerCount").textContent = `${players.length}/12`;
  }

  renderPlayers("lobbyPlayers", players);

  updateDurationSettings(state);

  if (state.phase === "lobby") {
    showScreen("lobbyScreen");

    $("chatPanel")?.classList.remove("hidden");

    $("startGame").disabled =
      !isHost || players.length < 5;

    if ($("startGame")) {
      $("startGame").textContent = isHost
        ? "เริ่มเกม"
        : "รอเจ้าของห้องเริ่มเกม";
    }

    return;
  }

  if (state.phase === "discussion" || state.phase === "voting") {
    showScreen("gameScreen");
    $("chatPanel")?.classList.remove("hidden");

    if ($("roundNo")) {
      $("roundNo").textContent = `ROUND ${state.round}`;
    }

    if ($("phaseLabel")) {
      $("phaseLabel").textContent =
        state.phase === "discussion"
          ? "DISCUSSION"
          : "VOTING";
    }

    $("discussionSection")?.classList.toggle(
      "hidden",
      state.phase !== "discussion"
    );

    $("votingSection")?.classList.toggle(
      "hidden",
      state.phase !== "voting"
    );

    $("resultSection")?.classList.add("hidden");
    $("revealSection")?.classList.add("hidden");

    if ($("secretCard")) {
      $("secretCard").classList.toggle(
        "hidden",
        !mySecret
      );
    }

    if ($("voteStart")) {
      $("voteStart").classList.toggle("hidden", !isHost);
    }

    if (state.phase === "discussion") {
      hasVoted = false;
      startTimer();
    } else {
      if (timerInterval) clearInterval(timerInterval);

      if ($("discussionTimer")) {
        $("discussionTimer").textContent = "--:--";
      }

      hasVoted = Boolean(me?.voted);

      if ($("voteStatus")) {
        $("voteStatus").textContent = hasVoted
          ? "คุณส่งคะแนนโหวตแล้ว"
          : "กรุณาเลือกผู้เล่นที่ต้องการโหวต";
      }

      renderPlayers("votingPlayers", players, {
        voting: true
      });
    }

    return;
  }

  if (state.phase === "ended") {
    if (timerInterval) clearInterval(timerInterval);

    showScreen("gameScreen");
    $("chatPanel")?.classList.remove("hidden");

    $("discussionSection")?.classList.add("hidden");
    $("votingSection")?.classList.add("hidden");
    $("resultSection")?.classList.add("hidden");

    return;
  }
}

// CREATE ROOM
$("createRoom")?.addEventListener("click", () => {
  const name = $("playerName").value.trim();

  if (!name) {
    notice("กรุณาใส่ชื่อผู้เล่น");
    return;
  }

  notice("");

  ackAction("createRoom", { name }, result => {
    myRoom = result.code;
    hasVoted = false;
    mySecret = null;
    $("chatMessages").innerHTML = "";
  });
});

// JOIN ROOM
$("joinRoom")?.addEventListener("click", () => {
  const name = $("playerName").value.trim();
  const code = $("roomCode").value.trim();

  if (!name) {
    notice("กรุณาใส่ชื่อผู้เล่น");
    return;
  }

  if (!/^\d{6}$/.test(code)) {
    notice("กรุณากรอกรหัสห้อง 6 หลัก");
    return;
  }

  notice("");

  ackAction("joinRoom", { name, code }, result => {
    myRoom = result.code;
    hasVoted = false;
    mySecret = null;
    $("chatMessages").innerHTML = "";
  });
});

// COPY ROOM CODE
$("copyRoomCode")?.addEventListener("click", async () => {
  const code = $("roomCodeDisplay").textContent;

  try {
    await navigator.clipboard.writeText(code);
    toast("คัดลอกรหัสห้องแล้ว");
  } catch {
    toast("ไม่สามารถคัดลอกรหัสได้");
  }
});

// SET DISCUSSION DURATION
$("discussionDuration")?.addEventListener("change", event => {
  const minutes = Number(event.target.value);

  ackAction("setDiscussionDuration", minutes, () => {
    toast(`ตั้งเวลาพูดคุย ${minutes} นาทีแล้ว`);
  });
});

// START GAME
$("startGame")?.addEventListener("click", () => {
  ackAction("startGame", {}, () => {
    toast("เริ่มเกมแล้ว!");
  });
});

// START VOTING
$("voteStart")?.addEventListener("click", () => {
  if (!isHost) return;

  ackAction("startVoting", {}, () => {
    toast("เข้าสู่ช่วงโหวตแล้ว");
  });
});

// PLAY AGAIN
$("playAgain")?.addEventListener("click", () => {
  ackAction("playAgain", {}, () => {
    mySecret = null;
    hasVoted = false;
    lastResult = null;
    $("chatMessages").innerHTML = "";
    toast("เริ่มเกมใหม่แล้ว");
  });
});

// SECRET WORD
socket.on("secret", data => {
  mySecret = data;

  if ($("secretWord")) {
    $("secretWord").textContent = data.word || "???";
  }

  if ($("secretHint")) {
    $("secretHint").textContent =
      "จำคำของคุณไว้ให้ดี อย่าให้คนอื่นเห็น!";
  }

  $("secretCard")?.classList.remove("hidden");
});

// ROOM STATE
socket.on("state", state => {
  renderState(state);
});

// CHAT
$("chatForm")?.addEventListener("submit", event => {
  event.preventDefault();

  const input = $("chatInput");
  const message = input.value.trim();

  if (!message) return;

  socket.emit("chatMessage", message, result => {
    if (result?.error) {
      toast(result.error);
    } else {
      input.value = "";
    }
  });
});

socket.on("chatMessage", data => {
  const container = $("chatMessages");
  if (!container) return;

  const message = document.createElement("div");
  message.className = "chat-message";

  const name = document.createElement("strong");
  name.textContent = data.name + ": ";

  const text = document.createElement("span");
  text.textContent = data.message;

  message.append(name, text);
  container.appendChild(message);

  container.scrollTop = container.scrollHeight;
});

// ROUND RESULT
socket.on("roundResult", result => {
  lastResult = result;

  $("resultSection")?.classList.remove("hidden");

  if (result.tie) {
    $("resultTitle").textContent = "คะแนนเสมอ!";
    $("resultText").textContent =
      result.message || "ไม่มีใครถูกคัดออก";
  } else {
    $("resultTitle").textContent = "มีผู้เล่นถูกคัดออก!";
    $("resultText").textContent =
      result.eliminated
        ? `${result.eliminated.name} ถูกคัดออกจากเกม`
        : "ไม่มีผู้เล่นถูกคัดออก";
  }

  toast(result.tie ? "คะแนนเสมอ!" : "จบรอบการโหวต");
});

// GAME REVEAL
socket.on("reveal", data => {
  if (timerInterval) clearInterval(timerInterval);

  showScreen("gameScreen");

  $("discussionSection")?.classList.add("hidden");
  $("votingSection")?.classList.add("hidden");
  $("resultSection")?.classList.add("hidden");
  $("revealSection")?.classList.remove("hidden");

  $("chatPanel")?.classList.remove("hidden");

  const winner = data.winner;

  $("winnerText").textContent =
    winner === "civilian"
      ? "ฝ่ายพลเมืองชนะ!"
      : "ฝ่าย Undercover ชนะ!";

  const container = $("revealPlayers");
  container.innerHTML = "";

  (data.players || []).forEach(player => {
    const item = document.createElement("div");
    item.className = "player-item";

    const name = document.createElement("span");
    name.textContent = player.name;

    const role = document.createElement("span");
    role.className = "player-status";

    const roleNames = {
      civilian: "พลเมือง",
      undercover: "Undercover",
      mrwhite: "Mr. White"
    };

    role.textContent =
      `${roleNames[player.role] || player.role}` +
      (player.word ? ` — ${player.word}` : "");

    item.append(name, role);
    container.appendChild(item);
  });
});

// RESET
socket.on("reset", () => {
  mySecret = null;
  hasVoted = false;
  lastResult = null;

  $("secretCard")?.classList.add("hidden");
  $("resultSection")?.classList.add("hidden");
  $("revealSection")?.classList.add("hidden");

  if ($("chatMessages")) {
    $("chatMessages").innerHTML = "";
  }

  toast("กลับสู่ห้องรอผู้เล่นแล้ว");
});

// CONNECTION ERRORS
socket.on("connect_error", () => {
  toast("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กำลังลองใหม่...");
});

socket.on("disconnect", () => {
  toast("การเชื่อมต่อขาดหาย กำลังเชื่อมต่อใหม่...");
});
