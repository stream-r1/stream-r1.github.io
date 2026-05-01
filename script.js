const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
const prefersReducedMotion = () => motionQuery.matches;

function safePlay(video) {
  if (!video) return;
  const promise = video.play();
  if (promise && typeof promise.catch === "function") {
    promise.catch(() => {});
  }
}

function initDurationShowcase() {
  const tabsContainer = document.querySelector(".duration-tabs");
  const grid = document.querySelector("[data-duration-grid]");
  if (!tabsContainer || !grid) return;

  const tabs = Array.from(tabsContainer.querySelectorAll(".duration-tab"));
  const indicator = tabsContainer.querySelector(".duration-indicator");
  const cards = Array.from(grid.querySelectorAll(".video-card"));

  function moveIndicator(activeTab) {
    if (!indicator || !activeTab) return;
    const containerRect = tabsContainer.getBoundingClientRect();
    const tabRect = activeTab.getBoundingClientRect();
    indicator.style.left = `${tabRect.left - containerRect.left}px`;
    indicator.style.width = `${tabRect.width}px`;
  }

  function setDuration(duration, focusTab) {
    tabs.forEach((tab) => {
      const active = tab.dataset.duration === duration;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", active ? "true" : "false");
      if (active) {
        moveIndicator(tab);
        if (focusTab) tab.focus();
      }
    });

    cards.forEach((card) => {
      const caseId = card.dataset.case;
      const video = card.querySelector("video");
      if (!video) return;
      const wasPlaying = !video.paused;
      const newSrc = `case/${duration}/${caseId}.mp4`;

      // Avoid reloading if the source is unchanged.
      if (video.src.endsWith(newSrc)) return;

      card.classList.add("is-loading");
      video.pause();
      video.removeAttribute("src");
      video.load();
      video.src = newSrc;
      video.preload = "metadata";

      const onCanPlay = () => {
        card.classList.remove("is-loading");
        if (wasPlaying && !prefersReducedMotion()) safePlay(video);
        video.removeEventListener("loadeddata", onCanPlay);
      };
      video.addEventListener("loadeddata", onCanPlay);
    });
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => setDuration(tab.dataset.duration));
    tab.addEventListener("keydown", (event) => {
      const idx = tabs.indexOf(tab);
      if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        event.preventDefault();
        const dir = event.key === "ArrowRight" ? 1 : -1;
        const next = tabs[(idx + dir + tabs.length) % tabs.length];
        setDuration(next.dataset.duration, true);
      }
    });
  });

  // Initial indicator position.
  const active = tabs.find((tab) => tab.classList.contains("is-active")) || tabs[0];
  if (active) moveIndicator(active);
  // Re-measure after fonts load and on resize.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => moveIndicator(active));
  }
  window.addEventListener("resize", () => {
    const a = tabs.find((tab) => tab.classList.contains("is-active"));
    if (a) moveIndicator(a);
  });
}

function initHoverVideoCards() {
  const cards = Array.from(document.querySelectorAll(".video-card"));
  if (!cards.length) return;

  cards.forEach((card) => {
    const video = card.querySelector("video");
    if (!video) return;
    card.tabIndex = 0;
    card.setAttribute("role", "button");

    const play = () => {
      if (prefersReducedMotion()) return;
      safePlay(video);
      card.classList.add("is-active");
    };
    const pause = () => {
      video.pause();
      card.classList.remove("is-active");
    };

    card.addEventListener("mouseenter", play);
    card.addEventListener("focusin", play);
    card.addEventListener("mouseleave", pause);
    card.addEventListener("focusout", pause);
    card.addEventListener("click", () => {
      if (video.paused) play();
      else pause();
    });
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        card.click();
      }
    });
  });

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            const video = entry.target.querySelector("video");
            if (video) {
              video.pause();
              entry.target.classList.remove("is-active");
            }
          }
        });
      },
      { threshold: 0.2 },
    );
    cards.forEach((card) => observer.observe(card));
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      cards.forEach((card) => {
        const video = card.querySelector("video");
        if (video) video.pause();
        card.classList.remove("is-active");
      });
    }
  });
}

function initCompareRows() {
  const rows = Array.from(document.querySelectorAll(".compare-row"));
  if (!rows.length) return;

  rows.forEach((row) => {
    const videos = Array.from(row.querySelectorAll("video"));
    if (!videos.length) return;

    const playAll = () => {
      if (prefersReducedMotion()) return;
      videos.forEach((v) => {
        v.currentTime = 0;
      });
      videos.forEach(safePlay);
    };
    const pauseAll = () => {
      videos.forEach((v) => v.pause());
    };

    row.addEventListener("mouseenter", playAll);
    row.addEventListener("mouseleave", pauseAll);
    row.addEventListener("focusin", playAll);
    row.addEventListener("focusout", pauseAll);
    row.tabIndex = 0;
    row.addEventListener("click", () => {
      if (videos[0]?.paused) playAll();
      else pauseAll();
    });
  });

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            entry.target
              .querySelectorAll("video")
              .forEach((v) => v.pause());
          }
        });
      },
      { threshold: 0.15 },
    );
    rows.forEach((row) => observer.observe(row));
  }
}

function initVisSlider() {
  const root = document.querySelector("[data-vis]");
  if (!root) return;

  const slider = root.querySelector(".vis-slider");
  const ticks = Array.from(root.querySelectorAll(".vis-ticks span"));
  const stacks = Array.from(root.querySelectorAll(".vis-img-stack"));
  if (!slider) return;

  const max = parseInt(slider.max, 10) || 3;

  function setActive(idx) {
    stacks.forEach((stack) => {
      const imgs = stack.querySelectorAll(".vis-img");
      imgs.forEach((img) => {
        img.classList.toggle("is-active", parseInt(img.dataset.pos, 10) === idx);
      });
    });
    ticks.forEach((tick, i) => tick.classList.toggle("is-active", i === idx));
    const progress = max === 0 ? 0 : (idx / max) * 100;
    slider.style.setProperty("--vis-progress", `${progress}%`);
    slider.setAttribute("aria-valuetext", `Case ${idx + 1} of ${max + 1}`);
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
      } catch {
        // fall through to fallback
      }
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
    } catch {
      button.setAttribute("aria-label", "Copy failed");
      button.title = "Copy failed";
      window.setTimeout(reset, 1600);
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initDurationShowcase();
  initHoverVideoCards();
  initCompareRows();
  initVisSlider();
  initCitationCopy();
});
