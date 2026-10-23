
"use strict";

/* =========================================
   DSS SHOP — APP.JS
   Supabase, produktet, kategorite, shporta,
   llogaria e klientit, porosite dhe detajet.
========================================= */

const sb = window.supabase.createClient(
  window.DSS_SUPABASE_URL,
  window.DSS_SUPABASE_KEY
);

let products = [];
let cart = JSON.parse(localStorage.getItem("dss_cart") || "[]");
let selectedCategory = "all";
let currentUser = null;
let customerApproved = false;
let customerDiscountPercent = 0;
let accountMode = "signup";
let language = localStorage.getItem("dss_language") || "sq";
let dssDetailHistoryOpen = false;

let dssAccountHistoryOpen = false;

window.addEventListener("popstate", () => {
  const detailModal = document.getElementById("productDetailsModal");
  if (detailModal && detailModal.style.display === "flex") {
    detailModal.style.display = "none";
    dssDetailHistoryOpen = false;
    return;
  }

  const accountBox = document.getElementById("accountBox");
  if (accountBox && !accountBox.hidden) {
    accountBox.style.display = "none";
    accountBox.hidden = true;
    dssAccountHistoryOpen = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
});

window.dssCloseProductDetails = function () {
  const detailModal = document.getElementById("productDetailsModal");
  const url = new URL(window.location.href);
  const isDirectProductUrl = url.searchParams.has("product") || /^\/p\/[^/]+$/.test(url.pathname);
  if (isDirectProductUrl && !window.history.state?.dssProductDetails) {
    url.searchParams.delete("product");
    window.history.replaceState(window.history.state || {}, "", url.pathname + url.search + url.hash);
    if (detailModal) detailModal.style.display = "none";
    dssDetailHistoryOpen = false;
  } else if (dssDetailHistoryOpen) {
    dssDetailHistoryOpen = false;
    window.history.back();
  } else if (detailModal) {
    detailModal.style.display = "none";
  }
};

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
    accountIntro: "Krijo llogari ose hyr në llogarinë tënde.",
    email: "Email-i",
    password: "Fjalëkalimi (minimumi 6 karaktere)",
    approvalPending: "Llogaria është në pritje të miratimit të administratorit. Hyrja do të lejohet pasi të aprovohet.",
    signup: "Regjistrohu",
    login: "Hyr",
    switchLogin: "Kam llogari — Hyr",
    switchSignup: "Nuk kam llogari — Regjistrohu",
    logout: "Dil nga llogaria",
    closeAccount: "×",
    home: "Kryesore",
    profile: "Profili",
    add: "+ Shto",
    emptyCart: "Shporta është bosh.",
    noProducts: "Nuk u gjetën produkte në këtë kategori.",
    added: "U shtua në shportë",
    emptyNotice: "Shporta është bosh",
    loggedIn: "Je i/e kyçur si",
    discountAll: ".",
    signupIntro: "Krijo llogari. Ulja shfaqet vetëm pasi administratori të miratojë llogarinë.",
    loginIntro: "Hyr në llogarinë tënde. Ulja aktivizohet pas miratimit nga administratori.",
    enterBoth: "Shkruaj email-in dhe fjalëkalimin.",
    wait: "Prit...",
    registered: "Regjistrimi u krye. Kontrollo email-in për konfirmim, pastaj hyr në llogari.",
    signupSuccess: "Llogaria u krijua. Prit miratimin e administratorit për të aktivizuar uljen.",
    loginSuccess: "U kyçe me sukses.",
    loggedOut: "",
    logoutError: "Gabim gjatë daljes: ",
    orderSuccess: "Porosia u regjistrua! Nr. ",
    orderError: "Gabim Supabase: ",
    orderCode: " | Kodi: ",
    noCode: "pa kod",
    orderFail: "Gabim gjatë porosisë: ",
    unknown: "Gabim i panjohur",
    registerError: "Gabim: ",
    accountMissing: "Nuk u gjet formulari i llogarisë në index.html.",
    discount: "ulje klienti: 10%",
    details: "Shiko përshkrimin",
    description: "Përshkrimi",
    condition: "Gjendja",
    newCondition: "E re",
    usedCondition: "E përdorur",
    noDescription: "Për këtë produkt nuk është shtuar ende përshkrimi.",
    stock: "Stoku: ",
    noStock: "I papërcaktuar",
    closeDetails: "Mbyll"
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
    accountIntro: "Create an account or sign in.",
    email: "Email",
    identifier: "Email or phone (+355...)",
    password: "Password (minimum 6 characters)",
    methodPassword: "Email/Phone + Password",
    methodSms: "Sign in with SMS code",
    otp: "6-digit SMS code",
    sendOtp: "Send SMS code",
    verifyOtp: "Verify code",
    otpSent: "Code sent. Check your SMS and enter the 6-digit code.",
    approvalPending: "Your account is awaiting administrator approval. Sign-in will be allowed once approved.",
    signup: "Register",
    login: "Sign in",
    switchLogin: "I have an account — Sign in",
    switchSignup: "I don't have an account — Register",
    logout: "Sign out",
    closeAccount: "×",
    home: "Home",
    profile: "Profile",
    add: "+ Add",
    emptyCart: "Your cart is empty.",
    noProducts: "No products found in this category.",
    added: "Added to cart",
    emptyNotice: "Your cart is empty",
    loggedIn: "Signed in as",
    discountAll: ".",
    signupIntro: "Create an account. The discount appears only after admin approval.",
    loginIntro: "Sign in. The discount activates after admin approval.",
    enterBoth: "Enter your email and password.",
    wait: "Please wait...",
    registered: "Registration complete. Check your email to confirm, then sign in.",
    signupSuccess: "Account created. Wait for admin approval to activate the discount.",
    loginSuccess: "Signed in successfully.",
    loggedOut: "",
    logoutError: "Sign-out error: ",
    orderSuccess: "Order registered! No. ",
    orderError: "Supabase error: ",
    orderCode: " | Code: ",
    noCode: "no code",
    orderFail: "Order error: ",
    unknown: "Unknown error",
    registerError: "Error: ",
    accountMissing: "Account form not found in index.html.",
    discount: "customer discount: 10%",
    details: "View details",
    description: "Description",
    condition: "Condition",
    newCondition: "New",
    usedCondition: "Used",
    noDescription: "No description has been added for this product yet.",
    stock: "Stock: ",
    noStock: "Not specified",
    closeDetails: "Close"
  }
};

const t = (key) =>
  (translations[language] || translations.sq)[key] ||
  translations.sq[key] ||
  key;

