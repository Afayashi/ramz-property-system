const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
  });
  const context = await browser.newContext({ viewport: { width: 1365, height: 900 } });
  await context.addInitScript(() => {
    localStorage.setItem('ramz_admin_session_v1', JSON.stringify({
      user: 'AliAyashi', userId: 'usr-admin', name: 'مدير النظام', role: 'admin', at: Date.now()
    }));
    localStorage.setItem('ramz_system_users_v2', JSON.stringify([
      { id: 'usr-admin', name: 'مدير النظام', username: 'AliAyashi', role: 'admin', status: 'active' }
    ]));
    localStorage.removeItem('ramz_owners_unions_v2');
  });

  let records = [];
  const upserts = [];
  await context.route('**/api/enterprise', async route => {
    let body = {};
    try { body = JSON.parse(route.request().postData() || '{}'); } catch (_) {}
    if (body.action === 'load') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ records, users: [], audit: [] }) });
    }
    if (body.action === 'upsert_record') {
      upserts.push(body.record);
      records = records.filter(row => row.source_id !== body.record.source_id);
      records.push({ ...body.record, updated_at: new Date().toISOString() });
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });

  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:8765/?page=owners-union&v=union-cloud-test', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.renderUnionsPage === 'function');
  await page.evaluate(() => {
    data.properties = [{ id: 'prop-qa-1', name: 'عقار اختبار الاتحاد', city: 'الرياض', owner_name: 'مالك الاختبار', owner_id: '1010101010', total_units: 4 }];
    UNION_PROP_OPTIONS_SIGNATURE = '';
    renderUnionsPage();
  });
  await page.click('button[onclick="openNewUnion()"]');
  await page.fill('#u-name', 'جمعية اختبار الحفظ السحابي');
  await page.selectOption('#u-prop', 'prop-qa-1');
  await page.fill('#u-reg-no', 'REG-QA-2026');
  await page.fill('#u-president', 'رئيس اختبار');
  await page.fill('#u-members', '4');
  await page.fill('#u-voters', '4');
  await page.fill('#u-acceptance', '100');
  await page.click('#union-save-btn');
  await page.waitForTimeout(1200);
  const saveState = await page.evaluate(() => ({
    unions: unionsData,
    modalOpen: document.getElementById('modal-union-new').classList.contains('open'),
    toasts: Array.from(document.querySelectorAll('.toast')).map(node => node.innerText)
  }));
  if (!(saveState.unions.length === 1 && saveState.unions[0].sync_status === 'synced')) {
    throw new Error('Cloud save did not complete: ' + JSON.stringify({ saveState, upserts }));
  }

  const first = await page.evaluate(() => ({
    status: unionsData[0].sync_status,
    banner: document.getElementById('u-cloud-status').innerText,
    card: document.getElementById('unions-list').innerText
  }));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.loadUnionsFromCloud === 'function');
  await page.evaluate(() => loadUnionsFromCloud(true));
  await page.waitForFunction(() => unionsData.length === 1 && unionsData[0].sync_status === 'synced');
  const reloaded = await page.evaluate(() => ({ count: unionsData.length, name: unionsData[0].name, status: unionsData[0].sync_status }));

  const result = {
    upserts: upserts.length,
    payloadFields: Object.keys(upserts[0].payload).length,
    firstStatus: first.status,
    statusConfirmed: first.banner.includes('محفوظة'),
    cardConfirmed: first.card.includes('محفوظة في قاعدة البيانات'),
    reloaded,
    errors
  };
  console.log(JSON.stringify(result, null, 2));
  if (upserts.length !== 1 || reloaded.count !== 1 || errors.length) process.exitCode = 1;
  await browser.close();
})().catch(error => {
  console.error(error);
  process.exit(1);
});
