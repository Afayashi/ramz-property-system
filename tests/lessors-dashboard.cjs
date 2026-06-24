const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
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
  await page.goto('http://127.0.0.1:8765/?page=lessors-dashboard&v=lessors-test', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.renderLessorsDashboard === 'function');
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    data.properties = [
      { id: 'p-a', name: 'عمارة النخيل', city: 'الرياض', owner_name: 'أحمد المالك', owner_id: '1010101010', owner_phone: '0500000001', owner_email: 'a@example.com', total_units: 2 },
      { id: 'p-b', name: 'فيلا الندى', city: 'جدة', owner_name: 'شركة المدى', owner_id: '7000000001', owner_phone: '0500000002', owner_type: 'company', total_units: 1 }
    ];
    data.units = [
      { id: 'u-a1', property_id: 'p-a', unit_number: 'A1', status: 'rented' },
      { id: 'u-a2', property_id: 'p-a', unit_number: 'A2', status: 'vacant' },
      { id: 'u-b1', property_id: 'p-b', unit_number: 'B1', status: 'maintenance' }
    ];
    data.contracts = [
      { id: 'c-a', contract_number: '1001', property_id: 'p-a', unit_id: 'u-a1', owner_name: 'أحمد المالك', status: 'active', monthly_rent: 5000, start_date: '2026-01-01', end_date: '2027-01-01' }
    ];
    data.invoices = [
      { id: 'i-a1', contract_id: 'c-a', property_id: 'p-a', status: 'paid', total_amount: 5000, paid_amount: 5000 },
      { id: 'i-a2', contract_id: 'c-a', property_id: 'p-a', status: 'overdue', total_amount: 5000, remaining_amount: 5000, due_date: '2026-07-01' }
    ];
    ramzTouchData();
    nav('lessors-dashboard');
  });
  await page.waitForFunction(() => document.getElementById('lessor-total').textContent === '2');
  const desktop = await page.evaluate(() => ({
    total: document.getElementById('lessor-total').textContent,
    properties: document.getElementById('lessor-rel-properties').textContent,
    units: document.getElementById('lessor-rel-units').textContent,
    active: document.getElementById('lessor-active').textContent,
    count: document.getElementById('lessor-table-count').textContent,
    bodyOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
  }));
  await page.screenshot({ path: 'tests/lessors-dashboard-desktop.png', fullPage: true });

  await page.evaluate(() => nav('properties'));
  await page.click('#props-tbl button[data-owner="أحمد المالك"]');
  await page.waitForFunction(() => document.getElementById('lessor-search').value === 'أحمد المالك');
  const fromProperty = await page.evaluate(() => ({
    visible: document.getElementById('p-lessors-dashboard').offsetHeight > 0,
    search: document.getElementById('lessor-search').value,
    count: document.getElementById('lessor-table-count').textContent
  }));

  await page.evaluate(() => nav('finance'));
  await page.click('#p-finance button[onclick="openLessorsDashboard(\'due\')"]');
  await page.waitForFunction(() => document.getElementById('lessor-status-filter').value === 'due');
  const fromFinance = await page.evaluate(() => ({
    filter: document.getElementById('lessor-status-filter').value,
    count: document.getElementById('lessor-table-count').textContent
  }));

  await page.evaluate(() => { nav('owners'); openPartyDetails('owner', 0); });
  await page.click('#party-details-lessors');
  await page.waitForFunction(() => document.getElementById('p-lessors-dashboard').offsetHeight > 0 && document.getElementById('lessor-search').value === 'أحمد المالك');
  const fromOwnerDetails = await page.evaluate(() => document.getElementById('lessor-table-count').textContent);

  await page.fill('#lessor-search', '');
  await page.selectOption('#lessor-status-filter', 'no-contract');
  const filtered = await page.evaluate(() => document.getElementById('lessor-table-count').textContent);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { document.getElementById('lessor-status-filter').value = 'all'; renderLessorsDashboard(); window.scrollTo(0, 0); });
  await page.screenshot({ path: 'tests/lessors-dashboard-mobile.png', fullPage: true });
  const mobile = await page.evaluate(() => ({
    bodyOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    tableScrollable: document.getElementById('lessors-dashboard-table').scrollWidth > document.getElementById('lessors-dashboard-table').clientWidth,
    visible: document.getElementById('p-lessors-dashboard').offsetHeight > 0
  }));

  console.log(JSON.stringify({ desktop, fromProperty, fromFinance, fromOwnerDetails, filtered, mobile, errors }, null, 2));
  if (desktop.total !== '2' || desktop.properties !== '2' || desktop.units !== '3' || desktop.active !== '1' || !fromProperty.visible || fromProperty.search !== 'أحمد المالك' || fromProperty.count.indexOf('1 من 2') < 0 || fromFinance.filter !== 'due' || fromFinance.count.indexOf('1 من 2') < 0 || fromOwnerDetails.indexOf('1 من 2') < 0 || filtered.indexOf('1 من 2') < 0 || errors.length || desktop.bodyOverflow || mobile.bodyOverflow || !mobile.tableScrollable || !mobile.visible) process.exitCode = 1;
  await browser.close();
})().catch(error => {
  console.error(error);
  process.exit(1);
});
