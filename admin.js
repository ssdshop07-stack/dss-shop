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
  let productCosts = new Map();
  let selectedProductMarkup = null;
  let adminLiveChannel = null;

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

  async function loadProductCosts() {
    // Kostoja është shtesë opsionale: nëse RPC i kostove dështon,
    // lista dhe redaktimi i produkteve duhet të vazhdojnë normalisht.
    try {
      const { data, error } = await db.rpc("dss_admin_get_product_costs");
      if (error) throw error;
      productCosts = new Map((Array.isArray(data) ? data : []).map(x => [String(x.product_id), Number(x.cost_price)]));
    } catch (error) {
      console.warn("DSS: kostot nuk u ngarkuan; redaktimi i produkteve vazhdon:", error?.message || error);
      productCosts = new Map();
    }
    return productCosts;
  }

  function localDateInput(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + d;
  }

  async function loadProfitReport() {
    const fromValue = $("profitFrom")?.value;
    const toValue = $("profitTo")?.value;
    if (!fromValue || !toValue) return;
    const from = new Date(fromValue + "T00:00:00");
    const to = new Date(toValue + "T00:00:00");
    to.setDate(to.getDate() + 1);
    if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || to <= from) {
      msg("profitSummary", "Zgjidh një periudhë të vlefshme.", true);
      return;
    }
    $("profitSummary").textContent = "Po llogaritet fitimi...";
    $("profitOrders").textContent = "";
    const { data, error } = await db.rpc("dss_admin_profit_report", {
      p_from: from.toISOString(), p_to: to.toISOString()
    });
    if (error) throw error;
    const report = data || {};
    $("profitSummary").innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(135px,1fr));gap:10px">
        <div style="padding:12px;border:1px solid #eaecf0;border-radius:10px"><small>Xhiro (pa anuluara)</small><h3>${price(report.revenue)}</h3></div>
        <div style="padding:12px;border:1px solid #eaecf0;border-radius:10px"><small>Kosto e njohur</small><h3>${price(report.known_cost)}</h3></div>
        <div style="padding:12px;border:1px solid #12b76a;border-radius:10px"><small>Fitimi i llogaritshëm</small><h3>${price(report.profit)}</h3></div>
        <div style="padding:12px;border:1px solid #eaecf0;border-radius:10px"><small>Porosi aktive</small><h3>${Number(report.orders_count || 0)}</h3></div>
      </div>
      ${Number(report.incomplete_count || 0) ? `<p style="color:#b54708;margin-top:10px">Kujdes: ${Number(report.incomplete_count)} porosi kanë produkte pa kosto të regjistruar dhe nuk përfshihen te fitimi.</p>` : `<p style="color:#067647;margin-top:10px">Të gjitha porositë e periudhës kanë kosto të regjistruar.</p>`}
    `;
    const orders = Array.isArray(report.orders) ? report.orders : [];
    $("profitOrders").innerHTML = orders.length ? orders.map(o => `
      <article style="padding:10px 0;border-bottom:1px solid #eaecf0">
        <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap"><strong>Porosia #${esc(o.id)}</strong><button type="button" data-print-invoice="${esc(o.id)}" class="secondary">🖨️ Printo faturën</button></div> · ${esc(o.customer_name || "")}
        <div style="font-size:13px;color:#667085">${esc(o.created_at ? new Date(o.created_at).toLocaleString("sq-AL") : "")} · ${esc(o.status || "")}</div>
        <div>Xhiro: ${price(o.total)} · Kosto: ${o.cost_complete ? price(o.cost_total) : "E papërcaktuar"} · <strong>Fitimi: ${o.cost_complete ? price(o.profit_total) : "—"}</strong></div>
      </article>`).join("") : "Nuk ka porosi në këtë periudhë.";
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

  /* PARALAJMERIMET E STOKUT */

  function renderStockAlerts(products) {
    const box = $("stockAlerts");
    if (!box) return;
    const active = (products || []).filter(p => p.active !== false);
    const out = active.filter(p => Number(p.stock || 0) <= 0);
    const low = active.filter(p => Number(p.stock || 0) > 0 && Number(p.stock || 0) <= 3);
    const alerts = [...out, ...low].sort((a, b) => Number(a.stock || 0) - Number(b.stock || 0));
    box.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(125px,1fr));gap:10px;margin-bottom:12px">
        <div style="padding:12px;border:1px solid #fecdca;border-radius:10px;background:#fff5f4"><small>Pa stok</small><h3 style="margin:5px 0;color:#b42318">${out.length}</h3></div>
        <div style="padding:12px;border:1px solid #fedf89;border-radius:10px;background:#fffaeb"><small>Stok i ulët (1–3)</small><h3 style="margin:5px 0;color:#b54708">${low.length}</h3></div>
      </div>
      ${alerts.length ? alerts.map(p => {
        const stock = Number(p.stock || 0);
        const empty = stock <= 0;
        return `<div style="display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap;padding:10px 0;border-bottom:1px solid #eee">
          <div style="flex:1;min-width:160px"><strong>${esc(p.name)}</strong><div style="font-size:12px;color:#667085">${esc(p.category || "Pa kategori")} · SKU: ${esc(p.sku || "—")}</div></div>
          <span style="font-weight:700;color:${empty ? "#b42318" : "#b54708"}">${empty ? "PA STOK" : "KANË MBETUR " + stock}</span>
          <button type="button" data-stock-edit="${esc(p.id)}">Përditëso stokun</button>
        </div>`;
      }).join("") : '<p style="color:#067647;margin:0">Të gjitha produktet aktive kanë më shumë se 3 copë në stok.</p>'}
    `;
    box.querySelectorAll("[data-stock-edit]").forEach(button => {
      button.addEventListener("click", () => editProduct(button.dataset.stockEdit));
    });
  }

  /* PRODUKTET */

  async function loadProducts() {
    const el = $("productsAdmin");
    if (!el) return;

    el.textContent = "Po ngarkohen produktet...";
    await loadProductCosts();

    const { data, error } = await db
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    renderStockAlerts(data || []);

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
                <div>Çmimi i shitjes: ${price(p.sale_price ?? p.price)}</div>
                <div>Kosto: ${productCosts.has(String(p.id)) ? price(productCosts.get(String(p.id))) : "E papërcaktuar"}</div>
                <div style="font-weight:700;color:${Number(p.stock || 0) <= 0 ? "#b42318" : Number(p.stock || 0) <= 3 ? "#b54708" : "#067647"}">Stoku: ${Number(p.stock || 0)}${Number(p.stock || 0) <= 0 ? " — PA STOK" : Number(p.stock || 0) <= 3 ? " — STOK I ULËT" : ""}</div>
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
      await loadProductCosts();
      $("productCostPrice").value = productCosts.has(String(data.id)) ? productCosts.get(String(data.id)) : "";
      selectedProductMarkup = null;
      updateProductMarkupUI();
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
      const costText = $("productCostPrice").value.trim();
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
      if (costText !== "" && (!Number.isFinite(Number(costText)) || Number(costText) < 0)) {
        throw new Error("Kontrollo çmimin e blerjes.");
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
        : await db.from("products").insert(row).select("id");

      if (result.error) throw result.error;

      const savedProductId = editingProduct || result.data?.[0]?.id;
      if (savedProductId && costText !== "") {
        const { error: costError } = await db.rpc("dss_admin_save_product_cost", {
          p_product_id: Number(savedProductId), p_cost_price: Number(costText)
        });
        if (costError) {
          console.warn("Produkti u ruajt, por kostoja nuk u përditësua:", costError.message);
          msg("productMsg", "Produkti u ruajt, por kostoja nuk u ruajt: " + costError.message, true);
        } else {
          productCosts.set(String(savedProductId), Number(costText));
        }
      }

      // Njofto klientët e aprovuar vetëm kur publikohet produkt i ri.
      if (!editingProduct && row.active) {
        try {
          const { data: customers, error: customersError } = await db
            .from("customer_approvals")
            .select("user_id")
            .eq("status", "approved");
          if (customersError) throw customersError;
          const recipients = (customers || []).filter(x => x.user_id);
          if (recipients.length) {
            const isOffer = row.sale_price !== null && row.sale_price < row.price;
            const { error: notifyError } = await db.from("customer_notifications").insert(
              recipients.map(x => ({
                user_id: x.user_id,
                notification_type: isOffer ? "offer" : "product",
                title: isOffer ? "Ofertë e re në DSS Shop" : "Produkt i ri në DSS Shop",
                message: isOffer
                  ? row.name + " tani është në ofertë. Çmimi promocional: €" + Number(row.sale_price).toFixed(2) + "."
                  : "Shtuam një produkt të ri: " + row.name + ".",
                product_id: result.data?.[0]?.id || null
              }))
            );
            if (notifyError) console.warn("Njoftimet e produktit nuk u ruajtën:", notifyError.message);
          }
        } catch (notificationError) {
          console.warn("Njoftimet e produktit nuk u dërguan:", notificationError.message);
        }
      }

      editingProduct = null;
      productPhoto = "";

      form.reset();
      $("productId").value = "";
      $("productStock").value = "0";
      $("productCostPrice").value = "";
      selectedProductMarkup = null;
      updateProductMarkupUI();
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

  let adminOrdersCache = [];

  async function printOrderInvoice(orderId) {
    const order = adminOrdersCache.find(o => String(o.id) === String(orderId));
    if (!order) { alert("Porosia nuk u gjet."); return; }

    // Hap dritaren menjëherë nga klikimi, që shfletuesi të mos bllokojë printimin.
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Lejo hapjen e dritareve (pop-ups) për këtë faqe dhe provo përsëri.");
      return;
    }

    printWindow.document.write("<p style='font-family:Arial;padding:20px'>Po përgatitet fatura...</p>");
    try {
      const { data: items, error } = await db.from("order_items")
        .select("product_name,sku,quantity,price,subtotal")
        .eq("order_id", order.id)
        .order("id", { ascending: true });
      if (error) throw error;

      const date = order.created_at ? new Date(order.created_at).toLocaleString("sq-AL") : "—";
      const rows = (items || []).map(item => `
        <tr>
          <td>${esc(item.product_name || "Produkt")}${item.sku ? `<small style="display:block;color:#667085">SKU: ${esc(item.sku)}</small>` : ""}</td>
          <td class="num">${Number(item.quantity || 0)}</td>
          <td class="num">${price(item.price)}</td>
          <td class="num">${price(item.subtotal ?? (Number(item.price || 0) * Number(item.quantity || 0)))}</td>
        </tr>`).join("");

      printWindow.document.open();
      printWindow.document.write(`<!doctype html><html lang="sq"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Faturë porosie #${esc(order.id)} — DSS Shop</title>
        <style>
          *{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#172033;margin:0;padding:28px;max-width:850px;margin:auto}
          .top{display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap;border-bottom:2px solid #172033;padding-bottom:18px}
          h1{margin:0 0 5px;font-size:27px}h2{font-size:20px;margin:26px 0 8px}
          .muted{color:#667085;font-size:13px;line-height:1.6}.meta{margin-top:22px;display:grid;grid-template-columns:1fr 1fr;gap:10px}
          .meta div{padding:12px;background:#f7f8fa;border-radius:8px}
          table{width:100%;border-collapse:collapse;margin-top:18px}th,td{padding:11px 8px;border-bottom:1px solid #e4e7ec;text-align:left;font-size:14px}
          th{background:#f7f8fa}.num{text-align:right;white-space:nowrap}.total{margin:18px 0 0 auto;max-width:300px;display:flex;justify-content:space-between;font-size:20px;font-weight:bold;border-top:2px solid #172033;padding-top:12px}
          .note{margin-top:18px;padding:12px;background:#f7f8fa;border-radius:8px;white-space:pre-wrap}
          .footer{margin-top:38px;border-top:1px solid #e4e7ec;padding-top:14px;text-align:center}
          .actions{margin:0 0 20px}button{padding:10px 16px;border:0;border-radius:6px;background:#155eef;color:white;font-size:15px}
          @media print{body{padding:0}.actions{display:none}}
          @media(max-width:520px){body{padding:14px}.meta{grid-template-columns:1fr}th,td{font-size:12px;padding:8px 4px}}
        </style></head><body>
        <div class="actions"><button onclick="window.print()">Printo faturën</button></div>
        <header class="top"><div><h1>DSS SHOP</h1><strong>SECURITY &amp; TECHNOLOGY</strong><p class="muted">Kamera sigurie, DVR/NVR, alarme dhe rrjetëzim<br><a href="https://dss-shop.pages.dev/">dss-shop.pages.dev</a><br>Tel / WhatsApp: +355 68 439 8803</p></div>
        <div style="text-align:right"><h2 style="margin:0">FATURË / POROSI</h2><strong>Nr. #${esc(order.id)}</strong><p class="muted">Data: ${esc(date)}</p></div></header>
        <section class="meta"><div><strong>Klienti</strong><p>${esc(order.customer_name || "—")}<br>${esc(order.phone || "—")}</p></div>
        <div><strong>Adresa e dërgesës</strong><p>${esc(order.address || "—")}</p></div></section>
        <h2>Produktet</h2><table><thead><tr><th>Produkti</th><th class="num">Sasia</th><th class="num">Çmimi</th><th class="num">Nëntotali</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="4">Nuk u gjetën detajet e produkteve për këtë porosi.</td></tr>'}</tbody></table>
        <div class="total"><span>Totali</span><span>${price(order.total)}</span></div>
        <p class="muted" style="text-align:right">Pagesa: Para në dorë në momentin e dorëzimit (COD)</p>
        ${order.notes ? `<div class="note"><strong>Shënim:</strong><br>${esc(order.notes)}</div>` : ""}
        <footer class="footer muted">Faleminderit që zgjodhët DSS Shop!<br>Dokument porosie i gjeneruar nga sistemi DSS Shop.</footer>
        <script>window.onload=function(){setTimeout(function(){window.print()},300)};</script></body></html>`);
      printWindow.document.close();
    } catch (e) {
      printWindow.document.body.innerHTML = "<p style='font-family:Arial;padding:20px;color:#b42318'>Nuk u përgatit fatura: " + esc(e.message) + "</p>";
    }
  }

  function renderOrders() {
    const el = $("orders");
    if (!el) return;
    const search = String($("orderSearch")?.value || "").trim().toLowerCase();
    const statusFilter = String($("orderStatusFilter")?.value || "all");
    const rows = adminOrdersCache.filter(order => {
      const matchesSearch = [order.id, order.customer_name, order.phone, order.address, order.notes]
        .some(value => String(value || "").toLowerCase().includes(search));
      return matchesSearch && (statusFilter === "all" || order.status === statusFilter);
    });

    const summary = $("ordersSummary");
    if (summary) {
      const active = adminOrdersCache.filter(o => o.status !== "cancelled");
      const total = active.reduce((sum, o) => sum + Number(o.total || 0), 0);
      summary.textContent = adminOrdersCache.length + " porosi gjithsej · " +
        active.length + " aktive · " + price(total) + " vlerë aktive";
    }

    if (!adminOrdersCache.length) {
      el.textContent = "Nuk ka porosi.";
      return;
    }
    if (!rows.length) {
      el.textContent = "Nuk u gjet asnjë porosi me këto kritere.";
      return;
    }

    const statuses = [
      ["new", "E re"], ["processing", "Në përpunim"],
      ["shipped", "Dërguar"], ["completed", "Përfunduar"],
      ["cancelled", "Anuluar"]
    ];
    el.innerHTML = rows.map(o => `
      <article style="padding:12px 0;border-bottom:1px solid #ddd">
        <strong>Porosia #${esc(o.id)}</strong>
        <p>${esc(o.customer_name || "")} · ${esc(o.phone || "")}</p>
        <p>${esc(o.address || "")}</p>
        ${o.notes ? `<p>Shënim: ${esc(o.notes)}</p>` : ""}
        <p>Totali: <strong>${price(o.total)}</strong> · ${esc(o.created_at ? new Date(o.created_at).toLocaleString("sq-AL") : "")}</p>
        <label>Statusi:
          <select data-order="${esc(o.id)}">
            ${statuses.map(([value,label]) => `<option value="${value}" ${o.status === value ? "selected" : ""}>${label}</option>`).join("")}
          </select>
        </label>
      </article>
    `).join("");

    el.querySelectorAll("[data-print-invoice]").forEach(button => {
      button.addEventListener("click", () => printOrderInvoice(button.dataset.printInvoice));
    });

    el.querySelectorAll("[data-order]").forEach(select => {
      select.addEventListener("change", async function () {
        const previous = adminOrdersCache.find(o => String(o.id) === select.dataset.order);
        try {
          const { error } = await db.from("orders").update({ status: select.value }).eq("id", select.dataset.order);
          if (error) throw error;
          if (previous && previous.user_id && previous.status !== select.value) {
            const labels = { new:"E re", processing:"Në përpunim", shipped:"Dërguar", completed:"Përfunduar", cancelled:"Anuluar" };
            const { error: notificationError } = await db.from("customer_notifications").insert({
              user_id: previous.user_id,
              notification_type: "order",
              title: "Përditësim i porosisë #" + previous.id,
              message: "Statusi i porosisë ndryshoi në: " + (labels[select.value] || select.value) + ".",
              order_id: previous.id
            });
            if (notificationError) console.warn("Njoftimi i porosisë nuk u ruajt:", notificationError.message);
          }
          if (previous) previous.status = select.value;
          msg("loginMsg", "Statusi i porosisë u ndryshua.");
          renderOrders();
        } catch (e) {
          alert("Gabim gjatë ndryshimit të statusit: " + e.message);
          if (previous) select.value = previous.status;
        }
      });
    });
  }

  async function loadOrders() {
    const el = $("orders");
    if (!el) return;
    el.textContent = "Po ngarkohen porositë...";
    const { data, error } = await db.from("orders").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    adminOrdersCache = data || [];
    renderOrders();
  }

  /* HISTORIKU I KLIENTEVE */
  let customerHistoryRows = [];
  function renderCustomerHistory() {
    const box = $("customerHistory");
    const search = String($("customerHistorySearch")?.value || "").trim().toLowerCase();
    if (!box) return;
    const rows = customerHistoryRows.filter(customer =>
      [customer.customer_name, customer.phone, customer.address, customer.user_id]
        .some(value => String(value || "").toLowerCase().includes(search))
    );
    if (!rows.length) {
      box.textContent = customerHistoryRows.length ? "Nuk u gjet klient me këtë kërkim." : "Nuk ka ende histori porosish.";
      return;
    }
    box.innerHTML = rows.map(customer => {
      const orders = Array.isArray(customer.orders) ? customer.orders : [];
      const history = orders.map(order => {
        const labels = {new:"E re",processing:"Në përpunim",shipped:"Dërguar",completed:"Përfunduar",cancelled:"Anuluar"};
        return `<div style="padding:8px 0;border-top:1px solid #eaecf0">
          <strong>Porosia #${esc(order.id)}</strong> · ${price(order.total)}
          <span style="color:#667085"> · ${esc(labels[order.status] || order.status || "—")}</span>
          <small style="display:block;color:#667085">${esc(order.created_at ? new Date(order.created_at).toLocaleString("sq-AL") : "—")}</small>
          <small style="display:block;color:#667085">${esc(order.address || "")}</small>
        </div>`;
      }).join("");
      return `<article style="padding:12px 0;border-bottom:1px solid #d0d5dd">
        <strong>${esc(customer.customer_name || "Klient pa emër")}</strong>
        <p style="margin:5px 0">${esc(customer.phone || "Pa telefon")}</p>
        <p style="margin:5px 0;color:#667085">${esc(customer.address || "")}</p>
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin:8px 0">
          <strong>Porosi: ${Number(customer.order_count || 0)}</strong>
          <strong>Shpenzuar: ${price(customer.total_spent)}</strong>
          <span style="color:#667085">Porosia e fundit: ${esc(customer.last_order_at ? new Date(customer.last_order_at).toLocaleDateString("sq-AL") : "—")}</span>
        </div>
        ${customer.user_id ? '<small style="color:#667085">Klient me llogari</small>' : '<small style="color:#667085">Porosi si vizitor</small>'}
        <details style="margin-top:8px"><summary style="cursor:pointer;font-weight:600">Shiko porositë (${orders.length})</summary><div style="padding-top:8px">${history || "Nuk ka porosi."}</div></details>
      </article>`;
    }).join("");
  }
  async function loadCustomerHistory() {
    const box = $("customerHistory");
    if (box) box.textContent = "Po ngarkohet historiku i klientëve...";
    const { data, error } = await db.rpc("dss_admin_customer_history");
    if (error) throw error;
    customerHistoryRows = Array.isArray(data) ? data : [];
    renderCustomerHistory();
    const summary = $("customerHistorySummary");
    if (summary) {
      const totalOrders = customerHistoryRows.reduce((sum,c) => sum + Number(c.order_count || 0),0);
      const totalSpent = customerHistoryRows.reduce((sum,c) => sum + Number(c.total_spent || 0),0);
      summary.textContent = customerHistoryRows.length + " klientë · " + totalOrders + " porosi aktive · " + price(totalSpent) + " gjithsej";
    }
  }

  /* MIRATIMI I LLOGARIVE TE KLIENTEVE */

  async function loadCustomerApprovals() {
    const el = $("customerApprovals");
    if (!el) return;

    el.textContent = "Po ngarkohen kërkesat...";
    const { data, error } = await db
      .from("customer_approvals")
      .select("user_id,email,status,discount_percent,created_at")
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
        <label style="display:block;margin:10px 0 4px;font-weight:bold">Ulje personale e klientit</label>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <select data-customer-discount="${esc(item.user_id)}" aria-label="Përqindja e uljes për ${esc(item.email || "klientin")}" style="max-width:180px;margin:0">
            ${[0,5,10,15,20,25,30,35,40,45].map(value => `<option value="${value}" ${Number(item.discount_percent ?? 10) === value ? "selected" : ""}>${value === 0 ? "Pa ulje (0%)" : value + "%"}</option>`).join("")}
          </select>
          <button type="button" data-save-customer-discount="${esc(item.user_id)}">Ruaj uljen</button>
        </div>
        <p style="font-size:13px;color:#667085">Ulja aplikohet vetëm kur llogaria është e aprovuar.</p>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">
          ${item.status === "pending" ? `
            <button type="button" data-approval="${esc(item.user_id)}" data-status="approved">Aprovo llogarinë</button>
            <button type="button" class="danger" data-approval="${esc(item.user_id)}" data-status="rejected">Refuzo</button>
          ` : ""}
          ${item.status === "approved" ? `<button type="button" class="danger" data-approval="${esc(item.user_id)}" data-status="rejected">Hiq aksesin</button>` : ""}
          <button type="button" class="danger" data-delete-customer="${esc(item.user_id)}">Fshi llogarinë</button>
        </div>
      </article>
    `).join("");

    el.querySelectorAll("[data-save-customer-discount]").forEach(button => {
      button.addEventListener("click", async () => {
        const id = button.dataset.saveCustomerDiscount;
        const select = el.querySelector('[data-customer-discount="' + id + '"]');
        const value = Number(select?.value);
        if (![0, 5, 10, 15, 20, 25, 30, 35, 40, 45].includes(value)) {
          alert("Zgjidh 0%, 5%, 10%, 15%, 20%, 25%, 30%, 35% ose 40%.");
          return;
        }
        button.disabled = true;
        const oldText = button.textContent;
        button.textContent = "Po ruhet...";
        try {
          const { data: updated, error } = await db
            .from("customer_approvals")
            .update({ discount_percent: value })
            .eq("user_id", id)
            .select("user_id,discount_percent")
            .maybeSingle();
          if (error) throw error;
          if (!updated) throw new Error("Nuk u ndryshua asnjë rresht. Kontrollo hyrjen si administrator.");
          msg("loginMsg", "Ulja personale u ruajt: " + value + "%.");
          await loadCustomerApprovals();
        } catch (e) {
          alert("Nuk u ruajt ulja: " + (e.message || "Gabim i panjohur"));
          button.disabled = false;
          button.textContent = oldText;
        }
      });
    });

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

    el.querySelectorAll("[data-delete-customer]").forEach(button => {
      button.addEventListener("click", async () => {
        const id = button.dataset.deleteCustomer;
        const article = button.closest("article");
        const email = article?.querySelector("strong")?.textContent || "këtë klient";
        if (!confirm("A je i sigurt që dëshiron të fshish përgjithmonë " + email + "? Ky veprim nuk mund të zhbëhet. Porositë e klientit nuk fshihen nga kjo procedurë.")) return;
        button.disabled = true;
        const previousText = button.textContent;
        button.textContent = "Po fshihet...";
        try {
          const { data: sessionData } = await db.auth.getSession();
          const token = sessionData?.session?.access_token;
          if (!token) throw new Error("Sesioni i administratorit ka skaduar. Hyr përsëri.");
          const { data, error } = await db.functions.invoke("admin-delete-customer", {
            body: { user_id: id },
            headers: { Authorization: "Bearer " + token }
          });
          if (error) throw error;
          if (!data?.success) throw new Error(data?.error || "Fshirja nuk u konfirmua.");
          msg("loginMsg", "Llogaria e klientit u fshi.");
          await loadCustomerApprovals();
        } catch (e) {
          const message = "Fshirja dështoi: " + (e.message || "Gabim i panjohur");
          msg("loginMsg", message, true);
          alert(message);
          button.disabled = false;
          button.textContent = previousText;
        }
      });
    });
  }

  /* KLIENTET ONLINE */
  async function loadOnlineCustomers() {
    const el = $("onlineCustomers");
    if (!el) return;
    el.textContent = "Po kontrollohen klientët online...";
    const cutoff = new Date(Date.now() - 90000).toISOString();
    const { data, error } = await db.from("customer_presence")
      .select("user_id,email,last_seen")
      .gte("last_seen", cutoff)
      .order("last_seen", { ascending: false });
    if (error) {
      el.textContent = "Gabim gjatë ngarkimit: " + error.message;
      return;
    }
    const users = data || [];
    if (!users.length) {
      el.textContent = "Nuk ka klientë të identifikuar online për momentin.";
      return;
    }
    el.innerHTML = users.map(user => {
      const seconds = Math.max(0, Math.floor((Date.now() - new Date(user.last_seen).getTime()) / 1000));
      const ago = seconds < 10 ? "tani" : "para " + seconds + " sekondash";
      return '<article style="padding:12px 0;border-bottom:1px solid #d0d5dd;overflow-wrap:anywhere">' +
        '<strong style="color:#067647">🟢 ' + esc(user.email || "Klient") + '</strong>' +
        '<p style="margin:6px 0 0">Aktiviteti i fundit: ' + ago + '</p></article>';
    }).join("");
  }

  function showAdminLiveToast(title, detail) {
    let host = document.getElementById("dssAdminLiveToasts");
    if (!host) {
      host = document.createElement("div");
      host.id = "dssAdminLiveToasts";
      host.style.cssText = "position:fixed;z-index:99999;top:12px;right:12px;left:12px;max-width:420px;margin-left:auto;display:grid;gap:8px;pointer-events:none";
      document.body.appendChild(host);
    }
    const card = document.createElement("div");
    card.style.cssText = "background:#101828;color:#fff;padding:14px 16px;border-radius:12px;box-shadow:0 8px 28px #0003;font:14px/1.45 Arial,sans-serif";
    const heading = document.createElement("strong");
    heading.textContent = title;
    const body = document.createElement("div");
    body.textContent = detail;
    body.style.cssText = "margin-top:4px;color:#eaecf0";
    card.append(heading, body);
    host.appendChild(card);
    setTimeout(() => card.remove(), 9000);
    if ("Notification" in window && Notification.permission === "granted") {
      try { new Notification(title, { body: detail }); } catch (_) {}
    }
  }

  function startAdminLiveNotifications() {
    if (adminLiveChannel) return;
    adminLiveChannel = db
      .channel("dss-admin-live-notifications")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, payload => {
        const order = payload.new || {};
        showAdminLiveToast(
          "Porosi e re #" + (order.id || ""),
          (order.customer_name || "Klient") + " · " + price(order.total)
        );
        loadOrders().catch(error => console.error("DSS live order refresh:", error));
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "customer_approvals" }, payload => {
        const customer = payload.new || {};
        showAdminLiveToast(
          "Klient i ri — kërkon miratim",
          customer.email || "U regjistrua një klient i ri."
        );
        loadCustomerApprovals().catch(error => console.error("DSS live customer refresh:", error));
      })
      .subscribe((status, error) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.error("DSS Admin live notifications:", status, error || "");
        }
      });
  }

  async function stopAdminLiveNotifications() {
    if (!adminLiveChannel) return;
    const channel = adminLiveChannel;
    adminLiveChannel = null;
    try { await db.removeChannel(channel); } catch (error) {
      console.warn("DSS Admin live channel close:", error);
    }
  }


  /* MODERIMI I KOMENTEVE */
  async function loadProductReviewsAdmin() {
    const box = $("productReviewsAdmin");
    const status = $("productReviewsAdminMsg");
    if (!box) return;
    box.textContent = "Po ngarkohen komentet...";
    if (status) status.textContent = "";

    const { data: reviews, error } = await db
      .from("product_reviews")
      .select("id, product_id, review_text, created_at, is_visible, admin_reply")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;

    if (!reviews || !reviews.length) {
      box.textContent = "Nuk ka ende komente.";
      return;
    }

    const productIds = [...new Set(reviews.map(r => r.product_id))];
    const { data: products, error: productsError } = await db
      .from("products")
      .select("id, name")
      .in("id", productIds);
    if (productsError) throw productsError;
    const names = new Map((products || []).map(p => [String(p.id), p.name]));

    box.innerHTML = reviews.map(review => {
      const visible = review.is_visible !== false;
      const date = review.created_at ? new Date(review.created_at).toLocaleString("sq-AL") : "";
      return `
        <article style="padding:12px 0;border-bottom:1px solid #eaecf0">
          <div style="display:flex;gap:8px;justify-content:space-between;align-items:center;flex-wrap:wrap">
            <strong>${esc(names.get(String(review.product_id)) || ("Produkti #" + review.product_id))}</strong>
            <span style="font-size:12px;color:${visible ? "#067647" : "#b42318"}">${visible ? "Publik" : "I fshehur"}</span>
          </div>
          <small style="display:block;color:#667085;margin:4px 0 8px">${esc(date)} · Koment #${esc(review.id)}</small>
          <p style="white-space:pre-wrap;overflow-wrap:anywhere;margin:0 0 10px">${esc(review.review_text)}</p>
          <label style="display:block;font-weight:600;margin:10px 0 5px">Përgjigjja e administratorit</label>
          <textarea data-review-reply="${esc(review.id)}" maxlength="500" rows="3" style="width:100%;box-sizing:border-box;padding:10px;border:1px solid #d0d5dd;border-radius:8px">${esc(review.admin_reply || "")}</textarea>
          <button type="button" data-save-review-reply="${esc(review.id)}" data-original-reply="${esc(review.admin_reply || "")}" style="margin:6px 8px 6px 0">Ruaj përgjigjen</button>
          <button type="button" data-review-visibility="${esc(review.id)}" data-visible="${visible ? "true" : "false"}">
            ${visible ? "Fsheh komentin" : "Rikthe komentin"}
          </button>
        </article>
      `;
    }).join("");

    box.querySelectorAll("[data-save-review-reply]").forEach(button => {
      button.addEventListener("click", async () => {
        if (busy) return;
        const id = button.dataset.saveReviewReply;
        const field = box.querySelector(`[data-review-reply="${id}"]`);
        const reply = String(field?.value || "").trim();
        const previousReply = String(button.dataset.originalReply || "");
        const shouldNotifyCustomer = Boolean(reply && reply !== previousReply);
        if (reply.length > 500) {
          if (status) status.textContent = "Përgjigjja nuk mund të kalojë 500 karaktere.";
          return;
        }
        busy = true;
        button.disabled = true;
        try {
          const { data: updated, error: updateError } = await db
            .from("product_reviews")
            .update({ admin_reply: reply || null })
            .eq("id", id)
            .select("id, admin_reply")
            .maybeSingle();
          if (updateError) throw updateError;
          if (!updated) throw new Error("Përgjigjja nuk u ruajt. Kontrollo lejet e administratorit.");

          button.dataset.originalReply = reply;
          let notificationSent = false;
          let notificationFailed = false;
          if (shouldNotifyCustomer) {
            const { data: notification, error: notificationError } = await db.functions.invoke(
              "notify-review-reply",
              { body: { review_id: Number(id) } }
            );
            notificationSent = !notificationError && notification?.ok === true;
            notificationFailed = !notificationSent;
            if (notificationError) console.error("DSS review reply email:", notificationError);
            if (notification?.error) console.error("DSS review reply email:", notification.error);
          }

          if (status) {
            status.textContent = !reply
              ? "Përgjigjja u hoq."
              : notificationSent
                ? "Përgjigjja u ruajt dhe klientit iu dërgua email."
                : notificationFailed
                  ? "Përgjigjja u ruajt, por emaili nuk u dërgua."
                  : "Përgjigjja u ruajt.";
            status.style.color = notificationFailed ? "#b54708" : "#067647";
          }
        } catch (error) {
          if (status) {
            status.textContent = "Gabim: " + (error.message || "Përgjigjja nuk u ruajt.");
            status.style.color = "#b42318";
          }
        } finally {
          busy = false;
          button.disabled = false;
        }
      });
    });

    box.querySelectorAll("[data-review-visibility]").forEach(button => {
      button.addEventListener("click", async () => {
        if (busy) return;
        const id = button.dataset.reviewVisibility;
        const nextVisible = button.dataset.visible !== "true";
        if (!confirm(nextVisible ? "Dëshiron ta rikthesh këtë koment në dyqan?" : "Dëshiron ta fshehësh këtë koment nga klientët?")) return;
        busy = true;
        button.disabled = true;
        try {
          const { data: updated, error: updateError } = await db
            .from("product_reviews")
            .update({ is_visible: nextVisible })
            .eq("id", id)
            .select("id, is_visible")
            .maybeSingle();
          if (updateError) throw updateError;
          if (!updated) throw new Error("Ndryshimi nuk u ruajt. Kontrollo lejet e administratorit.");
          if (status) {
            status.textContent = nextVisible ? "Komenti u rikthye në dyqan." : "Komenti u fsheh nga klientët.";
            status.style.color = "#067647";
          }
          await loadProductReviewsAdmin();
        } catch (error) {
          if (status) {
            status.textContent = "Gabim: " + (error.message || "Nuk u ruajt ndryshimi.");
            status.style.color = "#b42318";
          }
          button.disabled = false;
        } finally {
          busy = false;
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
    startAdminLiveNotifications();

    const tasks = [
      ["productsAdmin", loadProducts],
      ["orders", loadOrders],
      ["bannersAdmin", loadBanners],
      ["categoriesAdmin", loadCategories],
      ["trafficStats", loadTraffic],
      ["customerApprovals", loadCustomerApprovals],
      ["customerHistory", loadCustomerHistory],
      ["onlineCustomers", loadOnlineCustomers],
      ["profitSummary", loadProfitReport],
      ["productReviewsAdmin", loadProductReviewsAdmin]
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
    listen("refreshProductReviews", "click", async function () {
      try { await loadProductReviewsAdmin(); } catch (e) { msg("productReviewsAdminMsg", "Gabim gjatë ngarkimit: " + e.message, true); }
    });

    listen("refreshTraffic", "click", async function () {
      try { await loadTraffic(); } catch (e) { console.error(e); }
    });
    listen("refreshApprovals", "click", async function () {
      try { await loadCustomerApprovals(); } catch (e) { msg("loginMsg", "Gabim gjatë ngarkimit të kërkesave: " + e.message, true); }
    });
    listen("orderSearch", "input", renderOrders);
    listen("orderStatusFilter", "change", renderOrders);
    listen("refreshOrders", "click", async function () {
      try { await loadOrders(); } catch (e) {
        const box = $("orders");
        if (box) box.textContent = "Gabim gjatë ngarkimit: " + (e.message || "Gabim");
      }
    });
    listen("refreshCustomerHistory", "click", async function () {
      try { await loadCustomerHistory(); } catch (e) {
        const box = $("customerHistory");
        if (box) box.textContent = "Gabim gjatë ngarkimit: " + (e.message || "Gabim");
      }
    });
    listen("customerHistorySearch", "input", renderCustomerHistory);
    listen("refreshOnlineCustomers", "click", loadOnlineCustomers);
    setInterval(() => {
      if ($("panel") && !$("panel").hidden) loadOnlineCustomers();
    }, 30000);

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
      await stopAdminLiveNotifications();

      $("loginForm").reset();
      msg("loginMsg", "Ke dalë nga llogaria.");
    });

    listen("newBtn", "click", function () {
      editingProduct = null;
      productPhoto = "";

      $("productForm").reset();
      $("productId").value = "";
      $("productStock").value = "0";
      selectedProductMarkup = null;
      updateProductMarkupUI();
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

    function updateProductMarkupUI() {
      const cost = Number($("productCostPrice")?.value);
      const validCost = $("productCostPrice")?.value.trim() !== "" && Number.isFinite(cost) && cost >= 0;
      document.querySelectorAll("[data-product-markup]").forEach(button => {
        const active = Number(button.dataset.productMarkup) === selectedProductMarkup;
        button.style.background = active ? "#155eef" : "";
        button.style.color = active ? "#fff" : "";
        button.setAttribute("aria-pressed", active ? "true" : "false");
      });
      const result = $("productMarkupResult");
      if (!result) return;
      if (selectedProductMarkup === null) {
        result.textContent = "Shkruaj koston dhe zgjidh përqindjen. Çmimi i shitjes llogaritet automatikisht.";
        return;
      }
      if (!validCost) {
        result.textContent = "Shkruaj fillimisht çmimin e blerjes.";
        return;
      }
      const salePrice = Math.round((cost * (1 + selectedProductMarkup / 100) + Number.EPSILON) * 100) / 100;
      $("productPrice").value = salePrice.toFixed(2);
      result.textContent = "Çmimi i shitjes: €" + salePrice.toFixed(2) + " (kosto €" + cost.toFixed(2) + " + " + selectedProductMarkup + "%).";
    }

    document.querySelectorAll("[data-product-markup]").forEach(button => {
      button.addEventListener("click", function () {
        selectedProductMarkup = Number(button.dataset.productMarkup);
        updateProductMarkupUI();
        if ($("productCostPrice").value.trim() === "") $("productCostPrice").focus();
      });
    });
    listen("productCostPrice", "input", updateProductMarkupUI);

    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    if ($("profitFrom")) $("profitFrom").value = localDateInput(firstDay);
    if ($("profitTo")) $("profitTo").value = localDateInput(today);
    listen("refreshProfit", "click", async function () {
      try { await loadProfitReport(); } catch (e) { msg("profitSummary", "Gabim gjatë llogaritjes: " + e.message, true); }
    });

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
