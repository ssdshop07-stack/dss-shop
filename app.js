
const sb = window.supabase.createClient(
  window.DSS_SUPABASE_URL,
  window.DSS_SUPABASE_KEY
);

let products = [];
let cart = JSON.parse(localStorage.getItem("dss_cart") || "[]");
let selectedCategory = "all";
let currentUser = null;
let accountMode = "signup";

const $ = (s) => document.querySelector(s);

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

function renderCart() {
  $("#cartCount").textContent =
    cart.reduce((a, x) => a + x.qty, 0);

  $("#cartItems").innerHTML = cart.map((x, i) => `
    <div class="cartItem">
      <div>
        <b>${esc(x.name)}</b>
        <small>${money(x.price)} × ${x.qty}</small>
      </div>
      <div>
        <button onclick="change(${i},-1)">−</button>
        <button onclick="change(${i},1)">+</button>
      </div>
    </div>
  `).join("") || "<p>Shporta është bosh.</p>";

  const total = cart.reduce(
    (a, x) => a + x.price * x.qty, 0
  );

  $("#total").textContent = money(total);
}

window.change = (i, d) => {
  if (!cart[i]) return;

  cart[i].qty += d;

  if (cart[i].qty <= 0) {
    cart.splice(i, 1);
  }

  save();
};

function render() {
  const q = ($("#search").value || "").toLowerCase().trim();

  let a = products.filter((p) => {
    const name = (p.name || "").toLowerCase();
    const category = (p.category || "").toLowerCase();

    return (
      (name.includes(q) || category.includes(q)) &&
      (
        selectedCategory === "all" ||
        category === selectedCategory.toLowerCase()
      )
    );
  });

  const sort = $("#sort").value;

  if (sort === "low") {
    a.sort((x, y) => basePrice(x) - basePrice(y));
  }

  if (sort === "high") {
    a.sort((x, y) => basePrice(y) - basePrice(x));
  }

  $("#grid").innerHTML = a.map((p) => {
    const price = basePrice(p);
    const discounted = customerPrice(price);

    const priceHtml = currentUser
      ? `
        <div class="price">
          <span style="color:#aaa;text-decoration:line-through;font-size:14px">
            ${money(price)}
          </span>
          <br>
          ${money(discounted)}
          <span style="color:#35d07f;font-size:12px">-10%</span>
        </div>
      `
      : `<div class="price">${money(price)}</div>`;

    return `
      <article class="card">
        <div class="pic">
          ${p.image_url
            ? `<img src="${esc(p.image_url)}" alt="${esc(p.name)}" loading="lazy">`
            : "DSS"}
        </div>
        <div class="cat">${esc(p.category || "")}</div>
        <h3>${esc(p.name)}</h3>
        ${priceHtml}
        <button onclick='add(${JSON.stringify(p).replace(/'/g, "&#39;")})'>
          Shto në shportë
        </button>
      </article>
    `;
  }).join("") || "<p>Nuk u gjetën produkte në këtë kategori.</p>";
}

document.querySelectorAll(".category-btn").forEach((button) => {
  button.addEventListener("click", () => {
    selectedCategory = button.dataset.category;

    document.querySelectorAll(".category-btn").forEach((b) => {
      b.classList.toggle("active", b === button);
    });

    render();
  });
});

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
  toast("U shtua në shportë");
};

function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("show");

  setTimeout(() => {
    $("#toast").classList.remove("show");
  }, 1800);
}

async function load() {
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
        console.error("Gabim gjatë ngarkimit të produkteve:", error);
      } else {
        products = data || [];
      }
    }
  } catch (error) {
    console.error("Lidhja me Supabase dështoi:", error);
  }

  if (!products.length) {
    try {
      const response = await fetch("products.json");

      if (response.ok) {
        products = await response.json();
      }
    } catch (error) {
      console.error("Gabim te products.json:", error);
    }
  }

  refreshCartPrices();
  render();
  renderCart();
}

