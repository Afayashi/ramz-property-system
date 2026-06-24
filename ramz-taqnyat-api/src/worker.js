const API_PREFIX = '/api/v1';
const JSON_TYPE = 'application/json; charset=utf-8';
const MAX_JSON_BYTES = 1024 * 1024;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ROLES = new Set(['admin', 'manager', 'accountant', 'maintenance', 'employee', 'viewer']);

const RESOURCES = {
  properties: {
    table: 'properties',
    fields: ['source_id','name','type','usage','city','district','address','deed_number','owner_name','owner_id','owner_phone','total_units','area_sqm','status','fingerprint'],
    required: ['name'],
    search: ['name','deed_number','owner_name','owner_id','city','district','address'],
    filters: ['city','district','type','status','owner_id'],
    sort: ['created_at','updated_at','name','city','district','total_units','area_sqm'],
    writeRoles: ['admin','manager','employee']
  },
  units: {
    table: 'units',
    fields: ['source_id','property_id','unit_number','type','floor','area_sqm','monthly_rent','annual_rent','electricity_meter','water_meter','status','fingerprint'],
    required: ['property_id','unit_number'],
    search: ['unit_number','type','electricity_meter','water_meter'],
    filters: ['property_id','status','type'],
    sort: ['created_at','updated_at','unit_number','monthly_rent','annual_rent','area_sqm'],
    writeRoles: ['admin','manager','employee']
  },
  contracts: {
    table: 'contracts',
    fields: ['source_id','contract_number','ejar_number','property_id','unit_id','owner_name','owner_id','tenant_name','tenant_id_number','tenant_phone','start_date','end_date','monthly_rent','annual_rent','security_deposit','status','fingerprint'],
    required: ['contract_number','property_id','unit_id','tenant_name','start_date','end_date'],
    search: ['contract_number','ejar_number','owner_name','owner_id','tenant_name','tenant_id_number','tenant_phone'],
    filters: ['property_id','unit_id','status','tenant_id_number'],
    sort: ['created_at','updated_at','contract_number','start_date','end_date','annual_rent'],
    writeRoles: ['admin','manager','employee']
  },
  invoices: {
    table: 'invoices',
    fields: ['source_id','invoice_number','contract_id','installment_number','due_date','amount','tax_amount','total_amount','paid_amount','remaining_amount','paid_date','status','fingerprint'],
    required: ['invoice_number','contract_id','due_date','amount'],
    search: ['invoice_number','installment_number'],
    filters: ['contract_id','status'],
    sort: ['created_at','updated_at','invoice_number','due_date','amount','total_amount','remaining_amount'],
    writeRoles: ['admin','manager','accountant']
  }
};

class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export default {
  async fetch(request, env, executionCtx) {
    const startedAt = Date.now();
    const url = new URL(request.url);
    const ctx = {
      request,
      env,
      executionCtx,
      url,
      requestId: request.headers.get('cf-ray') || crypto.randomUUID(),
      origin: request.headers.get('origin') || '',
      user: null,
      token: null,
      rate: null
    };

    let response;
    try {
      assertOrigin(ctx);
      if (request.method === 'OPTIONS') response = new Response(null, { status: 204 });
      else {
        const scope = url.pathname.includes('/auth/login') ? 'login' : (url.pathname.includes('/sms/send') ? 'sms' : 'api');
        const limit = scope === 'login' ? 10 : (scope === 'sms' ? 20 : 180);
        const windowSeconds = scope === 'login' ? 900 : 60;
        ctx.rate = await consumeRateLimit(ctx, scope, limit, windowSeconds);
        response = await route(ctx);
      }
    } catch (error) {
      response = errorResponse(error, ctx);
    }

    response = withCommonHeaders(response, ctx);
    console.log(JSON.stringify({
      type: 'request', requestId: ctx.requestId, method: request.method,
      path: url.pathname, status: response.status, userId: ctx.user?.sub || null,
      durationMs: Date.now() - startedAt
    }));
    return response;
  }
};

