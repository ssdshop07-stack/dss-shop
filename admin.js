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

  function listen(id, event, callback) {
    const el = $(id);
    if (!el) {
      console.error("Mungon elementi HTML:", id);
      return;
    }
    el.addEventListener(event, callback);
  }

  function setButtonBusy(button, value) {
    if (button) button.disabled = value;
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
          'Nuk ekziston bucket "product-image". Kontrollo Supabase Storage.'
        );
      }
      throw error;
    }

    const result = db.storage.from(BUCKET).getPublicUrl(path);
    return result.data.publicUrl;
  }

  function preview(inputId, previewId, messageId) {
    const input = $(inputId);
    if (!input) return;

    input.addEventListener("change", function () {
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

    categories
      .filter(c => !["te gjitha", "te gjitha produktet", "all"].includes(String(c.name || "").normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").toLowerCase().trim()) && (c.active !== false || c.name === current))
      .forEach(category => {
        const option = document.createElement("option");
        option.value = category.name;
        option.textContent = category.active === false
          ? category.name + " (joaktive)"
          : category.name;
        select.appendChild(option);
      });

    if (current && !["te gjitha", "te gjitha produktet", "all"].includes(String(current).normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").toLowerCase().trim()) && !categories.some(c => c.name === current)) {
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
      .select("id, name, image_url, active, sort_order")
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
      <article class="category-item">
        <strong>${esc(c.name)}</strong>

        ${c.image_url ? `
          <img src="${esc(c.image_url)}"
            alt="${esc(c.name)}"
            style="display:block;width:120px;height:90px;object-fit:contain;border-radius:8px;margin:8px 0">
        ` : ""}

        <label>
          Fotoja e kategorisë (opsionale)
          <input type="file" accept="image/*"
            data-category-image="${esc(c.id)}">
        </label>

        <div data-category-preview="${esc(c.id)}"></div>

        <label>
          Emri i kategorisë
          <input type="text"
            data-category-name="${esc(c.id)}"
            value="${esc(c.name)}"
            maxlength="100" required>
        </label>

        <label>
          Renditja
          <input type="number"
            data-category-order="${esc(c.id)}"
            value="${Number(c.sort_order || 0)}"
            min="0" step="1" required>
        </label>

        <label>
          <input type="checkbox"
            data-category-active="${esc(c.id)}"
            ${c.active !== false ? "checked" : ""}>
          Kategoria aktive
        </label>

        <p>Statusi: <strong>${
          c.active !== false ? "Aktive" : "Joaktive"
        }</strong></p>

        <button type="button"
          data-save-category="${esc(c.id)}">
          Ruaj ndryshimet
        </button>

        <button type="button" class="danger"
          data-delete-category="${esc(c.id)}">
          Fshi kategorinë
        </button>
      </article>
    `).join("");

    /* RUAJTJA E KATEGORIVE EKZISTUESE */

    el.querySelectorAll("[data-save-category]").forEach(button => {
      button.addEventListener("click", async function () {
        if (busy) {
          msg("categoryMsg", "Një veprim tjetër është në proces. Prit pak dhe provo përsëri.", true);
          return;
        }

        const id = button.dataset.saveCategory;
        const original = categories.find(
          c => String(c.id) === String(id)
        );

        if (!original) return;

        const nameInput = el.querySelector(
          `[data-category-name="${id}"]`
        );
        const orderInput = el.querySelector(
          `[data-category-order="${id}"]`
        );
        const activeInput = el.querySelector(
          `[data-category-active="${id}"]`
        );
        const imageInput = el.querySelector(
          `[data-category-image="${id}"]`
        );

        const name = nameInput.value.trim();
        const order = Number(orderInput.value);

        if (!name) {
          msg("categoryMsg", "Shkruaj emrin e kategorisë.", true);
          nameInput.focus();
          return;
        }

        if (
          orderInput.value.trim() === "" ||
          !Number.isInteger(order) ||
          order < 0
        ) {
          msg(
            "categoryMsg",
            "Renditja duhet të jetë numër i plotë zero ose më i madh.",
            true
          );
          orderInput.focus();
          return;
        }

        const duplicate = categories.some(c =>
          String(c.id) !== String(id) &&
          c.name.trim().toLowerCase() === name.toLowerCase()
        );

        if (duplicate) {
          msg("categoryMsg", "Kjo kategori ekziston tashmë.", true);
          nameInput.focus();
          return;
        }

        busy = true;
        button.disabled = true;

        try {
          msg("categoryMsg", "Po ruhen ndryshimet...");

          let imageUrl = original.image_url || null;
          const imageFile = imageInput && imageInput.files
            ? imageInput.files[0]
            : null;

          if (imageFile) {
            imageUrl = await upload(imageFile, "categories");
          }

          // Ruaj fillimisht kategorinë dhe verifiko që rreshti u ndryshua.
          const { data: savedCategory, error: categoryError } = await db
            .from("categories")
            .update({
              name: name,
              image_url: imageUrl,
              sort_order: order,
              active: activeInput.checked
            })
            .eq("id", original.id)
            .select("id, name")
            .maybeSingle();

          if (categoryError) throw categoryError;
          if (!savedCategory) {
            throw new Error("Kategoria nuk u ndryshua në databazë. Kontrollo lejet (RLS) të tabelës categories në Supabase.");
          }

          // Përditëso edhe produktet që përdorin emrin e vjetër.
          if (name !== original.name) {
            const { error: productError } = await db
              .from("products")
              .update({ category: name })
              .eq("category", original.name);

            if (productError) {
              await loadCategories();
              await loadProducts();
              throw new Error("Emri i kategorisë u ruajt, por produktet nuk u lidhën me emrin e ri. Kontrollo lejet UPDATE të tabelës products në Supabase. Detaji: " + productError.message);
            }
          }

          await loadCategories();
          await loadProducts();

          msg("categoryMsg", "Kategoria u ruajt me sukses.");
        } catch (e) {
          msg("categoryMsg", "Gabim: " + e.message, true);
        } finally {
          busy = false;
          button.disabled = false;
        }
      });
    });

    /* FSHIRJA E KATEGORIVE */

    el.querySelectorAll("[data-delete-category]").forEach(button => {
      button.addEventListener("click", async function () {
        if (busy) return;

        const category = categories.find(
          c => String(c.id) === String(button.dataset.deleteCategory)
        );

        if (!category) return;

        try {
          const { data: usedProducts, error: checkError } = await db
            .from("products")
            .select("id")
            .eq("category", category.name)
            .limit(1);

          if (checkError) throw checkError;

          if (usedProducts && usedProducts.length) {
            msg(
              "categoryMsg",
              "Kjo kategori përdoret nga produkte. Ndrysho kategorinë e produkteve përpara fshirjes.",
              true
            );
            return;
          }

          if (!confirm(
            'Dëshiron të fshish kategorinë "' + category.name + '"?'
          )) return;

          busy = true;
          button.disabled = true;

          const { error } = await db
            .from("categories")
            .delete()
            .eq("id", category.id);

          if (error) throw error;

          await loadCategories();
          msg("categoryMsg", "Kategoria u fshi.");
        } catch (e) {
          msg("categoryMsg", "Gabim gjatë fshirjes: " + e.message, true);
        } finally {
          busy = false;
          button.disabled = false;
        }
      });
    });
  }

  async function saveCategory(event) {
    event.preventDefault();
    if (busy) return;

    const name = $("categoryName").value.trim();
    const sortOrder = Number($("categorySort").value || 0);

    if (!name) {
      msg("categoryMsg", "Shkruaj emrin e kategorisë.", true);
      return;
    }

    if (!Number.isInteger(sortOrder) || sortOrder < 0) {
      msg(
        "categoryMsg",
        "Renditja duhet të jetë numër i plotë zero ose më i madh.",
        true
      );
      return;
    }

    if (categories.some(c =>
      c.name.trim().toLowerCase() === name.toLowerCase()
    )) {
      msg("categoryMsg", "Kjo kategori ekziston tashmë.", true);
      return;
    }

    const form = $("categoryForm");
    const button = form.querySelector('[type="submit"]');

    busy = true;
    setButtonBusy(button, true);

    try {
      msg("categoryMsg", "Po ruhet kategoria...");

      const imageFile = $("categoryImage") &&
        $("categoryImage").files
        ? $("categoryImage").files[0]
        : null;

      const imageUrl = imageFile
        ? await upload(imageFile, "categories")
        : null;

      const { error } = await db
        .from("categories")
        .insert({
          name: name,
          image_url: imageUrl,
          sort_order: sortOrder,
          active: true
        });

      if (error) throw error;

      form.reset();
      $("categorySort").value = "10";

      if ($("categoryImagePreview")) {
        $("categoryImagePreview").innerHTML = "";
      }

      if ($("categoryImage")) {
        $("categoryImage").value = "";
      }

      await loadCategories();
      msg("categoryMsg", "Kategoria u shtua me sukses.");
    } catch (e) {
      msg("categoryMsg", "Gabim: " + e.message, true);
    } finally {
      busy = false;
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

    // Grupojmë produktet sipas kategorisë që kanë në databazë.
    const groups = new Map();
    data.forEach(product => {
      const categoryName = String(product.category || "Pa kategori").trim() || "Pa kategori";
      if (!groups.has(categoryName)) groups.set(categoryName, []);
      groups.get(categoryName).push(product);
    });

    const categoryOrder = new Map(
      categories.map((category, index) => [String(category.name || "").toLowerCase(), index])
    );
    const sortedGroups = Array.from(groups.entries()).sort((a, b) => {
      const ai = categoryOrder.has(a[0].toLowerCase()) ? categoryOrder.get(a[0].toLowerCase()) : 99999;
      const bi = categoryOrder.has(b[0].toLowerCase()) ? categoryOrder.get(b[0].toLowerCase()) : 99999;
      return ai - bi || a[0].localeCompare(b[0], "sq");
    });

    el.innerHTML = sortedGroups.map(([categoryName, products]) => `
      <section class="product-category-group" style="border:1px solid #d0d5dd;border-radius:12px;margin:14px 0;overflow:hidden">
        <h3 style="margin:0;padding:13px;background:#eef2f6;display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap">
          <span>${esc(categoryName)}</span>
          <span style="font-size:14px;font-weight:normal">${products.length} produkt(e)</span>
        </h3>
        <div style="padding:0 12px">
          ${products.map(p => `
            <article style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;padding:12px 0;border-bottom:1px solid #eee">
              ${p.image_url ? `
                <img src="${esc(p.image_url)}" alt="${esc(p.name)}"
                  style="width:75px;height:75px;object-fit:cover;border-radius:8px">
              ` : ""}
              <div style="flex:1;min-width:130px">
                <strong>${esc(p.name)}</strong>
                <div>SKU: ${esc(p.sku || "—")}</div>
                <div>Gjendja: ${p.product_condition === "used" ? "E përdorur" : "E re"}</div>
                <div>Çmimi: ${price(p.sale_price ?? p.price)}</div>
                <div>Stoku: ${Number(p.stock || 0)}</div>
                <div>Statusi: ${p.active ? "Aktiv" : "Joaktiv"}</div>
              </div>
              <button type="button" data-edit-product="${esc(p.id)}">Ndrysho</button>
              <button type="button" class="danger" data-delete-product="${esc(p.id)}">Fshi</button>
            </article>
          `).join("")}
        </div>
      </section>
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
      $("productCondition").value = data.product_condition === "used" ? "used" : "new";
      $("productStock").value = data.stock ?? 0;
      $("productDescription").value = data.description || "";
      $("productVideoUrl").value = data.installation_video_url || "";
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
      const priceText = $("productPrice").value.trim();
      const priceValue = Number(priceText);
      const sale = $("productSalePrice").value.trim();
      const stock = Number($("productStock").value);

      if (!name || !category) {
        throw new Error("Plotëso emrin dhe zgjidh kategorinë.");
      }

      if (
        priceText === "" ||
        !Number.isFinite(priceValue) ||
        priceValue < 0
      ) {
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
        product_condition: $("productCondition").value === "used" ? "used" : "new",
        price: priceValue,
        sale_price: sale === "" ? null : Number(sale),
        stock: stock,
        description: $("productDescription").value.trim() || null,
        installation_video_url: $("productVideoUrl").value.trim() || null,
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

      await loadProducts();
      msg("productMsg", "Produkti u ruajt me sukses.");
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
          <img src="${esc(b.image_url)}"
            alt="${esc(b.title)}"
            style="max-width:100%;max-height:200px;object-fit:contain">
        ` : ""}

        <p>
          Statusi: ${b.active ? "Aktiv" : "Joaktiv"}
          · Renditja: ${Number(b.sort_order || 0)}
        </p>

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

      if (!title) throw new Error("Shkruaj titullin e banerit.");

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
      msg("bannerMsg", "Baneri u ruajt me sukses.");
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

  /* TRAFIKU I VIZITOREVE */

  async function loadTraffic() {
    const stats = $("trafficStats");
    const recent = $("trafficRecent");
    if (!stats || !recent) return;
    stats.textContent = "Po ngarkohen statistikat...";
    recent.textContent = "Po ngarkohen vizitat...";
    const { data, error } = await db.from("site_visits")
      .select("id, visited_at, page_path, referrer_host, device_type")
      .order("visited_at", { ascending: false }).limit(500);
    if (error) {
      stats.textContent = "Gabim gjatë ngarkimit: " + error.message;
      recent.textContent = "Kontrollo lejet e Supabase.";
      throw error;
    }
    const visits = data || [];
    const todayKey = new Date().toISOString().slice(0, 10);
    const today = visits.filter(v => String(v.visited_at || "").slice(0, 10) === todayKey).length;
    const mobile = visits.filter(v => v.device_type === "mobile").length;
    const desktop = visits.filter(v => v.device_type === "desktop").length;
    const tablet = visits.filter(v => v.device_type === "tablet").length;
    stats.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(125px,1fr));gap:10px;margin:12px 0">
      <div style="padding:12px;background:#eef4ff;border-radius:10px">Vizita të ruajtura<h2>${visits.length}</h2><small>Maksimumi 500 të fundit</small></div>
      <div style="padding:12px;background:#ecfdf3;border-radius:10px">Vizita sot (UTC)<h2>${today}</h2></div>
      <div style="padding:12px;background:#f2f4f7;border-radius:10px">Telefon<h2>${mobile}</h2></div>
      <div style="padding:12px;background:#f2f4f7;border-radius:10px">Kompjuter<h2>${desktop}</h2></div>
      <div style="padding:12px;background:#f2f4f7;border-radius:10px">Tablet<h2>${tablet}</h2></div></div>`;
    if (!visits.length) {
      recent.textContent = "Nuk ka vizita ende. Hap faqen publike që të regjistrohet vizita e parë.";
      return;
    }
    recent.innerHTML = visits.slice(0, 50).map(v => `<article style="padding:10px 0;border-bottom:1px solid #eaecf0">
      <strong>${esc(v.page_path || "/")}</strong>
      <p>Koha: ${esc(v.visited_at ? new Date(v.visited_at).toLocaleString("sq-AL") : "—")}</p>
      <small>Pajisja: ${esc(v.device_type || "unknown")} · Burimi: ${esc(v.referrer_host || "Direkt")}</small></article>`).join("");
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

  /* MIRATIMI I LLOGARIVE TE KLIENTEVE */

  async function loadCustomerApprovals() {
    const el = $("customerApprovals");
    if (!el) return;

    el.textContent = "Po ngarkohen kërkesat...";
    const { data, error } = await db
      .from("customer_approvals")
      .select("user_id,email,status,created_at")
      .order("created_at", { ascending: false });

    if (error) throw error;
    if (!data || !data.length) {
      el.textContent = "Nuk ka kërkesa për llogari.";
      return;
    }

    el.innerHTML = data.map(item => `
      <article style="padding:12px 0;border-bottom:1px solid #ddd">
        <strong>Email: ${esc(item.email || "—")}</strong>
        <p>Statusi: <strong>${esc(item.status || "i panjohur")}</strong> · Regjistruar: ${esc(item.created_at ? new Date(item.created_at).toLocaleString("sq-AL") : "—")}</p>
        ${item.status === "pending" ? `
          <button type="button" data-approval="${esc(item.user_id)}" data-status="approved">Aprovo llogarinë</button>
          <button type="button" class="danger" data-approval="${esc(item.user_id)}" data-status="rejected">Refuzo</button>
        ` : ""}
      </article>
    `).join("");

    el.querySelectorAll("[data-approval]").forEach(button => {
      button.addEventListener("click", async () => {
        const id = button.dataset.approval;
        const status = button.dataset.status;
        const article = button.closest("article");
        const buttons = article ? article.querySelectorAll("button") : [button];
        buttons.forEach(b => { b.disabled = true; });
        const oldText = button.textContent;
        button.textContent = "Po ruhet...";

        try {
          // Confirm that Supabase actually changed a row; UPDATE without SELECT
          // can otherwise appear successful when RLS blocks the operation.
          const { data: updated, error: updateError } = await db
            .from("customer_approvals")
            .update({ status, reviewed_at: new Date().toISOString() })
            .eq("user_id", id)
            .select("user_id,email,status")
            .maybeSingle();

          if (updateError) throw updateError;
          if (!updated) {
            throw new Error("Supabase nuk ndryshoi asnjë rresht. Kontrollo që je hyrë si administratori i DSS Shop dhe që politikat RLS lejojnë miratimin.");
          }

          msg("loginMsg", status === "approved"
            ? "Llogaria u aprovua. Klienti mund të hyjë tani me email dhe fjalëkalim."
            : "Kërkesa e klientit u refuzua.");
          await loadCustomerApprovals();
        } catch (e) {
          const message = "Miratimi dështoi: " + (e.message || "Gabim i panjohur");
          msg("loginMsg", message, true);
          alert(message);
          buttons.forEach(b => { b.disabled = false; });
          button.textContent = oldText;
        }
      });
    });
  }

  /* PANELI */

  function showPanel() {
    // Hap panelin menjëherë; mos e lidh hyrjen me ngarkimin e tabelave.
    show("login", false);
    show("reset", false);
    show("panel", true);
    show("logout", true);

    const tasks = [
      ["productsAdmin", loadProducts],
      ["orders", loadOrders],
      ["bannersAdmin", loadBanners],
      ["categoriesAdmin", loadCategories],
      ["trafficStats", loadTraffic],
      ["customerApprovals", loadCustomerApprovals]
    ];

    tasks.forEach(([targetId, loader]) => {
      Promise.resolve()
        .then(() => loader())
        .catch(error => {
          console.error("DSS Admin load failed:", targetId, error);
          const target = $(targetId);
          if (target) {
            target.textContent = "Gabim gjatë ngarkimit: " +
              (error?.message || "Gabim i panjohur") +
              ". Shtyp Rifresko për të provuar përsëri.";
          }
        });
    });
  }

  /* HYRJA, RIKUPERIMI DHE INIT */

  function init() {
    if (
      !window.supabase ||
      !window.DSS_SUPABASE_URL ||
      !window.DSS_SUPABASE_KEY
    ) {
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
    listen("refreshTraffic", "click", async function () {
      try { await loadTraffic(); } catch (e) { console.error(e); }
    });
    listen("refreshApprovals", "click", async function () {
      try { await loadCustomerApprovals(); } catch (e) { msg("loginMsg", "Gabim gjatë ngarkimit të kërkesave: " + e.message, true); }
    });

    listen("loginForm", "submit", async function (event) {
      event.preventDefault();

      const button = $("loginForm").querySelector('[type="submit"]');
      setButtonBusy(button, true);
      msg("loginMsg", "Po kontrollohen të dhënat...");

      try {
        const email = $("email").value.trim();
        const password = $("password").value;

        const { data, error } = await db.auth.signInWithPassword({
          email: email,
          password: password
        });

        if (error) {
          const message = String(error.message || "");
          if (/email not confirmed/i.test(message)) {
            throw new Error("Email-i nuk është verifikuar. Hap email-in nga Supabase dhe kliko lidhjen e verifikimit.");
          }
          if (/invalid login credentials/i.test(message)) {
            throw new Error("Email-i ose fjalëkalimi nuk është i saktë.");
          }
          throw error;
        }

        if (!data.session) {
          throw new Error("Supabase nuk krijoi sesion. Provo përsëri.");
        }

        if (data.user && !data.user.email_confirmed_at) {
          await db.auth.signOut();
          throw new Error("Email-i nuk është verifikuar. Kontrollo kutinë hyrëse dhe Spam.");
        }

        await showPanel();
      } catch (e) {
        msg("loginMsg", "Gabim gjatë hyrjes: " + (e.message || "Gabim i panjohur"), true);
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

      const button = $("forgotBtn");
      setButtonBusy(button, true);
      try {
        const { error } = await db.auth.resetPasswordForEmail(email, {
          redirectTo: location.href.split("#")[0]
        });

        if (error) throw error;

        msg("loginMsg", "Nëse ky email është i regjistruar, do të marrësh një lidhje rikuperimi. Kontrollo edhe Spam.");
      } catch (e) {
        msg("loginMsg", "Gabim gjatë rikuperimit: " + (e.message || "Gabim i panjohur"), true);
      } finally {
        setButtonBusy(button, false);
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

    db.auth.getSession()
      .then(async ({ data, error }) => {
        if (error) {
          msg("loginMsg", error.message, true);
          return;
        }

        if (data.session && !recovery) {
          await showPanel();
        }
      })
      .catch(e => {
        msg("loginMsg", e.message, true);
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
