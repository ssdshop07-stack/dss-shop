"use strict";

/* =========================================
   DSS SHOP — APP.JS
   Supabase, produktet, kategorite, shporta,
   llogaria e klientit dhe porosite.
========================================= */

const sb = window.supabase.createClient(
  window.DSS_SUPABASE_URL,
  window.DSS_SUPABASE_KEY
);

let products = [];
let cart = JSON.parse(localStorage.getItem("dss_cart") || "[]");
let selectedCategory = "all";
let currentUser = null;
let accountMode = "signup";
let language = localStorage.getItem("dss_language") || "sq";

const $ = (s) => document.querySelector(s);

/* =========================================
   PERKTHIMET
========================================= */

const translations = {
  sq: {
    products: "Produktet",
    admin: "Admin",
    categories: "Kategoritë",
    all: "Të gjitha",
    search: "Kërko produkt...",
    sort: "Renditja",
    low: "Çmimi: ulët → lart",
    high: "Çmimi: lart → ulët",
    cart: "Shporta",
    close: "Mbyll shportën",
    total: "Total:",
    name: "Emri dhe mbiemri",
    phone: "Telefoni",
    address: "Adresa",
    order: "Porosit",
    account: "Llogaria DSS",
    accountIntro: "Regjistrohu ose hyr për të përfituar 10% ulje.",
    email: "Email-i",
    password: "Fjalëkalimi (minimumi 6 karaktere)",
    signup: "Regjistrohu",
    login: "Hyr",
    switchLogin: "Kam llogari — Hyr",
    switchSignup: "Nuk kam llogari — Regjistrohu",
    logout: "Dil nga llogaria",
    closeAccount: "Mbyll ×",
    home: "Kryesore",
    profile: "Profili",
    add: "Shto në shportë",
    emptyCart: "Shporta është bosh.",
    noProducts: "Nuk u gjetën produkte në këtë kategori.",
    added: "U shtua në shportë",
    emptyNotice: "Shporta është bosh",
    loggedIn: "Je i/e kyçur si",
    discountAll: ". Përfiton 10% ulje në të gjitha produktet.",
    signupIntro: "Krijo llogari për të përfituar 10% ulje në të gjitha produktet.",
    loginIntro: "Hyr në llogarinë tënde për të përfituar 10% ulje.",
    enterBoth: "Shkruaj email-in dhe fjalëkalimin.",
    wait: "Prit...",
    registered: "Regjistrimi u krye. Kontrollo email-in për konfirmim, pastaj hyr në llogari.",
    signupSuccess: "Llogaria u krijua me sukses! Ke 10% ulje.",
    loginSuccess: "U kyçe me sukses! Tani ke 10% ulje.",
    loggedOut: "Dole nga llogaria. Çmimet tani janë pa ulje.",
    logoutError: "Gabim gjatë daljes: ",
    orderSuccess: "Porosia u regjistrua! Nr. ",
    orderError: "Gabim Supabase: ",
    orderCode: " | Kodi: ",
    noCode: "pa kod",
    orderFail: "Gabim gjatë porosisë: ",
    unknown: "Gabim i panjohur",
    registerError: "Gabim: ",
    accountMissing: "Nuk u gjet formulari i llogarisë në index.html.",
    discount: "ulje klienti: 10%"
  },

  en: {
    products: "Products",
    admin: "Admin",
    categories: "Categories",
    all: "All",
    search: "Search products...",
    sort: "Sort by",
    low: "Price: low → high",
    high: "Price: high → low",
    cart: "Cart",
    close: "Close cart",
    total: "Total:",
    name: "Full name",
    phone: "Phone",
    address: "Address",
    order: "Place order",
    account: "DSS Account",
    accountIntro: "Register or sign in to get 10% off.",
    email: "Email",
    password: "Password (minimum 6 characters)",
    signup: "Register",
    login: "Sign in",
    switchLogin: "I have an account — Sign in",
    switchSignup: "I don't have an account — Register",
    logout: "Sign out",
    closeAccount: "Close ×",
    home: "Home",
    profile: "Profile",
    add: "Add to cart",
    emptyCart: "Your cart is empty.",
    noProducts: "No products found in this category.",
    added: "Added to cart",
    emptyNotice: "Your cart is empty",
    loggedIn: "Signed in as",
    discountAll: ". You get 10% off all products.",
    signupIntro: "Create an account to get 10% off all products.",
    loginIntro: "Sign in to your account to get 10% off.",
    enterBoth: "Enter your email and password.",
    wait: "Please wait...",
    registered: "Registration complete. Check your email to confirm, then sign in.",
    signupSuccess: "Account created successfully! You get 10% off.",
    loginSuccess: "Signed in successfully! You now get 10% off.",
    loggedOut: "You signed out. Prices are now shown without the discount.",
    logoutError: "Sign-out error: ",
    orderSuccess: "Order registered! No. ",
    orderError: "Supabase error: ",
    orderCode: " | Code: ",
    noCode: "no code",
    orderFail: "Order error: ",
    unknown: "Unknown error",
    registerError: "Error: ",
    accountMissing: "Account form not found in index.html.",
    discount: "customer discount: 10%"
  }
};

