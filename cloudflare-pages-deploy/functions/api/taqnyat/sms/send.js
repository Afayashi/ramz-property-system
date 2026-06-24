export async function onRequestOptions() {
  return json({ ok: true });
}

export async function onRequestPost({ request, env }) {
  const token = env.TAQNYAT_API_KEY;
  if (!token) {
    return json({ ok: false, code: 'missing_secret', message: 'TAQNYAT_API_KEY is not configured in Cloudflare Secrets.' }, 503);
  }

  if (env.TAQNYAT_SEND_ENABLED !== 'true') {
    return json({ ok: false, code: 'customer_notifications_locked', message: 'Customer SMS sending is locked on the server.' }, 423);
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, code: 'invalid_json', message: 'Request body must be JSON.' }, 400);
  }

  const recipients = Array.isArray(payload.recipients) ? payload.recipients.map(String) : [];
  const body = String(payload.body || '').trim();
  const sender = String(payload.sender || '').trim();

  if (!recipients.length || !body || !sender) {
    return json({ ok: false, code: 'missing_fields', message: 'recipients, body, and sender are required.' }, 400);
  }
  if (recipients.length > 50) {
    return json({ ok: false, code: 'too_many_recipients', message: 'Batch is limited to 50 recipients per request.' }, 400);
  }
  const invalid = recipients.filter((phone) => !/^966[0-9]{8,12}$/.test(phone));
  if (invalid.length) {
    return json({ ok: false, code: 'invalid_recipient_format', message: 'Recipients must use international format without + or 00.', invalidCount: invalid.length }, 400);
  }

  try {
    const upstream = await fetch('https://api.taqnyat.sa/v1/messages', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({ recipients, body, sender })
    });
    const text = await upstream.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    return json({ ok: upstream.ok, status: upstream.status, data }, upstream.ok ? 200 : upstream.status);
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
