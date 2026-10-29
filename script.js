// script.js: everything on the homepage that moves.

const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const canHover = window.matchMedia("(hover: hover)").matches;

const hero = document.querySelector(".hero-inner");
const title = document.querySelector(".hero-title");
const lens = document.querySelector(".lens");

// ---------- 1. Headline letters rise in one after another ----------
// "Content" becomes <span class="word"><span class="ch">C</span><span class="ch">o</span>…</span>
let n = 0;
title.querySelectorAll(".l1, .l2").forEach((line) => {
  const word = document.createElement("span");
  word.className = "word";
  for (const letter of line.textContent.trim()) {
    const ch = document.createElement("span");
    ch.className = "ch";
    ch.textContent = letter;
    ch.style.animationDelay = (0.15 + n * 0.05) + "s";
    word.appendChild(ch);
    n++;
  }
  line.replaceChildren(word);
});

// ---------- 2. The glass lens ----------
// A copy of the headline sits inside the lens. We move the lens, and move the
// copy the opposite way, so the copy always lines up with the real headline.
const copy = title.cloneNode(true);
copy.removeAttribute("aria-label");
lens.appendChild(copy);

const zoom = 1.18;
let pos = { x: 0, y: 0 };          // where the lens is now
let target = null;                 // the mouse position, when the mouse is over the hero

function placeLens(x, y) {
  const r = lens.offsetWidth / 2;
  lens.style.transform = `translate(${x - r}px, ${y - r}px)`;
  copy.style.width = title.offsetWidth + "px";
  copy.style.left = (title.offsetLeft - x + r) + "px";
  copy.style.top = (title.offsetTop - y + r) + "px";
  copy.style.transformOrigin = `${x - title.offsetLeft}px ${y - title.offsetTop}px`;
  copy.style.transform = `scale(${zoom})`;
}

// When nobody is moving the mouse, the lens drifts along a slow figure-of-eight over the words
function idlePoint(t) {
  const w = title.offsetWidth, h = title.offsetHeight;
  return {
    x: title.offsetLeft + w * (0.5 + 0.42 * Math.sin(t / 2600)),
    y: title.offsetTop + h * (0.5 + 0.3 * Math.sin(t / 1300)),
  };
}

function tick(t) {
  const goal = target || idlePoint(t);
  pos.x += (goal.x - pos.x) * 0.08;   // ease toward the goal: smooth, never jumpy
  pos.y += (goal.y - pos.y) * 0.08;
  placeLens(pos.x, pos.y);
  requestAnimationFrame(tick);
}

if (calm) {
  lens.remove();
} else {
  pos = idlePoint(0);
  requestAnimationFrame(tick);
  if (canHover) {
    document.querySelector(".hero").addEventListener("mousemove", (e) => {
      const box = hero.getBoundingClientRect();
      target = { x: e.clientX - box.left, y: e.clientY - box.top };
    });
    document.querySelector(".hero").addEventListener("mouseleave", () => (target = null));
  }
}

// ---------- 3. Scrolling: headline lifts and blurs away, background changes colour ----------
const root = document.documentElement;
function onScroll() {
  const p = Math.min(window.scrollY / window.innerHeight, 1);   // 0 at top, 1 after one screen
  if (!calm) {
    hero.style.transform = `translateY(calc(-55% - ${p * 30}vh))`;
    hero.style.filter = `blur(${p * 14}px)`;
    hero.style.opacity = 1 - p * 1.1;
  }
  root.style.setProperty("--mix", Math.min(p * 1.3, 1));        // cool blue → colourful
  root.style.setProperty("--lens-fade", 1 - p * 2);
}
window.addEventListener("scroll", onScroll, { passive: true });
onScroll();

// ---------- 4. Things slide up and sharpen as they scroll into view ----------
const watcher = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add("in");
      watcher.unobserve(entry.target);
    }
  });
}, { threshold: 0.2 });
document.querySelectorAll(".reveal").forEach((el) => watcher.observe(el));

// ---------- 5. The card deck ----------
const cards = [...document.querySelectorAll(".deck-card")];
const dots = document.querySelector(".dots");
const count = document.querySelector(".count");
let current = 0;
let timer;

cards.forEach((_, i) => {
  const dot = document.createElement("button");
  dot.setAttribute("aria-label", "Show card " + (i + 1));
  dot.addEventListener("click", () => show(i, true));
  dots.appendChild(dot);
});

function show(i, byHand) {
  const prev = current;
  current = (i + cards.length) % cards.length;
  cards.forEach((card, k) => {
    // How far behind the front card is this one? 0 = front, 1 and 2 peek out behind.
    const depth = (k - current + cards.length) % cards.length;
    card.dataset.pos = k === prev && k !== current ? "out" : depth <= 2 ? String(depth) : "hidden";
  });
  dots.querySelectorAll("button").forEach((d, k) => d.classList.toggle("on", k === current));
  count.textContent = String(current + 1).padStart(2, "0") + " / " + String(cards.length).padStart(2, "0");
  if (byHand) restart();   // after a click, wait a full interval before moving on
}

let filmPlaying = false;
function restart() {
  clearInterval(timer);
  if (!calm && !filmPlaying && deckVisible) timer = setInterval(() => show(current + 1), 4000);
}

document.querySelector(".prev").addEventListener("click", () => show(current - 1, true));
document.querySelector(".next").addEventListener("click", () => show(current + 1, true));

// Only cycle while the deck is actually on screen, so nobody misses the first card
const deck = document.querySelector(".deck");
let deckVisible = false;
new IntersectionObserver(([entry]) => {
  deckVisible = entry.isIntersecting;
  deckVisible ? restart() : clearInterval(timer);
}, { threshold: 0.3 }).observe(deck);

// Swipe left/right on phones
let startX = null;
deck.addEventListener("touchstart", (e) => (startX = e.touches[0].clientX), { passive: true });
deck.addEventListener("touchend", (e) => {
  if (startX === null) return;
  const dx = e.changedTouches[0].clientX - startX;
  if (Math.abs(dx) > 40) show(current + (dx < 0 ? 1 : -1), true);
  startX = null;
});

show(0);
restart();

// ---------- 6. Hover a video thumbnail to play a few silent seconds ----------
if (canHover && !calm) {
  document.querySelectorAll(".video a").forEach((link) => {
    const id = new URL(link.href).searchParams.get("v");
    let wait;
    link.addEventListener("mouseenter", () => {
      wait = setTimeout(() => {
        const player = document.createElement("iframe");
        player.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=1&controls=0&start=45&playsinline=1&loop=1&playlist=${id}`;
        player.allow = "autoplay";
        player.title = "Video preview";
        // stay hidden until YouTube's start-up overlay has faded
        player.addEventListener("load", () => setTimeout(() => player.classList.add("ready"), 2200));
        link.appendChild(player);
      }, 300);
    });
    link.addEventListener("mouseleave", () => {
      clearTimeout(wait);
      link.querySelector("iframe")?.remove();
    });
  });
}

// ---------- 7. Click the film poster to play it from Google Drive ----------
document.querySelectorAll(".film").forEach((poster) => {
  poster.addEventListener("click", () => {
    filmPlaying = true;     // don't flip the card away mid-film
    clearInterval(timer);
    const player = document.createElement("iframe");
    player.src = `https://drive.google.com/file/d/${poster.dataset.drive}/preview`;
    player.allow = "autoplay; fullscreen";
    player.allowFullscreen = true;
    player.title = "The Proposal Paradox";
    poster.replaceChildren(player);
  }, { once: true });
});
