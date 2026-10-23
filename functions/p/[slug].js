export async function onRequest(context) {
  const { request, env, params } = context;
  const url = new URL(request.url);
  const slug = String(params.slug || "");
  const match = slug.match(/-([0-9]+)$/);
  if (!match) return env.ASSETS.fetch(new Request(new URL("/", url.origin), request));
  const productId = match[1];
  const pageUrl = new URL("/", url.origin);
  const page = await env.ASSETS.fetch(new Request(pageUrl, request));
  if (!page.ok) return page;
  let html = await page.text();
  let title = "DSS Shop | Security & Technology";
  let description = "Dyqan online për kamera sigurie dhe teknologji.";
  let image = new URL("/logo-dss-shop.svg", url.origin).href;
  try {
    const apiUrl = "https://mwimgsccsccltzrtedcq.supabase.co/rest/v1/products?select=id,name,image_url,price,sale_price,description,active&id=eq." + encodeURIComponent(productId) + "&active=eq.true&limit=1";
    const response = await fetch(apiUrl, { headers: {
      apikey: "sb_publishable_LhAwFjGp3anpAT0_w83gjQ_X8At3-YX",
      Authorization: "Bearer sb_publishable_LhAwFjGp3anpAT0_w83gjQ_X8At3-YX"
    }});
    const rows = response.ok ? await response.json() : [];
    const product = rows[0];
    if (product) {
      title = String(product.name || title) + " | DSS Shop";
      description = ("Çmimi: " + (product.sale_price || product.price || "") + " €. " + String(product.description || "Porosit online në DSS Shop.")).replace(/\\s+/g, " ").slice(0, 200);
      if (product.image_url && /^https:\/\//i.test(product.image_url)) image = product.image_url;
    }
  } catch (_) {}
  const esc = value => String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  const metadata = [
    ['property="og:title"', title],
    ['name="twitter:title"', title],
    ['property="og:description"', description],
    ['name="description"', description],
    ['property="og:image"', image],
    ['name="twitter:image"', image],
    ['property="og:url"', url.href],
    ['property="og:type"', "product"]
  ];
  for (const [selector, value] of metadata) {
    const tag = '<meta ' + selector + ' content="' + esc(value) + '">';
    const a = selector.match(/^(property|name)="([^"]+)"/);
    const re = new RegExp('<meta\\s+[^>]*' + a[1] + '="' + a[2] + '"[^>]*>', "i");
    if (re.test(html)) html = html.replace(re, tag);
    else html = html.replace(/<head[^>]*>/i, head => head + "\\n" + tag);
  }
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=0, s-maxage=300" }});
}
