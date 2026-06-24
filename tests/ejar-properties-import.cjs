const { chromium } = require('playwright-core');
const baseUrl = process.env.RAMZ_TEST_URL || 'http://127.0.0.1:8765/';

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addInitScript(() => {
    localStorage.setItem('ramz_admin_session_v1', JSON.stringify({
      user: 'AliAyashi', userId: 'usr-admin', name: 'مدير النظام', role: 'admin', at: Date.now()
    }));
    localStorage.setItem('ramz_system_users_v2', JSON.stringify([
      { id: 'usr-admin', name: 'مدير النظام', username: 'AliAyashi', role: 'admin', status: 'active' }
    ]));
  });
  await context.route('**/api/enterprise', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ ok: true, records: [], users: [], audit: [] })
  }));

  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${baseUrl}?page=properties&v=ejar-import-test`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.prepareEjarPropertiesImport === 'function');
  await page.waitForFunction(() => window.isConnected === true, null, { timeout: 30000 });

  const preview = await page.evaluate(() => {
    const existing = {
      id: 1,
      source_id: 'existing-1',
      name: 'عمارة النخيل',
      deed_number: '1234567890',
      city: 'الرياض',
      district: 'العليا',
      owner_name: 'أحمد المالك',
      owner_id: '1010'
    };
    data.properties = [existing];
    ramzTouchData();
    openEjarPropertiesImport();
    prepareEjarPropertiesImport([
      {
        'رقم العقار في إيجار': 'E-100',
        'اسم العقار': 'عمارة النخيل المحدثة',
        'رقم الصك': '1234567890',
        'المدينة': 'الرياض',
        'الحي': 'العليا',
        'اسم المالك': 'أحمد المالك'
      },
      {
        'رقم العقار في إيجار': 'E-200',
        'اسم العقار': 'مجمع الياسمين',
        'رقم الصك': '2222',
        'المدينة': 'الرياض',
        'الحي': 'الياسمين',
        'اسم المالك': 'سارة المالك'
      },
      {
        'رقم العقار في إيجار': 'E-200',
        'اسم العقار': 'مجمع الياسمين',
        'رقم الصك': '2222',
        'المدينة': 'الرياض',
        'جوال المالك': '0500000002'
      },
      {
        'رقم العقار في إيجار': 'E-300',
        'اسم العقار': 'مجمع الياسمين',
        'رقم الصك': '3333',
        'المدينة': 'الرياض',
        'الحي': 'الياسمين',
        'اسم المالك': 'سارة المالك'
      }
    ]);
    return {
      stats: { ...RAMZ_EJAR_PROPERTY_IMPORT.stats },
      rows: RAMZ_EJAR_PROPERTY_IMPORT.rows.map(item => ({
        action: item.action,
        name: item.record.name,
        deed: item.record.deed_number,
        phone: item.record.owner_phone || ''
      })),
      saveEnabled: !document.getElementById('ejar-properties-import-save').disabled,
      modalVisible: document.getElementById('m-ejar-properties-import').classList.contains('open')
    };
  });

  await page.screenshot({ path: 'tests/ejar-properties-import-desktop.png', fullPage: true });

  const saved = await page.evaluate(async () => {
    window.__cloudRows = [{
      id: 1,
      source_id: 'existing-1',
      name: 'عمارة النخيل',
      deed_number: '1234567890',
      city: 'الرياض',
      district: 'العليا',
      owner_name: 'أحمد المالك',
      owner_id: '1010'
    }];
    window.__writes = { inserted: 0, updated: 0 };
    db = {
      from(table) {
        if (table !== 'real_properties') throw new Error(`Unexpected table: ${table}`);
        return {
          select() {
            return {
              async limit() {
                return { data: window.__cloudRows.map(row => ({ ...row })), error: null };
              }
            };
          },
          update(payload) {
            const filters = {};
            const query = {
              eq(key, value) {
                filters[key] = value;
                return query;
              },
              async select() {
                const index = window.__cloudRows.findIndex(row => Object.entries(filters).every(([key, value]) => String(row[key]) === String(value)));
                if (index < 0) return { data: [], error: null };
                window.__cloudRows[index] = { ...window.__cloudRows[index], ...payload };
                window.__writes.updated += 1;
                return { data: [{ ...window.__cloudRows[index] }], error: null };
              }
            };
            return query;
          },
          insert(payload) {
            return {
              async select() {
                const row = { id: window.__cloudRows.length + 1, ...payload };
                window.__cloudRows.push(row);
                window.__writes.inserted += 1;
                return { data: [{ ...row }], error: null };
              }
            };
          }
        };
      }
    };
    isConnected = true;
    window.db = db;
    window.isConnected = true;
    syncFromDB = async () => {};
    renderEjarIntegrationPage = () => {};
    await importEjarPropertiesToDatabase();
    return {
      count: window.__cloudRows.length,
      writes: { ...window.__writes },
      rows: window.__cloudRows.map(row => ({ name: row.name, deed: row.deed_number, phone: row.owner_phone || '' })),
      status: document.getElementById('ejar-properties-import-status').textContent.trim()
    };
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => openEjarPropertiesImport());
  const mobile = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    visible: document.getElementById('m-ejar-properties-import').classList.contains('open')
  }));
  await page.screenshot({ path: 'tests/ejar-properties-import-mobile.png', fullPage: true });

  console.log(JSON.stringify({ preview, saved, mobile, errors }, null, 2));
  const ok =
    preview.stats.incoming === 4 &&
    preview.stats.unique === 3 &&
    preview.stats.duplicates === 1 &&
    preview.stats.matched === 1 &&
    preview.stats.insert === 2 &&
    preview.saveEnabled &&
    preview.modalVisible &&
    preview.rows.some(row => row.deed === '2222' && row.phone === '0500000002') &&
    saved.count === 3 &&
    saved.writes.updated === 1 &&
    saved.writes.inserted === 2 &&
    saved.rows.some(row => row.name === 'عمارة النخيل المحدثة') &&
    saved.status.includes('أضيف 2 عقار') &&
    saved.status.includes('حُدث 1 عقار') &&
    mobile.visible &&
    !mobile.overflow &&
    errors.length === 0;
  if (!ok) process.exitCode = 1;
  await browser.close();
})().catch(error => {
  console.error(error);
  process.exit(1);
});
