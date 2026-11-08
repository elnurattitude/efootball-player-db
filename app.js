(() => {
  const cfg = window.APP_CONFIG || {};
  const statusEl = document.querySelector("#status");
  const playersEl = document.querySelector("#players");
  const searchEl = document.querySelector("#search");
  const positionEl = document.querySelector("#position");
  const ratingEl = document.querySelector("#rating");
  const countEl = document.querySelector("#result-count");
  const pageLabel = document.querySelector("#page-label");
  const prevBtn = document.querySelector("#previous");
  const nextBtn = document.querySelector("#next");

  const PAGE_SIZE = 24;
  let page = 0;
  let total = 0;
  let debounce;

  if (!window.supabase || !cfg.SUPABASE_URL || !cfg.SUPABASE_PUBLISHABLE_KEY ||
      cfg.SUPABASE_URL.includes("YOUR-PROJECT") ||
      cfg.SUPABASE_PUBLISHABLE_KEY.includes("REPLACE_ME")) {
    statusEl.textContent = "Setup required: add your Supabase URL and publishable key to config.js.";
    countEl.textContent = "Not connected";
    return;
  }

  const db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY);

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, ch => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[ch]));
  }

  async function loadPlayers() {
    statusEl.textContent = "Loading players…";
    playersEl.innerHTML = "";
    let query = db.from("player_catalog")
      .select("*", { count: "exact" })
      .order("player_name", { ascending: true })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    const term = searchEl.value.trim();
    const position = positionEl.value;
    const minRating = ratingEl.value;

    if (term) query = query.ilike("player_name", `%${term}%`);
    if (position) query = query.eq("position", position);
    if (minRating) query = query.gte("overall_rating", Number(minRating));

    const { data, error, count } = await query;
    if (error) {
      statusEl.textContent = `Database error: ${error.message}`;
      countEl.textContent = "Error";
      return;
    }

    total = count || 0;
    countEl.textContent = `${total.toLocaleString()} cards`;
    pageLabel.textContent = `Page ${page + 1}`;
    prevBtn.disabled = page === 0;
    nextBtn.disabled = (page + 1) * PAGE_SIZE >= total;

    if (!data?.length) {
      statusEl.textContent = "No matching players found.";
      return;
    }

    statusEl.textContent = "";
    playersEl.innerHTML = data.map(p => `
      <article class="player-card">
        <div class="rating">${p.overall_rating ?? "—"}</div>
        <div class="card-info">
          <h2>${escapeHtml(p.player_name)}</h2>
          <p>${escapeHtml(p.nationality || "Nationality unknown")}</p>
          <div class="tags">
            <span>${escapeHtml(p.position || "Position —")}</span>
            <span>${escapeHtml(p.card_type || "Standard")}</span>
          </div>
          <p class="style">${escapeHtml(p.playing_style || "")}</p>
        </div>
      </article>`).join("");
  }

  function refreshFromFirstPage() {
    page = 0;
    loadPlayers();
  }

  searchEl.addEventListener("input", () => {
    clearTimeout(debounce);
    debounce = setTimeout(refreshFromFirstPage, 250);
  });
  positionEl.addEventListener("change", refreshFromFirstPage);
  ratingEl.addEventListener("change", refreshFromFirstPage);
  document.querySelector("#clear").addEventListener("click", () => {
    searchEl.value = "";
    positionEl.value = "";
    ratingEl.value = "";
    refreshFromFirstPage();
  });
  prevBtn.addEventListener("click", () => { if (page > 0) { page--; loadPlayers(); } });
  nextBtn.addEventListener("click", () => { if ((page + 1) * PAGE_SIZE < total) { page++; loadPlayers(); } });

  async function loadPositions() {
    const { data, error } = await db.from("players").select("position").not("position", "is", null);
    if (error) return;
    [...new Set(data.map(x => x.position).filter(Boolean))].sort().forEach(pos => {
      const option = document.createElement("option");
      option.value = pos;
      option.textContent = pos;
      positionEl.appendChild(option);
    });
  }

  loadPositions().finally(loadPlayers);
})();
