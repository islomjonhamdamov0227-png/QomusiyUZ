const SUPABASE_URL = window.QOMUSIY_CONFIG?.SUPABASE_URL || "https://SIZNING-LOYIHA-ID.supabase.co";
const SUPABASE_ANON_KEY = window.QOMUSIY_CONFIG?.SUPABASE_ANON_KEY || "SIZNING_SUPABASE_ANON_KEY";
const BUCKET_NAME = window.QOMUSIY_CONFIG?.BUCKET_NAME || "pdfs";

const NICK_ACCOUNTS_KEY = "qomusiy_nick_parol_accounts_v1";
const NICK_SESSION_KEY = "qomusiy_nick_parol_session_v1";
const LOCAL_BOOKS_KEY = "qomusiy_books_store_v1";
const LOCAL_CHAT_KEY = "qomusiy_chat_messages_v1";

function isSupabaseConfigured() {
  return (
    typeof SUPABASE_URL === "string" &&
    /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(SUPABASE_URL.trim()) &&
    typeof SUPABASE_ANON_KEY === "string" &&
    SUPABASE_ANON_KEY.trim().length > 20 &&
    !SUPABASE_ANON_KEY.includes("SIZNING_SUPABASE_ANON_KEY")
  );
}

const supabaseClient =
  window.supabase && isSupabaseConfigured()
    ? window.supabase.createClient(SUPABASE_URL.trim(), SUPABASE_ANON_KEY.trim())
    : null;

let authMode = "login";
let currentUser = null;
let allBooks = [];
let activeFilter = "all";
let searchQuery = "";
let deferredInstallPrompt = null;

function showToast(msg) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2800);
}

function normalizeNick(nick) {
  return String(nick || "").trim().toLowerCase();
}

function isValidNick(nick) {
  return /^[A-Za-z0-9_.-]{3,24}$/.test(String(nick || "").trim());
}