/* =========================================
   NORMALIZIMI I KATEGORIVE
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
    all: "all",
    tegjitha: "all",
    allproducts: "all",

    kamerawifi: "kamerawifi",
    wificamera: "kamerawifi",
    wificameras: "kamerawifi",
    kamerawireless: "kamerawifi",

    kameraip: "kameraip",
    ipkamera: "kameraip",
    ipcameras: "kameraip",
    ipcamera: "kameraip",

    kameranaloge: "kameranaloge",
    kameraanaloge: "kameranaloge",
    analogkamera: "kameranaloge",
    analogcamera: "kameranaloge",
    analogcameras: "kameranaloge",

    dvrxvr: "dvrxvr",
    xvrdvr: "dvrxvr",
    xvr: "dvrxvr",
    dvr: "dvrxvr",

    nvr: "nvr",

    kompletekamerash: "kompletekamerash",
    kompletkamerash: "kompletekamerash",
    kamerakit: "kompletekamerash",
    camerakits: "kompletekamerash",

    alarme: "alarme",
    alarm: "alarme",
    alarms: "alarme",

    kontrollaksesi: "kontrollaksesi",
    akseskontroll: "kontrollaksesi",
    accesscontrol: "kontrollaksesi",

    interfone: "interfone",
    interfon: "interfone",
    intercom: "interfone",
    intercoms: "interfone",

    pajisjerrjeti: "pajisjerrjeti",
    pajisjerrjetit: "pajisjerrjeti",
    rrjeti: "pajisjerrjeti",
    networkdevices: "pajisjerrjeti",

    aksesore: "aksesore",
    aksesori: "aksesore",
    accessories: "aksesore"
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

  if (email) { email.placeholder = t("email"); email.type = "email"; email.autocomplete = "email"; }

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
  return customerApproved
    ? Math.round(Number(price) * (100 - customerDiscountPercent)) / 100
    : Number(price);
}

async function checkCustomerApproval(user) {
  customerApproved = false;
  customerDiscountPercent = 0;
  if (!user?.id) return false;

  try {
    const result = await Promise.race([
      sb.from("customer_approvals")
        .select("status,discount_percent")
        .eq("user_id", user.id)
        .maybeSingle(),
      new Promise((resolve) => setTimeout(
        () => resolve({ data: null, error: new Error("Kontrolli i miratimit zgjati shumë.") }),
        8000
      ))
    ]);

    if (result.error) {
      console.error("DSS approval check failed:", result.error.message);
      return false;
    }

    customerApproved = result.data?.status === "approved";
    customerDiscountPercent = customerApproved
      ? ([0, 5, 10, 15, 20].includes(Number(result.data?.discount_percent))
        ? Number(result.data.discount_percent) : 10)
      : 0;
    return customerApproved;
  } catch (error) {
    console.error("DSS approval check failed:", error?.message || error);
    return false;
  }
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

  const itemCount = cart.reduce((sum, x) => sum + Number(x.qty || 0), 0);
  count.textContent = itemCount;
  const itemCountText = document.getElementById("cartItemCountText");
  if (itemCountText) itemCountText.textContent = "(" + itemCount + " artikuj)";

  items.innerHTML = cart.map((x, i) => {
    const product = products.find(p => String(p.id) === String(x.id));
    const imageUrl = product?.image_url || x.image_url || "";
    const original = Number(x.basePrice ?? x.price ?? 0);
    const current = Number(x.price || 0);
    return `
      <article class="cartItem dss-cart-product">
        <div class="dss-cart-thumb">${imageUrl ? `<img src="${esc(imageUrl)}" alt="${esc(x.name)}">` : `<span>DSS</span>`}</div>
        <div class="dss-cart-product-info">
          <b>${esc(x.name)}</b>
          <small>${money(current)}</small>
          <div class="dss-qty">
            <button type="button" onclick="change(${i},-1)" aria-label="Ul pak">−</button>
            <span>${Number(x.qty || 0)}</span>
            <button type="button" onclick="change(${i},1)" aria-label="Shto një">+</button>
          </div>
        </div>
        <button class="dss-remove" type="button" onclick="change(${i},-${Number(x.qty || 0)})" aria-label="Hiq produktin" title="Hiq produktin"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2m-11 0 1 14h12l1-14M10 10v6m4-6v6"/></svg></button>
        <strong class="dss-line-total">${money(current * Number(x.qty || 0))}</strong>
      </article>`;
  }).join("") || `<p class="dss-empty-cart">${t("emptyCart")}</p>`;

  const subtotal = cart.reduce((sum, x) => sum + Number(x.basePrice ?? x.price ?? 0) * Number(x.qty || 0), 0);
  const total = cart.reduce((sum, x) => sum + Number(x.price || 0) * Number(x.qty || 0), 0);
  const discount = Math.max(0, subtotal - total);
  totalEl.textContent = money(total);
  const subtotalEl = document.getElementById("cartSubtotal");
  const discountRow = document.getElementById("cartDiscountRow");
  const discountValue = document.getElementById("cartDiscountValue");
  if (subtotalEl) subtotalEl.textContent = money(subtotal);
  if (discountRow) discountRow.hidden = discount <= 0;
  if (discountValue) discountValue.textContent = "-" + money(discount);
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
   DETAJET E PRODUKTIT
========================================= */

