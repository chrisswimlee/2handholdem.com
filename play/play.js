// Browser table laid out like the iPhone app.
// Ante with equal bets, Play deals four cards into the tray plus the flop
// and three dealer cards. Tap or drag cards into Hand 1 and Hand 2
// (the other hand fills once one side has both cards). Raise 2× is optional.
// Deal locks the split, burns, and brings the turn and river together.
// Dealer uses at most two of three hole cards. Win returns 2× the stake.

(() => {
  const WELCOME = 50_000;
  const MAX_BET = 250_000;
  const DENOMS = [1, 5, 25, 50, 100];
  const KEY = "2hh.play.v1";
  const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
  const SUITS = ["♠", "♥", "♦", "♣"];
  const SUIT_CLASS = ["s-s", "s-h", "s-d", "s-c"];
  const SUIT_NAME = ["spades", "hearts", "diamonds", "clubs"];
  const NAMES = ["High Card", "One Pair", "Two Pair", "Three of a Kind", "Straight", "Flush", "Full House", "Four of a Kind", "Straight Flush"];

  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let skip = false;
  let skipResolve = null;
  const wait = (ms) => {
    if (reduceMotion || skip) return Promise.resolve();
    return new Promise((resolve) => {
      const timer = setTimeout(resolve, ms);
      skipResolve = () => { clearTimeout(timer); resolve(); };
    });
  };
  const $ = (id) => document.getElementById(id);
  const rankOf = (c) => RANKS[c.r - 2];
  const fmt = (n) => n.toLocaleString("en-US");
  const chips = (n) => (Math.abs(n) === 1 ? "1 chip" : `${fmt(Math.abs(n))} chips`);
  const signed = (n) => (n > 0 ? `+${chips(n)}` : n < 0 ? `-${chips(n)}` : chips(0));
  const stamp = (n) => (n >= 10_000 ? `${Math.round(n / 1000)}k` : n >= 1000 ? `${(n / 1000).toLocaleString("en-US", { maximumFractionDigits: 1 })}k` : fmt(n));

  const el = {
    felt: $("felt"),
    bank: $("bank"),
    status: $("status"),
    dealerZone: $("dealer-zone"),
    dealerLabel: $("dealer-label"),
    dealer: $("dealer"),
    boardZone: document.querySelector(".board-zone"),
    prompt: $("prompt"),
    board: $("board"),
    h1: $("h1"),
    h2: $("h2"),
    coach1: $("coach1"),
    coach2: $("coach2"),
    tray: $("tray"),
    overall: $("overall"),
    pile1: $("pile1"),
    pile2: $("pile2"),
    go: $("go"),
    rerack: $("rerack"),
    reset: $("reset"),
    undo: $("undo"),
    raise1: $("raise1"),
    raise2: $("raise2"),
  };
  const slotEls = [...document.querySelectorAll(".slot")];

  let saved = WELCOME;
  let live = WELCOME;
  let blind = 0;
  let undoStack = [];
  let phase = "ante"; // ante | arrange | reveal | showdown
  let busy = false;
  let holdStatus = false;
  let hand = null;
  let drag = null;
  let seq = 1;

  function load() {
    try {
      const data = JSON.parse(localStorage.getItem(KEY) || "null");
      if (!data) return;
      if (Number.isInteger(data.balance) && data.balance >= 0) saved = data.balance;
      if (Number.isInteger(data.blind) && data.blind >= 0) blind = data.blind;
      if (Array.isArray(data.undo)) undoStack = data.undo.filter((n) => DENOMS.includes(n));
    } catch { /* private mode or bad JSON */ }
    live = saved;
    clampBlind();
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify({ balance: saved, blind, undo: undoStack }));
    } catch { /* quota / private mode */ }
  }

  function cap() {
    return Math.min(MAX_BET, Math.floor(live / 2));
  }

  function clampBlind() {
    const max = cap();
    if (blind > max) {
      blind = max;
      undoStack = blind > 0 ? [blind] : [];
    } else if (undoStack.reduce((a, n) => a + n, 0) !== blind) {
      undoStack = blind > 0 ? [blind] : [];
    }
  }

  function canEditBet() {
    return !busy && (phase === "ante" || phase === "arrange" || phase === "showdown");
  }

  function setStatus(text) {
    holdStatus = true;
    el.status.textContent = text;
  }

  function updateStatus() {
    if (holdStatus) return;
    if (phase === "arrange" && hand) {
      el.status.textContent = blind < 1
        ? "Tap a chip to set your bet"
        : handsSet() ? "" : "Arrange your 4 cards into two hands";
      return;
    }
    el.status.textContent = "";
  }

  function releaseStatus() {
    holdStatus = false;
    updateStatus();
  }

  function cells(row, n) {
    row.replaceChildren();
    for (let i = 0; i < n; i++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      row.appendChild(cell);
    }
  }

  function newDeck() {
    const d = [];
    for (let r = 2; r <= 14; r++) for (let s = 0; s < 4; s++) d.push({ r, s, id: seq++ });
    for (let i = d.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [d[i], d[j]] = [d[j], d[i]];
    }
    return d;
  }

  function makeCard(c, { down = false } = {}) {
    const node = document.createElement("button");
    node.type = "button";
    node.className = "card" + (down ? " down" : "") + (c.r === 10 ? " ten" : "");
    const rank = rankOf(c);
    const suit = SUITS[c.s];
    let center;
    if (c.r === 14) center = `<span class="pip ace">${suit}</span>`;
    else if (c.r >= 11) center = `<span class="court"><b>${rank}</b><i>${suit}</i></span>`;
    else center = `<span class="pip">${suit}</span>`;
    node.innerHTML =
      `<span class="card-inner">` +
        `<span class="card-face ${SUIT_CLASS[c.s]}">` +
          `<span class="idx tl"><b>${rank}</b><i>${suit}</i></span>${center}` +
          `<span class="idx br"><b>${rank}</b><i>${suit}</i></span>` +
        `</span>` +
        `<span class="card-back"></span>` +
      `</span>`;
    node.card = c;
    c.el = node;
    labelCard(node);
    return node;
  }

  function labelCard(node) {
    const c = node.card;
    node.setAttribute("aria-label", node.classList.contains("down") ? "Face-down card" : `${rankOf(c)} of ${SUIT_NAME[c.s]}`);
  }

  function flip(node, faceUp = true) {
    node.classList.toggle("down", !faceUp);
    labelCard(node);
  }

  function armDeal(node, i) {
    if (reduceMotion) return;
    node.classList.add("dealing");
    node.style.setProperty("--d", `${i * 42}ms`);
    node.style.setProperty("--fx", "120px");
    node.style.setProperty("--fy", "-30px");
    const clear = () => node.classList.remove("dealing");
    node.addEventListener("animationend", clear, { once: true });
    setTimeout(clear, i * 42 + 700);
  }

  function mountRow(row, cards, { down = false, animate = false } = {}) {
    [...row.children].forEach((cell, i) => {
      cell.replaceChildren();
      const c = cards[i];
      if (!c) return;
      if (!c.el) makeCard(c, { down });
      else flip(c.el, !down);
      if (animate) armDeal(c.el, i);
      cell.appendChild(c.el);
    });
  }

  function clearSeats() {
    slotEls.forEach((slot) => slot.replaceChildren());
    el.tray.replaceChildren();
    [el.h1, el.h2].forEach((seat) => {
      seat.classList.remove("win", "lose");
      const result = seat.querySelector(".result");
      result.textContent = "";
      result.className = "result";
    });
    el.coach1.textContent = "";
    el.coach2.textContent = "";
    el.overall.textContent = "";
    el.overall.className = "overall";
    document.querySelectorAll(".card.best").forEach((n) => n.classList.remove("best"));
  }

  function showAnte() {
    phase = "ante";
    hand = null;
    clearSeats();
    mountRow(el.dealer, []);
    mountRow(el.board, []);
    el.dealerZone.classList.remove("on");
    el.boardZone.classList.remove("dealt");
    el.dealerLabel.textContent = "Dealer";
  }

  function combos(arr, k) {
    const out = [];
    (function rec(start, pick) {
      if (pick.length === k) { out.push(pick.slice()); return; }
      for (let i = start; i < arr.length; i++) { pick.push(arr[i]); rec(i + 1, pick); pick.pop(); }
    })(0, []);
    return out;
  }

  function score5(cards) {
    const rs = cards.map((c) => c.r).sort((a, b) => b - a);
    const flush = cards.every((c) => c.s === cards[0].s);
    const uniq = [...new Set(rs)];
    let straightHigh = 0;
    if (uniq.length === 5) {
      if (rs[0] - rs[4] === 4) straightHigh = rs[0];
      else if (rs.join() === "14,5,4,3,2") straightHigh = 5;
    }
    const counts = {};
    rs.forEach((r) => (counts[r] = (counts[r] || 0) + 1));
    const groups = Object.entries(counts).map(([r, n]) => [n, +r]).sort((a, b) => b[0] - a[0] || b[1] - a[1]);
    const kick = groups.map((g) => g[1]);
    if (straightHigh && flush) return [8, straightHigh];
    if (groups[0][0] === 4) return [7, ...kick];
    if (groups[0][0] === 3 && groups[1][0] === 2) return [6, ...kick];
    if (flush) return [5, ...rs];
    if (straightHigh) return [4, straightHigh];
    if (groups[0][0] === 3) return [3, ...kick];
    if (groups[0][0] === 2 && groups[1][0] === 2) return [2, ...kick];
    if (groups[0][0] === 2) return [1, ...kick];
    return [0, ...rs];
  }

  const cmp = (a, b) => {
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      const d = (a[i] || 0) - (b[i] || 0);
      if (d) return d;
    }
    return 0;
  };

  function best(cards, hole = null, maxHole = 99) {
    let top = null;
    for (const c of combos(cards, 5)) {
      if (hole && c.filter((x) => hole.includes(x)).length > maxHole) continue;
      const score = score5(c);
      if (!top || cmp(score, top.score) > 0) top = { score, cards: c };
    }
    return top;
  }

  function handsSet() {
    return !!(hand && hand.slots.every(Boolean));
  }

  function raiseCost(h1, h2) {
    return (h1 ? blind * 2 : 0) + (h2 ? blind * 2 : 0);
  }

  function fitRaises() {
    if (!hand) return;
    while ((hand.raise1 || hand.raise2) && live < raiseCost(hand.raise1, hand.raise2)) {
      if (hand.raise2) hand.raise2 = false;
      else hand.raise1 = false;
    }
  }

  function snap() {
    return {
      slots: hand.slots.map((c) => (c ? c.id : null)),
      tray: hand.tray.map((c) => c.id),
      raise1: hand.raise1,
      raise2: hand.raise2,
    };
  }

  function byId(id) {
    return hand.hole.find((c) => c.id === id) || null;
  }

  function restore(s) {
    hand.slots = s.slots.map((id) => (id == null ? null : byId(id)));
    hand.tray = s.tray.map(byId).filter(Boolean);
    hand.raise1 = s.raise1;
    hand.raise2 = s.raise2;
  }

  function removeFrom(card) {
    const si = hand.slots.indexOf(card);
    if (si >= 0) hand.slots[si] = null;
    const ti = hand.tray.indexOf(card);
    if (ti >= 0) hand.tray.splice(ti, 1);
  }

  function autoFill() {
    const h1 = hand.slots.slice(0, 2).filter(Boolean).length;
    const h2 = hand.slots.slice(2).filter(Boolean).length;
    const fill = (indexes) => {
      indexes.forEach((i) => {
        const card = hand.tray.shift();
        if (card) hand.slots[i] = card;
      });
    };
    if ((h1 === 2 && h2 === 0) || (h1 === 0 && h2 === 2)) fill(h1 === 2 ? [2, 3] : [0, 1]);
    else if ((h1 === 2 && h2 === 1) || (h1 === 1 && h2 === 2)) {
      const i = hand.slots.findIndex((s) => !s);
      if (i >= 0) fill([i]);
    }
  }

  function userMove(fn, { fill = true } = {}) {
    if (busy || phase !== "arrange" || !hand) return;
    releaseStatus();
    hand.history.push(snap());
    fn();
    if (fill) autoFill();
    sync();
  }

  function placeNext(card) {
    const i = hand.slots.findIndex((s) => !s);
    if (i < 0) return;
    userMove(() => {
      removeFrom(card);
      hand.slots[i] = card;
    });
  }

  function seatInto(i) {
    if (!hand || hand.slots[i] || !hand.tray.length) return;
    const card = hand.tray[0];
    userMove(() => {
      removeFrom(card);
      hand.slots[i] = card;
    });
  }

  function returnToTray(card) {
    userMove(() => {
      removeFrom(card);
      hand.tray.push(card);
    }, { fill: false });
  }

  function dropOnSlot(card, i) {
    if (hand.slots[i] === card) return;
    userMove(() => {
      const from = hand.slots.indexOf(card);
      const trayAt = hand.tray.indexOf(card);
      const occupant = hand.slots[i];
      removeFrom(card);
      if (!occupant) {
        hand.slots[i] = card;
        return;
      }
      hand.slots[i] = card;
      if (from >= 0) hand.slots[from] = occupant;
      else hand.tray.splice(Math.min(Math.max(trayAt, 0), hand.tray.length), 0, occupant);
    });
  }

  function dropOnTray(card, clientX) {
    const fromSlot = hand.slots.includes(card);
    userMove(() => {
      removeFrom(card);
      let idx = hand.tray.length;
      for (let i = 0; i < hand.tray.length; i++) {
        const rect = hand.tray[i].el.getBoundingClientRect();
        if (clientX < rect.left + rect.width / 2) { idx = i; break; }
      }
      hand.tray.splice(idx, 0, card);
    }, { fill: !fromSlot });
  }

  function sync() {
    if (!hand) return;
    const placed = new Set();
    hand.slots.forEach((c, i) => {
      if (!c) {
        slotEls[i].replaceChildren();
        return;
      }
      slotEls[i].replaceChildren(c.el);
      placed.add(c);
    });
    el.tray.replaceChildren(...hand.tray.map((c) => c.el));
    hand.tray.forEach((c) => placed.add(c));
    paint();
  }

  function paint() {
    el.bank.textContent = fmt(live);
    const editing = canEditBet();
    document.querySelectorAll("[data-chip]").forEach((btn) => {
      btn.disabled = !editing || blind + Number(btn.dataset.chip) > cap();
    });
    const cardUndo = phase === "arrange" && hand && hand.history.length > 0;
    el.undo.disabled = busy || (!cardUndo && (!editing || undoStack.length === 0));
    el.reset.disabled = busy || (!cardUndo && blind === 0);
    el.rerack.hidden = busy || live >= 2 || phase === "arrange" || phase === "reveal";

    const showGo = busy
      || (phase === "showdown" && live >= 2)
      || ((phase === "ante") && blind >= 1 && live >= blind * 2)
      || (phase === "arrange" && handsSet() && blind >= 1);
    el.go.hidden = !showGo || !el.rerack.hidden;
    el.go.disabled = busy;
    el.go.textContent = busy ? "Dealing…" : phase === "showdown" ? "Play Again" : phase === "arrange" ? "Deal" : "Play";

    const showRaise = phase === "ante" || phase === "arrange";
    [el.raise1, el.raise2].forEach((btn, i) => {
      const on = !!(hand && (i === 0 ? hand.raise1 : hand.raise2));
      btn.hidden = !showRaise;
      btn.disabled = busy || phase !== "arrange" || !handsSet();
      btn.setAttribute("aria-pressed", String(on));
      btn.textContent = on ? "Undo 2x Raise" : "Raise 2x";
    });

    [el.pile1, el.pile2].forEach((pile, i) => {
      const raised = !!(hand && (i === 0 ? hand.raise1 : hand.raise2) && (phase !== "ante"));
      const amount = blind * (raised ? 3 : 1);
      pile.hidden = blind < 1;
      pile.classList.toggle("raised", raised);
      pile.innerHTML = `<b>${stamp(amount)}</b>`;
      pile.setAttribute("aria-label", `${chips(amount)} on hand ${i + 1}`);
    });

    slotEls.forEach((slot, i) => {
      const filled = hand && hand.slots[i];
      const open = phase === "arrange" && !filled;
      slot.tabIndex = open ? 0 : -1;
      if (open) slot.setAttribute("role", "button");
      else slot.removeAttribute("role");
      const name = i < 2 ? "Hand 1" : "Hand 2";
      if (open) slot.setAttribute("aria-label", `Empty ${name} slot ${(i % 2) + 1}`);
      else slot.removeAttribute("aria-label");
    });

    if (hand && phase === "arrange" && handsSet()) {
      const flop = hand.flop;
      el.coach1.textContent = NAMES[best([...flop, hand.slots[0], hand.slots[1]]).score[0]];
      el.coach2.textContent = NAMES[best([...flop, hand.slots[2], hand.slots[3]]).score[0]];
    } else if (phase !== "showdown") {
      el.coach1.textContent = "";
      el.coach2.textContent = "";
    }
    updateStatus();
  }

  function addChip(value) {
    if (!canEditBet() || !DENOMS.includes(value) || blind + value > cap()) return;
    releaseStatus();
    blind += value;
    undoStack.push(value);
    fitRaises();
    save();
    paint();
  }

  function undoChip() {
    if (!canEditBet() || undoStack.length === 0) return;
    blind = Math.max(0, blind - undoStack.pop());
    fitRaises();
    save();
    paint();
  }

  function clearBet() {
    blind = 0;
    undoStack = [];
    if (hand) { hand.raise1 = false; hand.raise2 = false; }
    save();
    paint();
  }

  function onReset() {
    if (busy) return;
    releaseStatus();
    if (phase === "arrange" && hand && hand.history.length) {
      hand.history = [];
      hand.slots = [null, null, null, null];
      hand.tray = hand.hole.slice();
      hand.raise1 = false;
      hand.raise2 = false;
      sync();
      return;
    }
    if (blind > 0) clearBet();
  }

  function onUndo() {
    if (busy) return;
    releaseStatus();
    if (phase === "arrange" && hand && hand.history.length) {
      restore(hand.history.pop());
      sync();
      return;
    }
    undoChip();
  }

  function toggleRaise(which) {
    if (busy || phase !== "arrange" || !handsSet()) return;
    releaseStatus();
    const key = which === 1 ? "raise1" : "raise2";
    if (hand[key]) {
      hand[key] = false;
      paint();
      return;
    }
    const next = raiseCost(which === 1 || hand.raise1, which === 2 || hand.raise2);
    if (live < next) {
      setStatus(`Not enough chips to raise. Need ${chips(next)}.`);
      return;
    }
    hand[key] = true;
    paint();
  }

  function draw(deck) {
    const c = deck.pop();
    if (!c) throw new Error("Deck empty");
    return c;
  }

  async function startHand() {
    if (busy || (phase !== "ante" && phase !== "showdown")) return;
    if (blind < 1) { setStatus("Tap a chip to set your bet"); return; }
    if (live < blind * 2) { setStatus(`Need ${chips(blind * 2)} to play`); return; }
    busy = true;
    skip = false;
    holdStatus = false;
    paint();
    try {
      if (!reduceMotion && el.felt.querySelector(".card")) {
        el.felt.querySelectorAll(".card").forEach((c) => c.classList.add("collect"));
        await wait(280);
      }
      const deck = newDeck();
      const hole = [draw(deck), draw(deck), draw(deck), draw(deck)];
      deck.pop();
      const flop = [draw(deck), draw(deck), draw(deck)];
      const dealer = [draw(deck), draw(deck), draw(deck)];
      hole.forEach((c) => makeCard(c, { down: true }));
      flop.forEach((c) => makeCard(c, { down: true }));
      dealer.forEach((c) => makeCard(c, { down: true }));
      hand = {
        hole, flop, dealer, deck,
        turn: null, river: null,
        slots: [null, null, null, null],
        tray: hole.slice(),
        history: [],
        raise1: false, raise2: false,
        made: null,
      };
      clearSeats();
      el.dealerZone.classList.add("on");
      el.boardZone.classList.add("dealt");
      el.dealerLabel.textContent = "Dealer";
      mountRow(el.dealer, dealer, { down: true, animate: true });
      mountRow(el.board, [...flop, null, null], { down: true, animate: true });
      hole.forEach((c, i) => { armDeal(c.el, i); el.tray.appendChild(c.el); });
      phase = "arrange";
      await wait(hole.length * 42 + 280);
      for (const c of hole) { flip(c.el); await wait(60); }
      await wait(80);
      for (const c of flop) { flip(c.el); await wait(70); }
      releaseStatus();
    } finally {
      busy = false;
      paint();
    }
  }

  async function commit() {
    if (busy || phase !== "arrange" || !handsSet()) return;
    const extra = raiseCost(hand.raise1, hand.raise2);
    const need = blind * 2 + extra;
    if (blind < 1) { setStatus("Tap a chip to set your bet"); return; }
    if (live < need) { setStatus(`Need ${chips(need)} to play`); return; }
    busy = true;
    skip = false;
    phase = "reveal";
    live -= need;
    holdStatus = false;
    hand.hole.forEach((c) => { c.el.disabled = true; });
    paint();
    try {
      hand.deck.pop();
      hand.turn = draw(hand.deck);
      makeCard(hand.turn, { down: true });
      armDeal(hand.turn.el, 0);
      el.board.children[3].appendChild(hand.turn.el);
      await wait(260);
      flip(hand.turn.el);
      await wait(280);
      hand.deck.pop();
      hand.river = draw(hand.deck);
      makeCard(hand.river, { down: true });
      armDeal(hand.river.el, 0);
      el.board.children[4].appendChild(hand.river.el);
      await wait(260);
      flip(hand.river.el);
      await wait(280);
      for (const c of hand.dealer) { flip(c.el); await wait(120); }
      await wait(200);
      settle();
      phase = "showdown";
    } finally {
      busy = false;
      paint();
    }
  }

  function settle() {
    const board = [...hand.flop, hand.turn, hand.river];
    const h1 = [hand.slots[0], hand.slots[1]];
    const h2 = [hand.slots[2], hand.slots[3]];
    const dealerBest = best([...board, ...hand.dealer], hand.dealer, 2);
    const rank1 = best([...board, ...h1]);
    const rank2 = best([...board, ...h2]);
    hand.made = { dealer: dealerBest, h1: rank1, h2: rank2 };
    hand.dealer.forEach((c) => c.el.classList.toggle("unused", !dealerBest.cards.includes(c)));

    const bet1 = blind * (hand.raise1 ? 3 : 1);
    const bet2 = blind * (hand.raise2 ? 3 : 1);
    const outcome = (mine) => {
      const r = cmp(mine, dealerBest.score);
      return r > 0 ? "win" : r < 0 ? "loss" : "push";
    };
    const o1 = outcome(rank1.score);
    const o2 = outcome(rank2.score);
    const pay = (o, bet) => (o === "win" ? bet * 2 : o === "push" ? bet : 0);
    const netOf = (o, bet) => (o === "win" ? bet : o === "loss" ? -bet : 0);
    live += pay(o1, bet1) + pay(o2, bet2);
    const net = netOf(o1, bet1) + netOf(o2, bet2);
    saved = live;
    const max = cap();
    if (blind > max) {
      blind = max;
      undoStack = blind > 0 ? [blind] : [];
      hand.raise1 = false;
      hand.raise2 = false;
    }
    save();

    el.dealerLabel.textContent = NAMES[dealerBest.score[0]];
    [[el.h1, o1, rank1, bet1], [el.h2, o2, rank2, bet2]].forEach(([seat, o, rank, bet]) => {
      const out = seat.querySelector(".result");
      const name = document.createElement("span");
      name.textContent = NAMES[rank.score[0]];
      const line = document.createElement("span");
      if (o === "win") line.textContent = `Win ${signed(bet)}`;
      else if (o === "loss") line.textContent = `Loss ${signed(-bet)}`;
      else line.textContent = "Push";
      out.replaceChildren(name, document.createElement("br"), line);
      out.className = "result " + (o === "win" ? "w" : o === "loss" ? "l" : "p");
      seat.classList.toggle("win", o === "win");
      seat.classList.toggle("lose", o === "loss");
    });
    el.coach1.textContent = "";
    el.coach2.textContent = "";

    el.overall.textContent = net > 0 ? `You win ${chips(net)}` : net < 0 ? `You lose ${chips(-net)}` : "Push";
    el.overall.className = "overall " + (net > 0 ? "up" : net < 0 ? "down" : "push");
  }

  function highlight(which) {
    if (phase !== "showdown" || !hand || !hand.made) return;
    document.querySelectorAll(".card.best").forEach((n) => n.classList.remove("best"));
    const made = which === 1 ? hand.made.h1 : which === 2 ? hand.made.h2 : hand.made.dealer;
    made.cards.forEach((c) => c.el.classList.add("best"));
  }

  function onPrimary() {
    releaseStatus();
    if (phase === "arrange") commit();
    else startHand();
  }

  function requestSkip(e) {
    if (phase !== "reveal" || e.target.closest("button, a")) return;
    skip = true;
    if (skipResolve) skipResolve();
  }

  function underPointer(x, y) {
    return document.elementsFromPoint(x, y).find((node) => !node.closest(".card.dragging")) || null;
  }

  function endDrag(e) {
    if (!drag || e.pointerId !== drag.pid) return;
    const { card, moved, x, y } = drag;
    const node = card;
    const hit = underPointer(e.clientX, e.clientY);
    drag = null;
    node.classList.remove("dragging");
    node.style.left = "";
    node.style.top = "";
    slotEls.forEach((s) => s.classList.remove("hot"));
    if (phase !== "arrange" || busy) { sync(); return; }
    if (!moved || Math.hypot(e.clientX - x, e.clientY - y) < 8) {
      if (hand.tray.includes(card.card)) placeNext(card.card);
      else returnToTray(card.card);
      return;
    }
    const slot = hit && hit.closest(".slot");
    if (slot) { dropOnSlot(card.card, Number(slot.dataset.slot)); return; }
    if (hit && (hit.closest(".tray") || hit.closest(".action-center"))) { dropOnTray(card.card, e.clientX); return; }
    if (hand.slots.includes(card.card)) returnToTray(card.card);
    else sync();
  }

  el.felt.addEventListener("pointerdown", (e) => {
    requestSkip(e);
    if (phase !== "arrange" || busy) return;
    const cardEl = e.target.closest(".card");
    if (cardEl && cardEl.card && hand && hand.hole.includes(cardEl.card)) {
      e.preventDefault();
      drag = { card: cardEl, x: e.clientX, y: e.clientY, moved: false, pid: e.pointerId };
      cardEl.setPointerCapture(e.pointerId);
      return;
    }
    const slot = e.target.closest(".slot");
    if (slot && !slot.querySelector(".card")) seatInto(Number(slot.dataset.slot));
  });
  el.felt.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.pid) return;
    if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 8) return;
    drag.moved = true;
    const node = drag.card;
    node.classList.add("dragging");
    node.style.left = `${e.clientX}px`;
    node.style.top = `${e.clientY}px`;
    const hit = underPointer(e.clientX, e.clientY);
    const over = hit && hit.closest(".slot");
    slotEls.forEach((s) => s.classList.toggle("hot", s === over));
  });
  el.felt.addEventListener("pointerup", endDrag);
  el.felt.addEventListener("pointercancel", endDrag);
  el.felt.addEventListener("click", (e) => {
    if (phase !== "showdown") return;
    if (e.target.closest("#h1")) highlight(1);
    else if (e.target.closest("#h2")) highlight(2);
    else if (e.target.closest("#dealer")) highlight("d");
  });
  slotEls.forEach((slot) => {
    slot.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      seatInto(Number(slot.dataset.slot));
    });
  });

  document.querySelectorAll("[data-chip]").forEach((btn) => {
    btn.addEventListener("click", () => addChip(Number(btn.dataset.chip)));
  });
  el.undo.addEventListener("click", onUndo);
  el.reset.addEventListener("click", onReset);
  el.go.addEventListener("click", onPrimary);
  el.rerack.addEventListener("click", () => {
    if (busy || live >= 2) return;
    saved = WELCOME;
    live = WELCOME;
    blind = 0;
    undoStack = [];
    showAnte();
    save();
    releaseStatus();
    paint();
  });
  el.raise1.addEventListener("click", () => toggleRaise(1));
  el.raise2.addEventListener("click", () => toggleRaise(2));

  cells(el.dealer, 3);
  cells(el.board, 5);
  load();
  showAnte();
  paint();
})();
