const supabase = window.supabase.createClient(
  window.DSS_SUPABASE_URL,
  window.DSS_SUPABASE_KEY
);

const login = document.getElementById("login");
const reset = document.getElementById("reset");
const panel = document.getElementById("panel");
const logout = document.getElementById("logout");

const loginForm = document.getElementById("loginForm");
const forgotBtn = document.getElementById("forgotBtn");
const resetForm = document.getElementById("resetForm");

const productsAdmin = document.getElementById("productsAdmin");
const orders = document.getElementById("orders");

const newBtn = document.getElementById("newBtn");
const productFormBox = document.getElementById("productFormBox");
const productForm = document.getElementById("productForm");
const cancelProduct = document.getElementById("cancelProduct");

const formTitle = document.getElementById("formTitle");
const productMsg = document.getElementById("productMsg");
const imagePreview = document.getElementById("imagePreview");

let editingId = null;
let currentImageUrl = "";


/* =========================
   LOGIN
========================= */

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  const msg = document.getElementById("loginMsg");
  msg.textContent = "Duke hyrë...";

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    msg.textContent = error.message;
    return;
  }

  msg.textContent = "";
  await showPanel();
});


/* =========================
   FORGOT PASSWORD
========================= */

forgotBtn.addEventListener("click", async () => {
  const email = document.getElementById("email").value.trim();
  const msg = document.getElementById("loginMsg");

  if (!email) {
    msg.textContent = "Shkruaj email-in fillimisht.";
    return;
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo:
      window.location.origin +
      window.location.pathname
  });

  if (error) {
    msg.textContent = error.message;
    return;
  }

  msg.textContent =
    "U dërgua email-i për ndryshimin e fjalëkalimit.";
});


/* =========================
   RESET PASSWORD
========================= */

resetForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const password =
    document.getElementById("newPassword").value;

  const password2 =
    document.getElementById("newPassword2").value;

  const msg = document.getElementById("resetMsg");

  if (password !== password2) {
    msg.textContent =
      "Fjalëkalimet nuk përputhen.";
    return;
  }

  const { error } =
    await supabase.auth.updateUser({
      password
    });

  if (error) {
    msg.textContent = error.message;
    return;
  }

  msg.textContent =
    "Fjalëkalimi u ndryshua me sukses.";

  setTimeout(() => {
    reset.hidden = true;
    showPanel();
  }, 1000);
});


/* =========================
   LOGOUT
========================= */

logout.addEventListener("click", async () => {
  await supabase.auth.signOut();

  panel.hidden = true;
  logout.hidden = true;
  reset.hidden = true;
  login.hidden = false;
});


/* =========================
   CHECK SESSION
========================= */

async function init() {
  const { data } =
    await supabase.auth.getSession();

  if (data.session) {
    await showPanel();
  } else {
    login.hidden = false;
    panel.hidden = true;
    logout.hidden = true;
  }
}


/* =========================
   SHOW ADMIN PANEL
========================= */

async function showPanel() {
  login.hidden = true;
  reset.hidden = true;
  panel.hidden = false;
  logout.hidden = false;

  await loadProducts();
  await loadOrders();
}


/* =========================
   LOAD PRODUCTS
========================= */