window.openProductDetails = function (p) {
  if (!p) return;

  let modal = document.getElementById("productDetailsModal");
  if (!document.getElementById("dssProductDetailsStyles")) {
    const style = document.createElement("style");
    style.id = "dssProductDetailsStyles";
    style.textContent = `
      #productDetailsModal{position:fixed;inset:0;z-index:99999;display:none;align-items:center;justify-content:center;padding:16px;background:rgba(0,0,0,.82);backdrop-filter:blur(5px);overflow-y:auto;box-sizing:border-box}
      #productDetailsModal .dss-detail-panel{position:relative;width:min(100%,1000px);max-height:92vh;overflow:auto;background:#ffffff;color:#20242a;border:1px solid #e2e5e9;border-radius:18px;box-shadow:0 24px 80px #0005;padding:22px;box-sizing:border-box}
      #productDetailsModal .dss-detail-close{position:absolute;top:14px;right:14px;width:40px;height:40px;border:1px solid #d8dde4;border-radius:50%;background:#f4f5f7;color:#20242a;font-size:22px;z-index:2}
      #productDetailsModal #detailsBreadcrumb{display:flex;flex-wrap:wrap;align-items:center;gap:7px;padding-right:48px;font-size:12px;line-height:1.5;margin:3px 0 18px}
      #productDetailsModal .dss-detail-layout{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:28px;align-items:start}
      #productDetailsModal .dss-detail-photo{display:flex;align-items:center;justify-content:center;min-height:300px;background:#f6f6f6;border-radius:13px;overflow:hidden}
      #productDetailsModal #detailsImage{display:block;width:100%;height:100%;max-height:470px;min-height:260px;object-fit:contain;margin:0}
      #productDetailsModal #detailsCategory{display:inline-block;color:#c91420;background:#fff0f1;border:1px solid #ffd1d5;border-radius:20px;padding:6px 10px;font-size:11px;font-weight:bold;margin:2px 0 10px}
      #productDetailsModal #detailsName{font-size:clamp(22px,3vw,30px);line-height:1.25;letter-spacing:-.4px;margin:0 44px 10px 0;overflow-wrap:anywhere;text-transform:uppercase}
      #productDetailsModal .dss-detail-stars{display:flex;align-items:center;gap:12px;color:#606875;margin:0 0 18px;font-size:14px}
      #productDetailsModal .dss-detail-stars .stars{color:#d29b13;font-size:22px;letter-spacing:2px;white-space:nowrap}
      .dss-rating-widget{display:flex;align-items:center;gap:5px;margin:7px 0;color:#737373;font-size:12px}
      .dss-rating-stars{display:inline-flex;gap:1px}
      .dss-rating-star{display:inline-flex!important;align-items:center!important;justify-content:center!important;flex:0 0 auto!important;width:auto!important;min-width:0!important;height:auto!important;min-height:0!important;max-width:none!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;color:#f5b301!important;padding:0 1px!important;margin:0!important;font-size:15px!important;line-height:1!important;cursor:pointer!important}
      .dss-rating-star.filled{color:#f5b301!important}
      .dss-rating-star:hover,.dss-rating-star:focus-visible{color:#ff9800!important;background:transparent!important;transform:scale(1.12)}
      .dss-rating-star:disabled{cursor:wait;opacity:.65}
      .dss-rating-widget.compact{margin:3px 0}
      .dss-rating-widget.compact .dss-rating-star{font-size:16px}
      .dss-detail-rating-summary{font-size:12px;color:#606875}

      #productDetailsModal .dss-price-stock-row{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;padding:15px 0;margin:0 0 18px}
      #productDetailsModal #detailsPrice{font-size:clamp(25px,5vw,34px);font-weight:800;color:#20242a;margin:0}
      #productDetailsModal #detailsStock{margin:0;border:1px solid #bbf7d0;border-radius:30px;padding:9px 13px;background:#ecfdf3;color:#15803d;font-weight:800;white-space:nowrap}
      #productDetailsModal #detailsPersonalDiscount{display:none;align-items:center;justify-content:space-between;gap:12px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:14px;padding:16px;margin:0 0 22px;color:#15803d;font-size:15px;font-weight:bold}
      #productDetailsModal #detailsPersonalDiscount .discount-sub{display:block;color:#166534;font-weight:normal;font-size:13px;margin-top:4px}
      #productDetailsModal #detailsPersonalDiscount .discount-price{font-size:25px;white-space:nowrap;color:#15803d}
      #productDetailsModal .dss-detail-meta{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 18px}
      #productDetailsModal .dss-detail-meta p{margin:0;background:#f5f6f8;border:1px solid #e2e5e9;border-radius:8px;padding:9px 11px;color:#4b5563;font-size:12px}\n      #productDetailsModal #detailsStock{background:#092c1b;border-color:#14532d;color:#08c965;font-weight:800}
      #productDetailsModal #detailsDescriptionTitle{font-size:16px;margin:20px 0 8px}
      #productDetailsModal #detailsDescription{white-space:pre-wrap;line-height:1.7;color:#4b5563;font-size:14px;margin:0 0 20px;overflow-wrap:anywhere}
      #productDetailsModal #detailsInstallGuide iframe{display:block}
      #productDetailsModal #detailsAdd{width:100%;min-height:48px;padding:14px;background:#e32636;color:#fff;border:0;border-radius:9px;font-weight:bold;font-size:15px;cursor:pointer}
      #productDetailsModal #detailsShare{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0 0}
      #productDetailsModal #detailsShare button{flex:1;min-width:95px;min-height:40px;padding:10px;background:#f5f6f8;color:#20242a;border:1px solid #dfe3e8;border-radius:8px;font-size:12px;font-weight:bold;cursor:pointer}
      #productDetailsModal #shareFacebook{background:#173b72;border-color:#24539a}
      #productDetailsModal #shareInstagram{background:#482044;border-color:#74305f}
      @media(max-width:650px){
        #productDetailsModal{padding:0;align-items:stretch}
        #productDetailsModal .dss-detail-panel{width:100%;max-height:none;min-height:100%;border:0;border-radius:0;padding:16px 15px 28px}
        #productDetailsModal #detailsBreadcrumb{margin:4px 0 14px;font-size:11px}
        #productDetailsModal .dss-detail-layout{grid-template-columns:minmax(0,1fr);gap:18px}
        #productDetailsModal .dss-detail-photo{min-height:0;height:min(38vh,330px);border-radius:11px}
        #productDetailsModal #detailsImage{min-height:0;height:100%;max-height:100%}
        #productDetailsModal #detailsName{font-size:23px;margin-right:42px}
        #productDetailsModal .dss-detail-stars{margin-bottom:14px}
        #productDetailsModal .dss-price-stock-row{gap:9px}
        #productDetailsModal #detailsPrice{font-size:27px}
        #productDetailsModal #detailsStock{font-size:11px;padding:8px 9px}
        #productDetailsModal #detailsPersonalDiscount{font-size:13px;padding:13px}
        #productDetailsModal #detailsPersonalDiscount .discount-price{font-size:22px}
        #productDetailsModal #detailsDescription{font-size:13px}
        #productDetailsModal .dss-detail-close{top:12px;right:12px}
      }
    `;
    document.head.appendChild(style);
  }

  if (!modal) {
    modal = document.createElement("div");
    modal.id = "productDetailsModal";
    modal.innerHTML = `
      <div class="dss-detail-panel" role="dialog" aria-modal="true" aria-label="Product details">
        <button id="detailsClose" class="dss-detail-close" type="button" aria-label="Close">×</button>
        <nav id="detailsBreadcrumb" aria-label="Breadcrumb"></nav>
        <div class="dss-detail-layout">
          <div class="dss-detail-photo"><img id="detailsImage" alt=""></div>
          <section class="dss-detail-info">
            <div id="detailsCategory"></div>
            <h2 id="detailsName"></h2>
            <div class="dss-detail-stars"><span class="stars" aria-label="Pa ende vlerësime">☆☆☆☆☆</span><span id="detailsReviews">Ende pa komente</span></div>
            <div class="dss-price-stock-row"><div id="detailsPrice"></div><p id="detailsStock"></p></div>
            <div id="detailsPersonalDiscount"><span><span class="discount-title">Keni zbritje personale: -10%</span><span class="discount-sub">Aplikohet automatikisht në checkout</span></span><strong class="discount-price" id="detailsDiscountPrice"></strong></div>
            <div class="dss-detail-meta"><p id="detailsCondition"></p></div>
            <h3 id="detailsDescriptionTitle"></h3>
            <p id="detailsDescription"></p>
            <section id="detailsInstallGuide" style="display:none;margin:20px 0;padding:14px;background:#17191f;border:1px solid #34353d;border-radius:12px">
              <h3 style="margin:0 0 12px;font-size:17px;color:#08c965">Udhëzime instalimi</h3>
              <div style="position:relative;width:100%;aspect-ratio:16/9;background:#000;border-radius:9px;overflow:hidden">
                <iframe id="detailsInstallVideo" src="" title="Udhëzime instalimi për kamerën IPC P8F" loading="lazy" style="position:absolute;inset:0;width:100%;height:100%;border:0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
              </div>
              <a id="detailsInstallLink" href="" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin-top:10px;color:#08c965;font-weight:bold;text-decoration:none">Hap videon në YouTube ↗</a>
            </section>
            <button id="detailsAdd" type="button"></button>
            <div id="detailsShare">
              <button id="shareFacebook" type="button">Facebook</button>
              <button id="shareInstagram" type="button">Instagram</button>
              <button id="shareCopy" type="button"></button>
            </div>
          </section>
        </div>
      </div>`;
    document.body.appendChild(modal);

    modal.querySelector("#detailsClose").onclick = () => window.dssCloseProductDetails();
    modal.addEventListener("click", (e) => {
      if (e.target === modal) window.dssCloseProductDetails();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") window.dssCloseProductDetails();
    });
  }

  const image = modal.querySelector("#detailsImage");
  const description = String(p.description || "").trim();
  const breadcrumb = modal.querySelector("#detailsBreadcrumb");

  breadcrumb.innerHTML = `
    <button type="button" onclick="window.dssBreadcrumbHome()" style="border:0;background:transparent;color:#fff;padding:0;text-decoration:underline;cursor:pointer">${t("home")}</button>
    <span style="color:#777">›</span>
    <button type="button" onclick="window.dssBreadcrumbCategory()" style="border:0;background:transparent;color:#ff626b;padding:0;text-decoration:underline;cursor:pointer">${esc(p.category || t("categories"))}</button>
    <span style="color:#777">›</span>
    <span style="color:#bbb;overflow-wrap:anywhere">${esc(p.name || "")}</span>`;

  window.dssBreadcrumbHome = () => {
    window.dssCloseProductDetails();
    selectedCategory = "all";
    document.querySelectorAll("#categories .category-btn").forEach(button => button.classList.remove("active"));
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  window.dssBreadcrumbCategory = () => {
    window.dssCloseProductDetails();
    selectedCategory = p.category || "all";
    document.querySelectorAll("#categories .category-btn").forEach(button => {
      button.classList.toggle("active", normalizeCategory(button.dataset.category) === normalizeCategory(selectedCategory));
    });
    render();
    const productsSection = document.getElementById("products");
    if (productsSection) productsSection.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  modal.dataset.productId = String(p.id);
  updateDetailRating(p);

  image.src = p.image_url || "";
  image.alt = p.name || "DSS Shop";
  image.parentElement.style.display = p.image_url ? "flex" : "none";
  modal.querySelector("#detailsCategory").textContent = p.category || t("categories");
  modal.querySelector("#detailsName").textContent = p.name || "";
  const regularPrice = Number(p.price || 0);
  const salePrice = Number(p.sale_price || 0);
  const hasProductSale = salePrice > 0 && regularPrice > salePrice;
  const effectivePrice = hasProductSale ? salePrice : regularPrice;
  const finalCustomerPrice = customerPrice(effectivePrice);
  const discountPercent = hasProductSale ? Math.round((1 - salePrice / regularPrice) * 100) : 10;
  modal.querySelector("#detailsPrice").innerHTML = hasProductSale
    ? '<span style="text-decoration:line-through;color:#aaa;font-size:.58em;font-weight:500;display:block">' + money(regularPrice) + '</span>' + money(salePrice)
    : money(effectivePrice);
  modal.querySelector("#detailsCondition").textContent = t("condition") + ": " +
    (p.product_condition === "used" ? t("usedCondition") : t("newCondition"));
  modal.querySelector("#detailsStock").textContent = t("stock") + " " + (p.stock ?? t("noStock"));
  const personalDiscount = modal.querySelector("#detailsPersonalDiscount");
  personalDiscount.querySelector(".discount-title").textContent = hasProductSale
    ? (language === "sq" ? "Keni zbritje: -" + discountPercent + "%" : "You save: -" + discountPercent + "%")
    : (language === "sq" ? "Keni zbritje personale: -" + customerDiscountPercent + "%" : "Your personal discount: -" + customerDiscountPercent + "%");
  personalDiscount.querySelector(".discount-sub").textContent = language === "sq" ? "Aplikohet automatikisht në checkout" : "Applied automatically at checkout";
  modal.querySelector("#detailsDiscountPrice").textContent = money(hasProductSale ? salePrice : finalCustomerPrice);
  personalDiscount.style.display = (hasProductSale || (customerApproved && customerDiscountPercent > 0)) ? "flex" : "none";
  modal.querySelector("#detailsDescriptionTitle").textContent = t("description");
  modal.querySelector("#detailsDescription").textContent = description || t("noDescription");
  const installGuide = modal.querySelector("#detailsInstallGuide");
  const installVideo = modal.querySelector("#detailsInstallVideo");
  const installLink = modal.querySelector("#detailsInstallLink");
  const rawVideoUrl = String(p.installation_video_url || "").trim();
  const videoMatch = rawVideoUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/);
  const videoId = videoMatch ? videoMatch[1] : "";
  installGuide.style.display = videoId ? "block" : "none";
  installVideo.src = videoId ? "https://www.youtube-nocookie.com/embed/" + videoId : "";
  installLink.href = videoId ? "https://www.youtube.com/watch?v=" + videoId : "";
  modal.querySelector("#shareCopy").textContent = language === "sq" ? "Kopjo linkun" : "Copy link";
  modal.querySelector("#detailsAdd").textContent = t("order");

  const slug = String(p.name || "produkt").normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "produkt";
  const shareUrl = window.location.origin + "/p/" + slug + "-" + encodeURIComponent(String(p.id));
  const shareText = (p.name || "DSS Shop") + " — " + (p.category || "") + " | " + money(basePrice(p)) + " | DSS Shop";

  // Give each product its own shareable URL and product-specific metadata.
  const pageTitle = (p.name || "Produkt") + " | DSS Shop";
  document.title = pageTitle;
  const setMeta = (selector, attr, value) => {
    let node = document.head.querySelector(selector);
    if (!node) {
      node = document.createElement("meta");
      const match = selector.match(/\[(name|property)="([^"]+)"\]/);
      if (match) node.setAttribute(match[1], match[2]);
      document.head.appendChild(node);
    }
    node.setAttribute("content", value || "");
  };
  setMeta('meta[name="description"]', "name", String(p.name || "Produkt DSS Shop") + " — " + String(p.description || p.category || "Shiko çmimin dhe disponueshmërinë në DSS Shop").slice(0, 140));
  setMeta('meta[property="og:title"]', "property", pageTitle);
  setMeta('meta[property="og:description"]', "property", String(p.description || p.category || "Porosit online në DSS Shop").slice(0, 180));
  setMeta('meta[property="og:url"]', "property", shareUrl);
  setMeta('meta[property="og:image"]', "property", p.image_url || "");
  setMeta('meta[name="twitter:title"]', "name", pageTitle);
  setMeta('meta[name="twitter:description"]', "name", String(p.description || p.category || "Porosit online në DSS Shop").slice(0, 180));
  let canonical = document.head.querySelector('link[rel="canonical"]');
  if (canonical) canonical.href = shareUrl;
  let productSchema = document.getElementById("dssDynamicProductSchema");
  if (!productSchema) {
    productSchema = document.createElement("script");
    productSchema.id = "dssDynamicProductSchema";
    productSchema.type = "application/ld+json";
    document.head.appendChild(productSchema);
  }
  productSchema.textContent = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Product",
    "name": p.name || "Produkt DSS Shop",
    "image": p.image_url ? [p.image_url] : [],
    "description": String(p.description || p.category || "Produkt në DSS Shop"),
    "sku": p.sku || String(p.id),
    "category": p.category || "",
    "offers": {
      "@type": "Offer",
      "url": shareUrl,
      "priceCurrency": "EUR",
      "price": String(basePrice(p)),
      "availability": Number(p.stock || 0) > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock"
    }
  });

  modal.querySelector("#shareFacebook").onclick = () => window.open("https://www.facebook.com/sharer/sharer.php?u=" + encodeURIComponent(shareUrl), "_blank", "noopener,noreferrer");
  modal.querySelector("#shareInstagram").onclick = () => window.open("https://www.instagram.com/pro.security.golem/", "_blank", "noopener,noreferrer");
  modal.querySelector("#shareCopy").onclick = async () => {
    try {
      await navigator.clipboard.writeText(shareText + "\n" + shareUrl);
      alert(language === "sq" ? "Linku i produktit u kopjua." : "Product link copied.");
    } catch (_) {
      window.prompt(language === "sq" ? "Kopjo linkun e produktit:" : "Copy product link:", shareUrl);
    }
  };
  modal.querySelector("#detailsAdd").onclick = () => {
    window.add(p);
    window.dssCloseProductDetails();
    const cartBox = document.querySelector("#cart");
    if (cartBox) cartBox.classList.add("open");
    const orderForm = document.querySelector("#orderForm");
    if (orderForm) {
      orderForm.classList.add("dss-order-visible");
      setTimeout(() => orderForm.scrollIntoView({ behavior: "smooth", block: "start" }), 180);
    }
  };

  if (modal.style.display !== "flex" && !dssDetailHistoryOpen) {
    const url = new URL(window.location.href);
    if (url.searchParams.get("product") !== String(p.id)) {
      url.searchParams.set("product", String(p.id));
      window.history.pushState({ ...(window.history.state || {}), dssProductDetails: true }, "", url.pathname + url.search + url.hash);
    }
    dssDetailHistoryOpen = true;
  }
  modal.style.display = "flex";
};
/* =========================================
   SHFAQJA E PRODUKTEVE
========================================= */