const t = (key) =>
  (translations[language] || translations.sq)[key] ||
  translations.sq[key] ||
  key;

/* =========================================
   NORMALIZIMI I KATEGORIVE

   Ketu rregullohen emrat qe shkruhen
   ndryshe ne Admin dhe ne faqen kryesore.
========================================= */

function normalizeCategory(value) {
  const original = String(value || "").trim();

  if (!original) return "";

  const c = original
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/wi[\s_-]*fi/g, "wifi")
    .replace(/[\s_-]+/g, "")
    .replace(/[^a-z0-9]/g, "");

  const aliases = {
    "all": "all",
    "tegjitha": "all",
    "allproducts": "all",

    "kamerawifi": "kamerawifi",
    "wificamera": "kamerawifi",
    "wificameras": "kamerawifi",
    "kamerawireless": "kamerawifi",

    "kameraip": "kameraip",
    "ipkamera": "kameraip",
    "ipcameras": "kameraip",
    "ipcamera": "kameraip",

    "kameranaloge": "kameranaloge",
    "kameraanaloge": "kameranaloge",
    "analogkamera": "kameranaloge",
    "analogcamera": "kameranaloge",
    "analogcameras": "kameranaloge",

    "dvrxvr": "dvrxvr",
    "xvrdvr": "dvrxvr",
    "xvr": "dvrxvr",
    "dvr": "dvrxvr",

    "nvr": "nvr",

    "kompletekamerash": "kompletekamerash",
    "kompletkamerash": "kompletekamerash",
    "kamerakit": "kompletekamerash",
    "camerakits": "kompletekamerash",

    "alarme": "alarme",
    "alarm": "alarme",
    "alarms": "alarme",

    "kontrollaksesi": "kontrollaksesi",
    "akseskontroll": "kontrollaksesi",
    "accesscontrol": "kontrollaksesi",

    "interfone": "interfone",
    "interfon": "interfone",
    "intercom": "interfone",
    "intercoms": "interfone",

    "pajisjerrjeti": "pajisjerrjeti",
    "pajisjerrjetit": "pajisjerrjeti",
    "rrjeti": "pajisjerrjeti",
    "networkdevices": "pajisjerrjeti",

    "aksesore": "aksesore",
    "aksesori": "aksesore",
    "accessories": "aksesore"
  };

  return aliases[c] || c;
}

/* =========================================
   GJUHA
========================================= */

