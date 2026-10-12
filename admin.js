(function () {
  "use strict";

  const $ = id => document.getElementById(id);
  const BUCKET = "product-image";

  let db;
  let editingProduct = null;
  let editingBanner = null;
  let productPhoto = "";
  let bannerPhoto = "";
  let busy = false;
  let categories = [];

  function msg(id, text, error = false) {
    const el = $(id);
    if (!el) return;
    el.textContent = text;
    el.style.color = error ? "#b42318" : "#067647";
  }

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[c]);
  }

  function price(value) {
    return "€" + Number(value || 0).toFixed(2);
  }

  function show(id, visible) {
    if ($(id)) $(id).hidden = !visible;
  }

  function setButtonBusy(button, value) {
    if (button) button.disabled = value;
  }

  function listen(id, event, callback) {
    const el = $(id);
    if (!el) {
      console.error("Mungon elementi HTML:", id);
      return;
    }
    el.addEventListener(event, callback);
  }

  /* FOTO UPLOAD */

  async function upload(file, folder) {
    if (!file) return "";

    if (!file.type.startsWith("image/")) {
      throw new Error("Zgjidh një fotografi të vlefshme.");
    }

    if (file.size > 8 * 1024 * 1024) {
      throw new Error("Fotografia duhet të jetë maksimumi 8 MB.");
    }

    const ext = (file.name.split(".").pop() || "jpg")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "") || "jpg";

    const path = folder + "/" + Date.now() + "-" +
      Math.random().toString(36).slice(2, 9) + "." + ext;

    const { error } = await db.storage.from(BUCKET).upload(
      path,
      file,
      {
        upsert: false,
        contentType: file.type,
        cacheControl: "3600"
      }
    );

    if (error) {
      if (/bucket not found/i.test(error.message)) {
        throw new Error(
          'Nuk ekziston bucket "product-image". Kontrollo emrin te Supabase Storage.'
        );
      }
      throw error;
    }

    const result = db.storage.from(BUCKET).getPublicUrl(path);
    return result.data.publicUrl;
  }

  function preview(inputId, previewId, messageId) {
    listen(inputId, "change", function () {
      const input = $(inputId);
      const file = input.files && input.files[0];
      const target = $(previewId);

      if (!file) return;

      if (!file.type.startsWith("image/") ||
          file.size > 8 * 1024 * 1024) {
        msg(messageId, "Zgjidh një foto të vlefshme deri në 8 MB.", true);
        input.value = "";
        if (target) target.innerHTML = "";
        return;
      }

      if (target) {
        const url = URL.createObjectURL(file);
        target.innerHTML = "";

        const img = document.createElement("img");
        img.src = url;
        img.alt = "Parapamja e fotos";
        img.style.maxWidth = "220px";
        img.style.maxHeight = "220px";
        img.style.objectFit = "contain";
        img.style.borderRadius = "8px";

        target.appendChild(img);
      }

      msg(messageId, "");
    });
  }

  /* KATEGORITE */

  function prepareCategorySelect() {
    const old = $("productCategory");
    if (!old || old.tagName === "SELECT") return;

    const select = document.createElement("select");
    select.id = "productCategory";
    select.name = old.name || "category";
    select.required = true;
    select.setAttribute("aria-label", "Kategoria e produktit");

    const label = document.querySelector(
      'label[for="productCategory"]'
    );

    if (label) label.textContent = "Kategoria";

    old.replaceWith(select);
  }

  function fillCategorySelect(selectedName) {
    const select = $("productCategory");
    if (!select) return;

    const current = selectedName !== undefined
      ? String(selectedName || "")
      : select.value;

    select.innerHTML = "";

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Zgjidh kategorinë";
    select.appendChild(placeholder);

    categories.forEach(category => {
      const option = document.createElement("option");
      option.value = category.name;
      option.textContent = category.name;
      select.appendChild(option);
    });

    if (current && !categories.some(c => c.name === current)) {
      const option = document.createElement("option");
      option.value = current;
      option.textContent = current + " (kategori ekzistuese)";
      select.appendChild(option);
    }

    select.value = current;
  }

  async function loadCategories() {
    const el = $("categoriesAdmin");
    if (el) el.textContent = "Po ngarkohen kategoritë...";

    const { data, error } = await db
      .from("categories")
      .select("id, name, sort_order, image_url")
      .order("sort_order", { ascending: true });

    if (error) throw error;

    categories = data || [];
    fillCategorySelect();

    if (!el) return;

    if (!categories.length) {
      el.textContent = "Nuk ka kategori të regjistruara.";
      return;
    }

    el.innerHTML = categories.map(c => `
      <article style="padding:14px 0;border-bottom:1px solid #ddd">
        <label style="display:block;margin-bottom:8px">
          Emri i kategorisë:
          <input
            type="text"
            data-category-name="${esc(c.id)}"
            value="${esc(c.name)}"
            required
            maxlength="100"
            style="display:block;width:100%;box-sizing:border-box;margin-top:4px;padding:9px">
        </label>

        <label style="display:block;margin-bottom:8px">
          Renditja:
          <input
            type="number"
            min="0"
            step="1"
            data-category-order="${esc(c.id)}"
            value="${Number(c.sort_order || 0)}"
            required
            style="display:block;width:100%;box-sizing:border-box;margin-top:4px;padding:9px">
        </label>

        ${c.image_url ? `
          <img src="${esc(c.image_url)}"
               alt="${esc(c.name)}"
               style="width:120px;height:100px;object-fit:cover;border-radius:10px;display:block;margin:8px 0">
        ` : "<p>Nuk ka foto të kategorisë.</p>"}

        <label style="display:block;margin-bottom:8px">
          Ndrysho foton:
          <input
            type="file"
            accept="image/*"
            data-category-photo="${esc(c.id)}">
        </label>

        <button type="button"
                data-save-category="${esc(c.id)}"
                style="margin:6px 6px 6px 0">
          Ruaj ndryshimet
        </button>

        <button type="button"
                data-delete-category="${esc(c.id)}"
                class="danger"
                style="margin:6px 0">
          Fshi kategorinë
        </button>
      </article>
    `).join("");

    /* RUAJTJA E EMRIT DHE RENDITJES */

    el.querySelectorAll("[data-save-category]").forEach(button => {
      button.addEventListener("click", async function () {
        const id = button.dataset.saveCategory;
        const original = categories.find(
          c => String(c.id) === String(id)
        );

        if (!original) return;

        const nameInput = el.querySelector(
          '[data-category-name="' + id + '"]'
        );
        const orderInput = el.querySelector(
          '[data-category-order="' + id + '"]'
        );

        const newName = nameInput.value.trim();
        const newOrder = Number(orderInput.value);

        if (!newName) {
          msg("categoryMsg", "Shkruaj emrin e kategorisë.", true);
          nameInput.focus();
          return;
        }

        if (orderInput.value.trim() === "" ||
            !Number.isInteger(newOrder) ||
            newOrder < 0) {
          msg("categoryMsg", "Renditja duhet të jetë numër i plotë zero ose më i madh.", true);
          orderInput.focus();
          return;
        }

        const duplicate = categories.some(c =>
          String(c.id) !== String(id) &&
          c.name.trim().toLowerCase() === newName.toLowerCase()
        );

        if (duplicate) {
          msg("categoryMsg", "Ekziston një kategori me këtë emër.", true);
          nameInput.focus();
          return;
        }

        setButtonBusy(button, true);

        try {
          msg("categoryMsg", "Po ruhen ndryshimet...");

          /*
           * Përditëso emrin e kategorisë te produktet
           * kur ndryshon emri i kategorisë.
           */

          if (newName !== original.name) {
            const { error: productError } = await db
              .from("products")
              .update({ category: newName })
              .eq("category", original.name);

            if (productError) throw productError;
          }

          const { error } = await db
            .from("categories")
            .update({
              name: newName,
              sort_order: newOrder
            })
            .eq("id", original.id);

          if (error) throw error;

          await loadCategories();
          await loadProducts();

          msg("categoryMsg", "Kategoria u ndryshua me sukses.");
        } catch (e) {
          msg("categoryMsg", "Gabim gjatë ruajtjes: " + e.message, true);
        } finally {
          setButtonBusy(button, false);
        }
      });
    });

    /* NDRYSHIMI I FOTOS SE KATEGORISE */

    el.querySelectorAll("[data-category-photo]").forEach(input => {
      input.addEventListener("change", async function () {
        const file = input.files && input.files[0];
        if (!file) return;

        try {
          input.disabled = true;
          msg("categoryMsg", "Po ngarkohet fotoja...");

          const url = await upload(file, "categories");

          const { error } = await db
            .from("categories")
            .update({ image_url: url })
            .eq("id", input.dataset.categoryPhoto);

          if (error) throw error;

          await loadCategories();
          msg("categoryMsg", "Fotoja e kategorisë u ruajt.");
        } catch (e) {
          msg("categoryMsg", "Gabim: " + e.message, true);
          input.disabled = false;
        }
      });
    });

    /* FSHIRJA E KATEGORISE */

    el.querySelectorAll("[data-delete-category]").forEach(button => {
      button.addEventListener("click", async function () {
        const category = categories.find(
          c => String(c.id) === button.dataset.deleteCategory
        );

        if (!category) return;

        const { data: usedProducts, error: checkError } = await db
          .from("products")
          .select("id")
          .eq("category", category.name)
          .limit(1);

        if (checkError) {
          msg("categoryMsg", "Nuk u kontrolluan produktet: " + checkError.message, true);
          return;
        }

        if (usedProducts && usedProducts.length) {
          msg(
            "categoryMsg",
            'Kategoria "' + category.name +
            '" ka produkte. Ndrysho kategorinë e produkteve përpara se ta fshish.',
            true
          );
          return;
        }

        if (!confirm(
          'Dëshiron të fshish kategorinë "' + category.name + '"?'
        )) return;

        setButtonBusy(button, true);

        try {
          const { error } = await db
            .from("categories")
            .delete()
            .eq("id", category.id);

          if (error) throw error;

          await loadCategories();
          msg("categoryMsg", "Kategoria u fshi.");
        } catch (e) {
          msg("categoryMsg", "Gabim: " + e.message, true);
        } finally {
          setButtonBusy(button, false);
        }
      });
    });
  }

  async function saveCategory(event) {
    event.preventDefault();

    const name = $("categoryName").value.trim();
    const sortOrder = Number($("categorySort").value || 0);
    const fileInput = $("categoryImage");
    const file = fileInput && fileInput.files
      ? fileInput.files[0]
      : null;

    if (!name) {
      msg("categoryMsg", "Shkruaj emrin e kategorisë.", true);
      return;
    }

    if (!Number.isInteger(sortOrder) || sortOrder < 0) {
      msg("categoryMsg", "Renditja duhet të jetë numër i plotë zero ose më i madh.", true);
      return;
    }

    if (categories.some(c =>
      c.name.trim().toLowerCase() === name.toLowerCase()
    )) {
      msg("categoryMsg", "Ekziston një kategori me këtë emër.", true);
      return;
    }

    const form = $("categoryForm");
    const button = form
      ? form.querySelector('[type="submit"]')
      : null;

    setButtonBusy(button, true);

    try {
      msg("categoryMsg", "Po ruhet kategoria...");

      let imageUrl = "";

      if (file) {
        imageUrl = await upload(file, "categories");
      }

      const { error } = await db.from("categories").insert({
        name: name,
        sort_order: sortOrder,
        image_url: imageUrl || null
      });

      if (error) throw error;

      $("categoryForm").reset();

      if ($("categoryImagePreview")) {
        $("categoryImagePreview").innerHTML = "";
      }

      await loadCategories();
      msg("categoryMsg", "Kategoria u ruajt me sukses!");
    } catch (e) {
      msg("categoryMsg", "Gabim: " + e.message, true);
    } finally {
      setButtonBusy(button, false);
    }
  }

  /* PRODUKTET */

  async function loadProducts() {
    const el = $("productsAdmin");
    if (!el) return;

    el.textContent = "Po ngarkohen produktet...";

    const { data, error } = await db
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    if (!data || !data.length) {
      el.textContent = "Nuk ka produkte.";
      return;
    }

    el.innerHTML = data.map(p => `
      <article style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;padding:12px 0;border-bottom:1px solid #ddd">
        ${p.image_url ? `
          <img src="${esc(p.image_url)}"
               alt="${esc(p.name)}"
               style="width:75px;height:75px;object-fit:cover;border-radius:8px">
        ` : ""}

        <div style="flex:1;min-width:130px">
          <strong>${esc(p.name)}</strong>
          <div>Kategoria: ${esc(p.category)}</div>
          <div>Çmimi: ${price(p.sale_price ?? p.price)}</div>
          <div>Stoku: ${Number(p.stock || 0)}</div>
          <div>Statusi: ${p.active ? "Aktiv" : "Joaktiv"}</div>
        </div>

        <button type="button" data-edit-product="${esc(p.id)}">
          Ndrysho
        </button>

        <button type="button" class="danger"
                data-delete-product="${esc(p.id)}">
          Fshi
        </button>
      </article>
    `).join("");

    el.querySelectorAll("[data-edit-product]").forEach(button => {
      button.addEventListener("click", () =>
        editProduct(button.dataset.editProduct)
      );
    });

    el.querySelectorAll("[data-delete-product]").forEach(button => {
      button.addEventListener("click", () =>
        deleteProduct(button.dataset.deleteProduct)
      );
    });
  }

  async function editProduct(id) {
    try {
      const { data, error } = await db
        .from("products")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;

      editingProduct = data.id;
      productPhoto = data.image_url || "";

      $("productId").value = data.id;
      $("productName").value = data.name || "";
      $("productSku").value = data.sku || "";

      fillCategorySelect(data.category || "");

      $("productPrice").value = data.price ?? "";
      $("productSalePrice").value = data.sale_price ?? "";
      $("productStock").value = data.stock ?? 0;
      $("productDescription").value = data.description || "";
      $("productFeatured").checked = !!data.featured;
      $("productActive").checked = data.active !== false;
      $("productImage").value = "";

      $("imagePreview").innerHTML = productPhoto
        ? `<img src="${esc(productPhoto)}" alt=""
               style="max-width:220px;max-height:220px;object-fit:contain">`
        : "";

      $("formTitle").textContent = "Ndrysho produktin";
      msg("productMsg", "");
      show("productFormBox", true);
      $("productFormBox").scrollIntoView({ behavior: "smooth" });
    } catch (e) {
      alert("Gabim gjatë hapjes së produktit: " + e.message);
    }
  }

  async function deleteProduct(id) {
    if (!confirm("Dëshiron ta fshish këtë produkt?")) return;

    try {
      const { error } = await db
        .from("products")
        .delete()
        .eq("id", id);

      if (error) throw error;

      await loadProducts();
      msg("productMsg", "Produkti u fshi.");
    } catch (e) {
      alert("Gabim gjatë fshirjes: " + e.message);
    }
  }

  async function saveProduct(event) {
    event.preventDefault();
    if (busy) return;

    busy = true;

    const form = $("productForm");
    const button = form.querySelector('[type="submit"]');
    setButtonBusy(button, true);

    try {
      msg("productMsg", "Po ruhet produkti...");

      const name = $("productName").value.trim();
      const category = $("productCategory").value;
      const priceValue = Number($("productPrice").value);
      const sale = $("productSalePrice").value.trim();
      const stock = Number($("productStock").value);

      if (!name || !category) {
        throw new Error("Plotëso emrin dhe zgjidh kategorinë.");
      }

      if ($("productPrice").value.trim() === "" ||
          !Number.isFinite(priceValue) || priceValue < 0) {
        throw new Error("Shkruaj një çmim të vlefshëm.");
      }

      if (sale !== "" &&
          (!Number.isFinite(Number(sale)) || Number(sale) < 0)) {
        throw new Error("Kontrollo çmimin promocional.");
      }

      if (!Number.isInteger(stock) || stock < 0) {
        throw new Error("Stoku duhet të jetë numër i plotë zero ose më i madh.");
      }

      const file = $("productImage").files[0];
      const uploaded = await upload(file, "products");

      const row = {
        name: name,
        sku: $("productSku").value.trim() || ("DSS-" + Date.now()),
        category: category,
        price: priceValue,
        sale_price: sale === "" ? null : Number(sale),
        stock: stock,
        description: $("productDescription").value.trim() || null,
        featured: $("productFeatured").checked,
        active: $("productActive").checked,
        image_url: uploaded || productPhoto || null
      };

      const result = editingProduct
        ? await db.from("products").update(row).eq("id", editingProduct)
        : await db.from("products").insert(row);

      if (result.error) throw result.error;

      editingProduct = null;
      productPhoto = "";

      form.reset();
      $("productId").value = "";
      $("productStock").value = "0";
      $("productActive").checked = true;
      $("imagePreview").innerHTML = "";
      fillCategorySelect("");

      show("productFormBox", false);
      msg("productMsg", "Produkti u ruajt me sukses!");

      await loadProducts();
    } catch (e) {
      msg("productMsg", "Gabim: " + e.message, true);
    } finally {
      busy = false;
      setButtonBusy(button, false);
    }
  }

  /* BANERAT */

  async function loadBanners() {
    const el = $("bannersAdmin");
    if (!el) return;

    el.textContent = "Po ngarkohen banerat...";

    const { data, error } = await db
      .from("site_banners")
      .select("*")
      .order("sort_order", { ascending: true });

    if (error) throw error;

    if (!data || !data.length) {
      el.textContent = 'Nuk ka banera. Shtyp "Shto baner".';
      return;
    }

    el.innerHTML = data.map(b => `
      <article class="banner-item">
        <strong>${esc(b.title)}</strong>
        <p>${esc(b.subtitle || "")}</p>
        ${b.image_url ? `
          <img src="${esc(b.image_url)}" alt="${esc(b.title)}"
               style="max-width:100%;max-height:200px;object-fit:contain">
        ` : ""}
        <p>Statusi: ${b.active ? "Aktiv" : "Joaktiv"}
           · Renditja: ${Number(b.sort_order || 0)}</p>

        <button type="button" data-edit-banner="${esc(b.id)}">
          Ndrysho
        </button>
        <button type="button" class="danger"
                data-delete-banner="${esc(b.id)}">
          Fshi
        </button>
      </article>
    `).join("");

    el.querySelectorAll("[data-edit-banner]").forEach(button => {
      button.addEventListener("click", () =>
        editBanner(button.dataset.editBanner)
      );
    });

    el.querySelectorAll("[data-delete-banner]").forEach(button => {
      button.addEventListener("click", () =>
        deleteBanner(button.dataset.deleteBanner)
      );
    });
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
      const { data, error } = await db
        .from("site_banners")
        .select("*")
        .eq("id", id)
        .single();

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
        ? `<img src="${esc(bannerPhoto)}" alt=""
               style="max-width:100%;max-height:200px">`
        : "";

      $("bannerFormTitle").textContent = "Ndrysho banerin";
      msg("bannerMsg", "");
      show("bannerFormBox", true);
      $("bannerFormBox").scrollIntoView({ behavior: "smooth" });
    } catch (e) {
      alert("Gabim gjatë hapjes së banerit: " + e.message);
    }
  }

  async function saveBanner(event) {
    event.preventDefault();
    if (busy) return;

    busy = true;

    const button = $("bannerForm").querySelector('[type="submit"]');
    setButtonBusy(button, true);

    try {
      msg("bannerMsg", "Po ruhet baneri...");

      const title = $("bannerTitle").value.trim();
      const sortOrder = Number($("bannerSortOrder").value || 0);

      if (!title) {
        throw new Error("Shkruaj titullin e banerit.");
      }

      if (!Number.isInteger(sortOrder) || sortOrder < 0) {
        throw new Error("Renditja duhet të jetë numër i plotë zero ose më i madh.");
      }

      const file = $("bannerImage").files[0];
      const uploaded = await upload(file, "banners");

      const row = {
        title: title,
        subtitle: $("bannerSubtitle").value.trim() || null,
        image_url: uploaded || bannerPhoto || null,
        button_text: $("bannerButtonText").value.trim() || null,
        button_url: $("bannerButtonUrl").value.trim() || "#products",
        sort_order: sortOrder,
        active: $("bannerActive").checked
      };

      const result = editingBanner
        ? await db.from("site_banners").update(row).eq("id", editingBanner)
        : await db.from("site_banners").insert(row);

      if (result.error) throw result.error;

      clearBannerForm();
      show("bannerFormBox", false);

      await loadBanners();
      msg("bannerMsg", "Baneri u ruajt me sukses!");
    } catch (e) {
      msg("bannerMsg", "Gabim: " + e.message, true);
    } finally {
      busy = false;
      setButtonBusy(button, false);
    }
  }

  async function deleteBanner(id) {
    if (!confirm("Dëshiron ta fshish këtë baner?")) return;

    try {
      const { error } = await db
        .from("site_banners")
        .delete()
        .eq("id", id);

      if (error) throw error;

      await loadBanners();
      msg("bannerMsg", "Baneri u fshi.");
    } catch (e) {
      alert("Gabim gjatë fshirjes së banerit: " + e.message);
    }
  }

  /* POROSITE */

  async function loadOrders() {
    const el = $("orders");
    if (!el) return;

    el.textContent = "Po ngarkohen porositë...";

    const { data, error } = await db
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    if (!data || !data.length) {
      el.textContent = "Nuk ka porosi.";
      return;
    }

    const statuses = [
      ["new", "E re"],
      ["processing", "Në përpunim"],
      ["completed", "Përfunduar"],
      ["cancelled", "Anuluar"]
    ];

    el.innerHTML = data.map(o => `
      <article style="padding:12px 0;border-bottom:1px solid #ddd">
        <strong>Porosia #${esc(o.id)}</strong>
        <p>${esc(o.customer_name || "")} · ${esc(o.phone || "")}</p>
        <p>${esc(o.address || "")}</p>
        <p>Totali: ${price(o.total)}</p>

        <label>
          Statusi:
          <select data-order="${esc(o.id)}">
            ${statuses.map(([value, label]) => `
              <option value="${value}"
                ${o.status === value ? "selected" : ""}>
                ${label}
              </option>
            `).join("")}
          </select>
        </label>
      </article>
    `).join("");

    el.querySelectorAll("[data-order]").forEach(select => {
      select.addEventListener("change", async function () {
        const previous = data.find(
          o => String(o.id) === select.dataset.order
        );

        try {
          const { error } = await db
            .from("orders")
            .update({ status: select.value })
            .eq("id", select.dataset.order);

          if (error) throw error;

          msg("loginMsg", "Statusi i porosisë u ndryshua.");
        } catch (e) {
          alert("Gabim gjatë ndryshimit të statusit: " + e.message);

          if (previous) select.value = previous.status;
        }
      });
    });
  }

  /* PANELI ADMIN */

  async function showPanel() {
    show("login", false);
    show("reset", false);
    show("panel", true);
    show("logout", true);

    const tasks = [
      ["productsAdmin", loadProducts],
      ["orders", loadOrders],
      ["bannersAdmin", loadBanners],
      ["categoriesAdmin", loadCategories]
    ];

    const results = await Promise.allSettled(
      tasks.map(([, fn]) => fn())
    );

    results.forEach((result, index) => {
      if (result.status === "rejected") {
        const target = $(tasks[index][0]);
        if (target) {
          target.textContent =
            "Gabim: " +
            (result.reason?.message || "Gabim i panjohur");
        }
      }
    });
  }

  /* HYRJA DHE KONFIGURIMI */

  function init() {
    if (!window.supabase ||
        !window.DSS_SUPABASE_URL ||
        !window.DSS_SUPABASE_KEY) {
      msg(
        "loginMsg",
        "Supabase/config.js nuk u ngarkua. Kontrollo config.js.",
        true
      );
      return;
    }

    db = window.supabase.createClient(
      window.DSS_SUPABASE_URL,
      window.DSS_SUPABASE_KEY
    );

    prepareCategorySelect();

    listen("categoryForm", "submit", saveCategory);

    listen("loginForm", "submit", async function (event) {
      event.preventDefault();

      const button = $("loginForm").querySelector('[type="submit"]');
      setButtonBusy(button, true);
      msg("loginMsg", "Po kontrollohen të dhënat...");

      try {
        const email = $("email").value.trim();
        const password = $("password").value;

        const { data, error } = await db.auth.signInWithPassword({
          email,
          password
        });

        if (error) throw error;
        if (!data.session) {
          throw new Error("Sesioni nuk u krijua.");
        }

        await showPanel();
      } catch (e) {
        msg("loginMsg", "Gabim gjatë hyrjes: " + e.message, true);
      } finally {
        setButtonBusy(button, false);
      }
    });

    listen("forgotBtn", "click", async function () {
      const email = $("email").value.trim();

      if (!email) {
        msg("loginMsg", "Shkruaj email-in fillimisht.", true);
        return;
      }

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

    listen("resetForm", "submit", async function (event) {
      event.preventDefault();

      const a = $("newPassword").value;
      const b = $("newPassword2").value;

      if (a.length < 6) {
        msg("resetMsg", "Fjalëkalimi duhet të ketë të paktën 6 karaktere.", true);
        return;
      }

      if (a !== b) {
        msg("resetMsg", "Fjalëkalimet nuk përputhen.", true);
        return;
      }

      try {
        const { error } = await db.auth.updateUser({ password: a });
        if (error) throw error;

        msg("resetMsg", "Fjalëkalimi u ndryshua.");
        await showPanel();
      } catch (e) {
        msg("resetMsg", "Gabim: " + e.message, true);
      }
    });

    listen("logout", "click", async function () {
      const { error } = await db.auth.signOut();

      if (error) {
        alert(error.message);
        return;
      }

      show("login", true);
      show("panel", false);
      show("reset", false);
      show("logout", false);

      $("loginForm").reset();
      msg("loginMsg", "Ke dalë nga llogaria.");
    });

    listen("newBtn", "click", function () {
      editingProduct = null;
      productPhoto = "";

      $("productForm").reset();
      $("productId").value = "";
      $("productStock").value = "0";
      $("productActive").checked = true;
      $("imagePreview").innerHTML = "";
      $("productImage").value = "";
      $("formTitle").textContent = "Shto produkt";

      fillCategorySelect("");
      msg("productMsg", "");
      show("productFormBox", true);
      $("productFormBox").scrollIntoView({ behavior: "smooth" });
    });

    listen("cancelProduct", "click", function () {
      show("productFormBox", false);
      editingProduct = null;
      productPhoto = "";
    });

    listen("productForm", "submit", saveProduct);

    listen("newBannerBtn", "click", function () {
      clearBannerForm();
      show("bannerFormBox", true);
      $("bannerFormBox").scrollIntoView({ behavior: "smooth" });
    });

    listen("cancelBanner", "click", function () {
      show("bannerFormBox", false);
      clearBannerForm();
    });

    listen("bannerForm", "submit", saveBanner);

    preview("productImage", "imagePreview", "productMsg");
    preview("bannerImage", "bannerImagePreview", "bannerMsg");
    preview("categoryImage", "categoryImagePreview", "categoryMsg");

    const recovery =
      new URLSearchParams(location.hash.slice(1)).get("type") === "recovery";

    show("login", !recovery);
    show("reset", recovery);
    show("panel", false);
    show("logout", false);

    db.auth.getSession().then(async ({ data, error }) => {
      if (error) {
        msg("loginMsg", error.message, true);
        return;
      }

      if (data.session && !recovery) {
        await showPanel();
      }
    }).catch(e => {
      msg("loginMsg", e.message, true);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