let dssRatingStats = {};

function ratingMarkup(productId, compact = false) {
  const stats = dssRatingStats[String(productId)] || { average: 0, count: 0 };
  const rounded = Math.round(stats.average);
  return `<div class="dss-rating-widget ${compact ? "compact" : ""}" data-rating-product="${esc(productId)}">
    <span class="dss-rating-stars" role="group" aria-label="Vlerëso produktin">
      ${[1,2,3,4,5].map(n => `<button type="button" class="dss-rating-star ${n <= rounded ? "filled" : ""}" data-rating="${n}" aria-label="${n} yje" title="Vlerëso me ${n} yje">★</button>`).join("")}
    </span>
    <span class="dss-rating-count">${stats.count ? stats.average.toFixed(1) + " (" + stats.count + ")" : "Vlerëso"}</span>
  </div>`;
}

async function loadProductRatings() {
  try {
    const { data, error } = await sb.from("product_ratings").select("product_id,rating");
    if (error) throw error;
    dssRatingStats = {};
    (data || []).forEach(row => {
      const key = String(row.product_id);
      if (!dssRatingStats[key]) dssRatingStats[key] = { total: 0, count: 0, average: 0 };
      dssRatingStats[key].total += Number(row.rating);
      dssRatingStats[key].count++;
      dssRatingStats[key].average = dssRatingStats[key].total / dssRatingStats[key].count;
    });
    render();
    const modal = document.getElementById("productDetailsModal");
    const activeId = modal?.dataset.productId;
    if (activeId) {
      const p = products.find(x => String(x.id) === String(activeId));
      if (p) updateDetailRating(p);
    }
  } catch (error) {
    console.warn("Vlerësimet e produkteve nuk u ngarkuan:", error.message || error);
  }
}

