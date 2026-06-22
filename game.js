const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const playerScoreEl = document.getElementById("playerScore");
const aiScoreEl = document.getElementById("aiScore");
const playerTeamLabel = document.getElementById("playerTeamLabel");
const aiTeamLabel = document.getElementById("aiTeamLabel");
const roundLabel = document.getElementById("roundLabel");
const roleLabel = document.getElementById("roleLabel");
const toast = document.getElementById("toast");
const powerInput = document.getElementById("power");
const powerValue = document.getElementById("powerValue");
const primaryAction = document.getElementById("primaryAction");
const resetGame = document.getElementById("resetGame");
const playerShotsEl = document.getElementById("playerShots");
const aiShotsEl = document.getElementById("aiShots");
const homeScreen = document.getElementById("homeScreen");
const difficultyButtons = document.querySelectorAll("[data-difficulty]");
const teamButtons = document.querySelectorAll("[data-team]");
const startGameButton = document.getElementById("startGame");
const bracketScreen = document.getElementById("bracketScreen");
const bracketTitle = document.getElementById("bracketTitle");
const bracketGrid = document.getElementById("bracketGrid");
const continueTournamentButton = document.getElementById("continueTournament");
const restartTournamentButton = document.getElementById("restartTournament");

const W = 960;
const H = 540;
const GOAL = { x: 232, y: 56, w: 496, h: 248 };
const BALL_START = { x: 480, y: 486 };
const KEEPER_HOME = { x: GOAL.x + GOAL.w / 2, y: GOAL.y + GOAL.h - 52 };
const MAX_ROUNDS = 5;
const AI_SHOT_DELAY = 5000;

const ZONES = [
  { x: GOAL.x + GOAL.w * 0.18, y: GOAL.y + GOAL.h * 0.23 },
  { x: GOAL.x + GOAL.w * 0.5, y: GOAL.y + GOAL.h * 0.2 },
  { x: GOAL.x + GOAL.w * 0.82, y: GOAL.y + GOAL.h * 0.23 },
  { x: GOAL.x + GOAL.w * 0.2, y: GOAL.y + GOAL.h * 0.62 },
  { x: GOAL.x + GOAL.w * 0.5, y: GOAL.y + GOAL.h * 0.6 },
  { x: GOAL.x + GOAL.w * 0.8, y: GOAL.y + GOAL.h * 0.62 },
];

const DIFFICULTIES = {
  easy: {
    label: "Facile",
    keeperSaveZoneX: 46,
    keeperSaveZoneY: 52,
    hintLockBeforeShot: 2000,
    aiLineSpeed: 1500,
  },
  normal: {
    label: "Moyen",
    keeperSaveZoneX: 66,
    keeperSaveZoneY: 70,
    hintLockBeforeShot: 1000,
    aiLineSpeed: 1100,
  },
  hard: {
    label: "Difficile",
    keeperSaveZoneX: 96,
    keeperSaveZoneY: 96,
    hintLockBeforeShot: 500,
    aiLineSpeed: 760,
  },
};

const TEAMS = {
  real: { label: "Real Madrid", short: "Real", primary: "#f7f4dd", secondary: "#c6a24b" },
  barca: { label: "Barça", short: "Barça", primary: "#a50044", secondary: "#004d98" },
  psg: { label: "PSG", short: "PSG", primary: "#004170", secondary: "#da291c" },
  arsenal: { label: "Arsenal", short: "Arsenal", primary: "#ef0107", secondary: "#f7faf7" },
  city: { label: "Manchester City", short: "Man City", primary: "#6cabdd", secondary: "#1c2c5b" },
  liverpool: { label: "Liverpool", short: "Liverpool", primary: "#c8102e", secondary: "#00b2a9" },
  inter: { label: "Inter Milan", short: "Inter", primary: "#010e80", secondary: "#050505" },
  bayern: { label: "Bayern Munich", short: "Bayern", primary: "#dc052d", secondary: "#f7faf7" },
};

const TEAM_ORDER = ["real", "barca", "psg", "arsenal", "city", "liverpool", "inter", "bayern"];
const ROUND_NAMES = ["Quarts de finale", "Demi-finales", "Finale"];

let state;
let tournament = null;
let selectedDifficulty = "normal";
let selectedTeam = "real";
let lastFrameTime = performance.now();
const pressedKeys = new Set();

function freshState() {
  return {
    round: 1,
    role: "shooter",
    phase: "aim",
    playerScore: 0,
    aiScore: 0,
    playerShots: [],
    aiShots: [],
    aim: { x: GOAL.x + GOAL.w * 0.73, y: GOAL.y + GOAL.h * 0.34 },
    keeperAim: { ...KEEPER_HOME },
    keeper: {
      x: KEEPER_HOME.x,
      direction: 0,
      height: "mid",
      hasDived: false,
      diveStart: null,
      diveTarget: null,
      diveStartedAt: 0,
    },
    aiPlan: null,
    message: "Vise dans le but",
    shot: null,
    flash: null,
  };
}

