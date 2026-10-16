
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
    accountIntro: "Krijo llogari ose hyr në llogarinë tënde.",
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
    password: "Password (minimum 6 characters)",
    signup: "Register",
    login: "Sign in",
    switchLogin: "I have an account — Sign in",
    switchSignup: "I don't have an account — Register",
    logout: "Sign out",
    closeAccount: "Close ×",
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
  return customerApproved
    ? Math.round(Number(price) * 90) / 100
    : Number(price);
}

async function checkCustomerApproval(user) {
  customerApproved = false;
  if (!user?.id) return false;
  const { data, error } = await sb
    .from("customer_approvals")
    .select("status")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) {
    console.error("DSS approval check failed:", error.message);
    return false;
  }
  customerApproved = data?.status === "approved";
  return customerApproved;
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
      #productDetailsModal .dss-detail-panel{position:relative;width:min(100%,1000px);max-height:92vh;overflow:auto;background:#111217;color:#f7f7f8;border:1px solid #34353d;border-radius:18px;box-shadow:0 24px 80px #000b;padding:22px;box-sizing:border-box}
      #productDetailsModal .dss-detail-close{position:absolute;top:14px;right:14px;width:40px;height:40px;border:1px solid #45464e;border-radius:50%;background:#24252c;color:white;font-size:22px;z-index:2}
      #productDetailsModal #detailsBreadcrumb{display:flex;flex-wrap:wrap;align-items:center;gap:7px;padding-right:48px;font-size:12px;line-height:1.5;margin:3px 0 18px}
      #productDetailsModal .dss-detail-layout{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:28px;align-items:start}
      #productDetailsModal .dss-detail-photo{display:flex;align-items:center;justify-content:center;min-height:300px;background:#f6f6f6;border-radius:13px;overflow:hidden}
      #productDetailsModal #detailsImage{display:block;width:100%;height:100%;max-height:470px;min-height:260px;object-fit:contain;margin:0}
      #productDetailsModal #detailsCategory{display:inline-block;color:#ff626b;background:#30171b;border:1px solid #52242c;border-radius:20px;padding:6px 10px;font-size:11px;font-weight:bold;margin:2px 0 10px}
      #productDetailsModal #detailsName{font-size:clamp(22px,3vw,30px);line-height:1.25;letter-spacing:-.4px;margin:0 44px 10px 0;overflow-wrap:anywhere;text-transform:uppercase}
      #productDetailsModal .dss-detail-stars{display:flex;align-items:center;gap:12px;color:#c9c9c9;margin:0 0 18px;font-size:14px}
      #productDetailsModal .dss-detail-stars .stars{color:#555;font-size:22px;letter-spacing:2px;white-space:nowrap}
      #productDetailsModal .dss-price-stock-row{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;border-top:1px solid #292929;border-bottom:1px solid #292929;padding:15px 0;margin:0 0 18px}
      #productDetailsModal #detailsPrice{font-size:clamp(25px,5vw,34px);font-weight:800;color:#fff;margin:0}
      #productDetailsModal #detailsStock{margin:0;border:1px solid #174a2c;border-radius:30px;padding:9px 13px;background:#092014;color:#20d16b;font-weight:800;white-space:nowrap}
      #productDetailsModal #detailsPersonalDiscount{display:none;align-items:center;justify-content:space-between;gap:12px;background:#092014;border:1px solid #174a2c;border-radius:14px;padding:16px;margin:0 0 22px;color:#20d16b;font-size:15px;font-weight:bold}
      #productDetailsModal #detailsPersonalDiscount .discount-sub{display:block;color:#168b47;font-weight:normal;font-size:13px;margin-top:4px}
      #productDetailsModal #detailsPersonalDiscount .discount-price{font-size:25px;white-space:nowrap}
      #productDetailsModal .dss-detail-meta{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 18px}
      #productDetailsModal .dss-detail-meta p{margin:0;background:#202127;border:1px solid #34353d;border-radius:8px;padding:9px 11px;color:#d4d5da;font-size:12px}\n      #productDetailsModal #detailsStock{background:#12351f;border-color:#247442;color:#75e69a;font-weight:800}
      #productDetailsModal #detailsDescriptionTitle{font-size:16px;margin:20px 0 8px}
      #productDetailsModal #detailsDescription{white-space:pre-wrap;line-height:1.7;color:#c9cad0;font-size:14px;margin:0 0 20px;overflow-wrap:anywhere}
      #productDetailsModal #detailsAdd{width:100%;min-height:48px;padding:14px;background:#e32636;color:#fff;border:0;border-radius:9px;font-weight:bold;font-size:15px;cursor:pointer}
      #productDetailsModal #detailsShare{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0 0}
      #productDetailsModal #detailsShare button{flex:1;min-width:95px;min-height:40px;padding:10px;background:#24252c;color:#fff;border:1px solid #41424a;border-radius:8px;font-size:12px;font-weight:bold;cursor:pointer}
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

    modal.querySelector("#detailsClose").onclick = () => { modal.style.display = "none"; };
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.style.display = "none";
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") modal.style.display = "none";
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
    modal.style.display = "none";
    selectedCategory = "all";
    document.querySelectorAll("#categories .category-btn").forEach(button => button.classList.remove("active"));
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  window.dssBreadcrumbCategory = () => {
    modal.style.display = "none";
    selectedCategory = p.category || "all";
    document.querySelectorAll("#categories .category-btn").forEach(button => {
      button.classList.toggle("active", normalizeCategory(button.dataset.category) === normalizeCategory(selectedCategory));
    });
    render();
    const productsSection = document.getElementById("products");
    if (productsSection) productsSection.scrollIntoView({ behavior: "smooth", block: "start" });
  };

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
    : (language === "sq" ? "Keni zbritje personale: -10%" : "Your personal discount: -10%");
  personalDiscount.querySelector(".discount-sub").textContent = language === "sq" ? "Aplikohet automatikisht në checkout" : "Applied automatically at checkout";
  modal.querySelector("#detailsDiscountPrice").textContent = money(hasProductSale ? salePrice : finalCustomerPrice);
  personalDiscount.style.display = (hasProductSale || customerApproved) ? "flex" : "none";
  modal.querySelector("#detailsDescriptionTitle").textContent = t("description");
  modal.querySelector("#detailsDescription").textContent = description || t("noDescription");
  modal.querySelector("#shareCopy").textContent = language === "sq" ? "Kopjo linkun" : "Copy link";
  modal.querySelector("#detailsAdd").textContent = t("add");

  const shareUrl = window.location.href.split("#")[0] + "#product-" + encodeURIComponent(String(p.id ?? p.name ?? ""));
  const shareText = (p.name || "DSS Shop") + " — " + (p.category || "") + " | " + money(basePrice(p)) + " | DSS Shop";

  modal.querySelector("#shareFacebook").onclick = () => window.open("https://www.facebook.com/share/1HYfafBQqb/", "_blank", "noopener,noreferrer");
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
    modal.style.display = "none";
  };

  modal.style.display = "flex";
};
/* =========================================
   SHFAQJA E PRODUKTEVE
========================================= */

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

    const priceHtml = customerApproved
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
        <div style="display:inline-block;margin:5px 0 2px;padding:4px 7px;border-radius:5px;font-size:11px;font-weight:bold;background:${p.product_condition === "used" ? "#5a421b" : "#173e2b"};color:${p.product_condition === "used" ? "#ffd27a" : "#8ff0b0"}">${p.product_condition === "used" ? t("usedCondition") : t("newCondition")}</div>
        <h3>${esc(p.name)}</h3>

        ${priceHtml}

        <button type="button"
          onclick='event.stopPropagation();add(${encodedProduct})'>
          ${t("add")}
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

  try {
    const { data, error } = await sb
      .from("categories")
      .select("name, image_url, active, sort_order")
      .order("sort_order", { ascending: true });

    if (error) throw error;

    const normalize = (value) => String(value || "")
      .normalize("NFD")
      .replace(/[\\u0300-\\u036f]/g, "")
      .toLowerCase()
      .trim();

    const rows = data || [];
    const activeCategories = rows.filter((category) =>
      category.active !== false &&
      String(category.name || "").trim() &&
      !["te gjitha", "te gjitha produktet", "all"].includes(normalize(category.name))
    );

    container.innerHTML = activeCategories.map((category, index) => {
      const name = String(category.name || "").trim();
      return `<button type="button" class="category-btn${index === 0 ? " active" : ""}" data-category="${esc(name)}">
        ${category.image_url ? `<img src="${esc(category.image_url)}" alt="${esc(name)}" loading="lazy">` : ""}
        <span>${esc(name)}</span>
      </button>`;
    }).join("");

    // Shfaq të gjitha produktet në hapjen e faqes, pa një kartë "Të gjitha".
    selectedCategory = "all";
    container.querySelectorAll(".category-btn").forEach((button) => {
      button.classList.remove("active");
    });
  } catch (error) {
    console.error("Kategoritë nuk u ngarkuan nga Supabase:", error);
  }
}

