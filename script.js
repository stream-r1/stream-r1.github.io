/* ============================================================
   Stream-R1 — paper page interactivity
   ============================================================ */

const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
const reduced = () => motionQuery.matches;

function safePlay(video) {
  if (!video) return;
  const p = video.play();
  if (p && typeof p.catch === "function") p.catch(() => {});
}

function pad(n) {
  return n < 10 ? "0" + n : "" + n;
}

function formatTime(seconds) {
  if (!isFinite(seconds) || seconds < 0) seconds = 0;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return m + ":" + pad(s);
}

/* ============================================================
   Long Video Stage — featured player + 8 case thumbs + timeline
   ============================================================ */

function initLongVideoStage() {
  const stage = document.querySelector("[data-stage]");
  if (!stage) return;

  const featured = stage.querySelector("[data-stage-video]");
  const caseLabel = stage.querySelector("[data-stage-case-label]");
  const cases = Array.from(stage.querySelectorAll(".case-thumb"));
  const track = stage.querySelector("[data-timeline-track]");
  const progress = stage.querySelector("[data-timeline-progress]");
  const thumb = stage.querySelector("[data-timeline-thumb]");
  const elapsed = stage.querySelector("[data-timeline-elapsed]");
  const markers = Array.from(stage.querySelectorAll(".timeline-mark"));

  // Marker positions in seconds (used for jump targets and "current" highlight)
  const markerSeconds = { "10s": 10, "30s": 30, "60s": 60, "120s": 120, "180s": 180 };

  if (!featured) return;

  // === Case switching ===
  function setCase(caseId, fromUser) {
    cases.forEach((c) => {
      const active = c.dataset.case === caseId;
      c.classList.toggle("is-active", active);
      c.setAttribute("aria-selected", active ? "true" : "false");
      const numLabel = caseLabel && active
        ? "Case " + (c.dataset.label || "")
        : null;
      if (numLabel) caseLabel.textContent = numLabel;
    });

    const newSrc = "case/180s/" + caseId + ".mp4";
    if (featured.src.endsWith(newSrc)) return;

    featured.classList.add("is-swapping");
    featured.pause();
    featured.removeAttribute("src");
    featured.load();
    featured.src = newSrc;
    featured.preload = "auto";

    const ready = () => {
      featured.classList.remove("is-swapping");
      if (!reduced()) safePlay(featured);
      featured.removeEventListener("loadeddata", ready);
    };
    featured.addEventListener("loadeddata", ready);

    // Reset timeline
    if (progress) progress.style.width = "0%";
    if (thumb) thumb.style.left = "0%";
    if (elapsed) elapsed.textContent = "0:00";
    markers.forEach((m) => m.classList.remove("is-current"));
  }

  cases.forEach((c) => {
    c.addEventListener("click", () => setCase(c.dataset.case, true));
    c.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        c.click();
      }
    });
  });

  // === Timeline progression ===
  function update() {
    const dur = featured.duration;
    if (!isFinite(dur) || dur <= 0) return;
    const pct = Math.max(0, Math.min(100, (featured.currentTime / dur) * 100));
    if (progress) progress.style.width = pct + "%";
    if (thumb) thumb.style.left = pct + "%";
    if (elapsed) elapsed.textContent = formatTime(featured.currentTime);

    // Highlight nearest milestone marker as "current"
    const t = featured.currentTime;
    let active = null;
    markers.forEach((m) => {
      const ms = markerSeconds[m.dataset.mark];
      if (ms !== undefined && t + 0.5 >= ms - 4) active = m;
    });
    markers.forEach((m) => m.classList.toggle("is-current", m === active));
  }

  featured.addEventListener("timeupdate", update);
  featured.addEventListener("loadedmetadata", update);

  // === Click on track or marker to seek ===
  function seekFromEvent(e) {
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const ratio = Math.max(0, Math.min(1, x / rect.width));
    if (isFinite(featured.duration) && featured.duration > 0) {
      featured.currentTime = ratio * featured.duration;
    }
  }

  if (track) {
    track.addEventListener("click", seekFromEvent);
    // Drag to scrub
    let dragging = false;
    track.addEventListener("pointerdown", (e) => {
      dragging = true;
      track.setPointerCapture(e.pointerId);
      seekFromEvent(e);
    });
    track.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      seekFromEvent(e);
    });
    track.addEventListener("pointerup", (e) => {
      dragging = false;
      try { track.releasePointerCapture(e.pointerId); } catch (_) {}
    });
    track.addEventListener("pointercancel", () => { dragging = false; });
  }

  markers.forEach((m) => {
    m.style.pointerEvents = "auto";
    m.style.cursor = "pointer";
    m.addEventListener("click", () => {
      const ms = markerSeconds[m.dataset.mark];
      if (ms !== undefined && isFinite(featured.duration)) {
        featured.currentTime = Math.min(ms, featured.duration);
        if (!reduced()) safePlay(featured);
      }
    });
  });

  // Initial: ensure featured plays
  if (!reduced()) safePlay(featured);

  // Pause when far off-screen for bandwidth, resume in view
  if ("IntersectionObserver" in window) {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            if (!reduced()) safePlay(featured);
          } else {
            featured.pause();
          }
        });
      },
      { threshold: 0.15 },
    );
    obs.observe(stage.querySelector(".stage-feature"));
  }

  // Auto-play case thumbnails when in view (low cost — 10s clips)
  if ("IntersectionObserver" in window) {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const v = entry.target.querySelector("video");
          if (!v) return;
          if (entry.isIntersecting && !reduced()) safePlay(v);
          else v.pause();
        });
      },
      { threshold: 0.25 },
    );
    cases.forEach((c) => obs.observe(c));
  }
}

