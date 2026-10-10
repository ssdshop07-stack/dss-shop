const sb = window.supabase.createClient(
  window.DSS_SUPABASE_URL,
  window.DSS_SUPABASE_KEY
);

let products = [];
let cart = JSON.parse(localStorage.getItem("dss_cart") || "[]");

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

function save() {
  localStorage.setItem("dss_cart", JSON.stringify(cart));
  renderCart();
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

  $("#total").textContent = money(
    cart.reduce((a, x) => a + x.price * x.qty, 0)
  );
}

window.change = (i, d) => {
  cart[i].qty += d;

  if (cart[i].qty <= 0) {
    cart.splice(i, 1);
  }

  save();
};

function render() {
  const q = $("#search").value.toLowerCase();

  let a = products.filter(p =>
    (p.name || "").toLowerCase().includes(q) ||
    (p.category || "").toLowerCase().includes(q)
  );

  const s = $("#sort").value;

  if (s === "low") {
    a.sort((x, y) => x.price - y.price);
  }

  if (s === "high") {
    a.sort((x, y) => y.price - x.price);
  }

  $("#grid").innerHTML = a.map(p => `
    <article class="card">
      <div class="pic">
        ${p.image_url
          ? `<img src="${esc(p.image_url)}" alt="">`
          : "DSS"}
      </div>
      <div class="cat">${esc(p.category || "")}</div>
      <h3>${esc(p.name)}</h3>
      <div class="price">${money(p.sale_price || p.price)}</div>
      <button onclick='add(${JSON.stringify(p)})'>
        Shto në shportë
      </button>
    </article>
  `).join("") || "<p>Nuk u gjetën produkte.</p>";
}

window.add = (p) => {
  const x = cart.find(x => x.id === p.id);

  if (x) {
    x.qty++;
  } else {
    cart.push({
      id: p.id,
      name: p.name,
      price: Number(p.sale_price || p.price),
      qty: 1
    });
  }

  save();
  toast("U shtua në shportë");
};

function toast(t) {
  $("#toast").textContent = t;
  $("#toast").classList.add("show");

  setTimeout(() => {
    $("#toast").classList.remove("show");
  }, 1800);
}

async function load() {
  try {
    if (!window.DSS_SUPABASE_URL.includes("PASTE_")) {
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
      const r = await fetch("products.json");

      if (r.ok) {
        products = await r.json();
      }
    } catch (error) {
      console.error("Gabim te products.json:", error);
    }
  }

  render();
  renderCart();
}

$("#search").oninput = render;
$("#sort").onchange = render;

$("#cartBtn").onclick = () =>
  $("#cart").classList.add("open");

$("#closeCart").onclick = () =>
  $("#cart").classList.remove("open");

$("#orderForm").onsubmit = async (e) => {
  e.preventDefault();

  if (!cart.length) {
    return toast("Shporta është bosh");
  }

  const button = e.target.querySelector('button[type="submit"]');
  if (button) button.disabled = true;

  try {
    const f = new FormData(e.target);
    const total = cart.reduce(
      (a, x) => a + x.price * x.qty, 0
    );

    const order = {
      customer_name: String(f.get("name") || "").trim(),
      phone: String(f.get("phone") || "").trim(),
      address: String(f.get("address") || "").trim(),
      total,
      status: "new"
    };

    const { data, error } = await sb
      .from("orders")
      .insert(order)
      .select()
      .single();

    if (error) {
      console.error("Gabim gjatë regjistrimit të porosisë:", error);

      alert(
        "Gabim Supabase: " + error.message +
        " | Kodi: " + (error.code || "pa kod")
      );

      return;
    }

    const items = cart.map(x => ({
      order_id: data.id,
      product_id: x.id,
      product_name: x.name,
      quantity: x.qty,
      unit_price: x.price
    }));

    const { error: itemsError } = await sb
      .from("order_items")
      .insert(items);

    if (itemsError) {
      console.error("Gabim te artikujt e porosisë:", itemsError);

      alert(
        "Porosia u krijua, por artikujt nuk u ruajtën: " +
        itemsError.message +
        " | Kodi: " + (itemsError.code || "pa kod") +
        ". Kontakto administratorin për ta plotësuar porosinë."
      );

      return;
    }

    const msg =
      `Përshëndetje DSS, dua të bëj një porosi.\n\n` +
      cart.map(x =>
        `${x.name} x${x.qty} — ${money(x.price * x.qty)}`
      ).join("\n") +
      `\n\nTotal: ${money(total)}` +
      `\nEmri: ${order.customer_name}` +
      `\nTel: ${order.phone}` +
      `\nAdresa: ${order.address}`;

    cart = [];
    save();
    e.target.reset();

    toast("Porosia u regjistrua!");

    window.open(
      "https://wa.me/?text=" + encodeURIComponent(msg),
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
