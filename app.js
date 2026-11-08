(() => {
  "use strict";

  const cfg = window.APP_CONFIG || {};
  const $ = selector => document.querySelector(selector);
  const statusEl = $("#status");
  const playersEl = $("#players");
  const searchEl = $("#search");
  const positionEl = $("#position");
  const countEl = $("#result-count");
  const pageLabel = $("#page-label");
  const prevBtn = $("#previous");
  const nextBtn = $("#next");
  const PAGE_SIZE = 24;

  let page = 0;
  let hasNextPage = false;
  let debounceTimer;
  let requestNumber = 0;

  function showFatal(message) {
    statusEl.textContent = message;
    countEl.textContent = "Ulanishda xatolik";
    console.error(message);
  }

  if (!window.supabase) {
    showFatal("Supabase kutubxonasi yuklanmadi. Internet aloqasini tekshirib, sahifani yangilang.");
    return;
  }
  if (!cfg.SUPABASE_URL || !cfg.SUPABASE_PUBLISHABLE_KEY) {
    showFatal("config.js faylida Supabase URL yoki publishable key topilmadi.");
    return;
  }

  const db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY);

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, ch => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[ch]));
  }

  function normalizeSearch(value) {
    return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  }

  function renderPlayer(player) {
    const fullName = player.full_name && player.full_name !== player.name ? player.full_name : "";
    const facts = [
      player.age ? `${escapeHtml(player.age)} yosh` : "",
      player.height_cm ? `${escapeHtml(player.height_cm)} cm` : "",
      player.weight_kg ? `${escapeHtml(player.weight_kg)} kg` : ""
    ].filter(Boolean).join(" · ");

    return `
      <article class="player-card">
        <div class="rating">ID</div>
        <div class="card-info">
          <h2>${escapeHtml(player.name || "Nomi mavjud emas")}</h2>
          ${fullName ? `<p>${escapeHtml(fullName)}</p>` : ""}
          <div class="tags">
            <span>${escapeHtml(player.registered_position || "Pozitsiya ko‘rsatilmagan")}</span>
          </div>
          ${facts ? `<p class="style">${facts}</p>` : ""}
          ${player.youth_club ? `<p>${escapeHtml(player.youth_club)}</p>` : ""}
        </div>
      </article>`;
  }

  async function loadPlayers() {
    const currentRequest = ++requestNumber;
    statusEl.textContent = "Futbolchilar yuklanmoqda…";
    playersEl.innerHTML = "";

    try {
      const term = normalizeSearch(searchEl.value);
      let query = db.from("players")
        .select("external_id,name,full_name,age,height_cm,weight_kg,registered_position,youth_club")
        .order("name", { ascending: true })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

      if (term) query = query.ilike("search_name", `%${term}%`);
      if (positionEl.value) query = query.eq("registered_position", positionEl.value);

      const { data, error } = await query;
      if (currentRequest !== requestNumber) return;

      if (error) {
        console.error("Supabase players query:", error);
        statusEl.textContent = `Supabase xatosi: ${error.message}`;
        countEl.textContent = "Xatolik";
        return;
      }

      const rows = data || [];
      hasNextPage = rows.length > PAGE_SIZE;
      const visibleRows = rows.slice(0, PAGE_SIZE);

      countEl.textContent = term || positionEl.value
        ? `${visibleRows.length} ta natija`
        : "104 mingdan ortiq futbolchi";
      pageLabel.textContent = `${page + 1}-sahifa`;
      prevBtn.disabled = page === 0;
      nextBtn.disabled = !hasNextPage;

      if (visibleRows.length === 0) {
        statusEl.textContent = "Mos futbolchi topilmadi.";
        return;
      }

      statusEl.textContent = "";
      playersEl.innerHTML = visibleRows.map(renderPlayer).join("");
    } catch (error) {
      if (currentRequest !== requestNumber) return;
      console.error("Unexpected loading error:", error);
      statusEl.textContent = `Ulanish xatosi: ${error.message || error}`;
      countEl.textContent = "Xatolik";
    }
  }

  async function loadPositions() {
    try {
      const { data, error } = await db.from("players")
        .select("registered_position")
        .not("registered_position", "is", null)
        .limit(1000);

      if (error) {
        console.warn("Positions query:", error);
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
    } catch (error) {
      console.warn("Could not load positions:", error);
    }
  }

  function refresh() {
    page = 0;
    loadPlayers();
  }

  searchEl.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(refresh, 350);
  });
  positionEl.addEventListener("change", refresh);

  $("#clear").addEventListener("click", () => {
    searchEl.value = "";
    positionEl.value = "";
    refresh();
  });

  prevBtn.addEventListener("click", () => {
    if (page > 0) {
      page--;
      loadPlayers();
    }
  });

  nextBtn.addEventListener("click", () => {
    if (hasNextPage) {
      page++;
      loadPlayers();
    }
  });

  loadPlayers();
  loadPositions();
})();