function openAccount() {
  const box = $("#accountBox");
  if (!box) {
    alert("Nuk u gjet formulari i llogarisë në index.html.");
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

  if (currentUser) {
    status.textContent = message ||
      "Je i/e kyçur si " + currentUser.email +
      ". Përfiton 10% ulje në të gjitha produktet.";

    form.hidden = true;
    switchBtn.hidden = true;
    logout.hidden = false;
  } else {
    status.textContent = message || (
      accountMode === "signup"
        ? "Krijo llogari për të përfituar 10% ulje në të gjitha produktet."
        : "Hyr në llogarinë tënde për të përfituar 10% ulje."
    );

    form.hidden = false;
    email.disabled = false;
    password.disabled = false;
    submit.disabled = false;

    submit.textContent =
      accountMode === "signup" ? "Regjistrohu" : "Hyr";

    switchBtn.hidden = false;
    switchBtn.textContent =
      accountMode === "signup"
        ? "Kam llogari — Hyr"
        : "Nuk kam llogari — Regjistrohu";

    logout.hidden = true;
  }
}

$("#accountForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = $("#accountEmail").value.trim();
  const password = $("#accountPassword").value;
  const submit = $("#accountSubmit");

  if (!email || !password) {
    updateAccountUI("Shkruaj email-in dhe fjalëkalimin.");
    return;
  }

  submit.disabled = true;
  submit.textContent = "Prit...";

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

        updateAccountUI(
          "Llogaria u krijua me sukses! Ke 10% ulje."
        );
      } else {
        accountMode = "login";

        updateAccountUI(
          "Regjistrimi u krye. Kontrollo email-in për konfirmim, pastaj hyr në llogari."
        );
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

      updateAccountUI("U kyçe me sukses! Tani ke 10% ulje.");
    }
  } catch (error) {
    updateAccountUI(
      "Gabim: " + (error.message || "Nuk u krye veprimi.")
    );
  } finally {
    submit.disabled = false;

    if (!currentUser) {
      submit.textContent =
        accountMode === "signup" ? "Regjistrohu" : "Hyr";
    }
  }
});

$("#accountSwitch").addEventListener("click", () => {
  accountMode = accountMode === "signup" ? "login" : "signup";
  updateAccountUI();
});

$("#accountLogout").addEventListener("click", async () => {
  const { error } = await sb.auth.signOut();

  if (error) {
    updateAccountUI("Gabim gjatë daljes: " + error.message);
    return;
  }

  currentUser = null;
  refreshCartPrices();
  render();
  updateAccountUI("Dole nga llogaria. Çmimet tani janë pa ulje.");
});

$("#accountClose").addEventListener("click", closeAccount);

$("#accountBox").addEventListener("click", (e) => {
  if (e.target === $("#accountBox")) closeAccount();
});

$("#profileBtn").onclick = openAccount;

sb.auth.getSession().then(({ data, error }) => {
  if (error) console.error("Gabim në kontrollin e sesionit:", error);

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

$("#search").oninput = render;
$("#sort").onchange = render;

$("#cartBtn").onclick = () => $("#cart").classList.add("open");
$("#closeCart").onclick = () => $("#cart").classList.remove("open");

$("#orderForm").onsubmit = async (e) => {
  e.preventDefault();

  if (!cart.length) {
    toast("Shporta është bosh");
    return;
  }

  const button = e.target.querySelector('button[type="submit"]');
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
      console.error("Gabim gjatë regjistrimit të porosisë:", error);

      alert(
        "Gabim Supabase: " + error.message +
        " | Kodi: " + (error.code || "pa kod")
      );

      return;
    }

    const total = cart.reduce(
      (a, x) => a + x.price * x.qty, 0
    );

    const message =
      "Përshëndetje DSS, dua të bëj një porosi.\n\n" +
      cart.map((x) =>
        `${x.name} x${x.qty} — ${money(x.price * x.qty)}`
      ).join("\n") +
      `\n\nTotal: ${money(total)}` +
      `\nEmri: ${order.customer_name}` +
      `\nTel: ${order.phone}` +
      `\nAdresa: ${order.address}` +
      (currentUser ? "\nUlje klienti: 10%" : "");

    cart = [];
    save();
    e.target.reset();

    toast("Porosia u regjistrua! Nr. " + orderId);

    window.open(
      "https://wa.me/?text=" + encodeURIComponent(message),
      "_blank"
    );
  } catch (error) {
    console.error("Gabim gjatë porosisë:", error);

    alert(
      "Gabim gjatë porosisë: " +
      (error.message || "Gabim i panjohur")
    );
  } finally {
    if (button) button.disabled = false;
  }
};

load();
