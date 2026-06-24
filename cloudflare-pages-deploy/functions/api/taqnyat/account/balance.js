export async function onRequestGet({ env }) {
  const token = env.TAQNYAT_API_KEY;
  if (!token) {
    return json({ ok: false, code: 'missing_secret', message: 'TAQNYAT_API_KEY is not configured in Cloudflare Secrets.' }, 503);
  }

  try {
    const upstream = await fetch('https://api.taqnyat.sa/account/balance', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json'
      }
    });
    const text = await upstream.text();
    let body;
    try { body = JSON.parse(text); } catch { body = { raw: text }; }
    return json({ ok: upstream.ok, status: upstream.status, data: body }, upstream.ok ? 200 : upstream.status);
  } catch (error) {
    return json({ ok: false, code: 'taqnyat_unreachable', message: error.message }, 502);
  }
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}