/* ============================================================
   Comparison rows — autoplay-on-viewport instead of hover
   ============================================================ */

function initCompareRows() {
  const rows = Array.from(document.querySelectorAll(".compare-row"));
  if (!rows.length) return;

  rows.forEach((row) => {
    const videos = Array.from(row.querySelectorAll("video"));
    row.addEventListener("click", () => {
      const anyPaused = videos.some((v) => v.paused);
      if (anyPaused) {
        videos.forEach((v) => { v.currentTime = 0; });
        videos.forEach(safePlay);
      } else {
        videos.forEach((v) => v.pause());
      }
    });
  });

  if ("IntersectionObserver" in window) {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const videos = entry.target.querySelectorAll("video");
          if (entry.isIntersecting) {
            entry.target.classList.add("is-active");
            if (!reduced()) {
              // Sync starts to make Reward-Forcing vs Stream-R1 comparable
              videos.forEach((v) => { if (v.paused) v.currentTime = 0; });
              videos.forEach(safePlay);
            }
          } else {
            entry.target.classList.remove("is-active");
            videos.forEach((v) => v.pause());
          }
        });
      },
      { threshold: 0.4 },
    );
    rows.forEach((row) => obs.observe(row));
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      rows.forEach((row) =>
        row.querySelectorAll("video").forEach((v) => v.pause())
      );
    }
  });
}

/* ============================================================
   Saliency slider with temporal-weight readout
   ============================================================ */

function initVisSlider() {
  const root = document.querySelector("[data-vis]");
  if (!root) return;

  const slider = root.querySelector(".vis-slider");
  const ticks = Array.from(root.querySelectorAll(".vis-ticks span"));
  const stacks = Array.from(root.querySelectorAll(".vis-img-stack"));
  const readoutValue = root.querySelector("[data-vis-readout-value]");
  const readoutBar = root.querySelector("[data-vis-readout-bar]");
  if (!slider) return;

  const max = parseInt(slider.max, 10) || 3;

  // Linear interpolation 0.587 -> 2.117 across 4 frames
  const wMin = 0.587;
  const wMax = 2.117;
  const weights = [];
  for (let i = 0; i <= max; i++) {
    weights.push(wMin + ((wMax - wMin) * i) / max);
  }

  function setActive(idx) {
    stacks.forEach((stack) => {
      stack.querySelectorAll(".vis-img").forEach((img) => {
        img.classList.toggle(
          "is-active",
          parseInt(img.dataset.pos, 10) === idx
        );
      });
    });
    ticks.forEach((tick, i) => tick.classList.toggle("is-active", i === idx));
    const progressPct = max === 0 ? 0 : (idx / max) * 100;
    slider.style.setProperty("--vis-progress", progressPct + "%");
    slider.setAttribute("aria-valuetext", "Frame " + (idx + 1) + " of " + (max + 1));

    // Animate readout value
    if (readoutValue) {
      readoutValue.textContent = weights[idx].toFixed(3);
    }
    if (readoutBar) {
      // Bar from 0 (at w=0.5) to 100% (at w=2.5) — stretch a bit beyond endpoints
      const barPct =
        ((weights[idx] - 0.5) / (2.5 - 0.5)) * 100;
      readoutBar.style.setProperty(
        "--vis-bar",
        Math.max(0, Math.min(100, barPct)) + "%"
      );
    }
  }

  slider.addEventListener("input", () => {
    const idx = parseInt(slider.value, 10);
    setActive(idx);
  });

  ticks.forEach((tick, i) => {
    tick.style.cursor = "pointer";
    tick.addEventListener("click", () => {
      slider.value = String(i);
      setActive(i);
    });
  });

  setActive(parseInt(slider.value, 10) || 0);
}