function applyLanguage() {
  document.documentElement.lang = language;

  const setText = (selector, value) => {
    const el = $(selector);
    if (el) el.textContent = value;
  };

  setText("#navProducts", t("products"));
  setText("#navAdmin", t("admin"));
  setText("#categoriesTitle", t("categories"));
  setText("#productsTitle", t("products"));
  setText("#cartTitle", t("cart"));
  setText("#orderSubmit", t("order"));
  setText("#accountTitle", t("account"));
  setText("#accountClose", t("closeAccount"));
  setText(
    "#accountSubmit",
    accountMode === "signup" ? t("signup") : t("login")
  );
  setText(
    "#accountSwitch",
    accountMode === "signup" ? t("switchLogin") : t("switchSignup")
  );
  setText("#accountLogout", t("logout"));
  setText("#homeLabel", t("home"));
  setText("#bottomCartLabel", t("cart"));
  setText("#profileLabel", t("profile"));

  const search = $("#search");

  if (search) {
    search.placeholder = t("search");
    search.setAttribute("aria-label", t("search"));
  }

  const sort = $("#sort");

  if (sort && sort.options.length >= 3) {
    sort.options[0].textContent = t("sort");
    sort.options[1].textContent = t("low");
    sort.options[2].textContent = t("high");
  }

  const name = $('#orderForm input[name="name"]');
  const phone = $('#orderForm input[name="phone"]');
  const address = $('#orderForm input[name="address"]');

  if (name) name.placeholder = t("name");
  if (phone) phone.placeholder = t("phone");
  if (address) address.placeholder = t("address");

  const email = $("#accountEmail");
  const password = $("#accountPassword");

  if (email) email.placeholder = t("email");

  if (password) {
    password.placeholder = t("password");
    password.autocomplete =
      accountMode === "signup" ? "new-password" : "current-password";
  }

  document.querySelectorAll(".category-btn").forEach((button) => {
    const span = button.querySelector("span");
    if (!span) return;

    const category = button.dataset.category;

    if (normalizeCategory(category) === "all") {
      span.textContent = t("all");
    } else if (language === "en") {
      span.textContent = ({
        "Kamera IP": "IP Cameras",
        "Kamera Wi-Fi": "Wi-Fi Cameras",
        "Kamera analoge": "Analog Cameras",
        "DVR/XVR": "DVR/XVR",
        "NVR": "NVR",
        "Komplete kamerash": "Camera Kits",
        "Alarme": "Alarms",
        "Kontroll aksesi": "Access Control",
        "Interfonë": "Intercoms",
        "Pajisje rrjeti": "Network Devices",
        "Aksesorë": "Accessories"
      })[category] || category;
    } else {
      span.textContent = category;
    }
  });

  const langButton = $("#languageBtn");

  if (langButton) {
    langButton.textContent = language === "sq" ? "SQ | EN" : "EN | SQ";
    langButton.setAttribute(
      "aria-label",
      language === "sq" ? "Switch to English" : "Kalo në shqip"
    );
  }

  updateAccountUI();
  render();
  renderCart();
}

function toggleLanguage() {
  language = language === "sq" ? "en" : "sq";
  localStorage.setItem("dss_language", language);
  applyLanguage();
}

/* =========================================
   FUNKSIONE NDIHMESE
========================================= */

const esc = (s) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;"
  })[c]);

function money(n) {
  return "€" + Number(n || 0).toFixed(2);
}

function basePrice(p) {
  return Number(p.sale_price || p.price || 0);
}

function customerPrice(price) {
  return currentUser
    ? Math.round(Number(price) * 90) / 100
    : Number(price);
}

function save() {
  localStorage.setItem("dss_cart", JSON.stringify(cart));
  renderCart();
}

function refreshCartPrices() {
  cart = cart.map((x) => {
    const product = products.find(
      (p) => String(p.id) === String(x.id)
    );

    const base = product
      ? basePrice(product)
      : Number(x.basePrice ?? x.price ?? 0);

    return {
      ...x,
      basePrice: base,
      price: customerPrice(base)
    };
  });

  save();
}

/* =========================================
   SHPORTA
========================================= */

function renderCart() {
  const count = $("#cartCount");
  const items = $("#cartItems");
  const totalEl = $("#total");

  if (!count || !items || !totalEl) return;

  count.textContent = cart.reduce(
    (a, x) => a + Number(x.qty || 0),
    0
  );

  items.innerHTML = cart.map((x, i) => `
    <div class="cartItem">
      <div>
        <b>${esc(x.name)}</b>
        <small>${money(x.price)} × ${x.qty}</small>
      </div>
      <div>
        <button type="button"
          onclick="change(${i},-1)"
          aria-label="Decrease quantity">−</button>
        <button type="button"
          onclick="change(${i},1)"
          aria-label="Increase quantity">+</button>
      </div>
    </div>
  `).join("") || `<p>${t("emptyCart")}</p>`;

  const total = cart.reduce(
    (a, x) => a + Number(x.price) * Number(x.qty),
    0
  );

  totalEl.textContent = money(total);
}

window.change = (i, d) => {
  if (!cart[i]) return;

  cart[i].qty += d;

  if (cart[i].qty <= 0) {
    cart.splice(i, 1);
  }

  save();
};

/* =========================================
   SHFAQJA E PRODUKTEVE

   Ndryshimi kryesor:
   Kategorite krahasohen pas normalizimit,
   jo me emrin e shkruar fjale per fjale.
========================================= */