async function hashPassword(nick, password) {
  const raw = `${normalizeNick(nick)}::${String(password)}`;
  if (window.crypto && window.crypto.subtle) {
    const enc = new TextEncoder().encode(raw);
    const buf = await window.crypto.subtle.digest("SHA-256", enc);
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  let h = 2166136261;
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

function getNickAccounts() {
  try {
    return JSON.parse(localStorage.getItem(NICK_ACCOUNTS_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveNickAccounts(accounts) {
  localStorage.setItem(NICK_ACCOUNTS_KEY, JSON.stringify(accounts));
}

function loadNickSession() {
  try {
    const raw = localStorage.getItem(NICK_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveNickSession(user) {
  if (user) {
    localStorage.setItem(NICK_SESSION_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(NICK_SESSION_KEY);
  }
}

function getLocalBooks() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_BOOKS_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveLocalBooks(books) {
  localStorage.setItem(LOCAL_BOOKS_KEY, JSON.stringify(books));
}

// --- PWA Install ---
function isAppAlreadyInstalled() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

function updateInstallButtonVisibility() {
  const installBtn = document.getElementById("installAppBtn");
  if (!installBtn) return;

  if (isAppAlreadyInstalled() || !deferredInstallPrompt) {
    installBtn.classList.add("hidden");
  } else {
    installBtn.classList.remove("hidden");
  }
}

async function handleInstallClick() {
  if (!deferredInstallPrompt) {
    showToast("Brauzer menyusidan 'Add to Home Screen' / 'Install app' ni tanlang.");
    return;
  }

  deferredInstallPrompt.prompt();
  const { outcome } = await deferredInstallPrompt.userChoice;

  if (outcome === "accepted") {
    showToast("QomusiyAPP o‘rnatilmoqda...");
  } else {
    showToast("O‘rnatish bekor qilindi.");
  }

  deferredInstallPrompt = null;
  updateInstallButtonVisibility();
}

// --- Auth (Faqat Nik va Parol) ---
async function syncSession() {
  currentUser = loadNickSession();
  renderAuthHeader();
}

function getDisplayName(user) {
  if (!user) return "Mehmon";
  return user.nick || user.id || "Foydalanuvchi";
}

function renderAuthHeader() {
  const container = document.getElementById("authControls");
  if (!container) return;

  const installClass = !isAppAlreadyInstalled() && deferredInstallPrompt ? "" : "hidden";

  if (currentUser) {
    const displayName = getDisplayName(currentUser);
    container.innerHTML = `
      <button type="button" id="installAppBtn" class="btn-success ${installClass}">Ilovani o‘rnatish</button>
      <span class="meta">Salom, <strong>${escapeHtml(displayName)}</strong></span>
      <button type="button" id="logoutBtn">Chiqish</button>
    `;
    document.getElementById("logoutBtn").addEventListener("click", logoutUser);
  } else {
    container.innerHTML = `
      <button type="button" id="installAppBtn" class="btn-success ${installClass}">Ilovani o‘rnatish</button>
      <button type="button" id="openLoginBtn">Sign In</button>
      <button type="button" class="btn-primary" id="openRegisterBtn">Register</button>
    `;
    document.getElementById("openLoginBtn").addEventListener("click", () => openAuthModal("login"));
    document.getElementById("openRegisterBtn").addEventListener("click", () => openAuthModal("register"));
  }

  const installBtn = document.getElementById("installAppBtn");
  if (installBtn) {
    installBtn.addEventListener("click", handleInstallClick);
  }
}

function openAuthModal(mode) {
  authMode = mode;
  document.getElementById("authTitle").textContent =
    mode === "register" ? "Register" : "Sign In";
  document.getElementById("authSubmitBtn").textContent =
    mode === "register" ? "Ro‘yxatdan o‘tish" : "Kirish";
  document.getElementById("authModal").classList.add("open");
  setTimeout(() => document.getElementById("authNick")?.focus(), 40);
}

function closeAuthModal() {
  document.getElementById("authModal").classList.remove("open");
  document.getElementById("authForm").reset();
}

async function logoutUser() {
  currentUser = null;
  saveNickSession(null);
  renderAuthHeader();
  renderFilteredBooks();
  showToast("Hisobdan chiqdingiz");
}

async function handleAuthSubmit(e) {
  e.preventDefault();

  const nick = document.getElementById("authNick").value.trim();
  const password = document.getElementById("authPassword").value;

  if (!isValidNick(nick)) {
    showToast("Nik 3–24 belgidan iborat bo‘lishi kerak.");
    return;
  }

  if (!password || password.length < 4) {
    showToast("Parol kamida 4 belgidan iborat bo‘lishi kerak.");
    return;
  }

  const key = normalizeNick(nick);
  const passwordHash = await hashPassword(nick, password);
  const accounts = getNickAccounts();

  if (authMode === "register") {
    if (accounts[key]) {
      showToast("Bu nik allaqachon ro‘yxatdan o‘tgan. Sign In bosing.");
      return;
    }

    accounts[key] = {
      id: `user_${key}`,
      nick,
      passwordHash,
      createdAt: Date.now()
    };
    saveNickAccounts(accounts);

    currentUser = { id: accounts[key].id, nick: accounts[key].nick };
    saveNickSession(currentUser);
    renderAuthHeader();
    closeAuthModal();
    renderFilteredBooks();
    showToast("Muvaffaqiyatli ro‘yxatdan o‘tdingiz!");
  } else {
    const existing = accounts[key];
    if (!existing) {
      showToast("Bunday nik topilmadi. Avval Register qiling.");
      return;
    }

    if (existing.passwordHash !== passwordHash) {
      showToast("Parol noto‘g‘ri!");
      return;
    }

    currentUser = { id: existing.id, nick: existing.nick };
    saveNickSession(currentUser);
    renderAuthHeader();
    closeAuthModal();
    renderFilteredBooks();
    showToast(`Xush kelibsiz, ${existing.nick}!`);
  }
}

// --- Tabs ---
function switchTab(tabName) {
  if (tabName === "upload" && !currentUser) {
    showToast("PDF yuklash va reliz qilish uchun avval Sign In yoki Register qiling.");
    openAuthModal("login");
    return;
  }

  document.querySelectorAll(".tab").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tabName);
  });
  document.getElementById("tab-library").classList.toggle("hidden", tabName !== "library");
  document.getElementById("tab-upload").classList.toggle("hidden", tabName !== "upload");
  document.getElementById("tab-chat")?.classList.toggle("hidden", tabName !== "chat");
  document.getElementById("libraryFilters").classList.toggle("hidden", tabName !== "library");

  if (tabName === "library") {
    fetchBooks();
  } else if (tabName === "chat") {
    fetchChatMessages();
  }
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Faylni o‘qib bo‘lmadi"));
    reader.readAsDataURL(file);
  });
}

// --- Upload PDF ---
async function handleUploadSubmit(e) {
  e.preventDefault();

  if (!currentUser) {
    showToast("Avval hisobga kiring!");
    openAuthModal("login");
    return;
  }

  const fileInput = document.getElementById("pdfFile");
  const file = fileInput.files[0];
  if (!file) return;

  if (file.type !== "application/pdf") {
    showToast("Faqat PDF fayl tanlang!");
    return;
  }

  const submitBtn = document.getElementById("uploadSubmitBtn");
  submitBtn.disabled = true;
  submitBtn.textContent = "Yuklanmoqda...";

  try {
    const title = document.getElementById("bookTitle").value.trim();
    const author = document.getElementById("bookAuthor").value.trim();
    const version = document.getElementById("bookVersion").value.trim() || "v1.0";
    const status = document.getElementById("bookStatus").value;
    const safeName = `${currentUser.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

    let fileUrl = "";
    let storedInSupabase = false;

    if (supabaseClient) {
      const { error: uploadError } = await supabaseClient.storage
        .from(BUCKET_NAME)
        .upload(safeName, file, {
          contentType: "application/pdf",
          upsert: false
        });

      if (!uploadError) {
        const { data: publicUrlData } = supabaseClient.storage
          .from(BUCKET_NAME)
          .getPublicUrl(safeName);
        fileUrl = publicUrlData?.publicUrl || "";
        storedInSupabase = Boolean(fileUrl);
      }
    }

    if (!fileUrl) {
      if (file.size > 15 * 1024 * 1024) {
        throw new Error("15 MB dan katta fayl uchun Supabase Storage sozlangan bo‘lishi kerak.");
      }
      fileUrl = await fileToDataUrl(file);
    }

    const newBook = {
      id: `book_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      title,
      author,
      version,
      status,
      file_path: safeName,
      file_url: fileUrl,
      uploaded_by: getDisplayName(currentUser),
      user_id: currentUser.id,
      created_at: new Date().toISOString()
    };

    if (storedInSupabase && supabaseClient) {
      const { error: insertError } = await supabaseClient.from("books").insert([{
        title: newBook.title,
        author: newBook.author,
        version: newBook.version,
        status: newBook.status,
        file_path: newBook.file_path,
        file_url: newBook.file_url,
        uploaded_by: newBook.uploaded_by,
        user_id: null
      }]);
      if (insertError) {
        const localBooks = getLocalBooks();
        localBooks.unshift(newBook);
        saveLocalBooks(localBooks);
      }
    } else {
      const localBooks = getLocalBooks();
      localBooks.unshift(newBook);
      saveLocalBooks(localBooks);
    }

    e.target.reset();
    document.getElementById("bookVersion").value = "v1.0";
    showToast(status === "released" ? "PDF yuklandi va reliz qilindi!" : "PDF qoralama sifatida saqlandi!");
    switchTab("library");
  } catch (err) {
    showToast("Yuklash xatosi: " + (err?.message || String(err)));
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Saqlash va Yuklash";
  }
}

// --- Fetch & Render Books ---
function updateStats(books) {
  const totalEl = document.getElementById("statTotal");
  const releasedEl = document.getElementById("statReleased");
  const draftEl = document.getElementById("statDraft");

  if (totalEl) totalEl.textContent = String(books.length);
  if (releasedEl) {
    releasedEl.textContent = String(books.filter((b) => b.status === "released").length);
  }
  if (draftEl) {
    draftEl.textContent = String(books.filter((b) => b.status === "draft").length);
  }
}

async function fetchBooks() {
  const grid = document.getElementById("booksGrid");
  if (!grid) return;

  grid.innerHTML = `<div class="panel"><p class="meta">Kitoblar yuklanmoqda...</p></div>`;

  let remoteBooks = [];
  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient
        .from("books")
        .select("*")
        .order("created_at", { ascending: false });
      if (!error && Array.isArray(data)) {
        remoteBooks = data;
      }
    } catch {
      // Ignore network error and still display local books
    }
  }

  const localBooks = getLocalBooks();
  const seenUrls = new Set(remoteBooks.map((b) => b.file_url));
  allBooks = [...localBooks.filter((b) => !seenUrls.has(b.file_url)), ...remoteBooks];

  updateStats(allBooks);
  renderFilteredBooks();
}

function renderFilteredBooks() {
  const grid = document.getElementById("booksGrid");
  if (!grid) return;

  const q = searchQuery.trim().toLowerCase();
  const filtered = allBooks.filter((book) => {
    const matchesStatus = activeFilter === "all" || book.status === activeFilter;
    const matchesQuery =
      !q ||
      String(book.title || "").toLowerCase().includes(q) ||
      String(book.author || "").toLowerCase().includes(q);
    return matchesStatus && matchesQuery;
  });

  if (!filtered.length) {
    grid.innerHTML = `
      <div class="panel">
        <p class="meta">Mos kitoblar topilmadi. Filterni o‘zgartiring yoki yangi PDF yuklang.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered
    .map((book) => {
      const formattedDate = book.created_at
        ? new Date(book.created_at).toLocaleDateString("uz-UZ")
        : "";
      const canManage = Boolean(currentUser);

      return `
        <article class="card">
          <div>
            <div class="card-top">
              <h3>${escapeHtml(book.title)}</h3>
              <span class="status ${book.status}">${book.status === "released" ? "Reliz" : "Qoralama"}</span>
            </div>
            <p class="meta card-meta">
              Muallif: <strong>${escapeHtml(book.author)}</strong><br />
              Versiya: ${escapeHtml(book.version)} • Sana: ${escapeHtml(formattedDate)}<br />
              Yuklovchi: ${escapeHtml(book.uploaded_by)}
            </p>
          </div>
          <div class="card-actions">
            <button
              type="button"
              class="btn-primary"
              data-action="read"
              data-url="${escapeHtml(book.file_url)}"
              data-title="${escapeHtml(book.title)}"
              data-meta="${escapeHtml(`${book.author} (${book.version})`)}"
            >O‘qish</button>
            ${
              canManage
                ? book.status !== "released"
                  ? `<button type="button" class="btn-success" data-action="release" data-id="${escapeHtml(book.id)}">Reliz qilish</button>`
                  : `<button type="button" data-action="draft" data-id="${escapeHtml(book.id)}">Qoralamaga qaytarish</button>`
                : ""
            }
            ${
              canManage
                ? `<button type="button" class="btn-danger" data-action="delete" data-id="${escapeHtml(book.id)}" data-path="${escapeHtml(book.file_path)}">O‘chirish</button>`
                : ""
            }
          </div>
        </article>
      `;
    })
    .join("");
}

function handleGridClick(e) {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;

  const action = btn.dataset.action;

  if (action === "read") {
    openReader(btn.dataset.title, btn.dataset.meta, btn.dataset.url);
    return;
  }

  if (!currentUser) {
    showToast("Bu amal uchun avval tizimga kiring.");
    openAuthModal("login");
    return;
  }

  const id = btn.dataset.id;
  if (action === "release") updateBookStatus(id, "released", "Kitob reliz qilindi!");
  if (action === "draft") updateBookStatus(id, "draft", "Qoralama holatiga o‘tkazildi");
  if (action === "delete") deleteBook(id, btn.dataset.path);
}

function openReader(title, meta, url) {
  document.getElementById("readerTitle").textContent = title;
  document.getElementById("readerMeta").textContent = meta;
  document.getElementById("downloadPdfLink").href = url;
  document.getElementById("pdfFrame").src = url;
  document.getElementById("readerModal").classList.add("open");
}

function closeReader() {
  document.getElementById("readerModal").classList.remove("open");
  document.getElementById("pdfFrame").src = "";
}

async function updateBookStatus(id, status, message) {
  const localBooks = getLocalBooks();
  const idx = localBooks.findIndex((b) => String(b.id) === String(id));
  if (idx !== -1) {
    localBooks[idx].status = status;
    saveLocalBooks(localBooks);
    showToast(message);
    await fetchBooks();
    return;
  }

  if (supabaseClient) {
    const { error } = await supabaseClient.from("books").update({ status }).eq("id", id);
    if (error) {
      showToast("Yangilash xatosi: " + error.message);
      return;
    }
  }

  showToast(message);
  await fetchBooks();
}

async function deleteBook(id, filePath) {
  const localBooks = getLocalBooks();
  const filtered = localBooks.filter((b) => String(b.id) !== String(id));
  if (filtered.length !== localBooks.length) {
    saveLocalBooks(filtered);
    showToast("Kitob o‘chirildi");
    await fetchBooks();
    return;
  }

  if (supabaseClient) {
    if (filePath) {
      await supabaseClient.storage.from(BUCKET_NAME).remove([filePath]);
    }
    const { error } = await supabaseClient.from("books").delete().eq("id", id);
    if (error) {
      showToast("O‘chirish xatosi: " + error.message);
      return;
    }
  }

  showToast("Kitob o‘chirildi");
  await fetchBooks();
}


// --- Umumiy Chat ---
function getLocalChatMessages() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_CHAT_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveLocalChatMessages(messages) {
  localStorage.setItem(LOCAL_CHAT_KEY, JSON.stringify(messages));
}

function renderChatMessages(messages) {
  const listEl = document.getElementById("chatMessages");
  if (!listEl) return;

  if (!Array.isArray(messages) || messages.length === 0) {
    listEl.innerHTML = `<p class="meta">Hozircha xabarlar yo‘q. Birinchi bo‘lib yozing!</p>`;
    return;
  }

  const activeNickNorm = normalizeNick(currentUser?.nick || "");

  listEl.innerHTML = messages
    .map((m) => {
      const sender = m.sender_nick || "Foydalanuvchi";
      const isMine = activeNickNorm && normalizeNick(sender) === activeNickNorm;
      const timeStr = m.created_at
        ? new Date(m.created_at).toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" })
        : "";

      return `
        <div class="chat-item ${isMine ? "mine" : ""}">
          <div class="chat-item-top">
            <span class="chat-nick">${escapeHtml(sender)}</span>
            <span class="chat-time">${escapeHtml(timeStr)}</span>
          </div>
          <div class="chat-text">${escapeHtml(m.message || "")}</div>
        </div>
      `;
    })
    .join("");

  listEl.scrollTop = listEl.scrollHeight;
}

async function fetchChatMessages() {
  let remoteMsgs = [];
  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient
        .from("chat_messages")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(100);
      if (!error && Array.isArray(data)) {
        remoteMsgs = data;
      }
    } catch {
      // Fallback to local messages if offline or not configured
    }
  }

  const localMsgs = getLocalChatMessages();
  const seenIds = new Set(remoteMsgs.map((m) => String(m.id)));
  const merged = [...remoteMsgs, ...localMsgs.filter((m) => !seenIds.has(String(m.id)))];
  merged.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
  renderChatMessages(merged);
}

async function handleChatSubmit(e) {
  e.preventDefault();

  if (!currentUser) {
    showToast("Chatda yozish uchun avval Sign In yoki Register qiling.");
    openAuthModal("login");
    return;
  }

  const inputEl = document.getElementById("chatInput");
  const sendBtn = document.getElementById("chatSendBtn");
  const text = (inputEl?.value || "").trim();
  if (!text) return;

  if (sendBtn) {
    sendBtn.disabled = true;
    sendBtn.textContent = "Yuborilmoqda...";
  }

  const newMsg = {
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    sender_nick: getDisplayName(currentUser),
    message: text,
    created_at: new Date().toISOString()
  };

  try {
    let savedRemote = false;
    if (supabaseClient) {
      const { error } = await supabaseClient.from("chat_messages").insert([{
        sender_nick: newMsg.sender_nick,
        message: newMsg.message
      }]);
      if (!error) {
        savedRemote = true;
      }
    }

    if (!savedRemote) {
      const localMsgs = getLocalChatMessages();
      localMsgs.push(newMsg);
      saveLocalChatMessages(localMsgs);
    }

    if (inputEl) inputEl.value = "";
    await fetchChatMessages();
  } catch (err) {
    showToast("Xabar yuborish xatosi: " + (err?.message || String(err)));
  } finally {
    if (sendBtn) {
      sendBtn.disabled = false;
      sendBtn.textContent = "Yuborish";
    }
  }
}

function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[m]));
}

function bindEvents() {
  document.getElementById("closeAuthBtn").addEventListener("click", closeAuthModal);
  document.getElementById("authForm").addEventListener("submit", handleAuthSubmit);

  document.getElementById("heroUploadBtn").addEventListener("click", () => switchTab("upload"));
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => switchTab(tab.dataset.tab));
  });

  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeFilter = btn.dataset.filter;
      document.querySelectorAll(".filter-btn").forEach((b) => {
        b.classList.toggle("active", b === btn);
      });
      renderFilteredBooks();
    });
  });

  document.getElementById("searchInput").addEventListener("input", (e) => {
    searchQuery = e.target.value;
    renderFilteredBooks();
  });

  document.getElementById("uploadForm").addEventListener("submit", handleUploadSubmit);
  document.getElementById("booksGrid").addEventListener("click", handleGridClick);
  document.getElementById("closeReaderBtn").addEventListener("click", closeReader);
  document.getElementById("chatForm")?.addEventListener("submit", handleChatSubmit);
  document.getElementById("refreshChatBtn")?.addEventListener("click", fetchChatMessages);

  document.getElementById("readerModal").addEventListener("click", (e) => {
    if (e.target.id === "readerModal") closeReader();
  });
  document.getElementById("authModal").addEventListener("click", (e) => {
    if (e.target.id === "authModal") closeAuthModal();
  });

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    updateInstallButtonVisibility();
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    updateInstallButtonVisibility();
    showToast("QomusiyAPP qurilmangizga o‘rnatildi!");
  });

  window.matchMedia("(display-mode: standalone)").addEventListener("change", () => {
    updateInstallButtonVisibility();
  });
}

(async function bootstrap() {
  bindEvents();
  await syncSession();
  await fetchBooks();
})();
