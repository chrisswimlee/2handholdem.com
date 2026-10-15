// 2 Hand Hold'em — site interactions: nav, reveal, hero deal, split demo.

(() => {
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const wait = (ms) => new Promise((r) => setTimeout(r, reduceMotion ? 0 : ms));

  // ---------- Nav ----------
  const header = document.querySelector(".site-header");
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.getElementById("site-nav");
  const setNav = (open) => {
    nav.classList.toggle("open", open);
    toggle.setAttribute("aria-expanded", String(open));
  };
  toggle.addEventListener("click", () => setNav(!nav.classList.contains("open")));
  nav.addEventListener("click", (e) => { if (e.target.closest("a")) setNav(false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") setNav(false); });
  document.addEventListener("click", (e) => {
    if (nav.classList.contains("open") && !e.target.closest(".site-header")) setNav(false);
  });

  document.getElementById("year").textContent = new Date().getFullYear();

  // ---------- Scroll: header state + hero parallax ----------
  const heroArt = document.querySelector(".hero-art");
  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const y = window.scrollY;
      header.classList.toggle("scrolled", y > 8);
      if (!reduceMotion && y < 900) heroArt.style.setProperty("--py", `${y}px`);
      ticking = false;
    });
  };
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // ---------- Reveal on scroll (staggered within each group) ----------
  if ("IntersectionObserver" in window && !reduceMotion) {
    const groups = [".section-head", ".steps li", ".sidebets", ".sidebet-list li", ".venues li", ".pillars article", ".contact-card", ".phones", ".ip", ".casino-cta"];
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px" });
    groups.forEach((sel) => {
      document.querySelectorAll(sel).forEach((el, i) => {
        el.classList.add("reveal");
        el.style.setProperty("--i", String(i % 6));
        io.observe(el);
      });
    });

    // Pause looping hero animations while the hero is off-screen.
    const hero = document.querySelector(".hero");
    new IntersectionObserver(([en]) => hero.classList.toggle("paused", !en.isIntersecting)).observe(hero);
  }

  // ---------- Cards ----------
  const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
  const SUITS = ["♠", "♥", "♦", "♣"];
  const SUIT_CLASS = ["s-s", "s-h", "s-d", "s-c"];
  const SUIT_NAME = ["spades", "hearts", "diamonds", "clubs"];
  const rankOf = (c) => RANKS[c.r - 2];

  function makeCard(c, { down = false, button = false, small = false } = {}) {
    const el = document.createElement(button ? "button" : "span");
    el.className = "card" + (down ? " down" : "") + (small ? " small" : "");
    if (button) el.type = "button";
    const rank = rankOf(c), suit = SUITS[c.s];
    let center;
    if (c.r === 14) center = `<span class="pip ace">${suit}</span>`;
    else if (c.r >= 11) center = `<span class="court"><b>${rank}</b><i>${suit}</i></span>`;
    else center = `<span class="pip">${suit}</span>`;
    el.innerHTML =
      `<span class="card-inner">` +
        `<span class="card-face ${SUIT_CLASS[c.s]}">` +
          `<span class="idx tl"><b>${rank}</b><i>${suit}</i></span>${center}` +
          `<span class="idx br"><b>${rank}</b><i>${suit}</i></span>` +
        `</span>` +
        `<span class="card-back"></span>` +
      `</span>`;
    el.card = c;
    label(el);
    return el;
  }
  function label(el) {
    const c = el.card;
    el.setAttribute("aria-label", el.classList.contains("down") ? "Face-down card" : `${rankOf(c)} of ${SUIT_NAME[c.s]}`);
  }
  function flip(el, faceUp = true) {
    el.classList.toggle("down", !faceUp);
    label(el);
  }
  function ghost() {
    const g = document.createElement("span");
    g.className = "card ghost";
    g.setAttribute("aria-hidden", "true");
    return g;
  }
  function dealInto(row, el, i, from = {}) {
    if (!reduceMotion) {
      el.classList.add("dealing");
      el.style.setProperty("--d", `${i * 70}ms`);
      if (from.x != null) el.style.setProperty("--fx", `${from.x}px`);
      if (from.y != null) el.style.setProperty("--fy", `${from.y}px`);
      el.addEventListener("animationend", () => el.classList.remove("dealing"), { once: true });
    }
    row.appendChild(el);
    return el;
  }

  function newDeck() {
    const d = [];
    for (let r = 2; r <= 14; r++) for (let s = 0; s < 4; s++) d.push({ r, s });
    for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; }
    return d;
  }

  // ---------- Hero: deal four, flip, split into two hands ----------
  const heroDeal = document.getElementById("hero-deal");
  const heroRows = heroDeal.querySelectorAll(".pair-cards");
  let heroBusy = false;

  async function heroRun(cards) {
    heroBusy = true;
    heroDeal.classList.remove("split");
    const els = cards.map((c) => makeCard(c, { down: true }));
    els.forEach((el) => el.setAttribute("aria-hidden", "true"));
    heroRows[0].replaceChildren();
    heroRows[1].replaceChildren();
    els.forEach((el, i) => dealInto(heroRows[i < 2 ? 0 : 1], el, i, { x: 0, y: -160 }));
    await wait(650);
    for (const el of els) { flip(el); await wait(90); }
    await wait(500);
    heroDeal.classList.add("split");
    await wait(700);
    heroBusy = false;
  }
  function heroRandom() {
    // Two pocket pairs make the "two hands" idea read at a glance.
    const d = newDeck();
    const a = d[0], b = d.find((c) => c.r === a.r && c.s !== a.s);
    const pool = d.filter((c) => c.r !== a.r);
    const x = pool[0], y = pool.find((c) => c.r === x.r && c.s !== x.s);
    return [a, b, x, y];
  }
  heroDeal.addEventListener("click", () => { if (!heroBusy) heroRun(heroRandom()); });
  heroRun([{ r: 14, s: 1 }, { r: 14, s: 0 }, { r: 13, s: 2 }, { r: 13, s: 3 }]);

  // ---------- Hand evaluation ----------
  const NAMES = ["High card", "Pair", "Two pair", "Three of a kind", "Straight", "Flush", "Full house", "Four of a kind", "Straight flush"];
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
  const cmp = (a, b) => { for (let i = 0; i < Math.max(a.length, b.length); i++) { const d = (a[i] || 0) - (b[i] || 0); if (d) return d; } return 0; };
  function combos(arr, k) {
    const out = [];
    (function rec(start, pick) {
      if (pick.length === k) { out.push(pick.slice()); return; }
      for (let i = start; i < arr.length; i++) { pick.push(arr[i]); rec(i + 1, pick); pick.pop(); }
    })(0, []);
    return out;
  }
  // Best 5-card hand; optionally limit how many of `hole` may be used (dealer plays at most 2 of 3).
  function best(cards, hole = null, maxHole = 99) {
    let top = null;
    for (const c of combos(cards, 5)) {
      if (hole && c.filter((x) => hole.includes(x)).length > maxHole) continue;
      const score = score5(c);
      if (!top || cmp(score, top.score) > 0) top = { score, cards: c };
    }
    return top;
  }

  // ---------- Split demo ----------
  const $ = (id) => document.getElementById(id);
  const el = {
    dealer: $("demo-dealer"), board: $("demo-board"), hole: $("demo-hole"),
    h1: $("demo-h1"), h2: $("demo-h2"), status: $("demo-status"),
    go: $("demo-go"), fresh: $("demo-new"),
  };
  let s = null;

  function setStatus(text) {
    if (el.status.textContent === text) return;
    el.status.textContent = text;
    el.status.classList.remove("flash");
    void el.status.offsetWidth;
    el.status.classList.add("flash");
  }

  async function deal() {
    const d = newDeck();
    s = {
      hole: d.splice(0, 4), dealer: d.splice(0, 3), flop: d.splice(0, 3), turn: d.pop(), river: d.pop(),
      h1: [], busy: true, done: false, els: new Map(),
    };
    [el.h1, el.h2].forEach((h) => {
      h.classList.remove("win", "lose");
      h.querySelector(".result").textContent = "";
      h.querySelector(".result").className = "result";
      h.querySelector(".hand-chips").replaceChildren();
    });
    el.go.disabled = true;
    setStatus("Dealing…");

    el.hole.replaceChildren();
    el.dealer.replaceChildren();
    el.board.replaceChildren();
    // Deal order: your four, dealer's three, then the flop, turn and river face-down.
    let i = 0;
    s.hole.forEach((c) => {
      const b = dealInto(el.hole, makeCard(c, { down: true, button: true }), i++);
      b.disabled = true;
      b.addEventListener("click", () => pick(c));
      s.els.set(c, b);
    });
    s.dealer.forEach((c) => s.els.set(c, dealInto(el.dealer, makeCard(c, { down: true }), i++)));
    [...s.flop, s.turn, s.river].forEach((c) => s.els.set(c, dealInto(el.board, makeCard(c, { down: true }), i++)));
    renderHands();

    await wait(i * 70 + 350);
    for (const c of s.hole) { flip(s.els.get(c)); await wait(80); }
    await wait(150);
    for (const c of s.flop) { flip(s.els.get(c)); await wait(110); }
    await wait(300);
    s.hole.forEach((c) => (s.els.get(c).disabled = false));
    s.busy = false;
    update();
  }

  function pick(c) {
    if (!s || s.busy || s.done) return;
    if (s.h1.includes(c)) s.h1 = s.h1.filter((x) => x !== c);
    else if (s.h1.length < 2) s.h1.push(c);
    else s.h1 = [s.h1[1], c];
    update();
  }

  function hand2() { return s.h1.length === 2 ? s.hole.filter((c) => !s.h1.includes(c)) : []; }

  function renderHands() {
    const prev = s.shown || { h1: [], h2: [] };
    const next = { h1: s.h1.slice(), h2: hand2() };
    [[el.h1, "h1"], [el.h2, "h2"]].forEach(([wrap, key]) => {
      const row = wrap.querySelector(".cards");
      const kids = next[key].map((c) => {
        const k = makeCard(c, { small: true });
        k.setAttribute("aria-hidden", "true");
        if (!prev[key].includes(c) && !reduceMotion) k.classList.add("pop-in");
        return k;
      });
      while (kids.length < 2) kids.push(ghost());
      row.replaceChildren(...kids);
    });
    s.shown = next;
  }

  function update() {
    const h2 = hand2();
    s.hole.forEach((c) => {
      const b = s.els.get(c);
      if (s.h1.includes(c)) b.dataset.hand = "1";
      else if (h2.includes(c)) b.dataset.hand = "2";
      else delete b.dataset.hand;
      b.setAttribute("aria-pressed", String(s.h1.includes(c)));
    });
    renderHands();
    el.go.disabled = s.busy || s.done || s.h1.length !== 2;
    if (!s.done) {
      setStatus(s.h1.length < 2
        ? `Tap ${2 - s.h1.length} card${s.h1.length === 1 ? "" : "s"} for Hand 1.`
        : "The other two are Hand 2. Ready?");
    }
  }

  async function reveal() {
    if (!s || s.busy || s.done || s.h1.length !== 2) return;
    s.busy = true;
    s.done = true;
    el.go.disabled = true;
    s.hole.forEach((c) => (s.els.get(c).disabled = true));
    setStatus("Turn…");
    flip(s.els.get(s.turn));
    await wait(550);
    setStatus("River…");
    flip(s.els.get(s.river));
    await wait(550);
    setStatus("Dealer shows…");
    for (const c of s.dealer) { flip(s.els.get(c)); await wait(160); }
    await wait(450);
    showdown();
    s.busy = false;
  }

  function chips(n, color) {
    return Array.from({ length: n }, () => {
      const c = document.createElement("span");
      c.className = `chip ${color}`;
      return c;
    });
  }

  function showdown() {
    const board = [...s.flop, s.turn, s.river];
    const dealerBest = best([...board, ...s.dealer], s.dealer, 2);
    // Dim the dealer hole card(s) that didn't play.
    s.dealer.forEach((c) => s.els.get(c).classList.toggle("unused", !dealerBest.cards.includes(c)));

    let wins = 0, losses = 0;
    [[el.h1, s.h1], [el.h2, hand2()]].forEach(([wrap, hand]) => {
      const mine = best([...board, ...hand]).score;
      const r = cmp(mine, dealerBest.score);
      const out = wrap.querySelector(".result");
      const name = NAMES[mine[0]];
      if (r > 0) {
        out.textContent = `${name} · Win`; out.classList.add("w"); wrap.classList.add("win"); wins++;
        wrap.querySelector(".hand-chips").replaceChildren(...chips(3, "chip-gold"));
      } else if (r < 0) {
        out.textContent = `${name} · Lose`; out.classList.add("l"); wrap.classList.add("lose"); losses++;
      } else {
        out.textContent = `${name} · Push`; out.classList.add("p");
      }
    });
    const dName = NAMES[dealerBest.score[0]].toLowerCase();
    setStatus(
      wins === 2 ? `Both hands beat the dealer’s ${dName}!` :
      losses === 2 ? `Dealer’s ${dName} takes both. Deal again?` :
      wins === 1 && losses === 1 ? `Split decision vs. the dealer’s ${dName}.` :
      wins === 1 ? `One win, one push vs. ${dName}.` :
      losses === 1 ? `One loss, one push vs. ${dName}.` :
      `Two pushes vs. the dealer’s ${dName}.`
    );
  }

  async function collectAndDeal() {
    if (s && s.busy) return;
    if (s && !reduceMotion) {
      s.busy = true;
      document.querySelectorAll("#demo-felt .card:not(.ghost)").forEach((c, i) => {
        c.style.transitionDelay = `${i * 18}ms`;
        c.classList.add("collect");
      });
      await wait(450);
    }
    deal();
  }

  el.go.addEventListener("click", reveal);
  el.fresh.addEventListener("click", collectAndDeal);

  // Deal the demo when it first scrolls into view so the animation is seen.
  const demoEl = $("demo");
  if ("IntersectionObserver" in window) {
    const dio = new IntersectionObserver(([en]) => {
      if (en.isIntersecting) { dio.disconnect(); deal(); }
    }, { threshold: 0.25 });
    dio.observe(demoEl);
  } else {
    deal();
  }
})();