async function loadProducts() {
  productsAdmin.innerHTML =
    "<p>Duke ngarkuar produktet...</p>";

  const { data, error } =
    await supabase
      .from("products")
      .select("*")
      .order("created_at", {
        ascending: false
      });

  if (error) {
    productsAdmin.innerHTML =
      `<p>Gabim: ${escapeHtml(error.message)}</p>`;
    return;
  }

  if (!data || data.length === 0) {
    productsAdmin.innerHTML =
      "<p>Nuk ka produkte.</p>";
    return;
  }

  productsAdmin.innerHTML = data.map(p => {

    const price =
      Number(p.sale_price ?? p.price ?? 0)
        .toFixed(2);

    const image = p.image_url
      ? `<img src="${escapeHtml(p.image_url)}"
              alt="${escapeHtml(p.name)}"
              style="width:80px;height:80px;object-fit:cover;border-radius:10px;">`
      : `<div style="
          width:80px;
          height:80px;
          display:flex;
          align-items:center;
          justify-content:center;
          background:#eee;
          border-radius:10px;">
          📷
        </div>`;

    return `
      <div class="admin-product"
           style="
             display:flex;
             gap:15px;
             align-items:center;
             padding:15px 0;
             border-bottom:1px solid #ddd;
           ">

        ${image}

        <div style="flex:1">

          <strong>
            ${escapeHtml(p.name || "")}
          </strong>

          <div>
            ${escapeHtml(p.category || "")}
          </div>

          <div>
            €${price}
          </div>

          <div>
            Stok: ${Number(p.stock || 0)}
          </div>

          <div>
            ${p.active ? "🟢 Aktiv" : "🔴 Joaktiv"}
          </div>

        </div>

        <div style="display:flex;gap:8px;flex-wrap:wrap">

          <button
            type="button"
            onclick="editProduct(${Number(p.id)})">
            Ndrysho
          </button>

          <button
            type="button"
            onclick="deleteProduct(${Number(p.id)})">
            Fshi
          </button>

        </div>

      </div>
    `;
  }).join("");
}


/* =========================
   NEW PRODUCT
========================= */

newBtn.addEventListener("click", () => {

  editingId = null;
  currentImageUrl = "";

  formTitle.textContent =
    "Shto produkt";

  productForm.reset();

  document.getElementById(
    "productActive"
  ).checked = true;

  document.getElementById(
    "productFeatured"
  ).checked = false;

  document.getElementById(
    "productStock"
  ).value = 0;

  imagePreview.innerHTML = "";

  productMsg.textContent = "";

  productFormBox.hidden = false;

  productFormBox.scrollIntoView({
    behavior: "smooth"
  });
});


/* =========================
   EDIT PRODUCT
========================= */

window.editProduct = async function(id) {

  const { data, error } =
    await supabase
      .from("products")
      .select("*")
      .eq("id", id)
      .single();

  if (error || !data) {
    alert(
      "Nuk u gjet produkti."
    );
    return;
  }

  editingId = data.id;

  currentImageUrl =
    data.image_url || "";

  formTitle.textContent =
    "Ndrysho produktin";

  document.getElementById(
    "productId"
  ).value = data.id;

  document.getElementById(
    "productName"
  ).value = data.name || "";

  document.getElementById(
    "productSku"
  ).value = data.sku || "";

  document.getElementById(
    "productCategory"
  ).value = data.category || "";

  document.getElementById(
    "productPrice"
  ).value = data.price ?? "";

  document.getElementById(
    "productSalePrice"
  ).value =
    data.sale_price ?? "";

  document.getElementById(
    "productStock"
  ).value =
    data.stock ?? 0;

  document.getElementById(
    "productDescription"
  ).value =
    data.description || "";

  document.getElementById(
    "productFeatured"
  ).checked =
    !!data.featured;

  document.getElementById(
    "productActive"
  ).checked =
    data.active !== false;

  if (currentImageUrl) {
    imagePreview.innerHTML = `
      <p>Foto aktuale:</p>
      <img
        src="${escapeHtml(currentImageUrl)}"
        alt=""
        style="
          max-width:180px;
          max-height:180px;
          object-fit:cover;
          border-radius:10px;
        "
      >
    `;
  } else {
    imagePreview.innerHTML = "";
  }

  productMsg.textContent = "";

  productFormBox.hidden = false;

  productFormBox.scrollIntoView({
    behavior: "smooth"
  });
};


/* =========================
   CANCEL
========================= */

cancelProduct.addEventListener(
  "click",
  () => {
    productFormBox.hidden = true;
    productForm.reset();
    editingId = null;
    currentImageUrl = "";
    imagePreview.innerHTML = "";
    productMsg.textContent = "";
  }
);


/* =========================
   IMAGE PREVIEW
========================= */

document
  .getElementById("productImage")
  .addEventListener("change", (e) => {

    const file = e.target.files[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      productMsg.textContent =
        "Zgjidh një skedar fotografie.";
      e.target.value = "";
      return;
    }

    const maxSize =
      8 * 1024 * 1024;

    if (file.size > maxSize) {
      productMsg.textContent =
        "Fotoja duhet të jetë maksimumi 8 MB.";
      e.target.value = "";
      return;
    }
