const NASA_APOD_URL = "https://api.nasa.gov/planetary/apod";
const API_KEY = "XSjzWDbBOmtdKpUtJhsWWiW7AuhI1z47h5eu9exc"; // Replace with your NASA API key.

const APOD_FIRST_DATE = "1995-06-16";

const form = document.getElementById("search-form");
const startDateInput = document.getElementById("start-date");
const endDateInput = document.getElementById("end-date");
const statusEl = document.getElementById("status");
const galleryEl = document.getElementById("gallery");
const searchBtn = document.getElementById("search-btn");
const modalEl = document.getElementById("image-modal");
const modalCloseBtn = document.getElementById("modal-close");
const modalImageEl = document.getElementById("modal-image");
const modalTitleEl = document.getElementById("modal-title");
const modalDateEl = document.getElementById("modal-date");
const modalExplanationEl = document.getElementById("modal-explanation");
let statusClearTimerId = null;

function getTodayISO() {
  return new Date().toISOString().slice(0, 10);
}

function getSanitizedApiKey() {
  return API_KEY.trim();
}

function formatShortDate(isoDate) {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function setStatus(message, isError = false, customColor = "") {
  if (statusClearTimerId) {
    clearTimeout(statusClearTimerId);
    statusClearTimerId = null;
  }

  statusEl.textContent = message;
  if (customColor) {
    statusEl.style.color = customColor;
    return;
  }

  statusEl.style.color = isError ? "#f64137" : "#4f4f4f";
}

function clearStatusAfterDelay(delayMs = 1500) {
  statusClearTimerId = setTimeout(() => {
    statusEl.textContent = "";
    statusEl.style.color = "#4f4f4f";
    statusClearTimerId = null;
  }, delayMs);
}

function getDefaultDateRange() {
  const today = new Date();
  const end = today.toISOString().slice(0, 10);

  const weekAgo = new Date(today);
  weekAgo.setDate(today.getDate() - 6);
  const start = weekAgo.toISOString().slice(0, 10);

  return { start, end };
}

function buildAPODQuery(startDate, endDate) {
  const params = new URLSearchParams({
    api_key: getSanitizedApiKey(),
    start_date: startDate,
    end_date: endDate,
    thumbs: "true",
  });

  return `${NASA_APOD_URL}?${params.toString()}`;
}

function validateDates(startDate, endDate) {
  if (!startDate || !endDate) {
    return "Please choose both a start date and end date.";
  }

  if (startDate < APOD_FIRST_DATE) {
    return `Start date must be on or after ${APOD_FIRST_DATE}.`;
  }

  const today = getTodayISO();

  if (endDate > today) {
    return `End date cannot be after today (${today}).`;
  }

  if (startDate > endDate) {
    return "Start date cannot be after end date.";
  }

  return "";
}

function normalizeResults(data) {
  if (Array.isArray(data)) {
    return data;
  }

  if (data && typeof data === "object") {
    return [data];
  }

  return [];
}

function normalizeMediaUrl(url) {
  if (!url || typeof url !== "string") {
    return "";
  }

  if (url.startsWith("http://")) {
    return `https://${url.slice("http://".length)}`;
  }

  return url;
}

function openImageModal(item, imageUrl) {
  modalImageEl.src = imageUrl;
  modalImageEl.alt = item.title || "NASA APOD image";
  modalTitleEl.textContent = item.title || "Untitled";
  modalDateEl.textContent = item.date ? formatShortDate(item.date) : "Unknown date";
  modalExplanationEl.textContent = item.explanation || "No description available.";

  modalEl.classList.add("is-open");
  modalEl.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeImageModal() {
  modalEl.classList.remove("is-open");
  modalEl.setAttribute("aria-hidden", "true");
  modalImageEl.src = "";
  modalTitleEl.textContent = "";
  modalDateEl.textContent = "";
  modalExplanationEl.textContent = "";
  document.body.style.overflow = "";
}

function createCard(item) {
  const article = document.createElement("article");
  article.className = "card";

  const imageUrl =
    item.media_type === "image"
      ? normalizeMediaUrl(item.url || item.hdurl)
      : normalizeMediaUrl(item.thumbnail_url);
  const hasImage = Boolean(imageUrl);

  if (hasImage) {
    const img = document.createElement("img");
    img.src = imageUrl;
    img.alt = item.title || "NASA APOD image";
    img.loading = "lazy";
    img.addEventListener("click", () => {
      openImageModal(item, imageUrl);
    });
    article.appendChild(img);
  }

  const body = document.createElement("div");
  body.className = "card-body";

  if (hasImage) {
    body.addEventListener("click", () => {
      openImageModal(item, imageUrl);
    });
  }

  const title = document.createElement("h2");
  title.textContent = item.title || "Untitled";

  const date = document.createElement("p");
  date.className = "date";
  date.textContent = item.date ? formatShortDate(item.date) : "Unknown date";

  const explanation = document.createElement("p");

  if (item.media_type !== "image") {
    explanation.textContent = "This APOD entry is not an image. Open the original media:";
    const linkWrap = document.createElement("p");
    const mediaLink = document.createElement("a");
    mediaLink.className = "media-link";
    mediaLink.href = normalizeMediaUrl(item.url);
    mediaLink.target = "_blank";
    mediaLink.rel = "noopener noreferrer";
    mediaLink.textContent = "View media";
    linkWrap.appendChild(mediaLink);

    body.append(title, date, explanation, linkWrap);
    article.appendChild(body);
    return article;
  }

  explanation.textContent = item.explanation || "No description available.";
  body.append(title, date, explanation);
  article.appendChild(body);

  return article;
}

function renderGallery(items) {
  galleryEl.innerHTML = "";

  if (!items.length) {
    setStatus("No image results found for this date range.");
    return;
  }

  const newestFirst = [...items].sort((a, b) => (a.date < b.date ? 1 : -1));
  const fragment = document.createDocumentFragment();

  newestFirst.forEach((item) => {
    fragment.appendChild(createCard(item));
  });

  galleryEl.appendChild(fragment);
  setStatus(`Loaded ${items.length} image${items.length === 1 ? "" : "s"}.`);
  clearStatusAfterDelay(500);
}

async function searchAPODByDate(startDate, endDate) {
  const validationError = validateDates(startDate, endDate);

  if (validationError) {
    setStatus(validationError);
    return;
  }

  if (!getSanitizedApiKey() || getSanitizedApiKey() === "YOUR_NASA_API_KEY") {
    setStatus("Add your NASA API key in script.js before searching.");
    return;
  }

  setStatus("Loading images from NASA...", false, "#4f4f4f");
  searchBtn.disabled = true;

  try {
    const response = await fetch(buildAPODQuery(startDate, endDate));
    let data = null;

    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      const errMessage =
        data?.msg ||
        data?.error?.message ||
        "NASA is unavailable right now. Please try again later.";
      throw new Error(errMessage);
    }

    const items = normalizeResults(data);
    const imageItems = items.filter((item) => {
      if (item.media_type !== "image") {
        return false;
      }

      return Boolean(normalizeMediaUrl(item.url || item.hdurl));
    });

    renderGallery(imageItems);
  } catch (error) {
    const friendlyMessage =
      error instanceof TypeError
        ? "Unable to connect to NASA right now. Please check your internet connection and try again later."
        : error?.message || "Unable to load images right now. Please try again later.";

    setStatus(friendlyMessage, true);
  } finally {
    searchBtn.disabled = false;
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  searchAPODByDate(startDateInput.value, endDateInput.value);
});

modalCloseBtn.addEventListener("click", closeImageModal);

modalEl.addEventListener("click", (event) => {
  if (event.target === modalEl) {
    closeImageModal();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && modalEl.classList.contains("is-open")) {
    closeImageModal();
  }
});

(function init() {
  const { start, end } = getDefaultDateRange();
  const today = getTodayISO();

  startDateInput.min = APOD_FIRST_DATE;
  endDateInput.min = APOD_FIRST_DATE;
  startDateInput.max = today;
  endDateInput.max = today;

  startDateInput.value = start;
  endDateInput.value = end;
})();