async function submitProductRating(productId, rating) {
  const widget = document.querySelectorAll(`.dss-rating-widget[data-rating-product="${CSS.escape(String(productId))}"]`);
  widget.forEach(el => el.querySelectorAll("button").forEach(b => b.disabled = true));
  try {
    const { data: { user } = {} } = await sb.auth.getUser();
    const row = { product_id: Number(productId), rating: Number(rating) };
    if (user?.id) row.user_id = user.id;
    const { error } = await sb.from("product_ratings").insert(row);
    if (error) throw error;
    toast("Faleminderit për vlerësimin!");
    await loadProductRatings();
  } catch (error) {
    console.error("Vlerësimi dështoi:", error);
    toast("Vlerësimi nuk u ruajt. Provo përsëri.");
  } finally {
    widget.forEach(el => el.querySelectorAll("button").forEach(b => b.disabled = false));
  }
}

document.addEventListener("click", event => {
  const star = event.target.closest(".dss-rating-star");
  if (!star) return;
  event.preventDefault();
  event.stopPropagation();
  const widget = star.closest(".dss-rating-widget");
  if (widget) submitProductRating(widget.dataset.ratingProduct, star.dataset.rating);
});

function updateDetailRating(p) {
  const modal = document.getElementById("productDetailsModal");
  if (!modal || !p) return;
  const holder = modal.querySelector(".dss-detail-stars");
  const stats = dssRatingStats[String(p.id)] || { average: 0, count: 0 };
  if (holder) {
    holder.innerHTML = ratingMarkup(p.id) + `<span class="dss-detail-rating-summary">${stats.count ? stats.average.toFixed(1) + " / 5 · " + stats.count + " vlerësime" : "Bëhu i pari që vlerëson"}</span>`;
  }
}