async function route(ctx) {
  const { request, url, env } = ctx;
  const path = url.pathname.replace(/\/+$/, '') || '/';

  if ((path === '/health' || path === `${API_PREFIX}/health`) && request.method === 'GET') return health(ctx);
  if (path === '/account/balance' && request.method === 'GET') return getBalance(ctx);
  if (path === '/sms/send' && request.method === 'POST') return sendSms(ctx);
  if (path === `${API_PREFIX}/auth/login` && request.method === 'POST') return login(ctx);

  if (path.startsWith(`${API_PREFIX}/images/`) && request.method === 'GET') return getImage(ctx, path.split('/').pop());

  await requireAuth(ctx);
  if (path === `${API_PREFIX}/auth/me` && request.method === 'GET') return json({ ok: true, user: publicUser(ctx.user) });
  if (path === `${API_PREFIX}/auth/logout` && request.method === 'POST') return logout(ctx);

  if (path === `${API_PREFIX}/users`) {
    requireRoles(ctx, ['admin']);
    if (request.method === 'GET') return listUsers(ctx);
    if (request.method === 'POST') return createUser(ctx);
  }
  const userMatch = path.match(/^\/api\/v1\/users\/([^/]+)$/);
  if (userMatch) {
    requireRoles(ctx, ['admin']);
    if (request.method === 'PATCH') return updateUser(ctx, decodeURIComponent(userMatch[1]));
  }

  if (path === `${API_PREFIX}/admin/data-integrity` && request.method === 'GET') {
    requireRoles(ctx, ['admin','manager']);
    return dataIntegrity(ctx);
  }
  if (path === `${API_PREFIX}/admin/logs` && request.method === 'GET') {
    requireRoles(ctx, ['admin']);
    return listAuditLogs(ctx);
  }

  const imageUpload = path.match(/^\/api\/v1\/properties\/([^/]+)\/images$/);
  if (imageUpload && request.method === 'POST') return uploadImage(ctx, decodeURIComponent(imageUpload[1]));
  const imageDelete = path.match(/^\/api\/v1\/properties\/([^/]+)\/images\/([^/]+)$/);
  if (imageDelete && request.method === 'DELETE') return deleteImage(ctx, decodeURIComponent(imageDelete[1]), decodeURIComponent(imageDelete[2]));

  const resourceMatch = path.match(/^\/api\/v1\/(properties|units|contracts|invoices)(?:\/([^/]+))?$/);
  if (resourceMatch) {
    const type = resourceMatch[1];
    const id = resourceMatch[2] ? decodeURIComponent(resourceMatch[2]) : null;
    if (request.method === 'GET') return id ? getResource(ctx, type, id) : listResource(ctx, type);
    requireRoles(ctx, RESOURCES[type].writeRoles);
    if (request.method === 'POST' && !id) return createResource(ctx, type);
    if ((request.method === 'PUT' || request.method === 'PATCH') && id) return updateResource(ctx, type, id);
    if (request.method === 'DELETE' && id) return deleteResource(ctx, type, id);
  }

  if (path === API_PREFIX && request.method === 'GET') {
    return json({
      ok: true,
      service: 'ramz-taqnyat-api',
      version: 2,
      resources: ['properties','units','contracts','invoices','users','images','audit'],
      health: `${API_PREFIX}/health`
    });
  }
  throw new ApiError(404, 'not_found', 'المسار المطلوب غير موجود.');
}

function assertOrigin(ctx) {
  if (!ctx.origin) return;
  const configured = String(ctx.env.ALLOWED_ORIGINS || '').split(',').map(v => v.trim()).filter(Boolean);
  const allowed = configured.includes(ctx.origin) || /^https:\/\/[a-z0-9-]+\.ramz-property-system\.pages\.dev$/i.test(ctx.origin);
  if (!allowed) throw new ApiError(403, 'origin_not_allowed', 'هذا المصدر غير مسموح له بالاتصال بالخادم.');
}

