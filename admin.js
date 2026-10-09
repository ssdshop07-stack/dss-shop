<!doctype html>
<html lang="sq">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>DSS Shop - Admin</title>

  <link rel="stylesheet" href="style.css">

  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
  <script src="config.js"></script>
</head>

<body>

<header>
  <div class="wrap nav">
    <a class="brand" href="index.html">
      <b>DSS</b>
      <span>ADMIN</span>
    </a>
    <button id="logout" type="button" hidden>Dalje</button>
  </div>
</header>

<main class="wrap admin">

  <section id="login">
    <h1>Hyrje Admin</h1>
    <p>Vetëm administratori i DSS mund të hyjë.</p>

    <form id="loginForm">
      <input
        id="email"
        type="email"
        placeholder="Email"
        autocomplete="username"
        required
      >

      <input
        id="password"
        type="password"
        placeholder="Fjalëkalimi"
        autocomplete="current-password"
        required
      >

      <button id="loginButton" type="submit">Hyr</button>
    </form>

    <button id="forgotBtn" type="button">Harrova fjalëkalimin</button>
    <p id="loginMsg" role="status" aria-live="polite"></p>
  </section>

  <section id="reset" hidden>
    <h1>Vendos fjalëkalim të ri</h1>

    <form id="resetForm">
      <input
        id="newPassword"
        type="password"
        placeholder="Fjalëkalimi i ri"
        minlength="6"
        required
      >

      <input
        id="newPassword2"
        type="password"
        placeholder="Përsërite fjalëkalimin"
        minlength="6"
        required
      >

      <button type="submit">Ruaj fjalëkalimin</button>
    </form>

    <p id="resetMsg" role="status"></p>
  </section>

  <section id="panel" hidden>
    <div class="toolbar">
      <h1>Paneli DSS</h1>
      <button id="newBtn" type="button">+ Produkt</button>
    </div>

    <section id="productFormBox" hidden>
      <h2 id="formTitle">Shto produkt</h2>

      <form id="productForm">
        <input type="hidden" id="productId">

        <label>
          Emri i produktit
          <input id="productName" type="text" required>
        </label>

        <label>
          SKU
          <input id="productSku" type="text">
        </label>

        <label>
          Kategoria
          <input id="productCategory" type="text" required>
        </label>

        <label>
          Çmimi (€)
          <input id="productPrice" type="number" min="0" step="0.01" required>
        </label>

        <label>
          Çmimi promocional (€)
          <input id="productSalePrice" type="number" min="0" step="0.01">
        </label>

        <label>
          Stoku
          <input id="productStock" type="number" min="0" step="1" value="0" required>
        </label>

        <label>
          Përshkrimi
          <textarea id="productDescription" rows="5"></textarea>
        </label>

        <label>
          Foto e produktit
          <input id="productImage" type="file" accept="image/*">
        </label>

        <div id="imagePreview"></div>

        <label>
          <input id="productFeatured" type="checkbox">
          Produkt i veçuar
        </label>

        <label>
          <input id="productActive" type="checkbox" checked>
          Produkt aktiv
        </label>

        <div class="form-actions">
          <button type="submit">Ruaj produktin</button>
          <button id="cancelProduct" type="button">Anulo</button>
        </div>

        <p id="productMsg" role="status"></p>
      </form>
    </section>

    <h2>Produktet</h2>
    <div id="productsAdmin"></div>

    <h2>Porositë</h2>
    <div id="orders"></div>
  </section>

</main>

<script src="admin.js?v=8"></script>

</body>
</html>
