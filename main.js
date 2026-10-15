// 2 Hand Hold'em — site interactions: mobile nav, scroll reveal, split demo.

(() => {
  // ---- Nav ----
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.getElementById("site-nav");
  toggle.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(open));
  });
  nav.addEventListener("click", (e) => {
    if (e.target.closest("a")) {
      nav.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    }
  });

  document.getElementById("year").textContent = new Date().getFullYear();

  // ---- Reveal on scroll ----
  const targets = document.querySelectorAll(".section-head, .steps li, .sidebets, .venues li, .pillars article, .contact-card, .phones, .ip");
  if ("IntersectionObserver" in window && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px" });
    targets.forEach((el) => { el.classList.add("reveal"); io.observe(el); });
  }

  // ---- Split demo ----
  const SUITS = ["♠", "♥", "♦", "♣"];
  const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
  const $ = (id) => document.getElementById(id);
  const el = {
    dealer: $("demo-dealer"), board: $("demo-board"), hole: $("demo-hole"),
    h1: $("demo-h1"), h2: $("demo-h2"), status: $("demo-status"),
    go: $("demo-go"), fresh: $("demo-new"),
  };
  let s;

  function newDeck() {
    const d = [];
    for (let r = 0; r < 13; r++) for (let su = 0; su < 4; su++) d.push({ r: r + 2, s: su });
    for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; }
    return d;
  }

  function cardEl(c, { tag = "div", back = false, ghost = false } = {}) {
    const n = document.createElement(tag);
    n.className = "pc";
    if (ghost) { n.classList.add("ghost"); return n; }
    if (back) { n.classList.add("back"); n.setAttribute("aria-label", "Face-down card"); return n; }
    if (c.s === 1 || c.s === 2) n.classList.add("red");
    n.innerHTML = `${RANKS[c.r - 2]}<i>${SUITS[c.s]}</i>`;
    n.setAttribute("aria-label", `${RANKS[c.r - 2]} of ${["spades", "hearts", "diamonds", "clubs"][c.s]}`);
    if (tag === "button") n.type = "button";
    return n;
  }

  // Hand evaluation: score a 5-card hand as a comparable array.
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
  function best(cards, hole = null, maxHole = 99) {
    let top = null;
    for (const c of combos(cards, 5)) {
      if (hole && c.filter((x) => hole.includes(x)).length > maxHole) continue;
      const sc = score5(c);
      if (!top || cmp(sc, top) > 0) top = sc;
    }
    return top;
  }

  function deal() {
    const d = newDeck();
    s = { hole: d.splice(0, 4), dealer: d.splice(0, 3), flop: d.splice(0, 3), turn: d.pop(), river: d.pop(), h1: [], done: false };
    render();
  }

  function render() {
    el.dealer.replaceChildren(...s.dealer.map((c) => cardEl(c, { back: !s.done })));
    const board = [...s.flop, s.done ? s.turn : null, s.done ? s.river : null];
    el.board.replaceChildren(...board.map((c) => (c ? cardEl(c) : cardEl(null, { ghost: true }))));

    el.hole.replaceChildren(...s.hole.map((c) => {
      const b = cardEl(c, { tag: s.done ? "div" : "button" });
      if (s.h1.includes(c)) b.classList.add("sel");
      if (!s.done) b.addEventListener("click", () => pick(c));
      else b.classList.add("used");
      return b;
    }));

    const h2 = s.h1.length === 2 ? s.hole.filter((c) => !s.h1.includes(c)) : [];
    const fill = (wrap, cards) => {
      const row = wrap.querySelector(".cards");
      const shown = cards.map((c) => cardEl(c));
      while (shown.length < 2) shown.push(cardEl(null, { ghost: true }));
      row.replaceChildren(...shown);
    };
    fill(el.h1, s.h1);
    fill(el.h2, h2);
    el.h1.querySelector(".result").textContent = "";
    el.h2.querySelector(".result").textContent = "";
    el.h1.querySelector(".result").className = "result";
    el.h2.querySelector(".result").className = "result";

    el.go.disabled = s.done || s.h1.length !== 2;
    if (!s.done) {
      el.status.textContent = s.h1.length < 2
        ? `Tap ${2 - s.h1.length} card${s.h1.length === 1 ? "" : "s"} for Hand 1.`
        : "The other two are Hand 2. Ready?";
    } else {
      showdown(h2);
    }
  }

  function pick(c) {
    if (s.h1.includes(c)) s.h1 = s.h1.filter((x) => x !== c);
    else if (s.h1.length < 2) s.h1.push(c);
    else s.h1 = [s.h1[1], c];
    render();
  }

  function showdown(h2) {
    const board = [...s.flop, s.turn, s.river];
    const dealerScore = best([...board, ...s.dealer], s.dealer, 2);
    let wins = 0, losses = 0;
    [[el.h1, s.h1], [el.h2, h2]].forEach(([wrap, hand]) => {
      const sc = best([...board, ...hand]);
      const r = cmp(sc, dealerScore);
      const out = wrap.querySelector(".result");
      if (r > 0) { out.textContent = `${NAMES[sc[0]]} — wins`; out.classList.add("w"); wins++; }
      else if (r < 0) { out.textContent = `${NAMES[sc[0]]} — loses`; out.classList.add("l"); losses++; }
      else { out.textContent = `${NAMES[sc[0]]} — push`; out.classList.add("p"); }
    });
    const dName = NAMES[dealerScore[0]].toLowerCase();
    el.status.textContent =
      wins === 2 ? `Both hands beat the dealer’s ${dName}!` :
      losses === 2 ? `Dealer’s ${dName} takes both. Deal again?` :
      wins === 1 && losses === 1 ? `Split decision vs. the dealer’s ${dName}.` :
      `Dealer shows ${dName}.`;
  }

  el.go.addEventListener("click", () => { s.done = true; render(); });
  el.fresh.addEventListener("click", deal);
  deal();
})();