function difficulty() {
  return DIFFICULTIES[selectedDifficulty];
}

function team() {
  return TEAMS[selectedTeam];
}

function currentOpponentKey() {
  return tournament?.currentOpponent || null;
}

function currentOpponent() {
  const key = currentOpponentKey();
  return key ? TEAMS[key] : null;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function createTournament() {
  const opponents = shuffle(TEAM_ORDER.filter((key) => key !== selectedTeam));
  const quarterMatches = [
    [selectedTeam, opponents[0]],
    [opponents[1], opponents[2]],
    [opponents[3], opponents[4]],
    [opponents[5], opponents[6]],
  ];

  return {
    roundIndex: 0,
    playerMatchIndex: 0,
    currentOpponent: opponents[0],
    eliminated: false,
    champion: null,
    matches: [
      quarterMatches,
      [[null, null], [null, null]],
      [[null, null]],
    ],
    winners: [
      [null, null, null, null],
      [null, null],
      [null],
    ],
    lastResult: "",
  };
}

function simulateMatch(teamA, teamB) {
  if (!teamA) return teamB;
  if (!teamB) return teamA;
  const rating = {
    real: 58,
    barca: 56,
    psg: 55,
    arsenal: 54,
    city: 59,
    liverpool: 56,
    inter: 54,
    bayern: 57,
  };
  const total = rating[teamA] + rating[teamB];
  return Math.random() * total < rating[teamA] ? teamA : teamB;
}

function fillRoundAfterPlayerMatch(playerWinner) {
  const round = tournament.roundIndex;
  const playerMatch = tournament.playerMatchIndex;
  tournament.winners[round][playerMatch] = playerWinner;

  tournament.matches[round].forEach((match, index) => {
    if (!tournament.winners[round][index]) {
      tournament.winners[round][index] = simulateMatch(match[0], match[1]);
    }
  });

  if (round < 2) {
    const nextMatches = [];
    for (let i = 0; i < tournament.winners[round].length; i += 2) {
      nextMatches.push([tournament.winners[round][i], tournament.winners[round][i + 1]]);
    }
    tournament.matches[round + 1] = nextMatches;
  } else {
    tournament.champion = playerWinner;
  }
}

function finishTournamentMatch() {
  const playerWon = state.playerScore > state.aiScore;
  const winner = playerWon ? selectedTeam : currentOpponentKey();

  fillRoundAfterPlayerMatch(winner);
  tournament.eliminated = !playerWon;
  tournament.lastResult = playerWon ? "Victoire" : "Élimination";

  if (playerWon && tournament.roundIndex === 2) {
    tournament.champion = selectedTeam;
  }

  state.phase = "bracket";
  state.role = "done";
  state.message = playerWon ? "Tu avances" : "Tu es éliminé";
  primaryAction.textContent = "Bracket";
  showBracket();
  updateHud();
}

function teamName(key) {
  return key ? TEAMS[key].short : "À venir";
}

function renderBracketTeam(key, winnerKey) {
  const classNames = ["bracket-team"];
  if (!key) classNames.push("empty");
  if (key && key === winnerKey) classNames.push("winner");
  if (key === selectedTeam) classNames.push("player");
  const status = key && key === winnerKey ? "<small>Gagnant</small>" : "";
  return `<div class="${classNames.join(" ")}"><span>${teamName(key)}</span>${status}</div>`;
}

function renderBracketRound(roundIndex) {
  const matches = tournament.matches[roundIndex];
  const winners = tournament.winners[roundIndex];
  const rows = matches.map((match, index) => {
    const winner = winners[index];
    return `
      <div class="bracket-match">
        ${renderBracketTeam(match[0], winner)}
        ${renderBracketTeam(match[1], winner)}
      </div>
    `;
  }).join("");

  return `
    <div class="bracket-round">
      <h3>${ROUND_NAMES[roundIndex]}</h3>
      ${rows}
    </div>
  `;
}

function showBracket() {
  if (!tournament) return;

  const championText = tournament.champion
    ? `Champion: ${teamName(tournament.champion)}`
    : tournament.eliminated
      ? `${teamName(selectedTeam)} éliminé`
      : `${ROUND_NAMES[tournament.roundIndex]} terminé`;

  bracketTitle.textContent = championText;
  bracketGrid.innerHTML = [0, 1, 2].map(renderBracketRound).join("");
  continueTournamentButton.textContent = tournament.champion || tournament.eliminated ? "Nouveau tournoi" : "Prochain match";
  bracketScreen.classList.remove("hidden");
}

function advanceTournament() {
  if (!tournament || tournament.eliminated || tournament.champion) {
    reset(true);
    return;
  }

  tournament.roundIndex += 1;
  const roundMatches = tournament.matches[tournament.roundIndex];
  tournament.playerMatchIndex = roundMatches.findIndex((match) => match.includes(selectedTeam));
  tournament.currentOpponent = roundMatches[tournament.playerMatchIndex].find((key) => key !== selectedTeam);
  bracketScreen.classList.add("hidden");
  reset(false);
}

function randomZone() {
  const zone = ZONES[Math.floor(Math.random() * ZONES.length)];
  return {
    x: zone.x + randomBetween(-34, 34),
    y: zone.y + randomBetween(-24, 24),
  };
}

function pointFromEvent(event) {
  const rect = canvas.getBoundingClientRect();
  const clientX = event.touches ? event.touches[0].clientX : event.clientX;
  const clientY = event.touches ? event.touches[0].clientY : event.clientY;
  return {
    x: ((clientX - rect.left) / rect.width) * W,
    y: ((clientY - rect.top) / rect.height) * H,
  };
}

function insideGoal(point) {
  return (
    point.x >= GOAL.x &&
    point.x <= GOAL.x + GOAL.w &&
    point.y >= GOAL.y &&
    point.y <= GOAL.y + GOAL.h
  );
}

function playableGoalPoint(point) {
  return {
    x: clamp(point.x, GOAL.x + 18, GOAL.x + GOAL.w - 18),
    y: clamp(point.y, GOAL.y + 18, GOAL.y + GOAL.h - 16),
  };
}

function getPower() {
  return Number(powerInput.value) / 100;
}

function keeperLinePoint() {
  return { x: state.keeper.x, y: KEEPER_HOME.y };
}

function aiKeeperLinePoint(now = performance.now()) {
  const span = GOAL.w * 0.34;
  const x = KEEPER_HOME.x + Math.sin(now / difficulty().aiLineSpeed) * span;
  return { x: clamp(x, GOAL.x + 50, GOAL.x + GOAL.w - 50), y: KEEPER_HOME.y };
}

function keeperDiveTarget() {
  const direction = state.keeper.direction || 0;
  const diveY = state.keeper.height === "high"
    ? GOAL.y + 82
    : state.keeper.height === "low"
      ? GOAL.y + GOAL.h - 26
      : GOAL.y + GOAL.h * 0.56;

  return {
    x: clamp(state.keeper.x + direction * 118, GOAL.x + 34, GOAL.x + GOAL.w - 34),
    y: diveY,
  };
}

function movePlayerKeeper(delta) {
  if (state.phase !== "keeperReady" || state.role !== "keeper") return;
  if (state.keeper.hasDived) return;

  let direction = 0;
  if (pressedKeys.has("ArrowLeft")) direction -= 1;
  if (pressedKeys.has("ArrowRight")) direction += 1;

  if (pressedKeys.has("ArrowUp")) {
    state.keeper.height = "high";
  } else if (pressedKeys.has("ArrowDown")) {
    state.keeper.height = "low";
  } else {
    state.keeper.height = "mid";
  }

  if (direction !== 0) {
    state.keeper.direction = direction;
    state.keeper.x = clamp(
      state.keeper.x + direction * delta * 0.42,
      GOAL.x + 46,
      GOAL.x + GOAL.w - 46,
    );
  }

  state.keeperAim = keeperDiveTarget();
}

function playerKeeperDive() {
  if (state.phase !== "keeperReady" || state.role !== "keeper" || state.keeper.hasDived) return;

  state.keeper.hasDived = true;
  state.keeper.diveStart = keeperLinePoint();
  state.keeper.diveTarget = keeperDiveTarget();
  state.keeper.diveStartedAt = performance.now();
  state.keeperAim = state.keeper.diveTarget;
  state.message = "Plongeon";
  toast.textContent = state.message;
}

function playerKeeperCurrentPoint(now = performance.now()) {
  if (!state.keeper.hasDived) return keeperLinePoint();

  const progress = clamp((now - state.keeper.diveStartedAt) / 520, 0, 1);
  return {
    x: lerp(state.keeper.diveStart.x, state.keeper.diveTarget.x, easeOutCubic(progress)),
    y: lerp(state.keeper.diveStart.y, state.keeper.diveTarget.y, easeOutCubic(progress)),
  };
}

function aiKeeperDiveForShot(target, saved) {
  if (saved) {
    return {
      x: clamp(target.x + randomBetween(-28, 28), GOAL.x + 36, GOAL.x + GOAL.w - 36),
      y: clamp(target.y + randomBetween(-22, 22), GOAL.y + 36, GOAL.y + GOAL.h - 30),
    };
  }

  const wrongSide = target.x < GOAL.x + GOAL.w / 2 ? 1 : -1;
  return {
    x: clamp(target.x + wrongSide * randomBetween(120, 220), GOAL.x + 36, GOAL.x + GOAL.w - 36),
    y: clamp(target.y + randomBetween(-78, 92), GOAL.y + 36, GOAL.y + GOAL.h - 30),
  };
}

function computePlayerShotResult(ballTarget, aiKeeperStart) {
  if (!isGoal(ballTarget)) {
    return { result: { type: "miss", text: "À côté" }, saved: false };
  }

  const settings = difficulty();
  const keeperBodyTop = KEEPER_HOME.y - 90;
  const keeperBodyBottom = KEEPER_HOME.y + 58;
  const closestBodyY = clamp(ballTarget.y, keeperBodyTop, keeperBodyBottom);
  const normalizedX = (ballTarget.x - aiKeeperStart.x) / settings.keeperSaveZoneX;
  const normalizedY = (ballTarget.y - closestBodyY) / settings.keeperSaveZoneY;
  const saved = normalizedX * normalizedX + normalizedY * normalizedY <= 1;
  return {
    result: saved ? { type: "save", text: "Sauvé" } : { type: "goal", text: "But" },
    saved,
  };
}

function applyShotError(target, power) {
  const idealPower = 0.76;
  const pressure = 7 + Math.abs(power - idealPower) * 52;
  return {
    x: target.x + randomBetween(-pressure, pressure),
    y: target.y + randomBetween(-pressure * 0.72, pressure * 0.72),
  };
}

function isGoal(target) {
  const postPadding = 13;
  return (
    target.x > GOAL.x + postPadding &&
    target.x < GOAL.x + GOAL.w - postPadding &&
    target.y > GOAL.y + 10 &&
    target.y < GOAL.y + GOAL.h - 8
  );
}

function saveRadius(power, isPlayerKeeper) {
  const base = isPlayerKeeper ? 94 : 65;
  const slowBonus = Math.max(0, 0.72 - power) * 80;
  const rocketPenalty = Math.max(0, power - 0.88) * (isPlayerKeeper ? 22 : 48);
  return base + slowBonus - rocketPenalty;
}

function computeResult(ballTarget, diveTarget, power, isPlayerKeeper) {
  const onFrame = isGoal(ballTarget);
  if (!onFrame) {
    return { type: "miss", text: "À côté" };
  }

  const saved = distance(ballTarget, diveTarget) < saveRadius(power, isPlayerKeeper);
  if (saved) {
    return { type: "save", text: isPlayerKeeper ? "Arrêt" : "Sauvé" };
  }

  return { type: "goal", text: "But" };
}

function startPlayerShot() {
  if (state.phase !== "aim") return;

  const power = getPower();
  const ballTarget = applyShotError(state.aim, power);
  const diveStart = aiKeeperLinePoint();
  const aiSave = computePlayerShotResult(ballTarget, diveStart);
  const diveTarget = aiKeeperDiveForShot(ballTarget, aiSave.saved);

  state.phase = "animating";
  state.message = "Tir...";
  state.shot = {
    role: "shooter",
    startTime: performance.now(),
    duration: 900 - power * 230,
    ballTarget,
    intendedTarget: { ...state.aim },
    diveStart,
    diveTarget,
    power,
    result: aiSave.result,
  };
  updateHud();
}

function randomAiPlanTarget() {
  const intendedTarget = randomZone();
  const hintOffset = 58;
  return {
    intendedTarget,
    hint: playableGoalPoint({
      x: intendedTarget.x + randomBetween(-hintOffset, hintOffset),
      y: intendedTarget.y + randomBetween(-hintOffset * 0.62, hintOffset * 0.62),
    }),
  };
}

function buildAiPlan(now = performance.now()) {
  return {
    ...randomAiPlanTarget(),
    startedAt: now,
    shotAt: now + AI_SHOT_DELAY,
    lockAt: now + AI_SHOT_DELAY - difficulty().hintLockBeforeShot,
    nextMoveAt: now + 240,
  };
}

function updateAiShotTimer(now) {
  if (state.phase !== "keeperReady" || state.role !== "keeper" || !state.aiPlan) return;

  if (now < state.aiPlan.lockAt && now >= state.aiPlan.nextMoveAt) {
    const nextTarget = randomAiPlanTarget();
    state.aiPlan.intendedTarget = nextTarget.intendedTarget;
    state.aiPlan.hint = nextTarget.hint;
    state.aiPlan.nextMoveAt = now + randomBetween(210, 430);
  }

  if (now >= state.aiPlan.shotAt) {
    startAiShot();
    return;
  }

  const remaining = Math.max(0, Math.ceil((state.aiPlan.shotAt - now) / 1000));
  state.message = now < state.aiPlan.lockAt
    ? `L'IA cherche... ${remaining}`
    : `Tir dans ${remaining}`;
  toast.textContent = state.message;
  primaryAction.textContent = state.keeper.hasDived ? `${remaining}s` : "Espace";
}

function startAiShot() {
  if (state.phase !== "keeperReady") return;

  const plan = state.aiPlan || buildAiPlan();
  const power = randomBetween(0.58, 0.88);
  const intendedTarget = plan.intendedTarget;
  const aiAccuracy = state.playerScore > state.aiScore ? 36 : 46;
  const ballTarget = {
    x: intendedTarget.x + randomBetween(-aiAccuracy, aiAccuracy),
    y: intendedTarget.y + randomBetween(-aiAccuracy * 0.65, aiAccuracy * 0.65),
  };
  const diveStart = playerKeeperCurrentPoint();
  const diveTarget = state.keeper.hasDived ? state.keeper.diveTarget : keeperLinePoint();
  const result = computeResult(ballTarget, diveTarget, power, true);

  state.phase = "animating";
  state.message = "L'IA frappe...";
  state.shot = {
    role: "keeper",
    startTime: performance.now(),
    duration: 850 - power * 190,
    ballTarget,
    intendedTarget,
    diveStart,
    diveTarget,
    power,
    result,
  };
  state.aiPlan = null;
  updateHud();
}

function finishShot() {
  const shot = state.shot;
  if (!shot) return;

  if (shot.role === "shooter") {
    const scored = shot.result.type === "goal";
    state.playerShots.push(scored ? "goal" : "miss");
    if (scored) state.playerScore += 1;
    state.flash = { text: shot.result.text, good: scored, until: performance.now() + 900 };

    if (state.aiShots.length < MAX_ROUNDS) {
      state.role = "keeper";
      state.phase = "keeperReady";
      state.keeper = {
        x: KEEPER_HOME.x,
        direction: 0,
        height: "mid",
        hasDived: false,
        diveStart: null,
        diveTarget: null,
        diveStartedAt: 0,
      };
      state.keeperAim = keeperDiveTarget();
      state.aiPlan = buildAiPlan();
      state.message = "Bouge ton gardien";
      primaryAction.textContent = "5s";
    } else {
      endOrContinue();
    }
  } else {
    const conceded = shot.result.type === "goal";
    state.aiShots.push(conceded ? "goal" : "miss");
    if (conceded) state.aiScore += 1;
    state.flash = { text: shot.result.text, good: !conceded, until: performance.now() + 900 };
    state.round += 1;
    endOrContinue();
  }

  state.shot = null;
  updateHud();
}

function endOrContinue() {
  if (state.playerShots.length >= MAX_ROUNDS && state.aiShots.length >= MAX_ROUNDS) {
    if (state.playerScore === state.aiScore) {
      const playerWinsTieBreak = Math.random() >= 0.5;
      if (playerWinsTieBreak) {
        state.playerScore += 1;
        state.playerShots.push("goal");
        state.aiShots.push("miss");
      } else {
        state.aiScore += 1;
        state.playerShots.push("miss");
        state.aiShots.push("goal");
      }
    }
    finishTournamentMatch();
    return;
  }

  state.role = "shooter";
  state.phase = "aim";
  state.aim = randomZone();
  state.message = "Vise dans le but";
  primaryAction.textContent = "Tirer";
}

function updateMarkers(listEl, shots) {
  listEl.innerHTML = "";
  for (let i = 0; i < MAX_ROUNDS; i += 1) {
    const marker = document.createElement("li");
    if (shots[i]) marker.className = shots[i];
    listEl.append(marker);
  }
}

function updateDifficultyButtons() {
  difficultyButtons.forEach((button) => {
    button.classList.toggle("selected", button.dataset.difficulty === selectedDifficulty);
  });
}

function updateTeamButtons() {
  teamButtons.forEach((button) => {
    button.classList.toggle("selected", button.dataset.team === selectedTeam);
  });
}

function updateHud() {
  playerTeamLabel.textContent = team().short;
  const opponent = currentOpponent();
  aiTeamLabel.textContent = opponent ? opponent.short : "IA";
  playerScoreEl.textContent = state.playerScore;
  aiScoreEl.textContent = state.aiScore;
  roundLabel.textContent = state.phase === "menu"
    ? `Difficulté: ${difficulty().label}`
    : state.phase === "bracket" && tournament
      ? ROUND_NAMES[tournament.roundIndex]
    : `Manche ${Math.min(state.round, MAX_ROUNDS)} / ${MAX_ROUNDS}`;
  roleLabel.textContent = state.phase === "menu"
    ? "Accueil"
    : state.phase === "bracket"
      ? "Bracket"
    : state.role === "keeper" ? "Gardien" : state.role === "done" ? "Terminé" : "Tireur";
  toast.textContent = state.message;
  powerValue.textContent = `${powerInput.value}%`;
  powerInput.disabled = state.role !== "shooter" || state.phase === "animating" || state.phase === "gameOver" || state.phase === "menu";
  primaryAction.disabled = state.phase === "animating" || state.phase === "menu" || state.phase === "keeperReady" || state.phase === "bracket";
  resetGame.disabled = state.phase === "menu";
  updateMarkers(playerShotsEl, state.playerShots);
  updateMarkers(aiShotsEl, state.aiShots);
  updateDifficultyButtons();
  updateTeamButtons();
}

function drawPitch() {
  const grass = ctx.createLinearGradient(0, 0, 0, H);
  grass.addColorStop(0, "#128455");
  grass.addColorStop(0.56, "#0f7547");
  grass.addColorStop(1, "#0a5136");
  ctx.fillStyle = grass;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.globalAlpha = 0.18;
  for (let x = -80; x < W + 80; x += 120) {
    ctx.fillStyle = x % 240 === 0 ? "#e8fff2" : "#042a1e";
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 120, 0);
    ctx.lineTo(x + 340, H);
    ctx.lineTo(x + 190, H);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  ctx.strokeStyle = "rgba(247,250,247,0.68)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(W / 2, H + 30, 265, 115, 0, Math.PI, 0);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(W / 2, 518);
  ctx.lineTo(W / 2, 518);
  ctx.stroke();
}

function drawGoal() {
  ctx.save();
  ctx.strokeStyle = "rgba(247,250,247,0.28)";
  ctx.lineWidth = 1;
  for (let i = 1; i < 8; i += 1) {
    const x = GOAL.x + (GOAL.w / 8) * i;
    ctx.beginPath();
    ctx.moveTo(x, GOAL.y + 4);
    ctx.lineTo(x, GOAL.y + GOAL.h);
    ctx.stroke();
  }
  for (let i = 1; i < 5; i += 1) {
    const y = GOAL.y + (GOAL.h / 5) * i;
    ctx.beginPath();
    ctx.moveTo(GOAL.x, y);
    ctx.lineTo(GOAL.x + GOAL.w, y);
    ctx.stroke();
  }

  ctx.lineWidth = 10;
  ctx.lineCap = "round";
  ctx.strokeStyle = "#f7faf7";
  ctx.beginPath();
  ctx.moveTo(GOAL.x, GOAL.y + GOAL.h);
  ctx.lineTo(GOAL.x, GOAL.y);
  ctx.lineTo(GOAL.x + GOAL.w, GOAL.y);
  ctx.lineTo(GOAL.x + GOAL.w, GOAL.y + GOAL.h);
  ctx.stroke();

  ctx.lineWidth = 4;
  ctx.strokeStyle = "rgba(247,250,247,0.72)";
  ctx.strokeRect(GOAL.x - 30, GOAL.y + GOAL.h, GOAL.w + 60, 100);
  ctx.restore();
}

function drawTarget(point, color, label) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(point.x, point.y, 17, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(point.x - 26, point.y);
  ctx.lineTo(point.x + 26, point.y);
  ctx.moveTo(point.x, point.y - 26);
  ctx.lineTo(point.x, point.y + 26);
  ctx.stroke();
  if (label) {
    ctx.font = "700 14px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(label, point.x, point.y - 34);
  }
  ctx.restore();
}

function drawHintZone(point) {
  ctx.save();
  const pulse = 0.5 + Math.sin(performance.now() / 240) * 0.08;
  const radiusX = 88;
  const radiusY = 58;

  ctx.globalAlpha = pulse;
  ctx.fillStyle = "rgba(67, 199, 216, 0.24)";
  ctx.beginPath();
  ctx.ellipse(point.x, point.y, radiusX, radiusY, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = 0.86;
  ctx.strokeStyle = "rgba(170, 243, 251, 0.9)";
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 9]);
  ctx.beginPath();
  ctx.ellipse(point.x, point.y, radiusX, radiusY, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.setLineDash([]);
  ctx.fillStyle = "#dffbff";
  ctx.font = "800 14px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("Indice IA", point.x, point.y - radiusY - 12);
  ctx.restore();
}

function drawKeeper(point, progress = 0, active = false, startPoint = KEEPER_HOME, colors = null) {
  const kit = colors || { shirt: "#27314a", trim: "#f4bf4f", gloves: "#43c7d8" };
  const dive = active ? easeOutCubic(progress) : 0;
  const x = lerp(startPoint.x, point.x, dive);
  const y = lerp(startPoint.y, point.y, dive);
  const lean = clamp((point.x - startPoint.x) / 185, -1, 1) * dive;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(lean * 0.6);

  ctx.strokeStyle = "#151a22";
  ctx.lineWidth = 13;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-44, -24);
  ctx.lineTo(-86, -48);
  ctx.moveTo(44, -24);
  ctx.lineTo(86, -48);
  ctx.moveTo(-18, 20);
  ctx.lineTo(-48, 62);
  ctx.moveTo(18, 20);
  ctx.lineTo(48, 62);
  ctx.stroke();

  ctx.strokeStyle = kit.gloves;
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(-38, -26);
  ctx.lineTo(-78, -50);
  ctx.moveTo(38, -26);
  ctx.lineTo(78, -50);
  ctx.stroke();

  ctx.fillStyle = "#ffd5a1";
  ctx.beginPath();
  ctx.arc(0, -76, 22, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = kit.shirt;
  ctx.beginPath();
  ctx.roundRect(-33, -58, 66, 78, 16);
  ctx.fill();

  ctx.fillStyle = kit.trim;
  ctx.fillRect(-28, -48, 56, 9);
  ctx.restore();
}

function drawShooterHint() {
  const kit = team();
  ctx.save();
  ctx.fillStyle = kit.primary;
  ctx.beginPath();
  ctx.roundRect(W / 2 - 22, 458, 44, 62, 16);
  ctx.fill();
  ctx.fillStyle = "#ffd5a1";
  ctx.beginPath();
  ctx.arc(W / 2, 444, 17, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = kit.secondary;
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(W / 2 - 16, 502);
  ctx.lineTo(W / 2 - 38, 526);
  ctx.moveTo(W / 2 + 14, 502);
  ctx.lineTo(W / 2 + 37, 526);
  ctx.stroke();
  ctx.restore();
}

function ballPosition(shot, progress) {
  const t = easeOutCubic(progress);
  const mid = {
    x: lerp(BALL_START.x, shot.ballTarget.x, 0.48),
    y: Math.min(BALL_START.y, shot.ballTarget.y) - 80 - shot.power * 56,
  };
  const oneMinusT = 1 - t;
  return {
    x: oneMinusT * oneMinusT * BALL_START.x + 2 * oneMinusT * t * mid.x + t * t * shot.ballTarget.x,
    y: oneMinusT * oneMinusT * BALL_START.y + 2 * oneMinusT * t * mid.y + t * t * shot.ballTarget.y,
    size: lerp(23, 10, t),
  };
}

function drawBall(point, size = 18) {
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.beginPath();
  ctx.ellipse(point.x + size * 0.3, point.y + size * 0.75, size * 0.92, size * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#f7faf7";
  ctx.strokeStyle = "#101820";
  ctx.lineWidth = Math.max(1.5, size * 0.12);
  ctx.beginPath();
  ctx.arc(point.x, point.y, size, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#101820";
  ctx.beginPath();
  ctx.moveTo(point.x, point.y - size * 0.45);
  ctx.lineTo(point.x + size * 0.42, point.y - size * 0.12);
  ctx.lineTo(point.x + size * 0.25, point.y + size * 0.4);
  ctx.lineTo(point.x - size * 0.25, point.y + size * 0.4);
  ctx.lineTo(point.x - size * 0.42, point.y - size * 0.12);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawFlash() {
  if (!state.flash || performance.now() > state.flash.until) return;

  const alpha = clamp((state.flash.until - performance.now()) / 900, 0, 1);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = state.flash.good ? "rgba(67,199,216,0.2)" : "rgba(232,79,80,0.18)";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#f7faf7";
  ctx.font = "900 58px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(state.flash.text, W / 2, 275);
  ctx.restore();
}

function drawScene() {
  ctx.clearRect(0, 0, W, H);
  drawPitch();
  drawGoal();

  const playerKit = {
    shirt: team().primary,
    trim: team().secondary,
    gloves: "#f7faf7",
  };
  const opponent = currentOpponent();
  const aiKit = opponent
    ? { shirt: opponent.primary, trim: opponent.secondary, gloves: "#43c7d8" }
    : { shirt: "#27314a", trim: "#f4bf4f", gloves: "#43c7d8" };
  let keeperPoint = state.role === "keeper"
    ? keeperLinePoint()
    : state.role === "shooter"
      ? aiKeeperLinePoint()
      : KEEPER_HOME;
  let keeperStart = keeperPoint;
  let keeperKit = state.role === "keeper" ? playerKit : aiKit;
  let keeperActive = false;
  let shotProgress = 0;
  if (state.role === "keeper" && state.phase === "keeperReady" && state.keeper.hasDived) {
    shotProgress = clamp((performance.now() - state.keeper.diveStartedAt) / 520, 0, 1);
    keeperStart = state.keeper.diveStart;
    keeperPoint = state.keeper.diveTarget;
    keeperActive = true;
  }
  if (state.shot) {
    shotProgress = clamp((performance.now() - state.shot.startTime) / state.shot.duration, 0, 1);
    keeperStart = state.shot.diveStart || KEEPER_HOME;
    keeperPoint = state.shot.diveTarget;
    keeperKit = state.shot.role === "keeper" ? playerKit : aiKit;
    keeperActive = true;
  }

  if (state.role === "shooter" && state.phase === "aim") {
    drawTarget(state.aim, "#f4bf4f", "Cible");
  }

  if (state.role === "keeper" && state.phase === "keeperReady") {
    if (state.aiPlan) {
      drawHintZone(state.aiPlan.hint);
    }
    drawTarget(state.keeperAim, "#43c7d8", state.keeper.hasDived ? "Zone choisie" : "Plongeon");
  }

  drawKeeper(keeperPoint, shotProgress, keeperActive, keeperStart, keeperKit);

  if (state.shot) {
    const ball = ballPosition(state.shot, shotProgress);
    drawBall(ball, ball.size);
    if (shotProgress >= 1) finishShot();
  } else {
    drawShooterHint();
    drawBall(BALL_START, 22);
  }

  drawFlash();
}

function resizeCanvas() {
  const ratio = window.devicePixelRatio || 1;
  canvas.width = W * ratio;
  canvas.height = H * ratio;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function onCanvasSelect(event) {
  event.preventDefault();
  if (state.phase === "menu") return;

  const point = pointFromEvent(event);

  if (state.phase === "aim" && state.role === "shooter") {
    if (insideGoal(point)) {
      state.aim = playableGoalPoint(point);
      state.message = "Prêt à tirer";
      updateHud();
    }
    return;
  }

  if (state.phase === "keeperReady" && state.role === "keeper") return;
}

function mainAction() {
  if (state.phase === "menu") return;

  if (state.phase === "gameOver") {
    reset(false);
    return;
  }

  if (state.phase === "aim") {
    startPlayerShot();
  }
}

function reset(showMenu = false) {
  pressedKeys.clear();
  lastFrameTime = performance.now();
  state = freshState();
  bracketScreen.classList.add("hidden");
  if (showMenu) {
    tournament = null;
    state.phase = "menu";
    state.role = "menu";
    state.message = "Choisis ton équipe";
    homeScreen.classList.remove("hidden");
  } else {
    homeScreen.classList.add("hidden");
  }
  primaryAction.textContent = "Tirer";
  powerInput.disabled = false;
  updateHud();
}

function startWithDifficulty(key) {
  selectedDifficulty = key;
  updateHud();
}

function selectTeam(key) {
  selectedTeam = key;
  updateHud();
}

function startMatch() {
  tournament = createTournament();
  reset(false);
}

function loop(now) {
  const delta = Math.min(32, now - lastFrameTime);
  lastFrameTime = now;
  movePlayerKeeper(delta);
  updateAiShotTimer(now);
  drawScene();
  requestAnimationFrame(loop);
}

if (!ctx.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function roundRect(x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    this.beginPath();
    this.moveTo(x + r, y);
    this.arcTo(x + width, y, x + width, y + height, r);
    this.arcTo(x + width, y + height, x, y + height, r);
    this.arcTo(x, y + height, x, y, r);
    this.arcTo(x, y, x + width, y, r);
    this.closePath();
    return this;
  };
}

if (window.PointerEvent) {
  canvas.addEventListener("pointerdown", onCanvasSelect);
} else {
  canvas.addEventListener("touchstart", onCanvasSelect, { passive: false });
  canvas.addEventListener("mousedown", onCanvasSelect);
}
primaryAction.addEventListener("click", mainAction);
resetGame.addEventListener("click", () => reset(false));
powerInput.addEventListener("input", updateHud);
difficultyButtons.forEach((button) => {
  button.addEventListener("click", () => startWithDifficulty(button.dataset.difficulty));
});
teamButtons.forEach((button) => {
  button.addEventListener("click", () => selectTeam(button.dataset.team));
});
startGameButton.addEventListener("click", startMatch);
continueTournamentButton.addEventListener("click", advanceTournament);
restartTournamentButton.addEventListener("click", () => reset(true));
window.addEventListener("resize", resizeCanvas);
window.addEventListener("keydown", (event) => {
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.code)) {
    if (state.phase === "keeperReady") {
      event.preventDefault();
      pressedKeys.add(event.code);
    }
    return;
  }

  if (event.code === "Space") {
    event.preventDefault();
    if (state.phase === "keeperReady") {
      playerKeeperDive();
    } else {
      mainAction();
    }
    return;
  }

  if (event.code === "Enter" && state.phase !== "keeperReady") {
    event.preventDefault();
    if (state.phase === "bracket") {
      advanceTournament();
    } else {
      mainAction();
    }
  }
});
window.addEventListener("keyup", (event) => {
  pressedKeys.delete(event.code);
});

resizeCanvas();
reset(true);
requestAnimationFrame(loop);
