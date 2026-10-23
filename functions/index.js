export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const productId = url.searchParams.get("product");

  // Leave ordinary visits unchanged; only generate product-specific previews.
  if (!productId || !/^\d+$/.test(productId)) {
    return env.ASSETS.fetch(request);
  }

  const page = await env.ASSETS.fetch(new Request(new URL("/", url.origin), request));
  if (!page.ok) return page;

  let html = await page.text();
  let title = "DSS Shop | Security & Technology";
  let description = "Dyqan online për kamera sigurie, DVR/NVR, alarme, rrjetëzim dhe kontroll aksesi.";
  let image = new URL("/logo-dss-shop.svg", url.origin).href;
  const canonical = url.origin + "/?product=" + encodeURIComponent(productId);

  try {
    const apiUrl = "https://mwimgsccsccltzrtedcq.supabase.co/rest/v1/products"
      + "?select=id,name,image_url,price,sale_price,description,active"
      + "&id=eq." + encodeURIComponent(productId)
      + "&active=eq.true&limit=1";
    const response = await fetch(apiUrl, {
      headers: {
        apikey: "sb_publishable_LhAwFjGp3anpAT0_w83gjQ_X8At3-YX",
        Authorization: "Bearer sb_publishable_LhAwFjGp3anpAT0_w83gjQ_X8At3-YX"
      }
    });
    if (response.ok) {
      const rows = await response.json();
      const product = rows && rows[0];
      if (product) {
        title = String(product.name || title) + " | DSS Shop";
        const price = product.sale_price || product.price;
        description = String(product.description || "Porosit online në DSS Shop.")
          .replace(/\s+/g, " ").slice(0, 180);
        if (price !== null && price !== undefined && price !== "") {
          description = "Çmimi: " + price + " €. " + description;
        }
        if (product.image_url && /^https:\/\//i.test(product.image_url)) image = product.image_url;
      }
    }
  } catch (_) {
    // Fall back to the shop-wide metadata if product lookup fails.
  }

  const esc = (value) => String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  const meta = [
    ['property="og:title"', title],
    ['name="twitter:title"', title],
    ['property="og:description"', description],
    ['name="description"', description],
    ['property="og:image"', image],
    ['name="twitter:image"', image],
    ['property="og:url"', canonical],
    ['property="og:type"', "product"]
  ];
  for (const [selector, value] of meta) {
    const tag = '<meta ' + selector + ' content="' + esc(value) + '">';
    const attr = selector.match(/^(property|name)="([^"]+)"/);
    const re = new RegExp('<meta\\s+[^>]*' + attr[1] + '="' + attr[2] + '"[^>]*>', "i");
    if (re.test(html)) html = html.replace(re, tag);
    else html = html.replace(/<head[^>]*>/i, (head) => head + "\n" + tag);
  }
  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=0, s-maxage=300"
    }
  });
}