function render() {
  const searchEl = $("#search");
  const q = (searchEl?.value || "").toLowerCase().trim();
  const normalizedSearch = normalizeCategory(q);

  let a = products.filter((p) => {
    const name = String(p.name || "").toLowerCase();
    const categoryText = String(p.category || "").toLowerCase();
    const description = String(p.description || "").toLowerCase();

    const category = normalizeCategory(p.category);
    const selected = normalizeCategory(selectedCategory);

    const matchesSearch =
      !q ||
      name.includes(q) ||
      categoryText.includes(q) ||
      category.includes(normalizedSearch) ||
      description.includes(q);

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

    const priceHtml = (customerApproved && customerDiscountPercent > 0)
      ? `<div class="price">
          <span style="color:#aaa;text-decoration:line-through;font-size:14px">
            ${money(price)}
          </span>
          <br>
          ${money(discounted)}
          <span style="color:#35d07f;font-size:12px">-${customerDiscountPercent}%</span>
        </div>`
      : `<div class="price">${money(price)}</div>`;

    const encodedProduct = JSON.stringify(p)
      .replace(/</g, "\\u003c")
      .replace(/'/g, "&#39;");

    return `
      <article class="card" role="button" tabindex="0"
        aria-label="${esc(p.name)} — ${t("details")}"
        onclick='window.openProductDetails(${encodedProduct})'
        onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();window.openProductDetails(${encodedProduct})}"
        style="cursor:pointer">
        <div class="pic">
          ${p.image_url
            ? `<img src="${esc(p.image_url)}"
                    alt="${esc(p.name)}"
                    loading="lazy">`
            : "DSS"}
        </div>

        <div class="cat">${esc(p.category || "")}</div>
        <div style="display:inline-block;margin:5px 0 2px;padding:4px 7px;border-radius:5px;font-size:11px;font-weight:bold;background:${p.product_condition === "used" ? "#fff3d6" : "#d9fbe7"};color:${p.product_condition === "used" ? "#925f08" : "#087f46"};border:1px solid ${p.product_condition === "used" ? "#f2d28a" : "#91e6b6"};box-shadow:0 1px 3px rgba(8,127,70,.08)">${p.product_condition === "used" ? t("usedCondition") : t("newCondition")}</div>
        <h3>${esc(p.name)}</h3>

        ${priceHtml}

        <button type="button"
          onclick='event.stopPropagation();add(${encodedProduct});const cartBox=document.querySelector("#cart");if(cartBox)cartBox.classList.add("open");const orderForm=document.querySelector("#orderForm");if(orderForm){orderForm.classList.add("dss-order-visible");setTimeout(()=>orderForm.scrollIntoView({behavior:"smooth",block:"start"}),120)}'>
          ${t("order")}
        </button>
      </article>
    `;
  }).join("") || `<p>${t("noProducts")}</p>`;
}

/* =========================================
   KLIKIMI I KATEGORIVE
========================================= */

const categoryContainer = document.querySelector("#categories");
if (categoryContainer) {
  categoryContainer.addEventListener("click", (event) => {
    const button = event.target.closest(".category-btn");
    if (!button || !categoryContainer.contains(button)) return;
    selectedCategory = button.dataset.category || "all";
    categoryContainer.querySelectorAll(".category-btn").forEach((b) => {
      b.classList.toggle("active", b === button);
    });
    render();
  });
}

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
   FOTOT E KATEGORIVE
========================================= */

async function loadCategoriesUI() {
  const container = document.querySelector("#categories");
  if (!container) return;

  const fallbackMarkup = container.innerHTML;
  const adminCategoryFallback = [
    ["NVR","1791814279792-k3nn4nk.jpg"],
    ["DVR/XVR","1791814209732-l2rzqgg.webp"],
    ["Ip Camera","1791814504900-21u0gcm.jpg"],
    ["Alarme","1791814138267-v3b1hmu.png"],
    ["WI-FI Kamera","1791814066479-wp76d9d.webp"],
    ["Audio","1791814546563-6e27flj.jpg"],
    ["Storage","1791880844762-py9y8u1.jpg"],
    ["Kabllo & Rrjet","1791880758927-m2wptpz.png"],
    ["Power","1792136947096-o90enuw.webp"],
    ["Access Control","1791878069772-yqoki5s.jpg"],
    ["Rack Cabinet","1791877272450-f6wyow4.png"],
    ["Switch & PoE","1791877398137-gn3oupx.jpg"],
    ["Video Citofon","1791880668390-kpbd481.jpg"],
    ["RUTERA","1792138084273-gmhmtfr.jpg"],
    ["Aksesorë","1792124355625-pr6ptan.png"],
    ["CCTV Kamera","1792138959063-f177hfc.webp"]
  ];
  const renderAdminCategoryFallback = () => {
    const base = "https://mwimgsccsccltzrtedcq.supabase.co/storage/v1/object/public/product-image/categories/";
    container.innerHTML = adminCategoryFallback.map(function(item) {
      return '<button type="button" class="category-btn" data-category="' + esc(item[0]) + '" ><img src="' + base + item[1] + '" alt="' + esc(item[0]) + '" loading="eager" decoding="async"><span>' + esc(item[0]) + '</span></button>';
    }).join("");
  };
  const normalizeCategory = (value) => String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  const fallbackButtons = Array.from(container.querySelectorAll(".category-btn"));
  const fallbackImages = fallbackButtons
    .filter((button) => normalizeCategory(button.dataset.category) !== "all")
    .map((button) => ({
      name: String(button.dataset.category || ""),
      image: button.querySelector("img")?.getAttribute("src") || ""
    }))
    .filter((item) => item.image);
  const categoryImageFallback = (name, index) => {
    const normalized = normalizeCategory(name);
    const exact = fallbackImages.find((item) => normalizeCategory(item.name) === normalized);
    if (exact) return exact.image;
    const lower = String(name || "").toLowerCase();
    const matching = fallbackImages.find((item) => {
      const n = item.name.toLowerCase();
      return ((lower.includes("kamera") || lower.includes("camera")) && (n.includes("kamera") || n.includes("camera"))) ||
        ((lower.includes("dvr") || lower.includes("nvr") || lower.includes("xvr")) && (n.includes("dvr") || n.includes("nvr"))) ||
        (lower.includes("alarm") && n.includes("alarm")) ||
        ((lower.includes("akses") || lower.includes("access")) && (n.includes("akses") || n.includes("access"))) ||
        ((lower.includes("rrjet") || lower.includes("network")) && (n.includes("rrjet") || n.includes("network")));
    });
    return matching?.image || fallbackImages[index % Math.max(fallbackImages.length, 1)]?.image || "";
  };

  try {
    const { data, error } = await sb
      .from("categories")
      .select("name, image_url, active, sort_order")
      .order("sort_order", { ascending: true });
    if (error) throw error;

    const activeCategories = (data || []).filter((category) =>
      category.active !== false &&
      String(category.name || "").trim() &&
      !["te gjitha", "te gjitha produktet", "all"].includes(normalizeCategory(category.name))
    );

    if (!activeCategories.length) {
      renderAdminCategoryFallback();
      console.warn("Nuk u kthyen kategori aktive nga Supabase; u përdor lista rezervë e sinkronizuar me Admin.");

    } else {
      container.innerHTML = activeCategories.map((category, index) => {
        const name = String(category.name || "").trim();
        const fallbackImage = categoryImageFallback(name, index);
        const savedImage = String(category.image_url || "").trim();
        const image = savedImage || fallbackImage;
        return `<button type="button" class="category-btn" data-category="${esc(name)}">
          <img src="${esc(image)}" data-fallback-image="${esc(fallbackImage)}" alt="${esc(name)}" loading="eager" decoding="async">
          <span>${esc(name)}</span>
        </button>`;
      }).join("");

      container.querySelectorAll(".category-btn img").forEach((img) => {
        img.addEventListener("error", () => {
          const fallback = img.dataset.fallbackImage || "";
          if (fallback && img.src !== fallback) img.src = fallback;
          else img.style.visibility = "hidden";
        }, { once: true });
      });
    }

    selectedCategory = "all";
    const section = document.querySelector("#categoriesSection");
    if (section) {
      section.classList.add("dss-categories-ready");
      section.style.visibility = "visible";
    }
    container.querySelectorAll(".category-btn").forEach((button) => {
      button.classList.toggle("active", normalizeCategory(button.dataset.category) === normalizeCategory(selectedCategory));
    });
  } catch (error) {
    renderAdminCategoryFallback();
    const section = document.querySelector("#categoriesSection");
    if (section) {
      section.classList.add("dss-categories-ready");
      section.style.visibility = "visible";
    }
    console.error("Kategoritë nuk u ngarkuan nga Supabase; u rikthyen kategoritë rezervë:", error);
  }
}

/* =========================================
   NGARKIMI I PRODUKTEVE NGA SUPABASE
========================================= */

async function load() {
  // Start category loading without blocking the product request; both fetch in parallel.
  const categoriesLoading = loadCategoriesUI();

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

  await categoriesLoading;
  refreshCartPrices();
  render();
  renderCart();

  // Open the requested product when someone visits a shared product URL.
  const slugMatch = window.location.pathname.match(/^\/p\/.+-([0-9]+)\/?$/);
  const requestedProductId = new URLSearchParams(window.location.search).get("product") || (slugMatch ? slugMatch[1] : null);
  if (requestedProductId) {
    const requestedProduct = products.find(p => String(p.id) === String(requestedProductId));
    if (requestedProduct) {
      const url = new URL(window.location.href);
      url.searchParams.set("product", String(requestedProduct.id));
      window.history.replaceState({ ...(window.history.state || {}), dssDirectProductLink: true }, "", url.pathname + url.search + url.hash);
      window.openProductDetails(requestedProduct);
    }
  }
}

/* =========================================
   LLOGARIA E KLIENTIT
========================================= */

async function openAccount() {
  const box = $("#accountBox");

  if (!box) {
    alert(t("accountMissing"));
    return;
  }

  box.hidden = false;
  box.style.display = "flex";
  if (!dssAccountHistoryOpen) {
    window.history.pushState({ ...(window.history.state || {}), dssAccount: true }, "", window.location.href);
    dssAccountHistoryOpen = true;
  }

  // Always reconcile UI with Supabase's persisted session before showing login prompts.
  const { data: sessionData, error: sessionError } = await sb.auth.getSession();
  if (!sessionError) {
    const sessionUser = sessionData?.session?.user || null;
    if (sessionUser) {
      const approved = await checkCustomerApproval(sessionUser);
      currentUser = approved ? sessionUser : null;
      if (approved) {
        refreshCartPrices();
        render();
        dssStartPresence();
      }
    } else {
      currentUser = null;
      customerApproved = false;
    }
  }

  updateAccountUI();
}

function closeAccount() {
  const box = $("#accountBox");
  if (!box) return;

  box.style.display = "none";
  box.hidden = true;
  if (dssAccountHistoryOpen) {
    dssAccountHistoryOpen = false;
    window.history.back();
  }
}

function updateAccountUI(message) {
  const status = $("#accountStatus");
  const form = $("#accountForm");
  const identifier = $("#accountEmail");
  const password = $("#accountPassword");
  const submit = $("#accountSubmit");
  const switchBtn = $("#accountSwitch");
  const logout = $("#accountLogout");
  if (!status || !form || !identifier || !password || !submit || !switchBtn || !logout) return;

  if (currentUser) {
    status.innerHTML = "";
    const panel = document.createElement("div");
    panel.className = "dss-profile-panel";

    const heading = document.createElement("div");
    heading.className = "dss-profile-title";
    heading.textContent = "Profili yt";

    const email = document.createElement("div");
    email.className = "dss-profile-email";
    email.textContent = "Email: " + (currentUser.email || "Llogaria jote");

    const discount = document.createElement("div");
    discount.className = "dss-profile-discount";
    discount.textContent = customerApproved
      ? (customerDiscountPercent > 0 ? "Keni zbritje personale " + customerDiscountPercent + "%" : "Nuk ke ulje personale të caktuar.")
      : "Llogaria është në pritje të miratimit";

    const note = document.createElement("div");
    note.className = "dss-profile-note";
    note.textContent = message || (customerApproved
      ? "Je i/e kyçur në llogarinë tënde."
      : "Zbritja aktivizohet pasi administratori të miratojë llogarinë.");

    panel.append(heading, email, discount, note);
    status.appendChild(panel);
    form.hidden = true;
    switchBtn.hidden = true;
    logout.hidden = false;
    return;
  }

  form.hidden = false;
  logout.hidden = true;
  identifier.type = "email";
  identifier.placeholder = "Email-i";
  identifier.disabled = false;
  password.hidden = false;
  password.disabled = false;
  password.required = true;
  const otpInput = $("#accountOtp");
  if (otpInput) {
    otpInput.hidden = true;
    otpInput.required = false;
    otpInput.disabled = true;
  }
  switchBtn.hidden = false;
  switchBtn.textContent = accountMode === "signup" ? t("switchLogin") : t("switchSignup");
  submit.disabled = false;
  submit.textContent = accountMode === "signup" ? t("signup") : t("login");
  status.textContent = message || (accountMode === "signup" ? t("signupIntro") : t("loginIntro"));
}

async function finishCustomerLogin(user,successMessage){
  currentUser=user||null;const approved=await checkCustomerApproval(currentUser);
  if(!currentUser||!approved){
    if(currentUser)await sb.auth.signOut();currentUser=null;customerApproved=false;
    refreshCartPrices();render();updateAccountUI(t("approvalPending"));return false;
  }
  refreshCartPrices();render();dssStartPresence();updateAccountUI(successMessage||t("loginSuccess"));return true;
}

const accountForm=$("#accountForm");
if(accountForm)accountForm.addEventListener("submit",async(e)=>{
  e.preventDefault();const email=$("#accountEmail").value.trim(),password=$("#accountPassword").value,submit=$("#accountSubmit");
  if(!email||!email.includes("@")){updateAccountUI("Shkruaj një adresë emaili të vlefshme.");return;}
  submit.disabled=true;submit.textContent=t("wait");
  try{
    if(accountMode==="signup"){
      if(!password||password.length<6)throw new Error("Fjalëkalimi duhet të ketë të paktën 6 karaktere.");
      const {data,error}=await sb.auth.signUp({email,password,options:{emailRedirectTo:window.location.origin+window.location.pathname.replace(/[^/]*$/,"account.html")}});
      if(error)throw error;
      if(data.user){
        sb.functions.invoke("notify-new-customer",{body:{user_id:data.user.id}})
          .then(({error:notifyError})=>{if(notifyError)console.error("DSS signup email notification failed:",notifyError.message);})
          .catch((notifyError)=>console.error("DSS signup email notification failed:",notifyError));
      }
      if(data.session&&data.user)await finishCustomerLogin(data.user,t("signupSuccess"));else{accountMode="login";updateAccountUI(t("registered"));}
    }else{
      if(!password)throw new Error("Shkruaj fjalëkalimin.");
      const {data,error}=await sb.auth.signInWithPassword({email,password});if(error)throw error;await finishCustomerLogin(data.user,t("loginSuccess"));
    }
  }catch(error){updateAccountUI(t("registerError")+(error.message||"Action failed."));}
  finally{submit.disabled=false;submit.textContent=accountMode==="signup"?t("signup"):t("login");}
});
const accountSwitch=$("#accountSwitch");
if(accountSwitch)accountSwitch.addEventListener("click",()=>{accountMode=accountMode==="signup"?"login":"signup";updateAccountUI();});

const accountLogout = $("#accountLogout");

if (accountLogout) {
  accountLogout.addEventListener("click", async () => {
    const { error } = await sb.auth.signOut();

    if (error) {
      updateAccountUI(t("logoutError") + error.message);
      return;
    }

    currentUser = null;
    customerApproved = false;
    refreshCartPrices();
    render();
    updateAccountUI(t("loggedOut"));
  });
}

const accountClose = $("#accountClose");

if (accountClose) {
  accountClose.addEventListener("click", closeAccount);
}

/* =========================================
   NAVIGIMI I SEKSIONEVE TË PROFILIT
   Më parë butonat Porositë dhe Lista e dëshirave
   nuk kishin event handlers.
========================================= */
async function showAccountTab(tabName) {
  const validTabs = ["profile", "orders", "wishlist"];
  const tab = validTabs.includes(tabName) ? tabName : "profile";

  // Reconcile every account tab with the persisted Supabase session to avoid stale login prompts.
  const { data: sessionData, error: sessionError } = await sb.auth.getSession();
  if (!sessionError) {
    const sessionUser = sessionData?.session?.user || null;
    if (sessionUser) {
      const approved = await checkCustomerApproval(sessionUser);
      currentUser = approved ? sessionUser : null;
      if (approved) {
        refreshCartPrices();
        render();
      }
    } else {
      currentUser = null;
      customerApproved = false;
    }
  }

  const status = $("#accountStatus");
  const form = $("#accountForm");
  const switchBtn = $("#accountSwitch");
  const logout = $("#accountLogout");
  const sectionTitle = $("#accountSectionTitle");
  const tabMessage = $("#dssAccountTabMessage");

  document.querySelectorAll("[data-account-tab]").forEach((button) => {
    const active = button.dataset.accountTab === tab;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", active ? "true" : "false");
  });

  if (!status || !sectionTitle || !tabMessage) return;
  tabMessage.hidden = true;
  tabMessage.textContent = "";
  status.hidden = false;

  if (tab === "profile") {
    sectionTitle.textContent = "Informacioni i Llogarisë";
    if (currentUser) {
      updateAccountUI();
    } else {
      status.textContent = "Hyr ose regjistrohu për të hapur profilin tënd.";
      if (form) form.hidden = false;
      if (switchBtn) switchBtn.hidden = false;
      if (logout) logout.hidden = true;
    }
    return;
  }

  if (!currentUser) {
    sectionTitle.textContent = tab === "orders" ? "Porositë e mia" : "Lista e dëshirave";
    status.textContent = "Për të parë këtë seksion, fillimisht hyr në llogarinë tënde.";
    if (form) form.hidden = false;
    if (switchBtn) switchBtn.hidden = false;
    if (logout) logout.hidden = true;
    return;
  }

  if (form) form.hidden = true;
  if (switchBtn) switchBtn.hidden = true;
  if (logout) logout.hidden = false;

  if (tab === "orders") {
    sectionTitle.textContent = "Porositë e mia";
    status.textContent = "Po ngarkohen porositë...";
    tabMessage.hidden = true;
    sb.from("orders")
      .select("id, created_at, total, status")
      .eq("user_id", currentUser.id)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (document.querySelector('[data-account-tab="orders"]')?.classList.contains("active") !== true) return;
        status.textContent = "";
        tabMessage.hidden = false;
        if (error) {
          console.error("DSS customer orders:", error.message);
          tabMessage.textContent = "Nuk mundëm t'i ngarkojmë porositë. Provo përsëri më vonë.";
          return;
        }
        if (!data || !data.length) {
          tabMessage.textContent = "Nuk ke ende porosi të lidhura me këtë llogari.";
          return;
        }
        const labels = { new: "E re", processing: "Në përpunim", completed: "Përfunduar", cancelled: "Anuluar" };
        tabMessage.innerHTML = data.map((order) =>
          '<article style="padding:12px 0;border-bottom:1px solid #e5e7eb">' +
          '<strong>Porosia #' + esc(order.id) + '</strong>' +
          '<div style="margin-top:6px">Data: ' + esc(order.created_at ? new Date(order.created_at).toLocaleDateString("sq-AL") : "—") + '</div>' +
          '<div>Totali: ' + money(order.total) + '</div>' +
          '<div>Statusi: ' + esc(labels[order.status] || order.status || "Në pritje") + '</div>' +
          '</article>'
        ).join("");
      });
    return;
  }

  sectionTitle.textContent = "Lista e dëshirave";
  status.textContent = "";
  const saved = (() => {
    try {
      const value = JSON.parse(localStorage.getItem("dss_wishlist") || "[]");
      return Array.isArray(value) ? value : [];
    } catch (_) { return []; }
  })();

  tabMessage.hidden = false;
  if (!saved.length) {
    tabMessage.textContent = "Lista e dëshirave është bosh. Produktet e ruajtura do të shfaqen këtu.";
  } else {
    tabMessage.innerHTML = saved.map((item) =>
      '<div style="padding:10px 0;border-bottom:1px solid #e5e7eb"><strong>' +
      esc(item.name || "Produkt DSS") + '</strong>' +
      (item.price != null ? '<div>' + money(item.price) + '</div>' : '') +
      '</div>'
    ).join("");
  }
}