function withCommonHeaders(response, ctx) {
  const headers = new Headers(response.headers);
  headers.set('x-request-id', ctx.requestId);
  headers.set('x-content-type-options', 'nosniff');
  headers.set('referrer-policy', 'no-referrer');
  headers.set('cache-control', headers.get('cache-control') || 'no-store');
  headers.set('vary', 'Origin');
  if (ctx.origin) {
    headers.set('access-control-allow-origin', ctx.origin);
    headers.set('access-control-allow-credentials', 'true');
  }
  headers.set('access-control-allow-methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  headers.set('access-control-allow-headers', 'authorization,content-type,x-bootstrap-token');
  headers.set('access-control-expose-headers', 'x-request-id,x-ratelimit-limit,x-ratelimit-remaining');
  if (ctx.rate) {
    headers.set('x-ratelimit-limit', String(ctx.rate.limit));
    headers.set('x-ratelimit-remaining', String(ctx.rate.remaining));
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function json(payload, status = 200, headers = {}) {
  return new Response(JSON.stringify(payload), { status, headers: { 'content-type': JSON_TYPE, 'cache-control': 'no-store', ...headers } });
}

function errorResponse(error, ctx) {
  const known = error instanceof ApiError;
  const status = known ? error.status : 500;
  if (!known) console.error(JSON.stringify({ type: 'error', requestId: ctx.requestId, message: String(error?.message || error), stack: String(error?.stack || '').slice(0, 1200) }));
  return json({
    ok: false,
    code: known ? error.code : 'internal_error',
    message: known ? error.message : 'حدث خطأ غير متوقع في الخادم.',
    details: known ? error.details : undefined,
    requestId: ctx.requestId
  }, status);
}

async function consumeRateLimit(ctx, scope, limit, windowSeconds) {
  const now = Math.floor(Date.now() / 1000);
  const bucket = Math.floor(now / windowSeconds);
  const ip = ctx.request.headers.get('cf-connecting-ip') || 'unknown';
  const key = await sha256(`${scope}:${ip}:${bucket}`);
  await ctx.env.DB.prepare(`INSERT INTO rate_limits(bucket_key,request_count,expires_at) VALUES(?,1,?) ON CONFLICT(bucket_key) DO UPDATE SET request_count=request_count+1`).bind(key, now + windowSeconds * 2).run();
  const row = await ctx.env.DB.prepare('SELECT request_count FROM rate_limits WHERE bucket_key=?').bind(key).first();
  const count = Number(row?.request_count || 1);
  if (Math.random() < 0.02) ctx.executionCtx.waitUntil(ctx.env.DB.prepare('DELETE FROM rate_limits WHERE expires_at < ?').bind(now).run());
  if (count > limit) throw new ApiError(429, 'rate_limit_exceeded', 'تم تجاوز عدد الطلبات المسموح. حاول لاحقاً.');
  return { limit, remaining: Math.max(0, limit - count) };
}

async function health(ctx) {
  let database = 'unavailable';
  try {
    const row = await ctx.env.DB.prepare('SELECT 1 AS ok').first();
    database = row?.ok === 1 ? 'healthy' : 'degraded';
  } catch { database = 'unavailable'; }
  const healthy = database === 'healthy';
  return json({
    ok: healthy,
    service: 'ramz-taqnyat-api',
    version: 2,
    database,
    images: ctx.env.PROPERTY_IMAGES ? 'enabled' : 'awaiting_r2_activation',
    smsSendingLocked: ctx.env.TAQNYAT_SEND_ENABLED !== 'true',
    timestamp: new Date().toISOString(),
    requestId: ctx.requestId
  }, healthy ? 200 : 503);
}

async function readJson(request) {
  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > MAX_JSON_BYTES) throw new ApiError(413, 'payload_too_large', 'حجم الطلب أكبر من الحد المسموح.');
  let body;
  try { body = await request.json(); }
  catch { throw new ApiError(400, 'invalid_json', 'صيغة JSON غير صحيحة.'); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ApiError(400, 'invalid_body', 'يجب أن يكون محتوى الطلب كائناً.');
  return body;
}

async function login(ctx) {
  const body = await readJson(ctx.request);
  const username = cleanString(body.username, 120);
  const password = String(body.password || '');
  if (!username || !password) throw new ApiError(400, 'missing_credentials', 'اسم المستخدم وكلمة المرور مطلوبان.');
  const user = await ctx.env.DB.prepare('SELECT * FROM users WHERE username=? COLLATE NOCASE OR email=? COLLATE NOCASE LIMIT 1').bind(username, username).first();
  if (!user || user.status !== 'active' || !(await verifyPassword(password, user))) throw new ApiError(401, 'invalid_credentials', 'بيانات الدخول غير صحيحة أو الحساب موقوف.');
  if (!ctx.env.JWT_SECRET) throw new ApiError(503, 'missing_jwt_secret', 'سر المصادقة غير مضبوط على الخادم.');
  const ttl = clampInt(ctx.env.JWT_TTL_SECONDS, 900, 86400, 43200);
  const now = Math.floor(Date.now() / 1000);
  const token = await createJwt({ sub: user.id, username: user.username, name: user.name, role: user.role, jti: crypto.randomUUID(), iat: now, exp: now + ttl, iss: 'ramz-taqnyat-api' }, ctx.env.JWT_SECRET);
  await ctx.env.DB.prepare('UPDATE users SET last_login_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(user.id).run();
  await audit(ctx, 'auth.login', 'user', user.id, {});
  return json({ ok: true, token, expiresIn: ttl, user: publicUser(user) });
}

async function requireAuth(ctx) {
  const header = ctx.request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token || !ctx.env.JWT_SECRET) throw new ApiError(401, 'unauthorized', 'تسجيل الدخول مطلوب.');
  const payload = await verifyJwt(token, ctx.env.JWT_SECRET);
  if (!payload) throw new ApiError(401, 'invalid_token', 'جلسة الدخول غير صالحة أو منتهية.');
  const revoked = await ctx.env.DB.prepare('SELECT 1 FROM revoked_tokens WHERE jti=? AND expires_at>?').bind(payload.jti, Math.floor(Date.now()/1000)).first();
  if (revoked) throw new ApiError(401, 'revoked_token', 'تم إنهاء جلسة الدخول.');
  const user = await ctx.env.DB.prepare('SELECT id,username,email,name,role,status,created_at,last_login_at FROM users WHERE id=?').bind(payload.sub).first();
  if (!user || user.status !== 'active') throw new ApiError(401, 'inactive_user', 'الحساب غير نشط.');
  ctx.user = { ...payload, ...user, sub: user.id };
  ctx.token = token;
}

function requireRoles(ctx, roles) {
  if (!ctx.user || !roles.includes(ctx.user.role)) throw new ApiError(403, 'forbidden', 'لا تملك الصلاحية لتنفيذ هذا الإجراء.');
}

async function logout(ctx) {
  await ctx.env.DB.prepare('INSERT OR REPLACE INTO revoked_tokens(jti,user_id,expires_at) VALUES(?,?,?)').bind(ctx.user.jti, ctx.user.sub, Number(ctx.user.exp || 0)).run();
  await audit(ctx, 'auth.logout', 'user', ctx.user.sub, {});
  return json({ ok: true });
}

async function listUsers(ctx) {
  const rows = await ctx.env.DB.prepare('SELECT id,username,email,name,role,status,created_at,updated_at,last_login_at FROM users ORDER BY created_at DESC').all();
  return json({ ok: true, data: rows.results || [] });
}

async function createUser(ctx) {
  const body = await readJson(ctx.request);
  const username = cleanString(body.username, 80);
  const email = cleanOptional(body.email, 160);
  const name = cleanString(body.name, 160);
  const password = String(body.password || '');
  const role = cleanString(body.role || 'employee', 30);
  if (!username || !name || password.length < 10 || !ROLES.has(role)) throw new ApiError(400, 'validation_error', 'تحقق من الاسم واسم المستخدم والدور، ويجب ألا تقل كلمة المرور عن 10 أحرف.');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ApiError(400, 'invalid_email', 'البريد الإلكتروني غير صحيح.');
  const id = crypto.randomUUID();
  const hashed = await hashPassword(password);
  try {
    await ctx.env.DB.prepare(`INSERT INTO users(id,username,email,name,password_salt,password_hash,password_iterations,role,status) VALUES(?,?,?,?,?,?,?,?,?)`).bind(id, username, email, name, hashed.salt, hashed.hash, hashed.iterations, role, 'active').run();
  } catch (error) { throw mapDbError(error, 'user'); }
  await audit(ctx, 'user.create', 'user', id, { username, role });
  return json({ ok: true, data: { id, username, email, name, role, status: 'active' } }, 201);
}

async function updateUser(ctx, id) {
  const body = await readJson(ctx.request);
  const current = await ctx.env.DB.prepare('SELECT * FROM users WHERE id=?').bind(id).first();
  if (!current) throw new ApiError(404, 'user_not_found', 'المستخدم غير موجود.');
  const role = body.role == null ? current.role : cleanString(body.role, 30);
  const status = body.status == null ? current.status : cleanString(body.status, 20);
  if (!ROLES.has(role) || !['active','inactive'].includes(status)) throw new ApiError(400, 'validation_error', 'الدور أو الحالة غير صحيح.');
  if (id === ctx.user.sub && status === 'inactive') throw new ApiError(409, 'cannot_disable_self', 'لا يمكنك إيقاف حسابك الحالي.');
  let salt = current.password_salt, hash = current.password_hash, iterations = current.password_iterations;
  if (body.password != null) {
    if (String(body.password).length < 10) throw new ApiError(400, 'weak_password', 'يجب ألا تقل كلمة المرور عن 10 أحرف.');
    const hashed = await hashPassword(String(body.password));
    salt = hashed.salt; hash = hashed.hash; iterations = hashed.iterations;
  }
  await ctx.env.DB.prepare(`UPDATE users SET name=?,email=?,role=?,status=?,password_salt=?,password_hash=?,password_iterations=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(cleanString(body.name ?? current.name,160), cleanOptional(body.email ?? current.email,160), role, status, salt, hash, iterations, id).run();
  await audit(ctx, 'user.update', 'user', id, { role, status });
  return json({ ok: true });
}

async function listResource(ctx, type) {
  const cfg = RESOURCES[type];
  const page = clampInt(ctx.url.searchParams.get('page'), 1, 100000, 1);
  const limit = clampInt(ctx.url.searchParams.get('limit'), 1, 100, 25);
  const search = cleanOptional(ctx.url.searchParams.get('search'), 100);
  const sort = cfg.sort.includes(ctx.url.searchParams.get('sort')) ? ctx.url.searchParams.get('sort') : 'created_at';
  const direction = ctx.url.searchParams.get('direction') === 'asc' ? 'ASC' : 'DESC';
  const clauses = ['deleted_at IS NULL'];
  const binds = [];
  for (const filter of cfg.filters) {
    const value = ctx.url.searchParams.get(filter);
    if (value != null && value !== '') { clauses.push(`${filter}=?`); binds.push(value); }
  }
  if (type === 'invoices') {
    const from = ctx.url.searchParams.get('due_from');
    const to = ctx.url.searchParams.get('due_to');
    if (from) { clauses.push('due_date>=?'); binds.push(validDate(from, 'due_from')); }
    if (to) { clauses.push('due_date<=?'); binds.push(validDate(to, 'due_to')); }
  }
  if (search) {
    clauses.push('(' + cfg.search.map(field => `${field} LIKE ?`).join(' OR ') + ')');
    cfg.search.forEach(() => binds.push(`%${escapeLike(search)}%`));
  }
  const where = clauses.join(' AND ');
  const count = await ctx.env.DB.prepare(`SELECT COUNT(*) AS total FROM ${cfg.table} WHERE ${where}`).bind(...binds).first();
  const rows = await ctx.env.DB.prepare(`SELECT * FROM ${cfg.table} WHERE ${where} ORDER BY ${sort} ${direction} LIMIT ? OFFSET ?`).bind(...binds, limit, (page-1)*limit).all();
  const total = Number(count?.total || 0);
  return json({ ok: true, data: rows.results || [], pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
}

async function getResource(ctx, type, id) {
  const row = await ctx.env.DB.prepare(`SELECT * FROM ${RESOURCES[type].table} WHERE id=? AND deleted_at IS NULL`).bind(id).first();
  if (!row) throw new ApiError(404, 'record_not_found', 'السجل المطلوب غير موجود.');
  return json({ ok: true, data: row });
}

async function createResource(ctx, type) {
  const body = await readJson(ctx.request);
  const record = await buildRecord(ctx, type, body, null);
  try { await insertRecord(ctx.env.DB, RESOURCES[type], record); }
  catch (error) { throw mapDbError(error, type); }
  await audit(ctx, `${type}.create`, type, record.id, { source_id: record.source_id || null });
  return json({ ok: true, data: record }, 201);
}

async function updateResource(ctx, type, id) {
  const current = await ctx.env.DB.prepare(`SELECT * FROM ${RESOURCES[type].table} WHERE id=? AND deleted_at IS NULL`).bind(id).first();
  if (!current) throw new ApiError(404, 'record_not_found', 'السجل المطلوب غير موجود.');
  const body = await readJson(ctx.request);
  const record = await buildRecord(ctx, type, { ...current, ...body }, current);
  try { await updateRecord(ctx.env.DB, RESOURCES[type], record); }
  catch (error) { throw mapDbError(error, type); }
  await audit(ctx, `${type}.update`, type, id, { changed: Object.keys(body).filter(key => RESOURCES[type].fields.includes(key)) });
  return json({ ok: true, data: record });
}

async function deleteResource(ctx, type, id) {
  const cfg = RESOURCES[type];
  const current = await ctx.env.DB.prepare(`SELECT id FROM ${cfg.table} WHERE id=? AND deleted_at IS NULL`).bind(id).first();
  if (!current) throw new ApiError(404, 'record_not_found', 'السجل المطلوب غير موجود.');
  if (type === 'properties') {
    const child = await ctx.env.DB.prepare('SELECT 1 FROM units WHERE property_id=? AND deleted_at IS NULL LIMIT 1').bind(id).first();
    if (child) throw new ApiError(409, 'property_has_units', 'لا يمكن حذف عقار مرتبط بوحدات.');
  }
  if (type === 'units') {
    const child = await ctx.env.DB.prepare('SELECT 1 FROM contracts WHERE unit_id=? AND deleted_at IS NULL LIMIT 1').bind(id).first();
    if (child) throw new ApiError(409, 'unit_has_contracts', 'لا يمكن حذف وحدة مرتبطة بعقود.');
  }
  if (type === 'contracts') {
    const child = await ctx.env.DB.prepare('SELECT 1 FROM invoices WHERE contract_id=? AND deleted_at IS NULL LIMIT 1').bind(id).first();
    if (child) throw new ApiError(409, 'contract_has_invoices', 'لا يمكن حذف عقد مرتبط بفواتير.');
  }
  await ctx.env.DB.prepare(`UPDATE ${cfg.table} SET deleted_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(id).run();
  await audit(ctx, `${type}.delete`, type, id, {});
  return json({ ok: true });
}

async function buildRecord(ctx, type, input, current) {
  const id = current?.id || cleanOptional(input.id, 100) || crypto.randomUUID();
  const sourceId = cleanOptional(input.source_id, 180) || id;
  let record;
  if (type === 'properties') {
    record = {
      id, source_id: sourceId, name: cleanString(input.name, 220), type: cleanString(input.type || 'building', 50),
      usage: cleanOptional(input.usage,80), city: cleanOptional(input.city,100), district: cleanOptional(input.district,120),
      address: cleanOptional(input.address,500), deed_number: cleanOptional(input.deed_number,100), owner_name: cleanOptional(input.owner_name,180),
      owner_id: cleanOptional(input.owner_id,30), owner_phone: cleanOptional(input.owner_phone,30), total_units: nonNegativeInt(input.total_units,0),
      area_sqm: nullableNumber(input.area_sqm), status: enumValue(input.status,'active',['active','inactive','under_maintenance'])
    };
    record.fingerprint = await fingerprint(['property', record.deed_number || '', record.name, record.city, record.district, record.address]);
  } else if (type === 'units') {
    record = {
      id, source_id: sourceId, property_id: cleanString(input.property_id,100), unit_number: cleanString(input.unit_number,80),
      type: cleanString(input.type || 'apartment',50), floor: cleanOptional(input.floor,30), area_sqm: nullableNumber(input.area_sqm),
      monthly_rent: nonNegativeNumber(input.monthly_rent,0), annual_rent: nonNegativeNumber(input.annual_rent,0),
      electricity_meter: cleanOptional(input.electricity_meter,100), water_meter: cleanOptional(input.water_meter,100),
      status: enumValue(input.status,'vacant',['vacant','rented','reserved','maintenance','inactive'])
    };
    await ensureExists(ctx.env.DB, 'properties', record.property_id, 'العقار المرتبط غير موجود.');
    record.fingerprint = await fingerprint(['unit', record.property_id, record.unit_number]);
  } else if (type === 'contracts') {
    record = {
      id, source_id: sourceId, contract_number: cleanString(input.contract_number,100), ejar_number: cleanOptional(input.ejar_number,100),
      property_id: cleanString(input.property_id,100), unit_id: cleanString(input.unit_id,100), owner_name: cleanOptional(input.owner_name,180),
      owner_id: cleanOptional(input.owner_id,30), tenant_name: cleanString(input.tenant_name,180), tenant_id_number: cleanOptional(input.tenant_id_number,30),
      tenant_phone: cleanOptional(input.tenant_phone,30), start_date: validDate(input.start_date,'start_date'), end_date: validDate(input.end_date,'end_date'),
      monthly_rent: nonNegativeNumber(input.monthly_rent,0), annual_rent: nonNegativeNumber(input.annual_rent,0), security_deposit: nonNegativeNumber(input.security_deposit,0),
      status: enumValue(input.status,'active',['draft','active','expired','terminated','cancelled'])
    };
    if (record.end_date < record.start_date) throw new ApiError(400,'invalid_date_range','تاريخ نهاية العقد يجب أن يكون بعد تاريخ البداية.');
    const unit = await ctx.env.DB.prepare('SELECT property_id FROM units WHERE id=? AND deleted_at IS NULL').bind(record.unit_id).first();
    if (!unit || String(unit.property_id) !== record.property_id) throw new ApiError(400,'invalid_contract_links','الوحدة غير موجودة أو غير مرتبطة بالعقار المحدد.');
    record.fingerprint = await fingerprint(['contract', record.contract_number, record.ejar_number || '', record.unit_id, record.start_date, record.end_date]);
  } else {
    record = {
      id, source_id: sourceId, invoice_number: cleanString(input.invoice_number,100), contract_id: cleanString(input.contract_id,100),
      installment_number: cleanOptional(input.installment_number,50), due_date: validDate(input.due_date,'due_date'), amount: nonNegativeNumber(input.amount,0),
      tax_amount: nonNegativeNumber(input.tax_amount,0), total_amount: nonNegativeNumber(input.total_amount, Number(input.amount || 0) + Number(input.tax_amount || 0)),
      paid_amount: nonNegativeNumber(input.paid_amount,0), remaining_amount: nonNegativeNumber(input.remaining_amount, Math.max(0, Number(input.total_amount ?? input.amount ?? 0) - Number(input.paid_amount || 0))),
      paid_date: input.paid_date ? validDate(input.paid_date,'paid_date') : null, status: enumValue(input.status,'pending',['pending','paid','partial','overdue','cancelled'])
    };
    await ensureExists(ctx.env.DB, 'contracts', record.contract_id, 'العقد المرتبط غير موجود.');
    if (record.paid_amount > record.total_amount) throw new ApiError(400,'invalid_paid_amount','المبلغ المدفوع أكبر من إجمالي الفاتورة.');
    record.fingerprint = await fingerprint(['invoice', record.invoice_number, record.contract_id, record.installment_number || '', record.due_date]);
  }
  for (const required of RESOURCES[type].required) if (record[required] == null || record[required] === '') throw new ApiError(400,'validation_error',`الحقل ${required} مطلوب.`);
  return record;
}

async function insertRecord(db, cfg, record) {
  const columns = ['id', ...cfg.fields];
  await db.prepare(`INSERT INTO ${cfg.table}(${columns.join(',')}) VALUES(${columns.map(()=>'?').join(',')})`).bind(...columns.map(key => record[key] ?? null)).run();
}

async function updateRecord(db, cfg, record) {
  await db.prepare(`UPDATE ${cfg.table} SET ${cfg.fields.map(field => `${field}=?`).join(',')},updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(...cfg.fields.map(key => record[key] ?? null), record.id).run();
}

async function ensureExists(db, table, id, message) {
  const row = await db.prepare(`SELECT 1 FROM ${table} WHERE id=? AND deleted_at IS NULL`).bind(id).first();
  if (!row) throw new ApiError(400,'invalid_relation',message);
}

function mapDbError(error, resource) {
  const message = String(error?.message || error);
  if (/UNIQUE constraint failed/i.test(message)) return new ApiError(409,'duplicate_record',`يوجد ${resource} مطابق مسجل مسبقاً.`, { constraint: message.replace(/^.*UNIQUE constraint failed:\s*/i,'').slice(0,200) });
  if (/FOREIGN KEY constraint failed/i.test(message)) return new ApiError(400,'invalid_relation','السجل المرتبط غير موجود أو غير صالح.');
  if (/CHECK constraint failed/i.test(message)) return new ApiError(400,'validation_error','إحدى القيم لا تحقق شروط قاعدة البيانات.');
  return error;
}

async function dataIntegrity(ctx) {
  const queries = {
    duplicatePropertyDeeds: `SELECT deed_number,COUNT(*) count FROM properties WHERE deleted_at IS NULL AND deed_number IS NOT NULL AND deed_number<>'' GROUP BY deed_number HAVING COUNT(*)>1`,
    duplicateUnits: `SELECT property_id,unit_number,COUNT(*) count FROM units WHERE deleted_at IS NULL GROUP BY property_id,unit_number HAVING COUNT(*)>1`,
    duplicateContracts: `SELECT contract_number,COUNT(*) count FROM contracts WHERE deleted_at IS NULL GROUP BY contract_number HAVING COUNT(*)>1`,
    duplicateInvoices: `SELECT invoice_number,COUNT(*) count FROM invoices WHERE deleted_at IS NULL GROUP BY invoice_number HAVING COUNT(*)>1`,
    orphanUnits: `SELECT u.id FROM units u LEFT JOIN properties p ON p.id=u.property_id AND p.deleted_at IS NULL WHERE u.deleted_at IS NULL AND p.id IS NULL`,
    orphanContracts: `SELECT c.id FROM contracts c LEFT JOIN properties p ON p.id=c.property_id AND p.deleted_at IS NULL LEFT JOIN units u ON u.id=c.unit_id AND u.deleted_at IS NULL WHERE c.deleted_at IS NULL AND (p.id IS NULL OR u.id IS NULL)`,
    orphanInvoices: `SELECT i.id FROM invoices i LEFT JOIN contracts c ON c.id=i.contract_id AND c.deleted_at IS NULL WHERE i.deleted_at IS NULL AND c.id IS NULL`
  };
  const result = {};
  for (const [key, sql] of Object.entries(queries)) result[key] = (await ctx.env.DB.prepare(sql).all()).results || [];
  const clean = Object.values(result).every(rows => rows.length === 0);
  return json({ ok: true, clean, checks: result, checkedAt: new Date().toISOString() });
}

async function listAuditLogs(ctx) {
  const limit = clampInt(ctx.url.searchParams.get('limit'),1,200,50);
  const rows = await ctx.env.DB.prepare('SELECT * FROM audit_logs ORDER BY id DESC LIMIT ?').bind(limit).all();
  return json({ ok: true, data: rows.results || [] });
}

async function audit(ctx, action, resourceType, resourceId, metadata) {
  const ip = ctx.request.headers.get('cf-connecting-ip') || null;
  const task = ctx.env.DB.prepare('INSERT INTO audit_logs(request_id,user_id,action,resource_type,resource_id,ip_address,metadata_json) VALUES(?,?,?,?,?,?,?)').bind(ctx.requestId, ctx.user?.sub || null, action, resourceType, resourceId, ip, JSON.stringify(metadata || {})).run().catch(error => console.error(JSON.stringify({ type:'audit_error', requestId:ctx.requestId, message:error.message })));
  ctx.executionCtx.waitUntil(task);
}

async function uploadImage(ctx, propertyId) {
  requireRoles(ctx, ['admin','manager','employee']);
  if (!ctx.env.PROPERTY_IMAGES) throw new ApiError(503,'r2_not_enabled','تخزين R2 غير مفعّل على الحساب بعد.');
  await ensureExists(ctx.env.DB, 'properties', propertyId, 'العقار غير موجود.');
  const form = await ctx.request.formData();
  const file = form.get('file');
  if (!file || typeof file.arrayBuffer !== 'function') throw new ApiError(400,'missing_file','ملف الصورة مطلوب.');
  if (!IMAGE_TYPES.has(file.type) || file.size <= 0 || file.size > MAX_IMAGE_BYTES) throw new ApiError(400,'invalid_image','الصورة يجب أن تكون JPG أو PNG أو WebP وبحجم لا يتجاوز 10MB.');
  const extension = file.type === 'image/png' ? 'png' : (file.type === 'image/webp' ? 'webp' : 'jpg');
  const imageId = crypto.randomUUID();
  const objectKey = `properties/${propertyId}/${imageId}.${extension}`;
  await ctx.env.PROPERTY_IMAGES.put(objectKey, await file.arrayBuffer(), { httpMetadata: { contentType: file.type, cacheControl: 'public,max-age=31536000,immutable' } });
  await ctx.env.DB.prepare('INSERT INTO property_images(id,property_id,object_key,file_name,content_type,size_bytes,created_by) VALUES(?,?,?,?,?,?,?)').bind(imageId, propertyId, objectKey, cleanString(file.name || `property.${extension}`,180), file.type, file.size, ctx.user.sub).run();
  await audit(ctx,'property.image.upload','property',propertyId,{ imageId, size:file.size });
  return json({ ok:true, data:{ id:imageId, property_id:propertyId, url:`${API_PREFIX}/images/${imageId}` } },201);
}

async function getImage(ctx, imageId) {
  if (!ctx.env.PROPERTY_IMAGES) throw new ApiError(503,'r2_not_enabled','تخزين الصور غير مفعّل.');
  const image = await ctx.env.DB.prepare('SELECT * FROM property_images WHERE id=?').bind(imageId).first();
  if (!image) throw new ApiError(404,'image_not_found','الصورة غير موجودة.');
  const object = await ctx.env.PROPERTY_IMAGES.get(image.object_key);
  if (!object) throw new ApiError(404,'image_not_found','ملف الصورة غير موجود.');
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('cache-control','public,max-age=31536000,immutable');
  return new Response(object.body,{ headers });
}

async function deleteImage(ctx, propertyId, imageId) {
  requireRoles(ctx,['admin','manager']);
  if (!ctx.env.PROPERTY_IMAGES) throw new ApiError(503,'r2_not_enabled','تخزين الصور غير مفعّل.');
  const image = await ctx.env.DB.prepare('SELECT * FROM property_images WHERE id=? AND property_id=?').bind(imageId,propertyId).first();
  if (!image) throw new ApiError(404,'image_not_found','الصورة غير موجودة.');
  await ctx.env.PROPERTY_IMAGES.delete(image.object_key);
  await ctx.env.DB.prepare('DELETE FROM property_images WHERE id=?').bind(imageId).run();
  await audit(ctx,'property.image.delete','property',propertyId,{ imageId });
  return json({ok:true});
}

async function getBalance(ctx) {
  if (!ctx.env.TAQNYAT_API_KEY) throw new ApiError(503,'missing_secret','مفتاح Taqnyat غير مضبوط.');
  try {
    const upstream = await fetch('https://api.taqnyat.sa/account/balance',{ headers:{ Authorization:`Bearer ${ctx.env.TAQNYAT_API_KEY}`,Accept:'application/json' } });
    const data = await safeJson(upstream);
    return json({ok:upstream.ok,status:upstream.status,data},upstream.ok?200:upstream.status);
  } catch (error) { throw new ApiError(502,'taqnyat_unreachable','تعذر الاتصال بخدمة Taqnyat.',String(error.message||error).slice(0,200)); }
}

async function sendSms(ctx) {
  if (!ctx.env.TAQNYAT_API_KEY) throw new ApiError(503,'missing_secret','مفتاح Taqnyat غير مضبوط.');
  if (ctx.env.TAQNYAT_SEND_ENABLED !== 'true') throw new ApiError(423,'customer_notifications_locked','إرسال إشعارات العملاء مقفل من الخادم.');
  const payload = await readJson(ctx.request);
  const recipients = Array.isArray(payload.recipients) ? [...new Set(payload.recipients.map(value=>String(value).trim()))] : [];
  const body = cleanString(payload.body, 1000);
  const sender = cleanString(payload.sender || ctx.env.TAQNYAT_SENDER || 'RAMZABDE', 20);
  if (!recipients.length || recipients.length > 50 || !body || !sender) throw new ApiError(400,'validation_error','تحقق من المستلمين ونص الرسالة واسم المرسل.');
  const invalid = recipients.filter(phone=>!/^966[0-9]{8,12}$/.test(phone));
  if (invalid.length) throw new ApiError(400,'invalid_recipient_format','أرقام الجوال يجب أن تكون بالصيغة الدولية 966 دون +.',{invalidCount:invalid.length});
  try {
    const upstream = await fetch('https://api.taqnyat.sa/v1/messages',{method:'POST',headers:{Authorization:`Bearer ${ctx.env.TAQNYAT_API_KEY}`,'content-type':'application/json',Accept:'application/json'},body:JSON.stringify({recipients,body,sender})});
    const data = await safeJson(upstream);
    return json({ok:upstream.ok,status:upstream.status,data},upstream.ok?200:upstream.status);
  } catch(error) { throw new ApiError(502,'taqnyat_unreachable','تعذر الاتصال بخدمة الرسائل.',String(error.message||error).slice(0,200)); }
}

async function safeJson(response) {
  const text = await response.text();
  try { return JSON.parse(text); } catch { return { raw:text.slice(0,2000) }; }
}

function publicUser(user) {
  return { id:user.id || user.sub, username:user.username, email:user.email || null, name:user.name, role:user.role, status:user.status || 'active', lastLoginAt:user.last_login_at || null };
}

async function hashPassword(password) {
  const iterations = 100000;
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
  const bits = await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt,iterations},key,256);
  return { salt:bytesToBase64(salt),hash:bytesToBase64(new Uint8Array(bits)),iterations };
}

async function verifyPassword(password,user) {
  const salt = base64ToBytes(user.password_salt);
  const expected = base64ToBytes(user.password_hash);
  const key = await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
  const iterations = Math.min(100000, Number(user.password_iterations || 100000));
  const bits = new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt,iterations},key,256));
  if (bits.length !== expected.length) return false;
  let diff=0; for(let i=0;i<bits.length;i++) diff|=bits[i]^expected[i];
  return diff===0;
}

async function createJwt(payload, secret) {
  const header = b64urlJson({alg:'HS256',typ:'JWT'});
  const body = b64urlJson(payload);
  const input = `${header}.${body}`;
  const signature = await hmac(input,secret);
  return `${input}.${signature}`;
}

async function verifyJwt(token,secret) {
  try {
    const parts=token.split('.'); if(parts.length!==3) return null;
    const expected=await hmac(`${parts[0]}.${parts[1]}`,secret);
    if(!constantTimeString(expected,parts[2])) return null;
    const payload=JSON.parse(new TextDecoder().decode(base64urlToBytes(parts[1])));
    const now=Math.floor(Date.now()/1000);
    if(payload.iss!=='ramz-taqnyat-api'||!payload.sub||!payload.jti||Number(payload.exp)<=now) return null;
    return payload;
  } catch { return null; }
}

async function hmac(value,secret) {
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return bytesToBase64url(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(value))));
}

function b64urlJson(value){return bytesToBase64url(new TextEncoder().encode(JSON.stringify(value)));}
function bytesToBase64(bytes){let s='';for(const byte of bytes)s+=String.fromCharCode(byte);return btoa(s);}
function base64ToBytes(value){const raw=atob(String(value));return Uint8Array.from(raw,c=>c.charCodeAt(0));}
function bytesToBase64url(bytes){return bytesToBase64(bytes).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
function base64urlToBytes(value){let v=String(value).replace(/-/g,'+').replace(/_/g,'/');while(v.length%4)v+='=';return base64ToBytes(v);}
function constantTimeString(a,b){if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;}

async function fingerprint(parts){return sha256(parts.map(value=>normalize(value)).join('|'));}
async function sha256(value){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(String(value)));return Array.from(new Uint8Array(bytes)).map(b=>b.toString(16).padStart(2,'0')).join('');}
function normalize(value){return String(value??'').trim().toLowerCase().replace(/[\u064B-\u065F\u0670]/g,'').replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').replace(/\s+/g,' ');}
function cleanString(value,max){const result=String(value??'').trim();if(result.length>max)throw new ApiError(400,'value_too_long',`القيمة تتجاوز ${max} حرفاً.`);return result;}
function cleanOptional(value,max){if(value==null||String(value).trim()==='')return null;return cleanString(value,max);}
function enumValue(value,fallback,allowed){const result=String(value??fallback);if(!allowed.includes(result))throw new ApiError(400,'invalid_value','إحدى القيم المحددة غير صحيحة.');return result;}
function nonNegativeNumber(value,fallback=0){const result=value==null||value===''?fallback:Number(value);if(!Number.isFinite(result)||result<0)throw new ApiError(400,'invalid_number','القيمة الرقمية يجب أن تكون صفراً أو أكبر.');return result;}
function nullableNumber(value){return value==null||value===''?null:nonNegativeNumber(value);}
function nonNegativeInt(value,fallback=0){const result=nonNegativeNumber(value,fallback);if(!Number.isInteger(result))throw new ApiError(400,'invalid_integer','القيمة يجب أن تكون عدداً صحيحاً.');return result;}
function clampInt(value,min,max,fallback){const n=Number.parseInt(value,10);return Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback;}
function validDate(value,field){const result=String(value??'').trim();if(!/^\d{4}-\d{2}-\d{2}$/.test(result)||Number.isNaN(Date.parse(result+'T00:00:00Z')))throw new ApiError(400,'invalid_date',`صيغة ${field} يجب أن تكون YYYY-MM-DD.`);return result;}
function escapeLike(value){return String(value).replace(/[\\%_]/g,char=>'\\'+char);}