/* ============================================================
   Citation copy
   ============================================================ */

function initCitationCopy() {
  const button = document.querySelector(".copy-citation-btn");
  const citation = document.querySelector(".citation-block code");
  if (!button || !citation) return;

  const reset = () => {
    button.classList.remove("is-copied");
    button.setAttribute("aria-label", "Copy citation");
    button.title = "Copy citation";
  };

  const copyText = async (text) => {
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        return;
      } catch (_) { /* fall through */ }
    }
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  };

  button.addEventListener("click", async () => {
    try {
      await copyText(citation.textContent.trim());
      button.classList.add("is-copied");
      button.setAttribute("aria-label", "Citation copied");
      button.title = "Citation copied";
      window.setTimeout(reset, 1600);
    } catch (_) {
      button.setAttribute("aria-label", "Copy failed");
      button.title = "Copy failed";
      window.setTimeout(reset, 1600);
    }
  });
}

/* ============================================================
   Scroll reveal — fade-in + lift sections as they enter view
   ============================================================ */

function initScrollReveal() {
  if (reduced() || !("IntersectionObserver" in window)) {
    document
      .querySelectorAll(".reveal")
      .forEach((el) => el.classList.add("is-revealed"));
    return;
  }

  const obs = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-revealed");
          obs.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
  );

  document.querySelectorAll(".reveal").forEach((el) => obs.observe(el));
}

/* ============================================================
   Win-rate bars — re-trigger fill animation when scrolled into view
   ============================================================ */

function initWinrateReveal() {
  const grid = document.querySelector("[data-winrates]");
  if (!grid) return;

  const rows = Array.from(grid.querySelectorAll(".winrate-row"));

  if (reduced() || !("IntersectionObserver" in window)) {
    rows.forEach((r) => r.classList.add("is-revealed"));
    return;
  }

  const obs = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          rows.forEach((r, i) => {
            window.setTimeout(
              () => r.classList.add("is-revealed"),
              i * 90,
            );
          });
          obs.disconnect();
        }
      });
    },
    { threshold: 0.4 },
  );
  obs.observe(grid);
}

/* ============================================================
   Hero metric counter — count up from 0 once on first view
   ============================================================ */

function initMetricCounters() {
  const dds = Array.from(document.querySelectorAll(".hero-metrics dd"));
  if (!dds.length) return;
  if (reduced() || !("IntersectionObserver" in window)) return;

  const animate = (el) => {
    const text = el.textContent.trim();
    const numMatch = text.match(/^([\d.]+)/);
    if (!numMatch) return;
    const target = parseFloat(numMatch[1]);
    if (!isFinite(target) || target === 0) return;
    const decimals = (numMatch[1].split(".")[1] || "").length;
    const suffix = text.slice(numMatch[1].length);

    const dur = 1100;
    const start = performance.now();
    function tick(now) {
      const t = Math.min(1, (now - start) / dur);
      // ease-out-cubic
      const eased = 1 - Math.pow(1 - t, 3);
      const v = target * eased;
      el.textContent = v.toFixed(decimals) + suffix;
      if (t < 1) requestAnimationFrame(tick);
      else el.textContent = numMatch[1] + suffix;
    }
    requestAnimationFrame(tick);
  };

  const obs = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          animate(entry.target);
          obs.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.5 },
  );
  dds.forEach((dd) => obs.observe(dd));
}

/* ============================================================
   Boot
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {
  initLongVideoStage();
  initCompareRows();
  initVisSlider();
  initCitationCopy();
  initScrollReveal();
  initWinrateReveal();
  initMetricCounters();
});