document.querySelectorAll("[data-account-tab]").forEach((button) => {
  button.addEventListener("click", () => showAccountTab(button.dataset.accountTab));
});

const accountBox = $("#accountBox");

if (accountBox) {
  accountBox.addEventListener("click", (e) => {
    if (e.target === accountBox) closeAccount();
  });
}

const profileBtn = $("#profileBtn");

if (profileBtn) {
  profileBtn.onclick = (event) => {
    event.preventDefault();
    openAccount();
  };
}

/* =========================================
   SESIONI I KLIENTIT
========================================= */

sb.auth.getSession().then(async ({ data, error }) => {
  if (error) console.error("Session check error:", error);

  currentUser = data?.session?.user || null;
  await checkCustomerApproval(currentUser);

  if (currentUser && !customerApproved) {
    await sb.auth.signOut();
    currentUser = null;
    customerApproved = false;
    accountMode = "login";
    refreshCartPrices();
    render();
    updateAccountUI("Llogaria është në pritje të miratimit të administratorit. Hyrja do të lejohet pasi të aprovohet.");
    return;
  }

  refreshCartPrices();
  render();
  if (currentUser && customerApproved) dssStartPresence();
  updateAccountUI();
});

// Do not query Supabase from the auth listener: approval is checked by
// finishCustomerLogin() and the initial session check. Duplicate requests here
// can race and leave the customer account screen stuck at "Prit...".
sb.auth.onAuthStateChange((_event, session) => {
  currentUser = session?.user || null;

  if (!currentUser) {
    customerApproved = false;
    refreshCartPrices();
    render();
    updateAccountUI();
  }
});