/* =========================================
   NGARKIMI I PRODUKTEVE NGA SUPABASE
========================================= */

async function load() {
  await loadCategoriesUI();

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
          password,
          options: {
            emailRedirectTo: window.location.origin + window.location.pathname.replace(/[^/]*$/, "account.html")
          }
        });

        if (error) throw error;

        if (data.session && data.user) {
          currentUser = data.user;
          await checkCustomerApproval(currentUser);
          refreshCartPrices();
          render();
          updateAccountUI(customerApproved ? t("signupSuccess") : "Llogaria u krijua. Prit miratimin e administratorit për të aktivizuar uljen.");
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
        await checkCustomerApproval(currentUser);
        refreshCartPrices();
        render();
        updateAccountUI(customerApproved ? t("loginSuccess") : "U kyçe, por llogaria është ende në pritje të miratimit. Çmimet mbeten pa ulje.");
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

const accountBox = $("#accountBox");

if (accountBox) {
  accountBox.addEventListener("click", (e) => {
    if (e.target === accountBox) closeAccount();
  });
}

const profileBtn = $("#profileBtn");

if (profileBtn) {
  profileBtn.onclick = () => {
    window.location.href = "./account.html";
  };
}

/* =========================================
   SESIONI I KLIENTIT
========================================= */

sb.auth.getSession().then(async ({ data, error }) => {
  if (error) console.error("Session check error:", error);

  currentUser = data?.session?.user || null;
  await checkCustomerApproval(currentUser);
  refreshCartPrices();
  render();
  updateAccountUI();
});

sb.auth.onAuthStateChange(async (_event, session) => {
  currentUser = session?.user || null;
  await checkCustomerApproval(currentUser);
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
