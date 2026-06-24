function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { 'content-type':'application/json; charset=utf-8', 'cache-control':'no-store' }
  });
}

export async function onRequestPost(context) {
  const env = context.env || {};
  const configured = Boolean(env.ZATCA_API_URL && env.ZATCA_CSID && env.ZATCA_SECRET);
  let body = {};
  try { body = await context.request.json(); } catch (_) {}

  if (body.action === 'status') {
    return json({ configured, environment:env.ZATCA_ENV || 'sandbox' });
  }
  if (!configured) {
    return json({ error:'ZATCA secrets are not configured in Cloudflare.' }, 503);
  }
  if (!body.invoice || !body.invoiceHash || !body.uuid) {
    return json({ error:'invoice, invoiceHash and uuid are required.' }, 400);
  }

  const target = String(env.ZATCA_API_URL).replace(/\/$/, '') + (body.mode === 'clearance' ? '/invoices/clearance/single' : '/invoices/reporting/single');
  const auth = btoa(env.ZATCA_CSID + ':' + env.ZATCA_SECRET);
  const upstream = await fetch(target, {
    method:'POST',
    headers:{
      'content-type':'application/json',
      'accept':'application/json',
      'accept-version':'V2',
      'authorization':'Basic ' + auth
    },
    body:JSON.stringify({ invoiceHash:body.invoiceHash, uuid:body.uuid, invoice:body.invoice })
  });
  const text = await upstream.text();
  let response;
  try { response = JSON.parse(text); } catch (_) { response = { message:text }; }
  return json({ ok:upstream.ok, status:upstream.status, response }, upstream.ok ? 200 : upstream.status);
}
