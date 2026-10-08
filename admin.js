const supabase = window.supabase.createClient(
  window.DSS_SUPABASE_URL,
  window.DSS_SUPABASE_KEY
);

const STORAGE_BUCKET = "product-images";

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

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

function money(value) {
  return "€" + Number(value || 0).toFixed(2);
}

function message(element, text, error = false) {
  if (!element) return;
  element.textContent = text || "";
  element.style.color = error ? "#b42318" : "";
}


/* =========================
   LOGIN
========================= */

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const msg = document.getElementById("loginMsg");

  message(msg, "Duke hyrë...");

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    message(msg, error.message, true);
    return;
  }

  message(msg, "");
  await showPanel();
});


/* =========================
   FORGOT PASSWORD
========================= */

forgotBtn.addEventListener("click", async () => {
  const email = document.getElementById("email").value.trim();
  const msg = document.getElementById("loginMsg");

  if (!email) {
    message(msg, "Shkruaj email-in fillimisht.", true);
    return;
  }

  message(msg, "Po dërgohet email-i...");

  const { error } =
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.href.split("#")[0]
    });

  if (error) {
    message(msg, error.message, true);
    return;
  }

  message(
    msg,
    "U dërgua email-i për ndryshimin e fjalëkalimit."
  );
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

  const msg =
    document.getElementById("resetMsg");

  if (password.length < 6) {
    message(
      msg,
      "Fjalëkalimi duhet të ketë të paktën 6 karaktere.",
      true
    );
    return;
  }

  if (password !== password2) {
    message(
      msg,
      "Fjalëkalimet nuk përputhen.",
      true
    );
    return;
  }

  const { error } =
    await supabase.auth.updateUser({
      password
    });

  if (error) {
    message(msg, error.message, true);
    return;
  }

  message(msg, "Fjalëkalimi u ndryshua me sukses.");

  setTimeout(() => {
    reset.hidden = true;
    showPanel();
  }, 800);
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
  productFormBox.hidden = true;
});


/* =========================
   SESSION
========================= */

supabase.auth.onAuthStateChange((event, session) => {

  if (event === "PASSWORD_RECOVERY") {
    login.hidden = true;
    panel.hidden = true;
    logout.hidden = true;
    reset.hidden = false;
    return;
  }

  if (event === "SIGNED_OUT") {
    login.hidden = false;
    panel.hidden = true;
    reset.hidden = true;
    logout.hidden = true;
  }

  if (event === "SIGNED_IN" && session) {
    showPanel();
  }
});


async function init() {

  login.hidden = true;
  panel.hidden = true;
  reset.hidden = true;
  logout.hidden = true;

  const { data, error } =
    await supabase.auth.getSession();

  if (error) {
    login.hidden = false;

    message(
      document.getElementById("loginMsg"),
      error.message,
      true
    );

    return;
  }

  if (data.session) {
    await showPanel();
  } else {
    login.hidden = false;
  }
}


/* =========================
   SHOW ADMIN
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
   PRODUCTS
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
      Number(p.sale_price ?? p.price ?? 0);

    const image = p.image_url

      ? `<img
          src="${escapeHtml(p.image_url)}"
          alt="${escapeHtml(p.name)}"
          style="
            width:80px;
            height:80px;
            object-fit:cover;
            border-radius:10px;
          "
        >`

      : `<div style="
          width:80px;
          height:80px;
          display:flex;
          align-items:center;
          justify-content:center;
          background:#eee;
          border-radius:10px;
        ">
          📷
        </div>`;

    return `
      <div
        class="admin-product"
        style="
          display:flex;
          gap:15px;
          align-items:center;
          padding:15px 0;
          border-bottom:1px solid #ddd;
        "
      >

        ${image}

        <div style="flex:1">

          <strong>
            ${escapeHtml(p.name || "")}
          </strong>

          <div>
            ${escapeHtml(p.category || "")}
          </div>

          <div>
            Çmimi: ${money(price)}
          </div>

          <div>
            Stok: ${Number(p.stock || 0)}
          </div>

          <div>
            ${p.active ? "🟢 Aktiv" : "🔴 Joaktiv"}
          </div>

        </div>

        <div
          style="
            display:flex;
            gap:8px;
            flex-wrap:wrap;
          "
        >

          <button
            type="button"
            onclick="editProduct(${Number(p.id)})"
          >
            Ndrysho
          </button>

          <button
            type="button"
            onclick="deleteProduct(${Number(p.id)})"
          >
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

  message(productMsg, "");

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
    alert("Nuk u gjet produkti.");
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
  ).value = data.sale_price ?? "";

  document.getElementById(
    "productStock"
  ).value = data.stock ?? 0;

  document.getElementById(
    "productDescription"
  ).value = data.description || "";

  document.getElementById(
    "productFeatured"
  ).checked = !!data.featured;

  document.getElementById(
    "productActive"
  ).checked = data.active !== false;

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

  message(productMsg, "");

  productFormBox.hidden = false;

  productFormBox.scrollIntoView({
    behavior: "smooth"
  });
};


/* =========================
   CANCEL
========================= */

