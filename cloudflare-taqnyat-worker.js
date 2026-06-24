const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'access-control-allow-origin': 'https://ramz-property-system.pages.dev',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'content-type'
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return json({ ok: true });

    if (url.pathname === '/health') {
      return json({ ok: true, service: 'ramz-taqnyat-api', sendingLocked: env.TAQNYAT_SEND_ENABLED !== 'true' });
    }

    if (url.pathname === '/account/balance' && request.method === 'GET') {
      return getBalance(env);
    }

    if (url.pathname === '/sms/send' && request.method === 'POST') {
      return sendSms(request, env);
    }

    return json({ ok: false, code: 'not_found' }, 404);
  }
};

async function getBalance(env) {
  if (!env.TAQNYAT_API_KEY) {
    return json({ ok: false, code: 'missing_secret' }, 503);
  }
  const upstream = await fetch('https://api.taqnyat.sa/account/balance', {
    headers: {
      Authorization: `Bearer ${env.TAQNYAT_API_KEY}`,
      Accept: 'application/json'
    }
  });
  const data = await safeJson(upstream);
  return json({ ok: upstream.ok, status: upstream.status, data }, upstream.ok ? 200 : upstream.status);
}

async function sendSms(request, env) {
  if (!env.TAQNYAT_API_KEY) {
    return json({ ok: false, code: 'missing_secret' }, 503);
  }
  if (env.TAQNYAT_SEND_ENABLED !== 'true') {
    return json({ ok: false, code: 'customer_notifications_locked' }, 423);
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, code: 'invalid_json' }, 400);
  }

  const recipients = Array.isArray(payload.recipients) ? payload.recipients.map(String) : [];
  const body = String(payload.body || '').trim();
  const sender = String(payload.sender || '').trim();
  if (!recipients.length || !body || !sender) {
    return json({ ok: false, code: 'missing_fields' }, 400);
  }
  const invalid = recipients.filter((phone) => !/^966[0-9]{8,12}$/.test(phone));
  if (invalid.length) {
    return json({ ok: false, code: 'invalid_recipient_format', invalidCount: invalid.length }, 400);
  }

  const upstream = await fetch('https://api.taqnyat.sa/v1/messages', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.TAQNYAT_API_KEY}`,
      'content-type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({ recipients, body, sender })
  });
  const data = await safeJson(upstream);
  return json({ ok: upstream.ok, status: upstream.status, data }, upstream.ok ? 200 : upstream.status);
}

async function safeJson(response) {
  const text = await response.text();
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: JSON_HEADERS });
}
