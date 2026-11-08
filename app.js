(() => {
  "use strict";

  const cfg = window.APP_CONFIG || {};
  const statusEl = document.querySelector("#status");
  const playersEl = document.querySelector("#players");
  const searchEl = document.querySelector("#search");
  const positionEl = document.querySelector("#position");
  const countEl = document.querySelector("#result-count");
  const pageLabel = document.querySelector("#page-label");
  const prevBtn = document.querySelector("#previous");
  const nextBtn = document.querySelector("#next");
  const PAGE_SIZE = 24;

  let page = 0;
  let total = 0;
  let debounceTimer = null;
  let requestNumber = 0;

  if (!window.supabase || !cfg.SUPABASE_URL || !cfg.SUPABASE_PUBLISHABLE_KEY ||
      cfg.SUPABASE_URL.includes("YOUR-PROJECT") ||
      cfg.SUPABASE_PUBLISHABLE_KEY.includes("REPLACE_ME")) {
    statusEl.textContent = "Sozlash kerak: Supabase URL va publishable key qiymatlarini config.js fayliga kiriting.";
    countEl.textContent = "Ulanmagan";
    return;
  }

  const db = window.supabase.createClient(
    cfg.SUPABASE_URL,
    cfg.SUPABASE_PUBLISHABLE_KEY
  );

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, ch => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[ch]));
  }

  function displayValue(value) {
    if (value === null || value === undefined || value === "") return "";
    if (Array.isArray(value)) return value.map(displayValue).filter(Boolean).join(", ");
    if (typeof value === "object") return Object.values(value).map(displayValue).filter(Boolean).join(", ");
    return String(value);
  }

  function renderPlayer(player) {
    const fullName = player.full_name && player.full_name !== player.name
      ? player.full_name : "";
    const position = player.registered_position || "Pozitsiya ko‘rsatilmagan";
    const nationality = displayValue(player.nationality_ids);
    const details = [
      player.age ? `${escapeHtml(player.age)} yosh` : "",
      player.height_cm ? `${escapeHtml(player.height_cm)} cm` : "",
      player.strong_foot ? `Oyoq: ${escapeHtml(player.strong_foot)}` : ""
    ].filter(Boolean).join(" · ");

    return `
      <article class="player-card">
        <div class="rating" aria-label="Futbolchi ID">ID</div>
        <div class="card-info">
          <h2>${escapeHtml(player.name || "Nomi mavjud emas")}</h2>
          ${fullName ? `<p>${escapeHtml(fullName)}</p>` : ""}
          <div class="tags">
            <span>${escapeHtml(position)}</span>
            ${nationality ? `<span title="Manba faylidagi millat identifikatori">${escapeHtml(nationality)}</span>` : ""}
          </div>
          ${details ? `<p class="style">${details}</p>` : ""}
          ${player.youth_club ? `<p>${escapeHtml(player.youth_club)}</p>` : ""}
        </div>
      </article>`;
  }

  async function loadPlayers() {
    const thisRequest = ++requestNumber;
    statusEl.textContent = "Futbolchilar yuklanmoqda…";
    playersEl.innerHTML = "";

    let query = db.from("players")
      .select("external_id,name,full_name,nationality_ids,age,height_cm,weight_kg,strong_foot,star_rating,registered_position,youth_club", { count: "exact" })
      .order("name", { ascending: true })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

    const term = searchEl.value.trim();
    const position = positionEl.value;

    if (term) query = query.ilike("name", `%${term}%`);
    if (position) query = query.eq("registered_position", position);

    const { data, error, count } = await query;
    if (thisRequest !== requestNumber) return;

    if (error) {
      console.error("Supabase query error:", error);
      statusEl.textContent = `Ma’lumotlar bazasi xatosi: ${error.message}`;
      countEl.textContent = "Xatolik";
      return;
    }

    total = count || 0;
    countEl.textContent = `${total.toLocaleString("uz-UZ")} futbolchi`;
    pageLabel.textContent = `${page + 1}-sahifa`;
    prevBtn.disabled = page === 0;
    nextBtn.disabled = (page + 1) * PAGE_SIZE >= total;

    if (!data || data.length === 0) {
      statusEl.textContent = "Mos futbolchi topilmadi.";
      return;
    }

    statusEl.textContent = "";
    playersEl.innerHTML = data.map(renderPlayer).join("");
  }

  async function loadPositions() {
    const { data, error } = await db.from("players")
      .select("registered_position")
      .not("registered_position", "is", null)
      .limit(1000);

    if (error) {
      console.warn("Pozitsiyalarni yuklashda xatolik:", error);
      return;
    }

    const positions = [...new Set((data || [])
      .map(row => row.registered_position)
      .filter(Boolean))].sort();

    positions.forEach(position => {
      const option = document.createElement("option");
      option.value = position;
      option.textContent = position;
      positionEl.appendChild(option);
    });
  }

  function refreshFromFirstPage() {
    page = 0;
    loadPlayers();
  }

  searchEl.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(refreshFromFirstPage, 300);
  });

  positionEl.addEventListener("change", refreshFromFirstPage);

  document.querySelector("#clear").addEventListener("click", () => {
    searchEl.value = "";
    positionEl.value = "";
    refreshFromFirstPage();
  });

  prevBtn.addEventListener("click", () => {
    if (page > 0) {
      page--;
      loadPlayers();
    }
  });

  nextBtn.addEventListener("click", () => {
    if ((page + 1) * PAGE_SIZE < total) {
      page++;
      loadPlayers();
    }
  });

  loadPositions().finally(loadPlayers);
})();
