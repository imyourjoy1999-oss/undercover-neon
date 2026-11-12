const socket = io();
const $ = id => document.getElementById(id);
let myRoom = null, isHost = false, mySecret = null, latestState = null, hasVoted = false;
function notice(msg="") { $("notice").textContent = msg; }
function ackAction(event, data) {
  socket.emit(event, data, result => {
    if (result?.error) notice(result.error);
    else if (result?.ok) notice("");
  });
}
$("createBtn").onclick = () => ackAction("createRoom", { name: $("createName").value });
$("joinBtn").onclick = () => ackAction("joinRoom", { name: $("joinName").value, code: $("roomCodeInput").value });
$("copyCode").onclick = async () => {
  try { await navigator.clipboard.writeText(myRoom); notice("คัดลอกรหัสห้องแล้ว"); }
  catch { notice("รหัสห้อง: " + myRoom); }
};
$("voteStart").onclick = () => ackAction("startVoting");
$("againBtn").onclick = () => ackAction("playAgain");
$("chatForm").addEventListener("submit", event => {
  event.preventDefault();
  const input = $("chatInput");
  const message = input.value.trim();
  if (!message) return;

  socket.emit("chatMessage", message, result => {
    if (result?.error) notice(result.error);
    else input.value = "";
  });
});

socket.on("chatMessage", data => {
  const box = $("chatMessages");
  const empty = box.querySelector(".muted");
  if (empty) empty.remove();

  const item = document.createElement("p");
  const name = document.createElement("strong");
  name.textContent = data.name + ": ";
  item.append(name, document.createTextNode(data.message));
  box.appendChild(item);
  box.scrollTop = box.scrollHeight;
});
socket.on("connect_error", () => notice("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองรีเฟรชหน้าเว็บ"));
socket.on("secret", secret => {
  mySecret = secret;
  $("secretCard").classList.remove("hidden");
 $("roleName").textContent = "คำลับของคุณ";
$("secretWord").textContent = secret.word || "คุณไม่มีคำศัพท์";
$("roleHint").textContent = "จำคำของคุณไว้ และอย่าให้คนอื่นเห็นหน้าจอ";
});
socket.on("state", state => {
  latestState = state; myRoom = state.code; isHost = state.hostId === socket.id;
  $("home").classList.add("hidden"); $("roomView").classList.remove("hidden");
  $("roomCode").textContent = state.code; $("playerCount").textContent = `${state.players.length}/12`;
  $("phaseLabel").textContent = state.phase.toUpperCase();
  $("roundNo").textContent = state.round || 1;
  $("players").innerHTML = state.players.map(p =>
    `<div class="player ${p.alive ? "" : "dead"}"><span>${escapeHtml(p.name)}${p.id===state.hostId?" ★":""}</span><em>${p.alive?"● อยู่ในเกม":"ออกแล้ว"}</em></div>`
  ).join("");
  const start = document.getElementById("startGame");
  if (start) start.remove();
  if (state.phase === "lobby") {
    $("discussion").classList.add("hidden"); $("voting").classList.add("hidden"); $("secretCard").classList.add("hidden");
    if (isHost && state.players.length >= 5) {
      const b = document.createElement("button"); b.id="startGame"; b.className="primary"; b.textContent="เริ่มเกม";
      b.onclick=()=>ackAction("startGame"); $("roomView").insertBefore(b,$("notice"));
    }
    $("phaseLabel").textContent = "WAITING ROOM";
  } else if (state.phase === "discussion") {
    $("discussion").classList.remove("hidden"); $("voting").classList.add("hidden");
    $("voteStart").classList.toggle("hidden", !isHost);
    $("secretCard").classList.toggle("hidden", !mySecret);
  } else if (state.phase === "voting") {
    $("discussion").classList.add("hidden"); $("voting").classList.remove("hidden");
    $("voteTargets").innerHTML = state.players.filter(p=>p.alive && p.id!==socket.id).map(p=>
      `<button data-id="${p.id}" ${hasVoted || state.players.find(x=>x.id===socket.id)?.alive===false ? "disabled":""}>${escapeHtml(p.name)}</button>`
    ).join("");
    $("voteTargets").querySelectorAll("button").forEach(b=>b.onclick=()=>{
      socket.emit("vote",{targetId:b.dataset.id},r=>{if(r?.error)notice(r.error);else{hasVoted=true;$("voteStatus").textContent="ส่งคะแนนแล้ว รอผู้เล่นคนอื่น...";}});
    });
    $("voteStatus").textContent = hasVoted ? "ส่งคะแนนแล้ว รอผู้เล่นคนอื่น..." : "เลือกผู้เล่นหนึ่งคน";
  } else if (state.phase === "ended") {
    $("discussion").classList.add("hidden"); $("voting").classList.add("hidden");
    $("againBtn").classList.toggle("hidden", !isHost);
  }
});
socket.on("roundResult", result => {
  hasVoted=false;
  $("result").classList.remove("hidden");
  $("result").innerHTML = result.tie ? "<h2>คะแนนเสมอ!</h2><p>เริ่มรอบใหม่ ไม่มีใครถูกคัดออก</p>" :
    `<h2>ถูกคัดออก: ${escapeHtml(result.eliminated?.name || "ผู้เล่น")}</h2><p>เตรียมเข้าสู่รอบถัดไป</p>`;
});
socket.on("reveal", players => {
  const winner = latestState?.winner;
  $("result").classList.remove("hidden");
  $("result").innerHTML = `<h2>${winner==="civilian"?"CIVILIANS WIN!":"UNDERCOVER WINS!"}</h2><p>${winner==="civilian"?"ฝ่ายพลเมืองจับ Undercover ได้ทั้งหมด":"Undercover มีจำนวนเท่ากับหรือมากกว่าฝ่ายอื่น"}</p>`;
  $("reveal").classList.remove("hidden");
  $("revealList").innerHTML = players.map(p=>`<div class="reveal-row"><span>${escapeHtml(p.name)} ${p.alive?"":"(ถูกคัดออก)"}</span><b>${p.role==="mrwhite"?"MR. WHITE":p.role.toUpperCase()} · ${escapeHtml(p.word||"—")}</b></div>`).join("");
});
socket.on("reset",()=>{mySecret=null;hasVoted=false;$("secretCard").classList.add("hidden");$("reveal").classList.add("hidden");$("result").classList.add("hidden");});
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