function render() {
  const searchEl = $("#search");
  const q = (searchEl?.value || "").toLowerCase().trim();

  const normalizedSearch = normalizeCategory(q);

  let a = products.filter((p) => {
    const name = String(p.name || "").toLowerCase();
    const categoryText = String(p.category || "").toLowerCase();

    const category = normalizeCategory(p.category);
    const selected = normalizeCategory(selectedCategory);

    const matchesSearch =
      !q ||
      name.includes(q) ||
      categoryText.includes(q) ||
      category.includes(normalizedSearch);

    const matchesCategory =
      selected === "all" || category === selected;

    return matchesSearch && matchesCategory;
  });

  const sort = $("#sort")?.value;

  if (sort === "low") {
    a.sort((x, y) => basePrice(x) - basePrice(y));
  }

  if (sort === "high") {
    a.sort((x, y) => basePrice(y) - basePrice(x));
  }

  const grid = $("#grid");

  if (!grid) return;

  grid.innerHTML = a.map((p) => {
    const price = basePrice(p);
    const discounted = customerPrice(price);

    const priceHtml = currentUser
      ? `<div class="price">
          <span style="color:#aaa;text-decoration:line-through;font-size:14px">
            ${money(price)}
          </span>
          <br>
          ${money(discounted)}
          <span style="color:#35d07f;font-size:12px">-10%</span>
        </div>`
      : `<div class="price">${money(price)}</div>`;

    const encodedProduct = JSON.stringify(p)
      .replace(/</g, "\\u003c")
      .replace(/'/g, "&#39;");

    return `
      <article class="card">
        <div class="pic">
          ${p.image_url
            ? `<img src="${esc(p.image_url)}"
                    alt="${esc(p.name)}"
                    loading="lazy">`
            : "DSS"}
        </div>

        <div class="cat">${esc(p.category || "")}</div>
        <h3>${esc(p.name)}</h3>

        ${priceHtml}

        <button type="button"
          onclick='add(${encodedProduct})'>
          ${t("add")}
        </button>
      </article>
    `;
  }).join("") || `<p>${t("noProducts")}</p>`;
}

/* =========================================
   KLIKIMI I KATEGORIVE
========================================= */

document.querySelectorAll(".category-btn").forEach((button) => {
  button.addEventListener("click", () => {
    selectedCategory = button.dataset.category || "all";

    document.querySelectorAll(".category-btn").forEach((b) => {
      b.classList.toggle("active", b === button);
    });

    render();
  });
});

/* =========================================
   SHTO NE SHPORTE
========================================= */

window.add = (p) => {
  const existing = cart.find(
    (x) => String(x.id) === String(p.id)
  );

  const base = basePrice(p);

  if (existing) {
    existing.qty++;
    existing.basePrice = base;
    existing.price = customerPrice(base);
  } else {
    cart.push({
      id: p.id,
      name: p.name,
      basePrice: base,
      price: customerPrice(base),
      qty: 1
    });
  }

  save();
  toast(t("added"));
};

/* =========================================
   NJOFTIMET
========================================= */

function toast(message) {
  const el = $("#toast");

  if (!el) return;

  el.textContent = message;
  el.classList.add("show");

  setTimeout(() => {
    el.classList.remove("show");
  }, 1800);
}

/* =========================================
   NGARKIMI I PRODUKTEVE NGA SUPABASE
========================================= */


async function loadCategoryPhotos() {
  try {
    const { data, error } = await sb
      .from("categories")
      .select("name, image_url");

    if (error) throw error;

    const normalize = (text) =>
      String(text || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, " ")
        .trim();

    const photos = new Map(
      (data || [])
        .filter(c => c.image_url)
        .map(c => [normalize(c.name), c.image_url])
    );

    document.querySelectorAll(".category-btn").forEach(button => {
      const label = button.querySelector("span");
      const img = button.querySelector("img");

      if (!label || !img) return;

      const url = photos.get(normalize(label.textContent));

      if (url) {
        img.src = url;
      }
    });
  } catch (error) {
    console.error("Gabim gjatë ngarkimit të fotove të kategorive:", error);
  }
}

async function load() {
  await loadCategoryPhotos();

  try {
    if (
      window.DSS_SUPABASE_URL &&
      !window.DSS_SUPABASE_URL.includes("PASTE_")
    ) {
      const { data, error } = await sb
        .from("products")
        .select("*")
        .eq("active", true)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Product loading error:", error);
      } else {
        products = data || [];
      }
    }
  } catch (error) {
    console.error("Supabase connection failed:", error);
  }

  if (!products.length) {
    try {
      const response = await fetch("products.json");

      if (response.ok) {
        products = await response.json();
      }
    } catch (error) {
      console.error("products.json error:", error);
    }
  }

  refreshCartPrices();
  render();
  renderCart();
}