/* PRANIA ONLINE: ruaj vetëm sesionet e klientëve të miratuar. */
let dssPresenceTimer = null;
async function dssUpdateCustomerPresence() {
  if (!currentUser?.id || !customerApproved || document.visibilityState === "hidden") return;
  const { error } = await sb.from("customer_presence").upsert({
    user_id: currentUser.id,
    email: currentUser.email || null,
    last_seen: new Date().toISOString()
  }, { onConflict: "user_id" });
  if (error) console.warn("DSS presence update failed:", error.message);
}
function dssStartPresence() {
  dssUpdateCustomerPresence();
  if (dssPresenceTimer) clearInterval(dssPresenceTimer);
  dssPresenceTimer = setInterval(dssUpdateCustomerPresence, 30000);
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") dssUpdateCustomerPresence();
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

const checkoutButton = $("#dssCheckoutButton");
if (checkoutButton) checkoutButton.onclick = () => {
  const form = $("#orderForm");
  if (form) {
    form.classList.add("dss-order-visible");
    form.scrollIntoView({behavior:"smooth", block:"start"});
  }
};
const continueButton = $("#dssContinueButton");
if (continueButton) continueButton.onclick = () => {
  const cartBox = $("#cart");
  if (cartBox) cartBox.classList.remove("open");
};

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

      // Njoftimi me email dërgohet në sfond; dështimi i email-it nuk anulon porosinë.
      sb.functions.invoke("notify-new-order",{body:{order_id:orderId}})
        .then(({error:notifyError})=>{if(notifyError)console.error("DSS order email notification failed:",notifyError.message);})
        .catch((notifyError)=>console.error("DSS order email notification failed:",notifyError));

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
        (currentUser && customerApproved ? "\nUlje klienti: " + customerDiscountPercent + "%" : "");

      cart = [];
      save();
      e.target.reset();

      toast(t("orderSuccess") + orderId);

      window.open(
        "https://wa.me/355684398803?text=" + encodeURIComponent(message),
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
   BANERET
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

    const title = document.getElementById("dssBannerTitle");
    const subtitle = document.getElementById("dssBannerSubtitle");
    const img = document.getElementById("dssBannerImage");
    const button = document.getElementById("dssBannerButton");

    if (title) title.textContent = b.title || "";
    if (subtitle) subtitle.textContent = b.subtitle || "";

    if (img && b.image_url) {
      img.src = b.image_url;
      img.style.display = "block";
    }

    if (button && b.button_text) {
      button.textContent = b.button_text;
      button.href = b.button_url || "#products";
      button.style.display = "inline-block";
    }

    section.style.display = "block";
  } catch (error) {
    console.error("Gabim me banerin DSS:", error);
  }
}

/* =========================================
   NISJA E FAQES
========================================= */

/* REGJISTRIMI I VIZITAVE — pa ruajtur IP ose të dhëna personale */
(function trackDssVisit() {
  try {
    const ua = navigator.userAgent || "";
    const device = /ipad|tablet/i.test(ua) ? "tablet" :
      /mobile|android|iphone/i.test(ua) ? "mobile" :
      /windows|macintosh|linux/i.test(ua) ? "desktop" : "unknown";
    let referrerHost = null;
    try { referrerHost = document.referrer ? new URL(document.referrer).hostname : null; } catch (_) {}
    sb.from("site_visits").insert({
      page_path: location.pathname,
      referrer_host: referrerHost,
      device_type: device
    }).then(({ error }) => {
      if (error) console.warn("Vizita nuk u regjistrua:", error.message);
    });
  } catch (error) {
    console.warn("Gabim gjatë regjistrimit të vizitës:", error);
  }
})();

applyLanguage();
load();
loadBanners();
loadProductRatings();
