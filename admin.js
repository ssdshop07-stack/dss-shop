(function () {
function startAdmin() {
"use strict";

/* DSS SHOP - ADMIN */

const $ = (id) => document.getElementById(id);

function message(element, text, error = false) {
  if (!element) return;
  element.textContent = text || "";
  element.style.color = error ? "#b42318" : "#067647";
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function money(value) {
  return "€" + Number(value || 0).toFixed(2);
}

/* SUPABASE */

const loginMsg = $("loginMsg");

if (!window.supabase) {
  message(loginMsg, "Gabim: Supabase nuk u ngarkua.", true);
  throw new Error("Supabase JS nuk u ngarkua.");
}

if (!window.DSS_SUPABASE_URL || !window.DSS_SUPABASE_KEY) {
  message(loginMsg, "Gabim: config.js nuk u ngarkua.", true);
  throw new Error("Supabase config mungon.");
}

const dssClient = window.supabase.createClient(
  window.DSS_SUPABASE_URL,
  window.DSS_SUPABASE_KEY
);

const STORAGE_BUCKET = "product-image";

/* ELEMENTET */

const login = $("login");
const reset = $("reset");
const panel = $("panel");
const logout = $("logout");

const loginForm = $("loginForm");
const forgotBtn = $("forgotBtn");
const resetForm = $("resetForm");

const productsAdmin = $("productsAdmin");
const orders = $("orders");

const newBtn = $("newBtn");
const productFormBox = $("productFormBox");
const productForm = $("productForm");
const cancelProduct = $("cancelProduct");

const formTitle = $("formTitle");
const productMsg = $("productMsg");
const imagePreview = $("imagePreview");

let editingId = null;
let currentImageUrl = "";
let loginInProgress = false;
let passwordRecovery = new URLSearchParams(window.location.hash.slice(1)).get("type") === "recovery";
let savingProduct = false;

/* KONTROLLI I ELEMENTEVE */

const requiredElements = [
  login,
  reset,
  panel,
  logout,
  loginForm,
  $("email"),
  $("password"),
  forgotBtn,
  resetForm,
  productsAdmin,
  orders,
  newBtn,
  productFormBox,
  productForm,
  cancelProduct,
  formTitle,
  productMsg,
  imagePreview,
  $("productImage")
];

if (requiredElements.some((element) => !element)) {
  message(
    loginMsg,
    "Gabim: Mungon një element në admin.html.",
    true
  );
  throw new Error("Elemente të Admin-it mungojnë: " + requiredElements.map((element, index) => element ? null : index).filter((index) => index !== null).join(", "));
}

/* HYRJA — PJESA E RREGULLUAR */

loginForm.addEventListener("submit", async function(event) {
  event.preventDefault();

  if (loginInProgress) return;

  loginInProgress = true;

  const email = $("email").value.trim();
  const password = $("password").value;
  const button = loginForm.querySelector('button[type="submit"]');

  if (button) button.disabled = true;

  message(loginMsg, "Po kontrollohen të dhënat...");

  try {
    const { data, error } =
      await dssClient.auth.signInWithPassword({
        email: email,
        password: password
      });

    if (error) throw error;

    if (!data?.session) {
      throw new Error("Hyrja nuk u konfirmua.");
    }

    message(loginMsg, "Hyrja u krye. Po ngarkohen të dhënat...");

    await showPanel();
  } catch (error) {
    message(
      loginMsg,
      error.message || "Gabim gjatë hyrjes.",
      true
    );
  } finally {
    loginInProgress = false;
    if (button) button.disabled = false;
  }
});

/* HARROVA FJALËKALIMIN */

forgotBtn.addEventListener("click", async function() {
  const email = $("email").value.trim();

  if (!email) {
    message(loginMsg, "Shkruaj email-in fillimisht.", true);
    $("email").focus();
    return;
  }

  message(loginMsg, "Po dërgohet email-i...");

  try {
    const { error } = await dssClient.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.href.split("#")[0]
    });

    if (error) throw error;

    message(
      loginMsg,
      "Nëse email-i është i regjistruar, kontrollo kutinë e email-it."
    );
  } catch (error) {
    message(loginMsg, error.message || "Gabim gjatë dërgimit.", true);
  }
});

/* NDRYSHIMI I FJALËKALIMIT */

resetForm.addEventListener("submit", async function(event) {
  event.preventDefault();

  const password = $("newPassword").value;
  const password2 = $("newPassword2").value;
  const msg = $("resetMsg");

  if (password.length < 6) {
    message(msg, "Fjalëkalimi duhet të ketë të paktën 6 karaktere.", true);
    return;
  }

  if (password !== password2) {
    message(msg, "Fjalëkalimet nuk përputhen.", true);
    return;
  }

  try {
    const { error } = await dssClient.auth.updateUser({ password });

    if (error) throw error;

    passwordRecovery = false;
    message(msg, "Fjalëkalimi u ndryshua me sukses.");
    resetForm.reset();
    reset.hidden = true;
    await showPanel();
  } catch (error) {
    message(msg, error.message || "Gabim gjatë ndryshimit.", true);
  }
});

/* DALJA */

logout.addEventListener("click", async function() {
  logout.disabled = true;

  try {
    const { error } = await dssClient.auth.signOut();

    if (error) throw error;

    login.hidden = false;
    panel.hidden = true;
    reset.hidden = true;
    logout.hidden = true;
    loginForm.reset();

    message(loginMsg, "Dole nga llogaria.");
  } catch (error) {
    alert("Gabim gjatë daljes: " + error.message);
  } finally {
    logout.disabled = false;
  }
});

/* SESIONI */

dssClient.auth.onAuthStateChange(function(event) {
  if (event === "PASSWORD_RECOVERY") {
    passwordRecovery = true;
    login.hidden = true;
    panel.hidden = true;
    logout.hidden = true;
    reset.hidden = false;
  }

  if (event === "SIGNED_OUT") {
    login.hidden = false;
    panel.hidden = true;
    reset.hidden = true;
    logout.hidden = true;
  }
});

/* NISJA */

async function init() {
  login.hidden = false;
  panel.hidden = true;
  reset.hidden = true;
  logout.hidden = true;

  message(loginMsg, "Admin.js u ngarkua.");

  try {
    const { data, error } = await dssClient.auth.getSession();

    if (error) throw error;

    if (passwordRecovery) {
      login.hidden = true;
      reset.hidden = false;
    } else if (data.session) {
      await showPanel();
    }
  } catch (error) {
    message(
      loginMsg,
      error.message || "Gabim gjatë kontrollit të sesionit.",
      true
    );
  }
}

/* SHFAQ PANELIN */

async function showPanel() {
  login.hidden = true;
  reset.hidden = true;
  panel.hidden = false;
  logout.hidden = false;

  await Promise.allSettled([
    loadProducts(),
    loadOrders()
  ]);
}

/* PRODUKTET */

async function loadProducts() {
  productsAdmin.textContent = "Duke ngarkuar produktet...";

  try {
    const { data, error } = await dssClient
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    if (!data || data.length === 0) {
      productsAdmin.textContent = "Nuk ka produkte.";
      return;
    }

    productsAdmin.innerHTML = data.map(function(product) {
      const image = product.image_url
        ? `<img src="${escapeHtml(product.image_url)}"
             alt="${escapeHtml(product.name)}"
             style="width:80px;height:80px;object-fit:cover;border-radius:8px">`
        : "";

      return `
        <div style="display:flex;gap:12px;align-items:center;
                    padding:12px 0;border-bottom:1px solid #ddd;flex-wrap:wrap">
          ${image}
          <div style="flex:1;min-width:140px">
            <strong>${escapeHtml(product.name)}</strong>
            <div>${escapeHtml(product.category)}</div>
            <div>Çmimi: ${money(product.sale_price ?? product.price)}</div>
            <div>Stoku: ${Number(product.stock || 0)}</div>
            <div>${product.active ? "Aktiv" : "Joaktiv"}</div>
          </div>
          <button type="button"
            onclick="editProduct('${escapeHtml(product.id)}')">
            Ndrysho
          </button>
          <button type="button" class="danger"
            onclick="deleteProduct('${escapeHtml(product.id)}')">
            Fshi
          </button>
        </div>`;
    }).join("");
  } catch (error) {
    productsAdmin.textContent = "Gabim te produktet: " + error.message;
  }
}

/* SHTO PRODUKT */

newBtn.addEventListener("click", function() {
  editingId = null;
  currentImageUrl = "";
  productForm.reset();

  $("productId").value = "";
  $("productStock").value = "0";
  $("productActive").checked = true;
  $("productFeatured").checked = false;

  formTitle.textContent = "Shto produkt";
  imagePreview.innerHTML = "";
  $("productImage").value = "";
  message(productMsg, "");

  productFormBox.hidden = false;
  productFormBox.scrollIntoView({ behavior: "smooth" });
});

/* NDRYSHO PRODUKT */

window.editProduct = async function(id) {
  try {
    const { data, error } = await dssClient
      .from("products")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;

    editingId = data.id;
    currentImageUrl = data.image_url || "";

    $("productId").value = data.id;
    $("productName").value = data.name || "";
    $("productSku").value = data.sku || "";
    $("productCategory").value = data.category || "";
    $("productPrice").value = data.price ?? "";
    $("productSalePrice").value = data.sale_price ?? "";
    $("productStock").value = data.stock ?? 0;
    $("productDescription").value = data.description || "";
    $("productFeatured").checked = !!data.featured;
    $("productActive").checked = data.active !== false;
    $("productImage").value = "";

    formTitle.textContent = "Ndrysho produktin";

    imagePreview.innerHTML = currentImageUrl
      ? `<img src="${escapeHtml(currentImageUrl)}"
          alt="" style="max-width:180px;border-radius:8px">`
      : "";

    message(productMsg, "");
    productFormBox.hidden = false;
    productFormBox.scrollIntoView({ behavior: "smooth" });
  } catch (error) {
    alert("Nuk u gjet produkti: " + error.message);
  }
};

/* ANULO */

cancelProduct.addEventListener("click", function() {
  productFormBox.hidden = true;
  productForm.reset();
  $("productImage").value = "";
  editingId = null;
  currentImageUrl = "";
  imagePreview.innerHTML = "";
  message(productMsg, "");
});

/* PARAPAMJA E FOTOS */

$("productImage").addEventListener("change", function(event) {
  const file = event.target.files[0];

  if (!file) return;

  if (!file.type.startsWith("image/")) {
    message(productMsg, "Zgjidh një foto të vlefshme.", true);
    event.target.value = "";
    return;
  }

  if (file.size > 8 * 1024 * 1024) {
    message(productMsg, "Fotoja duhet të jetë maksimumi 8 MB.", true);
    event.target.value = "";
    return;
  }

  const objectUrl = URL.createObjectURL(file);

  imagePreview.innerHTML = `
    <img src="${objectUrl}" alt="Parapamja e fotos"
         style="max-width:180px;border-radius:8px">`;
});

/* NGARKO FOTON */

async function uploadProductImage(file) {
  if (!file) return currentImageUrl || "";

  const extension = (file.name.split(".").pop() || "jpg")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

  const path = "products/" + Date.now() + "-" +
    Math.random().toString(36).slice(2, 9) + "." + extension;

  const { error } = await dssClient.storage
    .from(STORAGE_BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type
    });

  if (error) throw error;

  return dssClient.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(path).data.publicUrl;
}

/* RUAJ PRODUKTIN */

productForm.addEventListener("submit", async function(event) {
  event.preventDefault();

  if (savingProduct) return;
  savingProduct = true;

  const button = productForm.querySelector('button[type="submit"]');
  if (button) button.disabled = true;

  try {
    message(productMsg, "Po ruhet produkti...");

    const price = Number($("productPrice").value);
    const saleValue = $("productSalePrice").value;
    const stock = Number($("productStock").value);

    if (!Number.isFinite(price) || price < 0) {
      throw new Error("Vendos një çmim të vlefshëm.");
    }

    if (saleValue !== "" &&
        (!Number.isFinite(Number(saleValue)) || Number(saleValue) < 0)) {
      throw new Error("Çmimi promocional nuk është i vlefshëm.");
    }

    if (!Number.isInteger(stock) || stock < 0) {
      throw new Error("Stoku duhet të jetë numër i plotë, zero ose më shumë.");
    }

    const product = {
      name: $("productName").value.trim(),
      sku: $("productSku").value.trim() || ("DSS-" + Date.now()),
      category: $("productCategory").value.trim(),
      price,
      sale_price: saleValue === "" ? null : Number(saleValue),
      stock,
      description: $("productDescription").value.trim() || null,
      featured: $("productFeatured").checked,
      active: $("productActive").checked
    };

    if (!product.name || !product.category) {
      throw new Error("Plotëso emrin dhe kategorinë.");
    }

    const file = $("productImage").files[0];
    product.image_url = await uploadProductImage(file) || null;

    let result;

    if (editingId !== null) {
      result = await dssClient
        .from("products")
        .update(product)
        .eq("id", editingId);
    } else {
      result = await dssClient
        .from("products")
        .insert(product);
    }

    if (result.error) throw result.error;

    message(productMsg, "Produkti u ruajt me sukses.");

    productForm.reset();
    $("productImage").value = "";
    editingId = null;
    currentImageUrl = "";
    imagePreview.innerHTML = "";
    $("productStock").value = "0";
    $("productActive").checked = true;

    await loadProducts();
  } catch (error) {
    message(productMsg, "Gabim: " + error.message, true);
  } finally {
    savingProduct = false;
    if (button) button.disabled = false;
  }
});

/* FSHI PRODUKTIN */

window.deleteProduct = async function(id) {
  if (!confirm("A dëshiron ta fshish këtë produkt?")) return;

  try {
    const { error } = await dssClient
      .from("products")
      .delete()
      .eq("id", id);

    if (error) throw error;

    await loadProducts();
  } catch (error) {
    alert("Gabim gjatë fshirjes: " + error.message);
  }
};

/* POROSITË */

async function loadOrders() {
  orders.textContent = "Duke ngarkuar porositë...";

  try {
    const { data, error } = await dssClient
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    if (!data || data.length === 0) {
      orders.textContent = "Nuk ka porosi.";
      return;
    }

    orders.innerHTML = data.map(function(order) {
      const statuses = ["new", "processing", "completed", "cancelled"];

      return `
        <div style="padding:12px 0;border-bottom:1px solid #ddd">
          <strong>Porosia #${escapeHtml(order.id)}</strong>
          <div>${escapeHtml(order.customer_name || "")}</div>
          <div>Tel: ${escapeHtml(order.phone || "")}</div>
          <div>Adresa: ${escapeHtml(order.address || "")}</div>
          <div>Totali: ${money(order.total)}</div>
          <label>
            Statusi:
            <select
              onchange="updateOrderStatus('${escapeHtml(order.id)}', this.value)">
              ${statuses.map(function(status) {
                return `<option value="${status}"
                  ${order.status === status ? "selected" : ""}>
                  ${status}
                </option>`;
              }).join("")}
            </select>
          </label>
        </div>`;
    }).join("");
  } catch (error) {
    orders.textContent = "Gabim te porositë: " + error.message;
  }
}

/* NDRYSHO STATUSIN E POROSISË */

window.updateOrderStatus = async function(id, status) {
  const allowed = ["new", "processing", "completed", "cancelled"];

  if (!allowed.includes(status)) return;

  try {
    const { error } = await dssClient
      .from("orders")
      .update({ status })
      .eq("id", id);

    if (error) throw error;

    message(loginMsg, "Statusi i porosisë u ndryshua.");
  } catch (error) {
    alert("Gabim gjatë ndryshimit të statusit: " + error.message);
    await loadOrders();
  }
};

/* NIS ADMIN */

init();
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startAdmin, { once: true });
} else {
  startAdmin();
}
})();
