
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const BUCKET = "product-image";
  let db;
  let editingProduct = null;
  let editingBanner = null;
  let productPhoto = "";
  let bannerPhoto = "";
  let busy = false;

  function msg(id, text, error = false) {
    const el = $(id);
    if (!el) return;
    el.textContent = text;
    el.style.color = error ? "#b42318" : "#067647";
  }

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;",
      '"': "&quot;", "'": "&#39;"
    })[c]);
  }

  function price(value) {
    return "€" + Number(value || 0).toFixed(2);
  }

  function show(id, visible) {
    if ($(id)) $(id).hidden = !visible;
  }

  async function upload(file, folder) {
    if (!file) return "";
    if (!file.type.startsWith("image/")) {
      throw new Error("Zgjidh një fotografi të vlefshme.");
    }
    if (file.size > 8 * 1024 * 1024) {
      throw new Error("Fotografia duhet të jetë maksimumi 8 MB.");
    }

    const ext = (file.name.split(".").pop() || "jpg")
      .toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const path = folder + "/" + Date.now() + "-" +
      Math.random().toString(36).slice(2, 9) + "." + ext;

    const { error } = await db.storage.from(BUCKET).upload(path, file, {
      upsert: false,
      contentType: file.type,
      cacheControl: "3600"
    });
    if (error) throw error;

    return db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  }

  function preview(inputId, previewId) {
    $(inputId).addEventListener("change", function () {
      const file = this.files && this.files[0];
      if (!file) return;
      if (!file.type.startsWith("image/") || file.size > 8 * 1024 * 1024) {
        msg(inputId === "bannerImage" ? "bannerMsg" : "productMsg",
          "Zgjidh foto deri në 8 MB.", true);
        this.value = "";
        return;
      }
      $(previewId).innerHTML =
        '<img style="max-width:220px;border-radius:8px" src="' +
        URL.createObjectURL(file) + '" alt="Parapamja">';
    });
  }

  async function loadProducts() {
    const el = $("productsAdmin");
    el.textContent = "Po ngarkohen produktet...";
    const { data, error } = await db.from("products")
      .select("*").order("created_at", { ascending: false });
    if (error) throw error;
    if (!data || !data.length) {
      el.textContent = "Nuk ka produkte.";
      return;
    }
    el.innerHTML = data.map(p => `
      <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;padding:12px 0;border-bottom:1px solid #ddd">
        ${p.image_url ? `<img src="${esc(p.image_url)}" alt="" style="width:75px;height:75px;object-fit:cover;border-radius:8px">` : ""}
        <div style="flex:1;min-width:130px">
          <strong>${esc(p.name)}</strong>
          <div>${esc(p.category)}</div>
          <div>${price(p.sale_price ?? p.price)}</div>
          <div>Stoku: ${Number(p.stock || 0)} · ${p.active ? "Aktiv" : "Joaktiv"}</div>
        </div>
        <button type="button" data-edit-product="${esc(p.id)}">Ndrysho</button>
        <button type="button" class="danger" data-delete-product="${esc(p.id)}">Fshi</button>
      </div>`).join("");

    el.querySelectorAll("[data-edit-product]").forEach(b =>
      b.addEventListener("click", () => editProduct(b.dataset.editProduct)));
    el.querySelectorAll("[data-delete-product]").forEach(b =>
      b.addEventListener("click", () => deleteProduct(b.dataset.deleteProduct)));
  }

  async function editProduct(id) {
    try {
      const { data, error } = await db.from("products")
        .select("*").eq("id", id).single();
      if (error) throw error;

      editingProduct = data.id;
      productPhoto = data.image_url || "";
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
      $("imagePreview").innerHTML = productPhoto
        ? `<img src="${esc(productPhoto)}" alt="" style="max-width:220px">` : "";
      $("formTitle").textContent = "Ndrysho produktin";
      msg("productMsg", "");
      show("productFormBox", true);
      $("productFormBox").scrollIntoView({ behavior: "smooth" });
    } catch (e) {
      alert("Gabim: " + e.message);
    }
  }

  async function deleteProduct(id) {
    if (!confirm("Ta fshijmë këtë produkt?")) return;
    const { error } = await db.from("products").delete().eq("id", id);
    if (error) return alert("Gabim: " + error.message);
    await loadProducts();
  }

  async function saveProduct(event) {
    event.preventDefault();
    if (busy) return;
    busy = true;
    const button = $("productForm").querySelector('[type="submit"]');
    button.disabled = true;
    try {
      msg("productMsg", "Po ruhet produkti...");
      const priceValue = Number($("productPrice").value);
      const sale = $("productSalePrice").value;
      const stock = Number($("productStock").value);
      if (!Number.isFinite(priceValue) || priceValue < 0)
        throw new Error("Kontrollo çmimin.");
      if (sale !== "" && (!Number.isFinite(Number(sale)) || Number(sale) < 0))
        throw new Error("Kontrollo çmimin promocional.");
      if (!Number.isInteger(stock) || stock < 0)
        throw new Error("Stoku duhet të jetë numër i plotë pozitiv ose zero.");

      const file = $("productImage").files[0];
      const uploaded = await upload(file, "products");
      const row = {
        name: $("productName").value.trim(),
        sku: $("productSku").value.trim() || ("DSS-" + Date.now()),
        category: $("productCategory").value.trim(),
        price: priceValue,
        sale_price: sale === "" ? null : Number(sale),
        stock,
        description: $("productDescription").value.trim() || null,
        featured: $("productFeatured").checked,
        active: $("productActive").checked,
        image_url: uploaded || productPhoto || null
      };
      if (!row.name || !row.category)
        throw new Error("Plotëso emrin dhe kategorinë.");

      const result = editingProduct
        ? await db.from("products").update(row).eq("id", editingProduct)
        : await db.from("products").insert(row);
      if (result.error) throw result.error;

      msg("productMsg", "Produkti u ruajt!");
      editingProduct = null;
      productPhoto = "";
      $("productForm").reset();
      $("productStock").value = "0";
      $("productActive").checked = true;
      $("imagePreview").innerHTML = "";
      await loadProducts();
    } catch (e) {
      msg("productMsg", "Gabim: " + e.message, true);
    } finally {
      busy = false;
      button.disabled = false;
    }
  }

  async function loadBanners() {
    const el = $("bannersAdmin");
    el.textContent = "Po ngarkohen banerat...";
    const { data, error } = await db.from("site_banners")
      .select("*").order("sort_order", { ascending: true });
    if (error) throw error;
    if (!data || !data.length) {
      el.textContent = "Nuk ka banera. Shtyp “Shto baner”.";
      return;
    }
    el.innerHTML = data.map(b => `
      <article class="banner-item">
        <strong>${esc(b.title)}</strong>
        <p>${esc(b.subtitle || "")}</p>
        ${b.image_url ? `<img src="${esc(b.image_url)}" alt="">` : ""}
        <p>Statusi: ${b.active ? "Aktiv" : "Joaktiv"} · Renditja: ${Number(b.sort_order || 0)}</p>
        <button type="button" data-edit-banner="${esc(b.id)}">Ndrysho</button>
        <button type="button" class="danger" data-delete-banner="${esc(b.id)}">Fshi</button>
      </article>`).join("");

    el.querySelectorAll("[data-edit-banner]").forEach(b =>
      b.addEventListener("click", () => editBanner(b.dataset.editBanner)));
    el.querySelectorAll("[data-delete-banner]").forEach(b =>
      b.addEventListener("click", () => deleteBanner(b.dataset.deleteBanner)));
  }

  function clearBannerForm() {
    editingBanner = null;
    bannerPhoto = "";
    $("bannerForm").reset();
    $("bannerId").value = "";
    $("bannerButtonUrl").value = "#products";
    $("bannerSortOrder").value = "0";
    $("bannerActive").checked = true;
    $("bannerImage").value = "";
    $("bannerImagePreview").innerHTML = "";
    $("bannerFormTitle").textContent = "Shto baner";
    msg("bannerMsg", "");
  }

  async function editBanner(id) {
    try {
      const { data, error } = await db.from("site_banners")
        .select("*").eq("id", id).single();
      if (error) throw error;
      editingBanner = data.id;
      bannerPhoto = data.image_url || "";
      $("bannerId").value = data.id;
      $("bannerTitle").value = data.title || "";
      $("bannerSubtitle").value = data.subtitle || "";
      $("bannerButtonText").value = data.button_text || "";
      $("bannerButtonUrl").value = data.button_url || "#products";
      $("bannerSortOrder").value = data.sort_order ?? 0;
      $("bannerActive").checked = data.active !== false;
      $("bannerImage").value = "";
      $("bannerImagePreview").innerHTML = bannerPhoto
        ? `<img src="${esc(bannerPhoto)}" alt="" style="max-width:100%;max-height:200px">` : "";
      $("bannerFormTitle").textContent = "Ndrysho banerin";
      msg("bannerMsg", "");
      show("bannerFormBox", true);
      $("bannerFormBox").scrollIntoView({ behavior: "smooth" });
    } catch (e) {
      alert("Gabim: " + e.message);
    }
  }

  async function saveBanner(event) {
    event.preventDefault();
    if (busy) return;
    busy = true;
    const button = $("bannerForm").querySelector('[type="submit"]');
    button.disabled = true;
    try {
      msg("bannerMsg", "Po ruhet baneri...");
      const file = $("bannerImage").files[0];
      const uploaded = await upload(file, "banners");
      const row = {
        title: $("bannerTitle").value.trim(),
        subtitle: $("bannerSubtitle").value.trim() || null,
        image_url: uploaded || bannerPhoto || null,
        button_text: $("bannerButtonText").value.trim() || null,
        button_url: $("bannerButtonUrl").value.trim() || "#products",
        sort_order: Number($("bannerSortOrder").value || 0),
        active: $("bannerActive").checked
      };
      if (!row.title) throw new Error("Shkruaj titullin e banerit.");
      if (!Number.isInteger(row.sort_order) || row.sort_order < 0)
        throw new Error("Renditja duhet të jetë numër zero ose më i madh.");

      const result = editingBanner
        ? await db.from("site_banners").update(row).eq("id", editingBanner)
        : await db.from("site_banners").insert(row);
      if (result.error) throw result.error;

      msg("bannerMsg", "Baneri u ruajt me sukses!");
      clearBannerForm();
      show("bannerFormBox", false);
      await loadBanners();
    } catch (e) {
      msg("bannerMsg", "Gabim: " + e.message, true);
    } finally {
      busy = false;
      button.disabled = false;
    }
  }

  async function deleteBanner(id) {
    if (!confirm("Ta fshijmë këtë baner?")) return;
    const { error } = await db.from("site_banners").delete().eq("id", id);
    if (error) return alert("Gabim: " + error.message);
    await loadBanners();
  }

  async function loadOrders() {
    const el = $("orders");
    el.textContent = "Po ngarkohen porositë...";
    const { data, error } = await db.from("orders")
      .select("*").order("created_at", { ascending: false });
    if (error) throw error;
    if (!data || !data.length) {
      el.textContent = "Nuk ka porosi.";
      return;
    }
    const statuses = ["new", "processing", "completed", "cancelled"];
    el.innerHTML = data.map(o => `
      <div style="padding:12px 0;border-bottom:1px solid #ddd">
        <strong>Porosia #${esc(o.id)}</strong>
        <p>${esc(o.customer_name || "")} · ${esc(o.phone || "")}</p>
        <p>${esc(o.address || "")}</p>
        <p>Totali: ${price(o.total)}</p>
        <label>Statusi:
          <select data-order="${esc(o.id)}">
            ${statuses.map(s => `<option value="${s}" ${o.status === s ? "selected" : ""}>${s}</option>`).join("")}
          </select>
        </label>
      </div>`).join("");

    el.querySelectorAll("[data-order]").forEach(select => {
      select.addEventListener("change", async () => {
        const { error } = await db.from("orders")
          .update({ status: select.value }).eq("id", select.dataset.order);
        if (error) {
          alert("Gabim: " + error.message);
          await loadOrders();
        } else {
          msg("loginMsg", "Statusi i porosisë u ndryshua.");
        }
      });
    });
  }

  async function showPanel() {
    show("login", false);
    show("reset", false);
    show("panel", true);
    show("logout", true);
    const results = await Promise.allSettled([
      loadProducts(), loadOrders(), loadBanners()
    ]);
    results.forEach((r, i) => {
      if (r.status === "rejected") {
        const target = ["productsAdmin", "orders", "bannersAdmin"][i];
        $(target).textContent = "Gabim: " + r.reason.message;
      }
    });
  }

  function init() {
    if (!window.supabase || !window.DSS_SUPABASE_URL ||
        !window.DSS_SUPABASE_KEY) {
      msg("loginMsg", "Supabase/config.js nuk u ngarkua. Kontrollo config.js.", true);
      return;
    }

    db = window.supabase.createClient(
      window.DSS_SUPABASE_URL, window.DSS_SUPABASE_KEY
    );

    $("loginForm").addEventListener("submit", async event => {
      event.preventDefault();
      const button = $("loginForm").querySelector('[type="submit"]');
      button.disabled = true;
      msg("loginMsg", "Po kontrollohen të dhënat...");
      try {
        const { data, error } = await db.auth.signInWithPassword({
          email: $("email").value.trim(),
          password: $("password").value
        });
        if (error) throw error;
        if (!data.session) throw new Error("Sesioni nuk u krijua.");
        await showPanel();
      } catch (e) {
        msg("loginMsg", "Gabim gjatë hyrjes: " + e.message, true);
      } finally {
        button.disabled = false;
      }
    });

    $("forgotBtn").addEventListener("click", async () => {
      const email = $("email").value.trim();
      if (!email) return msg("loginMsg", "Shkruaj email-in fillimisht.", true);
      try {
        const { error } = await db.auth.resetPasswordForEmail(email, {
          redirectTo: location.href.split("#")[0]
        });
        if (error) throw error;
        msg("loginMsg", "Kontrollo email-in për lidhjen e rikuperimit.");
      } catch (e) {
        msg("loginMsg", "Gabim: " + e.message, true);
      }
    });

    $("resetForm").addEventListener("submit", async event => {
      event.preventDefault();
      const a = $("newPassword").value;
      const b = $("newPassword2").value;
      if (a.length < 6) return msg("resetMsg", "Duhet të ketë të paktën 6 karaktere.", true);
      if (a !== b) return msg("resetMsg", "Fjalëkalimet nuk përputhen.", true);
      try {
        const { error } = await db.auth.updateUser({ password: a });
        if (error) throw error;
        msg("resetMsg", "Fjalëkalimi u ndryshua.");
        await showPanel();
      } catch (e) {
        msg("resetMsg", "Gabim: " + e.message, true);
      }
    });

    $("logout").addEventListener("click", async () => {
      const { error } = await db.auth.signOut();
      if (error) return alert(error.message);
      show("login", true);
      show("panel", false);
      show("reset", false);
      show("logout", false);
      $("loginForm").reset();
    });

    $("newBtn").addEventListener("click", () => {
      editingProduct = null;
      productPhoto = "";
      $("productForm").reset();
      $("productId").value = "";
      $("productStock").value = "0";
      $("productActive").checked = true;
      $("imagePreview").innerHTML = "";
      $("productImage").value = "";
      $("formTitle").textContent = "Shto produkt";
      msg("productMsg", "");
      show("productFormBox", true);
    });
    $("cancelProduct").addEventListener("click", () => {
      show("productFormBox", false);
      editingProduct = null;
      productPhoto = "";
    });
    $("productForm").addEventListener("submit", saveProduct);

    $("newBannerBtn").addEventListener("click", () => {
      clearBannerForm();
      show("bannerFormBox", true);
    });
    $("cancelBanner").addEventListener("click", () => {
      show("bannerFormBox", false);
      clearBannerForm();
    });
    $("bannerForm").addEventListener("submit", saveBanner);

    preview("productImage", "imagePreview");
    preview("bannerImage", "bannerImagePreview");

    const recovery = new URLSearchParams(location.hash.slice(1)).get("type") === "recovery";
    show("login", !recovery);
    show("reset", recovery);
    show("panel", false);
    show("logout", false);

    db.auth.getSession().then(async ({ data, error }) => {
      if (error) return msg("loginMsg", error.message, true);
      if (data.session && !recovery) await showPanel();
    }).catch(e => msg("loginMsg", e.message, true));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