/* =========================================
   LLOGARIA E KLIENTIT
========================================= */

function openAccount() {
  const box = $("#accountBox");

  if (!box) {
    alert(t("accountMissing"));
    return;
  }

  box.hidden = false;
  box.style.display = "flex";

  updateAccountUI();
}

function closeAccount() {
  const box = $("#accountBox");

  if (!box) return;

  box.style.display = "none";
  box.hidden = true;
}

function updateAccountUI(message) {
  const status = $("#accountStatus");
  const form = $("#accountForm");
  const email = $("#accountEmail");
  const password = $("#accountPassword");
  const submit = $("#accountSubmit");
  const switchBtn = $("#accountSwitch");
  const logout = $("#accountLogout");

  if (
    !status || !form || !email || !password ||
    !submit || !switchBtn || !logout
  ) return;

  if (currentUser) {
    status.textContent =
      message ||
      (t("loggedIn") + " " + currentUser.email + t("discountAll"));

    form.hidden = true;
    switchBtn.hidden = true;
    logout.hidden = false;
    logout.textContent = t("logout");
  } else {
    status.textContent =
      message ||
      (accountMode === "signup"
        ? t("signupIntro")
        : t("loginIntro"));

    form.hidden = false;
    email.disabled = false;
    password.disabled = false;
    submit.disabled = false;

    submit.textContent =
      accountMode === "signup" ? t("signup") : t("login");

    switchBtn.hidden = false;
    switchBtn.textContent =
      accountMode === "signup"
        ? t("switchLogin")
        : t("switchSignup");

    logout.hidden = true;
  }
}

const accountForm = $("#accountForm");

if (accountForm) {
  accountForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = $("#accountEmail").value.trim();
    const password = $("#accountPassword").value;
    const submit = $("#accountSubmit");

    if (!email || !password) {
      updateAccountUI(t("enterBoth"));
      return;
    }

    submit.disabled = true;
    submit.textContent = t("wait");

    try {
      if (accountMode === "signup") {
        const { data, error } = await sb.auth.signUp({
          email,
          password
        });

        if (error) throw error;

        if (data.session && data.user) {
          currentUser = data.user;
          refreshCartPrices();
          render();
          updateAccountUI(t("signupSuccess"));
        } else {
          accountMode = "login";
          updateAccountUI(t("registered"));
        }
      } else {
        const { data, error } = await sb.auth.signInWithPassword({
          email,
          password
        });

        if (error) throw error;

        currentUser = data.user;
        refreshCartPrices();
        render();
        updateAccountUI(t("loginSuccess"));
      }
    } catch (error) {
      updateAccountUI(
        t("registerError") + (error.message || "Action failed.")
      );
    } finally {
      submit.disabled = false;

      if (!currentUser) {
        submit.textContent =
          accountMode === "signup" ? t("signup") : t("login");
      }
    }
  });
}

const accountSwitch = $("#accountSwitch");

if (accountSwitch) {
  accountSwitch.addEventListener("click", () => {
    accountMode = accountMode === "signup" ? "login" : "signup";
    updateAccountUI();
  });
}

const accountLogout = $("#accountLogout");

if (accountLogout) {
  accountLogout.addEventListener("click", async () => {
    const { error } = await sb.auth.signOut();

    if (error) {
      updateAccountUI(t("logoutError") + error.message);
      return;
    }

    currentUser = null;
    refreshCartPrices();
    render();
    updateAccountUI(t("loggedOut"));
  });
}

const accountClose = $("#accountClose");

if (accountClose) {
  accountClose.addEventListener("click", closeAccount);
}

const accountBox = $("#accountBox");

if (accountBox) {
  accountBox.addEventListener("click", (e) => {
    if (e.target === accountBox) closeAccount();
  });
}

const profileBtn = $("#profileBtn");

if (profileBtn) {
  profileBtn.onclick = openAccount;
}