cancelProduct.addEventListener("click", () => {

  productFormBox.hidden = true;

  productForm.reset();

  editingId = null;
  currentImageUrl = "";

  imagePreview.innerHTML = "";

  message(productMsg, "");
});


/* =========================
   IMAGE PREVIEW
========================= */

document
  .getElementById("productImage")
  .addEventListener("change", (e) => {

    const file = e.target.files[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {

      message(
        productMsg,
        "Zgjidh një skedar fotografie.",
        true
      );

      e.target.value = "";

      return;
    }

    if (file.size > 8 * 1024 * 1024) {

      message(
        productMsg,
        "Fotoja duhet të jetë maksimumi 8 MB.",
        true
      );

      e.target.value = "";

      return;
    }

    const url =
      URL.createObjectURL(file);

    imagePreview.innerHTML = `
      <p>Parapamje:</p>

      <img
        src="${url}"
        alt=""
        style="
          max-width:180px;
          max-height:180px;
          object-fit:cover;
          border-radius:10px;
        "
      >
    `;
});


/* =========================
   UPLOAD IMAGE
========================= */

async function uploadProductImage(file) {

  if (!file) {
    return currentImageUrl || "";
  }

  const extension =
    (file.name.split(".").pop() || "jpg")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");

  const fileName =
    `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 10)}.${extension}`;

  const path =
    `products/${fileName}`;

  const { error } =
    await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(
        path,
        file,
        {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type
        }
      );

  if (error) {

    throw new Error(
      "Fotoja nuk u ngarkua. Kontrollo Storage bucket 'product-images'. " +
      error.message
    );
  }

  const { data } =
    supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(path);

  return data.publicUrl;
}


/* =========================
   SAVE PRODUCT
========================= */

productForm.addEventListener("submit", async (e) => {

  e.preventDefault();

  const submitButton =
    productForm.querySelector(
      'button[type="submit"]'
    );

  submitButton.disabled = true;

  try {

    message(
      productMsg,
      "Po ruhet produkti..."
    );

    const name =
      document.getElementById(
        "productName"
      ).value.trim();

    const sku =
      document.getElementById(
        "productSku"
      ).value.trim();

    const category =
      document.getElementById(
        "productCategory"
      ).value.trim();

    const price =
      Number(
        document.getElementById(
          "productPrice"
        ).value
      );

    const salePriceValue =
      document.getElementById(
        "productSalePrice"
      ).value;

    const sale_price =
      salePriceValue === ""
        ? null
        : Number(salePriceValue);

    const stock =
      Number(
        document.getElementById(
          "productStock"
        ).value
      );

    const description =
      document.getElementById(
        "productDescription"
      ).value.trim();

    const featured =
      document.getElementById(
        "productFeatured"
      ).checked;

    const active =
      document.getElementById(
        "productActive"
      ).checked;

    const imageFile =
      document.getElementById(
        "productImage"
      ).files[0];

    if (
      !name ||
      !category ||
      !Number.isFinite(price) ||
      price < 0
    ) {

      message(
        productMsg,
        "Plotëso emrin, kategorinë dhe çmimin saktë.",
        true
      );

      return;
    }

    if (!Number.isFinite(stock) || stock < 0) {

      message(
        productMsg,
        "Stoku nuk është i vlefshëm.",
        true
      );

      return;
    }

    if (
      sale_price !== null &&
      (
        !Number.isFinite(sale_price) ||
        sale_price < 0
      )
    ) {

      message(
        productMsg,
        "Çmimi promocional nuk është i vlefshëm.",
        true
      );

      return;
    }

    let image_url =
      currentImageUrl;

    if (imageFile) {
      image_url =
        await uploadProductImage(
          imageFile
        );
    }

    const product = {
      name,
      sku: sku || null,
      category,
      price,
      sale_price,
      stock,
      description: description || null,
      image_url: image_url || null,
      featured,
      active
    };

    let result;

    if (editingId !== null) {

      result =
        await supabase
          .from("products")
          .update(product)
          .eq("id", editingId)
          .select()
          .single();

    } else {

      result =
        await supabase
          .from("products")
          .insert(product)
          .select()
          .single();
    }

    if (result.error) {
      throw new Error(
        result.error.message
      );
    }

    message(
      productMsg,
      editingId !== null
        ? "Produkti u ndryshua me sukses."
        : "Produkti u shtua me sukses."
    );

    productForm.reset();

    document.getElementById(
      "productActive"
    ).checked = true;

    document.getElementById(
      "productStock"
    ).value = 0;

    editingId = null;
    currentImageUrl = "";

    imagePreview.innerHTML = "";

    await loadProducts();

    setTimeout(() => {

      productFormBox.hidden = true;

      message(productMsg, "");

    }, 700);

  } catch (error) {

    message(
      productMsg,
      "Gabim: " +
      (error?.message ||
       "Nuk u ruajt produkti."),
      true
    );

  } finally {

    submitButton.disabled = false;

  }
});


/* =========================
   DELETE PRODUCT
========================= */

window.deleteProduct = async function(id) {

  const ok =
    confirm(
      "A je i sigurt që do ta fshish këtë produkt?"
    );

  if (!ok) return;

  const { error } =
    await supabase
      .from("products")
      .delete()
      .eq("id", id);

  if (error) {

    alert(
      "Produkti nuk u fshi: " +
      error.message
    );

    return;
  }

  await loadProducts();
};


/* =========================
   ORDERS
========================= */

async function loadOrders() {

  orders.innerHTML =
    "<p>Duke ngarkuar porositë...</p>";

  const { data, error } =
    await supabase
      .from("orders")
      .select("*")
      .order("created_at", {
        ascending: false
      });

  if (error) {

    orders.innerHTML =
      `<p>Gabim: ${escapeHtml(error.message)}</p>`;

    return;
  }

  if (!data || data.length === 0) {

    orders.innerHTML =
      "<p>Nuk ka porosi.</p>";

    return;
  }

  orders.innerHTML =
    data.map(order => `

      <div
        style="
          padding:15px 0;
          border-bottom:1px solid #ddd;
        "
      >

        <strong>
          Porosia #${escapeHtml(order.id)}
        </strong>

        <div>
          ${escapeHtml(
            order.customer_name || ""
          )}
        </div>

        <div>
          Tel:
          ${escapeHtml(
            order.phone || ""
          )}
        </div>

        <div>
          Adresa:
          ${escapeHtml(
            order.address || ""
          )}
        </div>

        <div>
          Total:
          <strong>
            ${money(order.total)}
          </strong>
        </div>

        <label
          style="
            display:block;
            margin-top:8px;
          "
        >

          Statusi:

          <select
            onchange="updateOrderStatus(${Number(order.id)}, this.value)"
          >

            ${[
              "new",
              "processing",
              "completed",
              "cancelled"
            ].map(status => `

              <option
                value="${status}"
                ${
                  order.status === status
                    ? "selected"
                    : ""
                }
              >
                ${status}
              </option>

            `).join("")}

          </select>

        </label>

      </div>

    `).join("");
}


window.updateOrderStatus =
  async function(id, status) {

    const { error } =
      await supabase
        .from("orders")
        .update({ status })
        .eq("id", id);

    if (error) {

      alert(
        "Statusi nuk u ndryshua: " +
        error.message
      );
    }
  };


/* =========================
   START
========================= */

init();
