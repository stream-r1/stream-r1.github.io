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

/* ============================================================
   Reading-progress bar at top of viewport
   ============================================================ */

function initReadingProgress() {
  const bar = document.querySelector("[data-reading-progress]");
  if (!bar) return;

  let ticking = false;
  function update() {
    const doc = document.documentElement;
    const max = doc.scrollHeight - doc.clientHeight;
    const pct = max > 0 ? (window.scrollY / max) * 100 : 0;
    bar.style.setProperty("--progress", pct + "%");
    ticking = false;
  }
  window.addEventListener(
    "scroll",
    () => {
      if (!ticking) {
        requestAnimationFrame(update);
        ticking = true;
      }
    },
    { passive: true },
  );
  update();
}

/* ============================================================
   Marquees — viewport-aware autoplay
   Each row runs on CSS animation (paused on hover).
   We toggle <video>.play()/.pause() based on whether each clip
   currently intersects the row's visible window, so only the
   videos actually being shown are streaming bytes.
   ============================================================ */

function initMarquees() {
  const rows = Array.from(document.querySelectorAll("[data-marquee]"));
  if (!rows.length) return;

  rows.forEach((row) => {
    const videos = Array.from(row.querySelectorAll("video"));
    if (!videos.length) return;

    // Stagger initial currentTime so identical-source pairs don't sync up
    videos.forEach((v, i) => {
      v.addEventListener(
        "loadedmetadata",
        () => {
          if (isFinite(v.duration) && v.duration > 0.5) {
            const offset = ((i * 0.7) % 1) * Math.min(v.duration, 8);
            try { v.currentTime = offset; } catch (_) {}
          }
        },
        { once: true },
      );
      // Mark wrapper as having data so the shimmer skeleton hides
      v.addEventListener(
        "loadeddata",
        () => {
          const wrap = v.closest(".marquee-video");
          if (wrap) wrap.classList.add("has-data");
        },
        { once: true },
      );
    });

    if (!("IntersectionObserver" in window)) {
      // Fallback: just play them all, browser will manage
      if (!reduced()) videos.forEach(safePlay);
      return;
    }

    const ob = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const v = entry.target;
          if (entry.isIntersecting && !reduced()) {
            // Browser may need preload bump
            if (v.preload === "metadata") v.preload = "auto";
            safePlay(v);
          } else {
            v.pause();
          }
        });
      },
      {
        // Observe relative to the row's visible width — clips outside
        // the masked area are paused to save bandwidth
        root: row,
        rootMargin: "0px -2% 0px -2%",
        threshold: 0,
      },
    );
    videos.forEach((v) => ob.observe(v));
  });

  // Pause everything when tab is hidden
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      rows.forEach((row) =>
        row.querySelectorAll("video").forEach((v) => v.pause()),
      );
    }
  });

  // When entire row is offscreen, drop everything in it
  if ("IntersectionObserver" in window) {
    const rowObs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            entry.target
              .querySelectorAll("video")
              .forEach((v) => v.pause());
          }
        });
      },
      { threshold: 0 },
    );
    rows.forEach((row) => rowObs.observe(row));
  }
}

/* ============================================================
   Fullscreen-on-click for any [data-fullscreen] element.
   When [data-fullscreen-src] is present, the click swaps the
   <video>'s src to the higher-quality source, plays + goes
   fullscreen, then restores the lightweight preview source on
   fullscreen exit.
   ============================================================ */