/* =========================================
   SESIONI I KLIENTIT
========================================= */

sb.auth.getSession().then(({ data, error }) => {
  if (error) console.error("Session check error:", error);

  currentUser = data?.session?.user || null;

  refreshCartPrices();
  render();
  updateAccountUI();
});

sb.auth.onAuthStateChange((_event, session) => {
  currentUser = session?.user || null;

  refreshCartPrices();
  render();
  updateAccountUI();
});

/* =========================================
   KERKIMI, RENDITJA DHE SHPORTA
========================================= */

const searchInput = $("#search");

if (searchInput) {
  searchInput.oninput = render;
}

const sortInput = $("#sort");

if (sortInput) {
  sortInput.onchange = render;
}

const cartBtn = $("#cartBtn");

if (cartBtn) {
  cartBtn.onclick = () => {
    const cartBox = $("#cart");
    if (cartBox) cartBox.classList.add("open");
  };
}

const closeCart = $("#closeCart");

if (closeCart) {
  closeCart.onclick = () => {
    const cartBox = $("#cart");
    if (cartBox) cartBox.classList.remove("open");
  };
}

const langButton = $("#languageBtn");

if (langButton) {
  langButton.addEventListener("click", toggleLanguage);
}

/* =========================================
   POROSIA
========================================= */

const orderForm = $("#orderForm");

if (orderForm) {
  orderForm.onsubmit = async (e) => {
    e.preventDefault();

    if (!cart.length) {
      toast(t("emptyNotice"));
      return;
    }

    const button = e.target.querySelector(
      'button[type="submit"]'
    );

    if (button) button.disabled = true;

    try {
      const form = new FormData(e.target);

      const order = {
        customer_name: String(form.get("name") || "").trim(),
        phone: String(form.get("phone") || "").trim(),
        address: String(form.get("address") || "").trim()
      };

      const p_items = cart.map((x) => ({
        id: String(x.id),
        qty: Number(x.qty)
      }));

      const { data: orderId, error } = await sb.rpc(
        "dss_create_order",
        {
          p_customer_name: order.customer_name,
          p_phone: order.phone,
          p_address: order.address,
          p_items
        }
      );

      if (error) {
        console.error("Order registration error:", error);

        alert(
          t("orderError") +
          error.message +
          t("orderCode") +
          (error.code || t("noCode"))
        );

        return;
      }

      const total = cart.reduce(
        (a, x) => a + x.price * x.qty,
        0
      );

      const message =
        "Përshëndetje DSS, dua të bëj një porosi.\n\n" +
        cart.map(
          (x) => `${x.name} x${x.qty} — ${money(x.price * x.qty)}`
        ).join("\n") +
        `\n\nTotal: ${money(total)}` +
        `\nEmri: ${order.customer_name}` +
        `\nTel: ${order.phone}` +
        `\nAdresa: ${order.address}` +
        (currentUser ? "\nUlje klienti: 10%" : "");

      cart = [];
      save();
      e.target.reset();

      toast(t("orderSuccess") + orderId);

      window.open(
        "https://wa.me/?text=" + encodeURIComponent(message),
        "_blank"
      );
    } catch (error) {
      console.error("Order error:", error);

      alert(
        t("orderFail") + (error.message || t("unknown"))
      );
    } finally {
      if (button) button.disabled = false;
    }
  };
}

/* =========================================
   NISJA E FAQES
========================================= */

async function loadBanners() {
const section = document.getElementById("dssBanner");
if (!section) return;

try {
const { data, error } = await sb
.from("site_banners")
.select("*")
.eq("active", true)
.order("sort_order", { ascending: true });

if (error) throw error;

if (!data || data.length === 0) {
  section.style.display = "none";
  return;
}

const b = data[0];

document.getElementById("dssBannerTitle").textContent = b.title || "";
document.getElementById("dssBannerSubtitle").textContent = b.subtitle || "";

const img = document.getElementById("dssBannerImage");
if (b.image_url) {
  img.src = b.image_url;
  img.style.display = "block";
}

const button = document.getElementById("dssBannerButton");
if (b.button_text) {
  button.textContent = b.button_text;
  button.href = b.button_url || "#products";
  button.style.display = "inline-block";
}

section.style.display = "block";

} catch (error) {
console.error("Gabim me banerin DSS:", error);
}
}

applyLanguage();
load();
loadBanners();
