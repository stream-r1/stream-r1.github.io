function initVideoPreviews() {
  const items = Array.from(document.querySelectorAll(".video-item"));
  if (!items.length) return;

  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  const setActiveState = (item, active) => {
    item.classList.toggle("is-active", active);
    item.setAttribute("aria-pressed", active ? "true" : "false");
    item.dataset.locked = active ? "true" : "false";
  };

  const pauseItem = (item, force = false) => {
    const video = item.querySelector("video");
    if (!video) return;
    if (!force && item.dataset.locked === "true") return;
    video.pause();
    setActiveState(item, false);
  };

  const pauseAll = (exceptItem = null) => {
    items.forEach((item) => {
      if (item === exceptItem) return;
      pauseItem(item, true);
    });
  };

  const playItem = (item, persist = false) => {
    const video = item.querySelector("video");
    if (!video) return;

    pauseAll(item);
    const promise = video.play();
    setActiveState(item, persist);

    if (promise && typeof promise.catch === "function") {
      promise.catch(() => {
        setActiveState(item, false);
      });
    }
  };

  items.forEach((item) => {
    const video = item.querySelector("video");
    const prompt = item.querySelector(".video-prompt")?.textContent?.trim();
    if (!video) return;

    item.tabIndex = 0;
    item.setAttribute("role", "button");
    item.setAttribute("aria-pressed", "false");
    item.dataset.locked = "false";
    if (prompt) {
      item.setAttribute("aria-label", `${prompt} preview`);
    }

    video.autoplay = false;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.pause();

    item.addEventListener("mouseenter", () => {
      if (motionQuery.matches) return;
      playItem(item, false);
    });

    item.addEventListener("focusin", () => {
      if (motionQuery.matches) return;
      playItem(item, false);
    });

    item.addEventListener("mouseleave", () => {
      pauseItem(item);
    });

    item.addEventListener("focusout", () => {
      pauseItem(item);
    });

    item.addEventListener("click", () => {
      if (item.dataset.locked === "true") {
        pauseItem(item, true);
        return;
      }
      playItem(item, true);
    });

    item.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        item.click();
      }
    });
  });

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            pauseItem(entry.target, true);
          }
        });
      },
      { threshold: 0.25 },
    );

    items.forEach((item) => observer.observe(item));
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      pauseAll();
    }
  });
}

function initShowcaseVideos() {
  const cards = Array.from(document.querySelectorAll(".showcase-card"));
  if (!cards.length) return;

  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  const stopCard = (card, reset = false) => {
    const video = card.querySelector(".showcase-video");
    if (!video) return;
    video.pause();
    if (reset) {
      video.currentTime = 0;
    }
    card.classList.remove("is-playing");
  };

  const stopAll = (exceptCard = null) => {
    cards.forEach((card) => {
      if (card !== exceptCard) stopCard(card);
    });
  };

  const playCard = (card) => {
    if (motionQuery.matches) return;
    const video = card.querySelector(".showcase-video");
    if (!video) return;

    stopAll(card);
    video.muted = true;
    video.loop = true;
    video.playsInline = true;

    const promise = video.play();
    if (promise && typeof promise.then === "function") {
      promise
        .then(() => card.classList.add("is-playing"))
        .catch(() => card.classList.remove("is-playing"));
      return;
    }

    card.classList.add("is-playing");
  };

  cards.forEach((card) => {
    const video = card.querySelector(".showcase-video");
    if (!video) return;

    video.autoplay = false;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.pause();

    card.addEventListener("mouseenter", () => playCard(card));
    card.addEventListener("focusin", () => playCard(card));
    card.addEventListener("mouseleave", () => stopCard(card));
    card.addEventListener("focusout", () => stopCard(card));
  });

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            stopCard(entry.target, true);
          }
        });
      },
      { threshold: 0.1 },
    );

    cards.forEach((card) => observer.observe(card));
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stopAll();
    }
  });
}

function initCitationCopy() {
  const button = document.querySelector(".copy-citation-btn");
  const citation = document.querySelector(".citation-block code");
  if (!button || !citation) return;

  const resetButton = () => {
    button.classList.remove("is-copied");
    button.setAttribute("aria-label", "Copy citation");
    button.title = "Copy citation";
  };

  const copyWithFallback = async (text) => {
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        return;
      } catch {
        // Continue to the selection-based fallback below.
      }
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.top = "-9999px";
    document.body.append(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  };

  button.addEventListener("click", async () => {
    try {
      await copyWithFallback(citation.textContent.trim());
      button.classList.add("is-copied");
      button.setAttribute("aria-label", "Citation copied");
      button.title = "Citation copied";
      window.setTimeout(resetButton, 1600);
    } catch {
      button.setAttribute("aria-label", "Copy failed");
      button.title = "Copy failed";
      window.setTimeout(resetButton, 1600);
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initShowcaseVideos();
  initVideoPreviews();
  initCitationCopy();
});