function initMarqueeFullscreen() {
  const targets = Array.from(document.querySelectorAll("[data-fullscreen]"));
  if (!targets.length) return;

  function requestFs(el) {
    const req =
      el.requestFullscreen ||
      el.webkitRequestFullscreen ||
      el.webkitEnterFullscreen ||
      el.msRequestFullscreen ||
      el.mozRequestFullScreen;
    if (!req) return;
    try {
      const result = req.call(el);
      if (result && typeof result.catch === "function") {
        result.catch(() => {});
      }
    } catch (_) {}
  }

  function urlOf(srcOrRel) {
    try { return new URL(srcOrRel, location.href).href; } catch (_) { return srcOrRel; }
  }

  function swapSource(video, newSrc) {
    if (!video) return;
    if (urlOf(video.src) === urlOf(newSrc)) return;
    if (!video.dataset.previewSrc) {
      video.dataset.previewSrc = video.getAttribute("src") || video.src;
    }
    video.pause();
    video.removeAttribute("src");
    video.load();
    video.src = newSrc;
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
  }

  function restorePreview(video) {
    const preview = video.dataset.previewSrc;
    if (!preview) return;
    if (urlOf(video.src) === urlOf(preview)) return;
    video.pause();
    video.removeAttribute("src");
    video.load();
    video.src = preview;
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.play().catch(() => {});
  }

  function watchFullscreenExit(video) {
    const onChange = () => {
      const fs = document.fullscreenElement || document.webkitFullscreenElement;
      if (!fs) {
        // Exited fullscreen — go back to the lightweight preview
        restorePreview(video);
        document.removeEventListener("fullscreenchange", onChange);
        document.removeEventListener("webkitfullscreenchange", onChange);
        document.removeEventListener("webkitendfullscreen", onChange);
      }
    };
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange);
    document.addEventListener("webkitendfullscreen", onChange);
  }

  targets.forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      const video = el.querySelector("video");
      if (!video) return;

      // Swap to the full-duration source if data-fullscreen-src is set
      const fullSrc = el.dataset.fullscreenSrc;
      if (fullSrc) {
        swapSource(video, fullSrc);
      }

      // Wait for the new source to be playable, then play + go fullscreen
      const launch = () => {
        try { video.currentTime = 0; } catch (_) {}
        // Try requesting fullscreen on the video first (better on mobile),
        // then fall back to the wrapper.
        requestFs(video);
        if (!document.fullscreenElement && !document.webkitFullscreenElement) {
          requestFs(el);
        }
        safePlay(video);
        watchFullscreenExit(video);
      };

      if (fullSrc && video.readyState < 1) {
        const onLoaded = () => {
          video.removeEventListener("loadedmetadata", onLoaded);
          launch();
        };
        video.addEventListener("loadedmetadata", onLoaded);
        // Safety fallback in case metadata event never fires
        setTimeout(() => {
          if (video.readyState < 1) return; // still nothing — bail
          if (!document.fullscreenElement && !document.webkitFullscreenElement) {
            launch();
          }
        }, 1500);
      } else {
        launch();
      }
    });

    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        el.click();
      }
    });
  });
}

/* ============================================================
   Comparison rows — autoplay-on-viewport
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
        row.querySelectorAll("video").forEach((v) => v.pause()),
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
          parseInt(img.dataset.pos, 10) === idx,
        );
      });
    });
    ticks.forEach((tick, i) => tick.classList.toggle("is-active", i === idx));
    const progressPct = max === 0 ? 0 : (idx / max) * 100;
    slider.style.setProperty("--vis-progress", progressPct + "%");
    slider.setAttribute(
      "aria-valuetext",
      "Frame " + (idx + 1) + " of " + (max + 1),
    );

    if (readoutValue) readoutValue.textContent = weights[idx].toFixed(3);
    if (readoutBar) {
      const barPct = ((weights[idx] - 0.5) / (2.5 - 0.5)) * 100;
      readoutBar.style.setProperty(
        "--vis-bar",
        Math.max(0, Math.min(100, barPct)) + "%",
      );
    }
  }

  slider.addEventListener("input", () => {
    setActive(parseInt(slider.value, 10));
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
      try { await navigator.clipboard.writeText(text); return; } catch (_) {}
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
   Scroll reveal — fade + lift sections as they enter view
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
   Boot
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {
  initReadingProgress();
  initMarquees();
  initMarqueeFullscreen();
  initCompareRows();
  initVisSlider();
  initCitationCopy();
  initScrollReveal();
});
