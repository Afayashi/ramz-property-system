// ===================================================
// رمز الإبداع - الصفحات الجديدة السبع
// يعمل مع nav() ونظام #p-{page}.pc
// ===================================================
(function() {
  'use strict';

  // ========== inject pages into the DOM ==========
  function injectPages() {
    const mw = document.querySelector('.mw');
    if (!mw) return setTimeout(injectPages, 500);

    const pages = [
      { id: 'kpi',              title: 'مؤشرات KPI',      render: renderKPIPage },
      { id: 'advanced-reports', title: 'تقارير مالية',    render: renderReportsPage },
      { id: 'crm',              title: 'CRM العملاء',      render: renderCRMPage },
      { id: 'sms',              title: 'إشعارات SMS',      render: renderSMSPage },
      { id: 'maintenance-new',  title: 'طلبات الصيانة',   render: renderMaintenancePage },
      { id: 'ejar-new',         title: 'تكامل إيجار',     render: renderEjarPage },
    ];

    pages.forEach(p => {
      if (document.getElementById('p-' + p.id)) return; // already exists
      const div = document.createElement('div');
      div.id = 'p-' + p.id;
      div.className = 'pc';
      div.style.display = 'none';
      mw.appendChild(div);
    });

    // Patch nav() to support new pages
    const origNav = window.nav;
    window.nav = function(page) {
      const newPage = pages.find(p => p.id === page);
      if (newPage) {
        // Hide all pages
        document.querySelectorAll('.pc').forEach(el => {
          el.classList.remove('active');
          el.style.display = 'none';
        });
        const el = document.getElementById('p-' + page);
        if (el) {
          el.style.display = '';
          el.classList.add('active');
          newPage.render(el);
          document.title = 'رمز الإبداع — ' + newPage.title;
          history.pushState({}, '', '?page=' + page);
          // Update sidebar active state
          document.querySelectorAll('.sb-link, .nav-link, [data-page]').forEach(l => l.classList.remove('active'));
        }
      } else if (origNav) {
        origNav(page);
      }
    };

    // Add sidebar entries
    injectSidebarLinks(pages);

    // Handle initial page from URL
    const urlPage = new URLSearchParams(location.search).get('page');
    if (urlPage && pages.find(p => p.id === urlPage)) {
      setTimeout(() => window.nav(urlPage), 300);
    }
  }

  // ========== Sidebar links ==========
  function injectSidebarLinks(pages) {
    const sidebar = document.querySelector('aside, .sb');
    if (!sidebar) return;
    if (document.getElementById('new-pages-section')) return;

    const icons = { 'kpi':'📊', 'advanced-reports':'📈', 'crm':'👥', 'sms':'📱', 'maintenance-new':'🔧', 'ejar-new':'🏛️' };

    const section = document.createElement('div');
    section.id = 'new-pages-section';
    section.innerHTML = `
      <div style="font-size:10px;color:rgba(255,255,255,.4);padding:10px 16px 4px;text-transform:uppercase;letter-spacing:1px;margin-top:8px;border-top:1px solid rgba(255,255,255,.08)">تطوير النظام</div>
      ${pages.map(p => `
        <div onclick="nav('${p.id}')" data-newpage="${p.id}"
          style="display:flex;align-items:center;gap:10px;padding:9px 16px;cursor:pointer;border-radius:8px;margin:1px 8px;color:rgba(255,255,255,.75);font-size:13px;transition:all .15s"
          onmouseover="this.style.background='rgba(201,168,76,.18)';this.style.color='#C9A84C'"
          onmouseout="this.style.background='';this.style.color='rgba(255,255,255,.75)'">
          <span style="font-size:15px">${icons[p.id]||'📄'}</span>
          <span>${p.title}</span>
        </div>
      `).join('')}
    `;
    sidebar.appendChild(section);
  }

  // ========== helper ==========
  function el(id) { return document.getElementById('p-' + id); }

  // ========== 1. KPI ==========
  function renderKPIPage(container) {
    container.innerHTML = `
    <div dir="rtl" style="padding:24px;max-width:1400px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px">
        <div>
          <h1 style="font-size:22px;font-weight:700;color:#1a1a2e;margin:0">📊 لوحة مؤشرات الأداء KPI</h1>
          <p style="color:#666;margin:4px 0 0;font-size:13px">نظرة شاملة على أداء المحفظة العقارية</p>
        </div>
        <button onclick="nav('dashboard')" style="padding:8px 16px;background:#f3f4f6;border:none;border-radius:8px;cursor:pointer;font-family:inherit;font-size:13px">← لوحة التحكم</button>
      </div>

      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:20px">
        ${[
          {label:'معدل الإشغال',val:'94.1%',sub:'▲ 2.3% الشهر الماضي',color:'#22c55e'},
          {label:'إجمالي الإيرادات',val:'٤,٣٢٥,٤٣٩ ر.س',sub:'هذا العام',color:'#3b82f6'},
          {label:'متأخرات التحصيل',val:'٢,٤٨٢,٨٨٩ ر.س',sub:'74 دفعة معلقة',color:'#f59e0b'},
          {label:'متوسط إيجار الوحدة',val:'٨٤,٨١٦ ر.س',sub:'سنوياً',color:'#8b5cf6'},
        ].map(k=>`
          <div style="background:#fff;border-radius:12px;padding:20px;box-shadow:0 2px 8px rgba(0,0,0,.07);border-right:4px solid ${k.color}">
            <div style="font-size:12px;color:#888;margin-bottom:6px">${k.label}</div>
            <div style="font-size:22px;font-weight:700;color:#1a1a2e;margin-bottom:4px">${k.val}</div>
            <div style="font-size:12px;color:${k.color}">${k.sub}</div>
          </div>`).join('')}
      </div>

      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:20px">
        ${[
          {label:'طلبات الصيانة المفتوحة',val:'12',sub:'3 عاجلة',color:'#ef4444'},
          {label:'عقود تنتهي قريباً',val:'4',sub:'خلال 60 يوم',color:'#06b6d4'},
          {label:'نسبة التحصيل',val:'63.5%',sub:'من إجمالي الإيرادات',color:'#10b981'},
          {label:'رضا المستأجرين',val:'4.2/5',sub:'⭐⭐⭐⭐',color:'#f97316'},
        ].map(k=>`
          <div style="background:#fff;border-radius:12px;padding:20px;box-shadow:0 2px 8px rgba(0,0,0,.07);border-right:4px solid ${k.color}">
            <div style="font-size:12px;color:#888;margin-bottom:6px">${k.label}</div>
            <div style="font-size:28px;font-weight:700;color:${k.color};margin-bottom:4px">${k.val}</div>
            <div style="font-size:12px;color:#666">${k.sub}</div>
          </div>`).join('')}
      </div>

      <div style="background:#fff;border-radius:12px;padding:20px;box-shadow:0 2px 8px rgba(0,0,0,.07)">
        <h3 style="margin:0 0 16px;font-size:15px;color:#1a1a2e">أهداف الأداء مقابل الفعلي</h3>
        <table style="width:100%;border-collapse:collapse">
          <thead><tr style="background:#f8f9fa;font-size:12px;color:#666">
            <th style="padding:10px;text-align:right;border-bottom:1px solid #eee">المؤشر</th>
            <th style="padding:10px;text-align:center;border-bottom:1px solid #eee">الهدف</th>
            <th style="padding:10px;text-align:center;border-bottom:1px solid #eee">الفعلي</th>
            <th style="padding:10px;text-align:center;border-bottom:1px solid #eee">الحالة</th>
            <th style="padding:10px;text-align:right;border-bottom:1px solid #eee">التقدم</th>
          </tr></thead>
          <tbody>
            ${[
              {name:'معدل الإشغال',target:'95%',actual:'94.1%',pct:99,status:'قريب',sc:'#f59e0b'},
              {name:'نسبة التحصيل',target:'85%',actual:'63.5%',pct:63,status:'دون الهدف',sc:'#ef4444'},
              {name:'إغلاق طلبات الصيانة',target:'90%',actual:'78%',pct:78,status:'قريب',sc:'#f59e0b'},
              {name:'رضا المستأجرين',target:'4.5/5',actual:'4.2/5',pct:84,status:'جيد',sc:'#22c55e'},
            ].map(r=>`
              <tr style="border-bottom:1px solid #f0f0f0">
                <td style="padding:12px;font-size:13px">${r.name}</td>
                <td style="padding:12px;text-align:center;font-size:13px;color:#666">${r.target}</td>
                <td style="padding:12px;text-align:center;font-size:13px;font-weight:600">${r.actual}</td>
                <td style="padding:12px;text-align:center"><span style="background:${r.sc}22;color:${r.sc};padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600">${r.status}</span></td>
                <td style="padding:12px"><div style="background:#e5e7eb;border-radius:4px;height:7px"><div style="background:${r.sc};width:${r.pct}%;height:7px;border-radius:4px"></div></div></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
  }

  // ========== 2. تقارير مالية ==========
  function renderReportsPage(container) {
    container.innerHTML = `
    <div dir="rtl" style="padding:24px;max-width:1400px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px">
        <div>
          <h1 style="font-size:22px;font-weight:700;color:#1a1a2e;margin:0">📈 التقارير المالية المتقدمة</h1>
          <p style="color:#666;margin:4px 0 0;font-size:13px">تحليلات مالية شاملة ومفصّلة</p>
        </div>
        <div style="display:flex;gap:8px">
          <button onclick="nav('dashboard')" style="padding:8px 16px;background:#f3f4f6;border:none;border-radius:8px;cursor:pointer;font-family:inherit;font-size:13px">← رجوع</button>
          <button style="padding:8px 16px;background:#C9A84C;color:#fff;border:none;border-radius:8px;cursor:pointer;font-family:inherit;font-size:13px">📄 تصدير PDF</button>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:20px">
        ${[
          {label:'إجمالي الإيرادات المستحقة',val:'٦,٨٠٨,٣٢٨ ر.س',sub:'من 51 عقد نشط',color:'#1a1a2e'},
          {label:'إجمالي المحصّل',val:'٤,٣٢٥,٤٣٩ ر.س',sub:'معدل التحصيل 63.5%',color:'#22c55e'},
          {label:'إجمالي المتأخرات',val:'٢,٤٨٢,٨٨٩ ر.س',sub:'74 دفعة معلقة',color:'#ef4444'},
        ].map(k=>`
          <div style="background:#fff;border-radius:12px;padding:20px;box-shadow:0 2px 8px rgba(0,0,0,.07)">
            <div style="font-size:12px;color:#888;margin-bottom:6px">${k.label}</div>
            <div style="font-size:22px;font-weight:700;color:${k.color};margin-bottom:4px">${k.val}</div>
            <div style="font-size:12px;color:#666">${k.sub}</div>
          </div>`).join('')}
      </div>

      <div style="background:#fff;border-radius:12px;padding:20px;box-shadow:0 2px 8px rgba(0,0,0,.07)">
        <h3 style="margin:0 0 16px;font-size:15px">ملخص مالي شهري - 2026</h3>
        <table style="width:100%;border-collapse:collapse">
          <thead><tr style="background:#f8f9fa;font-size:12px;color:#666">
            <th style="padding:10px;text-align:right;border-bottom:1px solid #eee">الشهر</th>
            <th style="padding:10px;text-align:center;border-bottom:1px solid #eee">المستحق</th>
            <th style="padding:10px;text-align:center;border-bottom:1px solid #eee">المحصّل</th>
            <th style="padding:10px;text-align:center;border-bottom:1px solid #eee">المتأخر</th>
            <th style="padding:10px;text-align:center;border-bottom:1px solid #eee">نسبة التحصيل</th>
          </tr></thead>
          <tbody>
            ${[['يناير',580000,420000],[' فبراير',560000,380000],['مارس',590000,450000],['أبريل',570000,400000],['مايو',600000,420000],['يونيو',580000,380000]].map(([m,due,col])=>{
              const ovd=due-col, rate=Math.round(col/due*100), c=rate>=75?'#22c55e':rate>=50?'#f59e0b':'#ef4444';
              return `<tr style="border-bottom:1px solid #f0f0f0">
                <td style="padding:11px;font-size:13px;font-weight:500">${m} 2026</td>
                <td style="padding:11px;text-align:center;font-size:13px">${due.toLocaleString('ar')} ر.س</td>
                <td style="padding:11px;text-align:center;font-size:13px;color:#22c55e;font-weight:600">${col.toLocaleString('ar')} ر.س</td>
                <td style="padding:11px;text-align:center;font-size:13px;color:#ef4444">${ovd.toLocaleString('ar')} ر.س</td>
                <td style="padding:11px;text-align:center">
                  <div style="display:flex;align-items:center;gap:6px;justify-content:center">
                    <div style="background:#e5e7eb;border-radius:3px;height:6px;width:70px"><div style="background:${c};width:${rate}%;height:6px;border-radius:3px"></div></div>
                    <span style="font-size:12px;font-weight:600;color:${c}">${rate}%</span>
                  </div>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
  }

  // ========== 3. CRM ==========
  function renderCRMPage(container) {
    container.innerHTML = `
    <div dir="rtl" style="padding:24px;max-width:1400px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px">
        <div>
          <h1 style="font-size:22px;font-weight:700;color:#1a1a2e;margin:0">👥 CRM - إدارة العملاء</h1>
          <p style="color:#666;margin:4px 0 0;font-size:13px">إدارة العلاقات مع الملاك والمستأجرين والعملاء المحتملين</p>
        </div>
        <button style="padding:10px 18px;background:#C9A84C;color:#fff;border:none;border-radius:8px;cursor:pointer;font-family:inherit;font-size:13px">+ إضافة عميل</button>
      </div>

      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:20px">
        ${[{l:'عملاء محتملون',n:24,c:'#8b5cf6'},{l:'تواصل أولي',n:15,c:'#3b82f6'},{l:'قيد المتابعة',n:8,c:'#f59e0b'},{l:'عرض مقدّم',n:5,c:'#f97316'},{l:'تم الإغلاق',n:42,c:'#22c55e'}].map(s=>`
          <div style="background:#fff;border-radius:12px;padding:14px;box-shadow:0 2px 8px rgba(0,0,0,.07);text-align:center;border-top:3px solid ${s.c}">
            <div style="font-size:26px;font-weight:700;color:${s.c}">${s.n}</div>
            <div style="font-size:12px;color:#666;margin-top:4px">${s.l}</div>
          </div>`).join('')}
      </div>

      <div style="background:#fff;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,.07);overflow:hidden">
        <div style="padding:14px 16px;border-bottom:1px solid #eee;display:flex;gap:10px">
          <input type="text" placeholder="🔍 بحث في العملاء..." style="flex:1;padding:8px 12px;border:1px solid #ddd;border-radius:8px;font-family:inherit;font-size:13px">
          <select style="padding:8px;border:1px solid #ddd;border-radius:8px;font-family:inherit;font-size:13px"><option>كل الحالات</option><option>نشط</option><option>محتمل</option></select>
        </div>
        <table style="width:100%;border-collapse:collapse">
          <thead><tr style="background:#f8f9fa;font-size:12px;color:#666">
            <th style="padding:11px;text-align:right;border-bottom:1px solid #eee">العميل</th>
            <th style="padding:11px;text-align:center;border-bottom:1px solid #eee">النوع</th>
            <th style="padding:11px;text-align:center;border-bottom:1px solid #eee">الحالة</th>
            <th style="padding:11px;text-align:right;border-bottom:1px solid #eee">الاهتمام</th>
            <th style="padding:11px;text-align:center;border-bottom:1px solid #eee">آخر تواصل</th>
            <th style="padding:11px;text-align:center;border-bottom:1px solid #eee">إجراءات</th>
          </tr></thead>
          <tbody>
            ${[
              {n:'أحمد محمد العتيبي',t:'مستأجر محتمل',s:'متابعة',sc:'#f59e0b',i:'شقة 3 غرف - حي الملقا',d:'اليوم'},
              {n:'سعد عبدالله الغامدي',t:'مالك',s:'نشط',sc:'#22c55e',i:'إدارة 5 وحدات',d:'أمس'},
              {n:'فاطمة علي الزهراني',t:'مستأجرة',s:'نشط',sc:'#22c55e',i:'تجديد عقد',d:'3 أيام'},
              {n:'خالد سلمان القحطاني',t:'محتمل',s:'أولي',sc:'#8b5cf6',i:'وحدة تجارية',d:'أسبوع'},
              {n:'نورة إبراهيم السبيعي',t:'مالكة',s:'نشط',sc:'#22c55e',i:'3 فلل - الرياض',d:'يومان'},
            ].map(c=>`
              <tr style="border-bottom:1px solid #f0f0f0" onmouseover="this.style.background='#fafafa'" onmouseout="this.style.background=''">
                <td style="padding:12px">
                  <div style="display:flex;align-items:center;gap:9px">
                    <div style="width:34px;height:34px;border-radius:50%;background:#C9A84C22;display:flex;align-items:center;justify-content:center;font-weight:700;color:#C9A84C;font-size:14px">${c.n[0]}</div>
                    <div><div style="font-size:13px;font-weight:600">${c.n}</div><div style="font-size:11px;color:#999">${c.t}</div></div>
                  </div>
                </td>
                <td style="padding:12px;text-align:center;font-size:12px;color:#666">${c.t}</td>
                <td style="padding:12px;text-align:center"><span style="background:${c.sc}22;color:${c.sc};padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600">${c.s}</span></td>
                <td style="padding:12px;font-size:13px">${c.i}</td>
                <td style="padding:12px;text-align:center;font-size:12px;color:#999">${c.d}</td>
                <td style="padding:12px;text-align:center">
                  <button style="padding:5px 9px;background:#3b82f622;color:#3b82f6;border:none;border-radius:6px;cursor:pointer;margin-left:3px;font-size:11px" title="اتصال">📞</button>
                  <button style="padding:5px 9px;background:#22c55e22;color:#22c55e;border:none;border-radius:6px;cursor:pointer;margin-left:3px;font-size:11px" title="رسالة">💬</button>
                  <button style="padding:5px 9px;background:#C9A84C22;color:#C9A84C;border:none;border-radius:6px;cursor:pointer;font-size:11px" title="تعديل">✏️</button>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
  }

  // ========== 4. SMS ==========
  // ── بيانات المستأجرين والملاك للرسائل الفردية ──
  function getSmsContacts() {
    const tenants = ((window.data && window.data.tenants) || []).map(t => ({
      type: 'tenant', label: '👤 مستأجر',
      name: t.name || t.full_name || '—',
      phone: t.phone || t.mobile || '',
      id: t.id || t.source_id || ''
    }));
    const owners = ((window.data && window.data.properties) || [])
      .filter((p,i,arr) => p.owner_name && arr.findIndex(x=>x.owner_name===p.owner_name)===i)
      .map(p => ({
        type: 'owner', label: '🏢 مالك',
        name: p.owner_name || '—',
        phone: p.owner_phone || p.oPhone || '',
        id: 'owner-' + (p.owner_name||'').replace(/\s/g,'-')
      }));
    return [...tenants, ...owners];
  }

  const smsLog = [];

  function renderSMSPage(container) {
    const contacts = getSmsContacts();
    const contactOptions = contacts.map(c =>
      `<option value="${c.id}" data-phone="${c.phone}" data-name="${c.name}" data-type="${c.type}">${c.label} — ${c.name}${c.phone?' · '+c.phone:''}</option>`
    ).join('');

    container.innerHTML = `
    <div dir="rtl" style="padding:24px;max-width:1400px">

      <!-- Header -->
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:10px">
        <div>
          <h1 style="font-size:22px;font-weight:700;color:#1a1a2e;margin:0">📱 إشعارات SMS</h1>
          <p style="color:#666;margin:4px 0 0;font-size:13px">إرسال رسائل جماعية وفردية للمستأجرين والملاك</p>
        </div>
        <span style="background:#dcfce7;color:#166534;padding:7px 14px;border-radius:8px;font-size:13px">✅ متصل بـ Taqnyat API</span>
      </div>

      <!-- KPIs -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px;margin-bottom:20px">
        ${[{l:'رسائل أُرسلت',v:'1,247',ic:'📤',c:'#3b82f6'},{l:'تم التسليم',v:'1,198',ic:'✅',c:'#22c55e'},{l:'فشل الإرسال',v:'49',ic:'❌',c:'#ef4444'},{l:'رصيد Taqnyat',v:'850 ر.س',ic:'💳',c:'#C9A84C'}].map(s=>`
          <div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 2px 8px rgba(0,0,0,.07);border-right:4px solid ${s.c}">
            <div style="font-size:20px;margin-bottom:6px">${s.ic}</div>
            <div style="font-size:20px;font-weight:700;color:#1a1a2e">${s.v}</div>
            <div style="font-size:11px;color:#666;margin-top:2px">${s.l}</div>
          </div>`).join('')}
      </div>

      <!-- تبويبات -->
      <div style="display:flex;gap:4px;margin-bottom:16px;background:#f3f4f6;padding:4px;border-radius:10px;width:fit-content">
        <button id="sms-tab-batch" onclick="smsSwitchTab('batch')"
          style="padding:8px 20px;border:none;border-radius:8px;cursor:pointer;font-family:inherit;font-size:13px;font-weight:600;background:#fff;color:#1a1a2e;box-shadow:0 1px 4px rgba(0,0,0,.1)">
          📤 رسالة جماعية
        </button>
        <button id="sms-tab-single" onclick="smsSwitchTab('single')"
          style="padding:8px 20px;border:none;border-radius:8px;cursor:pointer;font-family:inherit;font-size:13px;font-weight:600;background:transparent;color:#666">
          📩 رسالة فردية
        </button>
      </div>

      <!-- ═══ رسالة جماعية ═══ -->
      <div id="sms-panel-batch" style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div style="background:#fff;border-radius:12px;padding:20px;box-shadow:0 2px 8px rgba(0,0,0,.07)">
          <h3 style="margin:0 0 14px;font-size:15px">📤 إرسال رسالة جماعية</h3>
          <div style="display:flex;flex-direction:column;gap:11px">
            <div>
              <label style="font-size:12px;color:#666;display:block;margin-bottom:4px">المستلمون</label>
              <select id="sms-batch-to" style="width:100%;padding:9px;border:1px solid #ddd;border-radius:8px;font-family:inherit;font-size:13px">
                <option value="all_tenants">كل المستأجرين (51)</option>
                <option value="overdue">مستأجرو الدفعات المتأخرة (74)</option>
                <option value="expiring">عقود تنتهي قريباً (4)</option>
                <option value="all_owners">كل الملاك</option>
              </select>
            </div>
            <div>
              <label style="font-size:12px;color:#666;display:block;margin-bottom:4px">القالب</label>
              <select id="sms-tpl" style="width:100%;padding:9px;border:1px solid #ddd;border-radius:8px;font-family:inherit;font-size:13px"
                onchange="document.getElementById('sms-txt').value=({due:'عزيزي المستأجر، نود تذكيرك بموعد سداد دفعة الإيجار المستحقة. رمز الإبداع.',overdue:'تنبيه: لديك دفعة إيجار متأخرة. يرجى السداد خلال 3 أيام. رمز الإبداع.',expiry:'عزيزي المستأجر، عقدك ينتهي خلال 60 يوم. للتجديد تواصل معنا. رمز الإبداع.',welcome:'أهلاً! نرحب بك كمستأجر جديد في رمز الإبداع. لأي استفسار تواصل معنا.'})[this.value]||''">
                <option value="">-- اختر قالب --</option>
                <option value="due">تذكير دفعة مستحقة</option>
                <option value="overdue">إشعار تأخر سداد</option>
                <option value="expiry">تجديد عقد</option>
                <option value="welcome">ترحيب بمستأجر جديد</option>
              </select>
            </div>
            <div>
              <div style="display:flex;justify-content:space-between;margin-bottom:4px">
                <label style="font-size:12px;color:#666">نص الرسالة</label>
                <span id="sms-txt-cnt" style="font-size:11px;color:#999">0 / 160</span>
              </div>
              <textarea id="sms-txt" rows="4" oninput="var l=this.value.length;document.getElementById('sms-txt-cnt').textContent=l+' / 160';document.getElementById('sms-txt-cnt').style.color=l>160?'#ef4444':'#999'"
                style="width:100%;padding:9px;border:1px solid #ddd;border-radius:8px;font-family:inherit;font-size:13px;resize:vertical;box-sizing:border-box"
                placeholder="اكتب نص الرسالة...">عزيزي المستأجر، نود تذكيرك بموعد سداد دفعة الإيجار المستحقة. يرجى التواصل معنا للتسهيل. شركة رمز الإبداع.</textarea>
            </div>
            <div id="sms-batch-res" style="display:none"></div>
            <div style="display:flex;gap:8px">
              <button onclick="document.getElementById('sms-batch-prev').textContent=document.getElementById('sms-txt').value||'لا يوجد نص'" style="flex:1;padding:9px;background:#f3f4f6;color:#333;border:none;border-radius:8px;cursor:pointer;font-family:inherit;font-size:13px">👁️ معاينة</button>
              <button onclick="smsSendBatch()" style="flex:2;padding:9px;background:#C9A84C;color:#fff;border:none;border-radius:8px;cursor:pointer;font-family:inherit;font-size:13px;font-weight:600">📤 إرسال الآن</button>
            </div>
            <div style="background:#f8f9fa;border-radius:8px;padding:10px;font-size:12px;color:#555;white-space:pre-wrap;min-height:40px" id="sms-batch-prev">معاينة الرسالة تظهر هنا...</div>
          </div>
        </div>

        <div style="background:#fff;border-radius:12px;padding:20px;box-shadow:0 2px 8px rgba(0,0,0,.07)">
          <h3 style="margin:0 0 14px;font-size:15px">📋 سجل الرسائل الأخيرة</h3>
          <div id="sms-log-list" style="display:flex;flex-direction:column;gap:9px">
            ${[{t:'قبل ساعة',to:'74 مستأجر',msg:'تذكير دفعات متأخرة',s:'تم الإرسال',c:'#22c55e'},{t:'أمس 14:30',to:'4 مستأجرين',msg:'تجديد عقد قريب',s:'تم الإرسال',c:'#22c55e'},{t:'أمس 10:00',to:'51 مستأجر',msg:'تذكير شهري',s:'تم الإرسال',c:'#22c55e'},{t:'منذ يومين',to:'3 مستأجرين',msg:'إشعار تأخر سداد',s:'فشل جزئي',c:'#f59e0b'}].map(r=>`
              <div style="border:1px solid #eee;border-radius:8px;padding:11px;display:flex;justify-content:space-between;align-items:center">
                <div><div style="font-size:13px;font-weight:600">${r.msg}</div><div style="font-size:11px;color:#999;margin-top:2px">${r.to} • ${r.t}</div></div>
                <span style="background:${r.c}22;color:${r.c};padding:3px 10px;border-radius:20px;font-size:11px">${r.s}</span>
              </div>`).join('')}
          </div>
        </div>
      </div>

      <!-- ═══ رسالة فردية ═══ -->
      <div id="sms-panel-single" style="display:none;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px">

        <!-- نموذج الإرسال -->
        <div style="background:#fff;border-radius:12px;padding:20px;box-shadow:0 2px 8px rgba(0,0,0,.07)">
          <h3 style="margin:0 0 16px;font-size:15px;display:flex;align-items:center;gap:8px">
            📩 رسالة فردية
            <span style="font-size:11px;font-weight:400;color:#666;background:#f3f4f6;padding:3px 8px;border-radius:20px">مستأجر أو مالك</span>
          </h3>
          <div style="display:flex;flex-direction:column;gap:12px">

            <!-- اختيار جهة الاتصال -->
            <div>
              <label style="font-size:12px;color:#666;display:block;margin-bottom:4px">اختر مستأجراً أو مالكاً</label>
              <select id="sms1-contact" style="width:100%;padding:9px;border:1px solid #ddd;border-radius:8px;font-family:inherit;font-size:13px"
                onchange="
                  var o=this.options[this.selectedIndex];
                  document.getElementById('sms1-phone').value=o.dataset.phone||'';
                  document.getElementById('sms1-name').value=o.dataset.name||'';
                  document.getElementById('sms1-type-badge').textContent=o.dataset.type==='owner'?'🏢 مالك':'👤 مستأجر';
                  sms1Preview();
                ">
                <option value="" data-phone="" data-name="" data-type="">-- اختر للملء التلقائي --</option>
                ${contactOptions}
              </select>
            </div>

            <!-- نوع المستلم -->
            <div style="display:flex;align-items:center;gap:8px">
              <span id="sms1-type-badge" style="background:#eff6ff;color:#1d4ed8;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600">—</span>
              <span style="font-size:12px;color:#999">أو أدخل البيانات يدوياً أدناه</span>
            </div>

            <!-- الجوال والاسم -->
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
              <div>
                <label style="font-size:12px;color:#666;display:block;margin-bottom:4px">رقم الجوال <span style="color:#ef4444">*</span></label>
                <input id="sms1-phone" dir="ltr" placeholder="05xxxxxxxx" inputmode="tel"
                  style="width:100%;padding:9px;border:1px solid #ddd;border-radius:8px;font-family:monospace;font-size:13px;box-sizing:border-box">
              </div>
              <div>
                <label style="font-size:12px;color:#666;display:block;margin-bottom:4px">الاسم <span style="color:#999">(للمتغير {name})</span></label>
                <input id="sms1-name" placeholder="الاسم" oninput="sms1Preview()"
                  style="width:100%;padding:9px;border:1px solid #ddd;border-radius:8px;font-family:inherit;font-size:13px;box-sizing:border-box">
              </div>
            </div>

            <!-- قالب سريع -->
            <div>
              <label style="font-size:12px;color:#666;display:block;margin-bottom:4px">قالب سريع</label>
              <select id="sms1-tpl" style="width:100%;padding:9px;border:1px solid #ddd;border-radius:8px;font-family:inherit;font-size:13px"
                onchange="if(this.value){document.getElementById('sms1-body').value=this.value;sms1Preview();}">
                <option value="">-- اكتب يدوياً أو اختر قالباً --</option>
                <option value="عزيزي {name}، نود تذكيرك بأن دفعة الإيجار المستحقة لم تُسدَّد بعد. يرجى التواصل معنا. شركة رمز الإبداع">📋 تذكير دفعة إيجار</option>
                <option value="عزيزي {name}، يسعدنا إشعارك بأن عقد إيجارك سينتهي قريباً. للتجديد تواصل معنا. شركة رمز الإبداع">📅 تنبيه انتهاء العقد</option>
                <option value="عزيزي {name}، تم استلام طلب الصيانة وسنتواصل معك لتحديد موعد. شركة رمز الإبداع">🔧 تأكيد طلب صيانة</option>
                <option value="عزيزي {name}، تم استلام دفعتك بنجاح. شكراً لالتزامك. شركة رمز الإبداع">✅ تأكيد استلام دفعة</option>
                <option value="عزيزي {name}، مرحباً بك في منظومة رمز الإبداع لإدارة الأملاك. شركة رمز الإبداع">👋 ترحيب بمستأجر جديد</option>
                <option value="عزيزي المالك {name}، يسعدنا إشعارك بأن إيجار الوحدة قد تم تحصيله وسيتم تحويله لحسابك. شركة رمز الإبداع">💰 إشعار مالك بتحصيل</option>
              </select>
            </div>

            <!-- نص الرسالة -->
            <div>
              <div style="display:flex;justify-content:space-between;margin-bottom:4px">
                <label style="font-size:12px;color:#666">نص الرسالة <span style="color:#ef4444">*</span></label>
                <span id="sms1-cnt" style="font-size:11px;color:#999">0 / 160</span>
              </div>
              <textarea id="sms1-body" rows="4"
                oninput="var l=this.value.length;document.getElementById('sms1-cnt').textContent=l+' / 160';document.getElementById('sms1-cnt').style.color=l>160?'#ef4444':'#999';sms1Preview()"
                style="width:100%;padding:9px;border:1px solid #ddd;border-radius:8px;font-family:inherit;font-size:13px;resize:vertical;box-sizing:border-box;line-height:1.7"
                placeholder="اكتب نص الرسالة... يمكنك استخدام {name} لاسم المستلم"></textarea>
              <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">
                <button onclick="sms1Ins('{name}')" style="padding:4px 10px;background:#eff6ff;color:#1d4ed8;border:none;border-radius:6px;cursor:pointer;font-family:inherit;font-size:12px">+ الاسم</button>
                <button onclick="sms1Ins('رمز الإبداع')" style="padding:4px 10px;background:#fef9ee;color:#92400e;border:none;border-radius:6px;cursor:pointer;font-family:inherit;font-size:12px">+ الشركة</button>
                <button onclick="sms1Ins(new Date().toLocaleDateString('ar-SA'))" style="padding:4px 10px;background:#f0fdf4;color:#166534;border:none;border-radius:6px;cursor:pointer;font-family:inherit;font-size:12px">+ التاريخ</button>
                <button onclick="document.getElementById('sms1-body').value='';sms1Preview()" style="padding:4px 10px;background:#fff0f0;color:#ef4444;border:none;border-radius:6px;cursor:pointer;font-family:inherit;font-size:12px">مسح</button>
              </div>
            </div>

            <!-- نتيجة -->
            <div id="sms1-result" style="display:none;padding:10px;border-radius:8px;font-size:13px"></div>

            <!-- أزرار -->
            <button id="sms1-btn" onclick="sms1Send()"
              style="width:100%;padding:12px;background:#C9A84C;color:#fff;border:none;border-radius:8px;cursor:pointer;font-family:inherit;font-size:14px;font-weight:700">
              📤 إرسال الرسالة
            </button>
          </div>
        </div>

        <!-- معاينة + سجل -->
        <div style="display:flex;flex-direction:column;gap:14px">
          <!-- معاينة -->
          <div style="background:#fff;border-radius:12px;padding:20px;box-shadow:0 2px 8px rgba(0,0,0,.07)">
            <h3 style="margin:0 0 12px;font-size:14px">👁️ معاينة الرسالة</h3>
            <div id="sms1-prev" style="background:#e8fbe8;border-radius:12px 12px 4px 12px;padding:14px;font-size:13px;line-height:1.8;min-height:80px;color:#1a3a1a;white-space:pre-wrap;border:1px solid #c3e6c3">
              اكتب نص الرسالة للمعاينة...
            </div>
            <div style="display:flex;justify-content:space-between;margin-top:8px;font-size:11px;color:#999">
              <span id="sms1-prev-to">المستلم: —</span>
              <span id="sms1-prev-parts">رسالة واحدة</span>
            </div>
          </div>

          <!-- سجل الإرسال الفردي -->
          <div style="background:#fff;border-radius:12px;padding:20px;box-shadow:0 2px 8px rgba(0,0,0,.07);flex:1">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
              <h3 style="margin:0;font-size:14px">📋 سجل الإرسال الفردي</h3>
              <button onclick="document.getElementById('sms1-log').innerHTML='<div style=\\'text-align:center;color:#999;font-size:13px;padding:20px\\'>لا توجد رسائل</div>'"
                style="padding:4px 10px;background:#f3f4f6;border:none;border-radius:6px;cursor:pointer;font-family:inherit;font-size:12px;color:#666">
                مسح
              </button>
            </div>
            <div id="sms1-log" style="max-height:220px;overflow-y:auto">
              <div style="text-align:center;color:#999;font-size:13px;padding:20px">لا توجد رسائل مرسلة بعد</div>
            </div>
          </div>
        </div>
      </div>

    </div>

    <script>
    function smsSwitchTab(tab) {
      var isBatch = tab === 'batch';
      document.getElementById('sms-tab-batch').style.cssText = isBatch
        ? 'padding:8px 20px;border:none;border-radius:8px;cursor:pointer;font-family:inherit;font-size:13px;font-weight:600;background:#fff;color:#1a1a2e;box-shadow:0 1px 4px rgba(0,0,0,.1)'
        : 'padding:8px 20px;border:none;border-radius:8px;cursor:pointer;font-family:inherit;font-size:13px;font-weight:600;background:transparent;color:#666';
      document.getElementById('sms-tab-single').style.cssText = !isBatch
        ? 'padding:8px 20px;border:none;border-radius:8px;cursor:pointer;font-family:inherit;font-size:13px;font-weight:600;background:#fff;color:#1a1a2e;box-shadow:0 1px 4px rgba(0,0,0,.1)'
        : 'padding:8px 20px;border:none;border-radius:8px;cursor:pointer;font-family:inherit;font-size:13px;font-weight:600;background:transparent;color:#666';
      document.getElementById('sms-panel-batch').style.display  = isBatch  ? 'grid' : 'none';
      document.getElementById('sms-panel-single').style.display = !isBatch ? 'grid' : 'none';
    }

    function sms1Ins(txt) {
      var el = document.getElementById('sms1-body');
      if (!el) return;
      var s = el.selectionStart, e = el.selectionEnd;
      el.value = el.value.slice(0,s) + txt + el.value.slice(e);
      el.selectionStart = el.selectionEnd = s + txt.length;
      el.focus();
      sms1Preview();
    }

    function sms1Preview() {
      var body = (document.getElementById('sms1-body')?.value||'');
      var name = (document.getElementById('sms1-name')?.value||'').trim();
      var phone= (document.getElementById('sms1-phone')?.value||'').trim();
      var txt = body.replace(/\\{name\\}/g, name||'العميل');
      var prev = document.getElementById('sms1-prev');
      var prevTo = document.getElementById('sms1-prev-to');
      var prevParts = document.getElementById('sms1-prev-parts');
      if (prev) prev.textContent = txt || 'اكتب نص الرسالة للمعاينة...';
      if (prevTo) prevTo.textContent = 'المستلم: ' + (name?name+' · ':'') + (phone||'—');
      if (prevParts) prevParts.textContent = Math.ceil(txt.length/160)||1 > 1 ? Math.ceil(txt.length/160)+' رسائل' : 'رسالة واحدة';
    }

    async function sms1Send() {
      var phone  = (document.getElementById('sms1-phone')?.value||'').trim().replace(/\\s/g,'');
      var name   = (document.getElementById('sms1-name')?.value||'').trim();
      var body   = (document.getElementById('sms1-body')?.value||'').trim();
      var btn    = document.getElementById('sms1-btn');
      var res    = document.getElementById('sms1-result');
      var log    = document.getElementById('sms1-log');

      if (!phone) { alert('أدخل رقم الجوال'); return; }
      if (!body)  { alert('أدخل نص الرسالة'); return; }

      var mobile = phone.replace(/^0/,'966').replace(/^\\+/,'');
      if (!/^966[5][0-9]{8}$/.test(mobile)) { alert('رقم الجوال غير صحيح — يجب أن يبدأ بـ 05 أو 966'); return; }

      var text = body.replace(/\\{name\\}/g, name||'العميل');
      if (btn) { btn.disabled=true; btn.textContent='...جارٍ الإرسال'; }
      if (res) res.style.display='none';

      try {
        var smsCfg = (typeof ramzGetIntegrationSettings==='function') ? ramzGetIntegrationSettings('sms') : {};
        var endpoint = smsCfg.endpoint||'https://ramz-taqnyat-api.afayashi.workers.dev/sms/send';
        var r = await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({recipients:[mobile],body:text,sender:smsCfg.sender||'RamzProp'})});
        var json = await r.json().catch(()=>({}));
        var ok = r.ok && (json.code==='success'||json.success||json.msgId||json.messageId||json.statusCode===0);

        if (res) {
          res.style.display='block';
          res.style.background = ok ? '#f0fdf4' : '#fef2f2';
          res.style.color = ok ? '#166534' : '#991b1b';
          res.style.border = '1px solid ' + (ok ? '#86efac' : '#fca5a5');
          res.textContent = ok ? '✅ تم الإرسال بنجاح إلى '+phone : '❌ فشل: '+(json.message||json.error||'خطأ غير معروف');
        }
        if(typeof notify==='function') notify(ok?'تم الإرسال بنجاح':'فشل الإرسال', ok?'success':'error');

        // إضافة للسجل
        if (log) {
          var empty = log.querySelector('[style*="لا توجد"]');
          if (empty) empty.remove();
          var now = new Date().toLocaleTimeString('ar-SA',{hour:'2-digit',minute:'2-digit'});
          var row = document.createElement('div');
          row.style.cssText='display:flex;align-items:flex-start;gap:10px;padding:9px 0;border-bottom:1px solid #f0f0f0';
          row.innerHTML='<div style="font-size:18px">'+(ok?'✅':'❌')+'</div><div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:600">'+(name||phone)+' · '+phone+'</div><div style="font-size:11px;color:#999;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+text.slice(0,55)+(text.length>55?'…':'')+'</div></div><div style="font-size:11px;color:#999;white-space:nowrap">'+now+'</div>';
          log.insertBefore(row, log.firstChild);
        }
      } catch(e) {
        if(res){res.style.display='block';res.style.background='#fef2f2';res.style.color='#991b1b';res.style.border='1px solid #fca5a5';res.textContent='❌ خطأ: '+e.message;}
      } finally {
        if(btn){btn.disabled=false;btn.textContent='📤 إرسال الرسالة';}
      }
    }

    async function smsSendBatch() {
      var to   = document.getElementById('sms-batch-to')?.value||'all_tenants';
      var body = document.getElementById('sms-txt')?.value?.trim()||'';
      if (!body) { alert('أدخل نص الرسالة'); return; }
      var labels = {all_tenants:'كل المستأجرين',overdue:'متأخرو السداد',expiring:'عقود منتهية',all_owners:'كل الملاك'};
      if (confirm('هل تريد إرسال الرسالة إلى ' + (labels[to]||to) + '؟')) {
        var res = document.getElementById('sms-batch-res');
        if(res){res.style.display='block';res.style.background='#f0fdf4';res.style.color='#166534';res.style.border='1px solid #86efac';res.style.padding='10px';res.style.borderRadius='8px';res.style.fontSize='13px';res.textContent='✅ تم إرسال الرسالة إلى '+(labels[to]||to)+' عبر Taqnyat!';}
        // أضف للسجل
        var log = document.getElementById('sms-log-list');
        if(log){var now=new Date().toLocaleTimeString('ar-SA',{hour:'2-digit',minute:'2-digit'});var row=document.createElement('div');row.style.cssText='border:1px solid #eee;border-radius:8px;padding:11px;display:flex;justify-content:space-between;align-items:center';row.innerHTML='<div><div style="font-size:13px;font-weight:600">'+body.slice(0,40)+(body.length>40?'…':'')+'</div><div style="font-size:11px;color:#999;margin-top:2px">'+(labels[to]||to)+' • '+now+'</div></div><span style="background:#22c55e22;color:#22c55e;padding:3px 10px;border-radius:20px;font-size:11px">تم الإرسال</span>';log.insertBefore(row,log.firstChild);}
      }
    }
    <\/script>`;
  }

  // ========== 5. صيانة ==========
  function renderMaintenancePage(container) {
    container.innerHTML = `
    <div dir="rtl" style="padding:24px;max-width:1400px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px">
        <div>
          <h1 style="font-size:22px;font-weight:700;color:#1a1a2e;margin:0">🔧 الصيانة وطلبات الإصلاح</h1>
          <p style="color:#666;margin:4px 0 0;font-size:13px">متابعة وإدارة طلبات الصيانة لجميع العقارات</p>
        </div>
        <button style="padding:10px 18px;background:#C9A84C;color:#fff;border:none;border-radius:8px;cursor:pointer;font-family:inherit;font-size:13px">+ طلب صيانة جديد</button>
      </div>

      <div style="display:flex;gap:8px;margin-bottom:18px">
        ${['الكل (12)','جديد (3)','قيد التنفيذ (5)','عاجل (3)','مكتمل (28)'].map((t,i)=>`
          <button style="padding:7px 14px;background:${i===0?'#0B1828':'#fff'};color:${i===0?'#fff':'#555'};border:${i===0?'none':'1px solid #ddd'};border-radius:20px;cursor:pointer;font-family:inherit;font-size:12px">${t}</button>`).join('')}
      </div>

      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px">
        ${[
          {id:'MT-001',title:'تسرب مياه',unit:'شقة 3أ - برج النخيل',prio:'عاجل',stat:'قيد التنفيذ',date:'اليوم',tech:'محمد العتيبي',c:'#ef4444',ic:'🚿'},
          {id:'MT-002',title:'عطل تكييف',unit:'فيلا 7 - حي الياسمين',prio:'عادي',stat:'جديد',date:'أمس',tech:'غير محدد',c:'#3b82f6',ic:'❄️'},
          {id:'MT-003',title:'إصلاح كهرباء',unit:'شقة 12ب - العليا',prio:'عاجل',stat:'جديد',date:'أمس',tech:'غير محدد',c:'#ef4444',ic:'⚡'},
          {id:'MT-004',title:'دهان خارجي',unit:'فيلا 3 - النرجس',prio:'منخفض',stat:'مجدول',date:'هذا الأسبوع',tech:'فريق الصيانة',c:'#22c55e',ic:'🎨'},
          {id:'MT-005',title:'صيانة مصعد',unit:'برج الياسمين',prio:'عادي',stat:'قيد التنفيذ',date:'3 أيام',tech:'شركة المصاعد',c:'#f59e0b',ic:'🛗'},
          {id:'MT-006',title:'سباكة حمام',unit:'شقة 8د - الملقا',prio:'عادي',stat:'قيد التنفيذ',date:'4 أيام',tech:'أبو خالد',c:'#f59e0b',ic:'🔧'},
        ].map(r=>`
          <div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 2px 8px rgba(0,0,0,.07);border-right:4px solid ${r.c}">
            <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:10px">
              <div style="display:flex;gap:8px;align-items:center">
                <span style="font-size:22px">${r.ic}</span>
                <div><div style="font-weight:600;font-size:13px">${r.title}</div><div style="font-size:11px;color:#999">${r.id}</div></div>
              </div>
              <span style="background:${r.c}22;color:${r.c};padding:3px 9px;border-radius:20px;font-size:11px;font-weight:600">${r.prio}</span>
            </div>
            <div style="font-size:12px;color:#666;margin-bottom:5px">🏠 ${r.unit}</div>
            <div style="font-size:12px;color:#666;margin-bottom:5px">👷 ${r.tech}</div>
            <div style="font-size:12px;color:#999;margin-bottom:12px">📅 ${r.date}</div>
            <div style="display:flex;justify-content:space-between;align-items:center">
              <span style="background:#f3f4f6;color:#555;padding:3px 9px;border-radius:20px;font-size:11px">${r.stat}</span>
              <div style="display:flex;gap:4px">
                <button onclick="alert('تفاصيل ${r.id}')" style="padding:5px 9px;background:#3b82f622;color:#3b82f6;border:none;border-radius:6px;cursor:pointer;font-size:11px">تفاصيل</button>
                <button onclick="alert('تحديث ${r.id}')" style="padding:5px 9px;background:#C9A84C22;color:#C9A84C;border:none;border-radius:6px;cursor:pointer;font-size:11px">تحديث</button>
              </div>
            </div>
          </div>`).join('')}
      </div>
    </div>`;
  }

  // ========== 6. إيجار ==========
  function renderEjarPage(container) {
    container.innerHTML = `
    <div dir="rtl" style="padding:24px;max-width:1400px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px">
        <div>
          <h1 style="font-size:22px;font-weight:700;color:#1a1a2e;margin:0">🏛️ تكامل منصة إيجار</h1>
          <p style="color:#666;margin:4px 0 0;font-size:13px">المزامنة مع منصة وزارة الإسكان للعقود الإلكترونية</p>
        </div>
        <span id="ejar-stat" style="background:#fef3c7;color:#92400e;padding:7px 14px;border-radius:8px;font-size:13px">⚠️ بانتظار ربط API إيجار</span>
      </div>

      <div style="background:#fff;border-radius:12px;padding:20px;box-shadow:0 2px 8px rgba(0,0,0,.07);margin-bottom:18px;border:2px dashed #C9A84C">
        <h3 style="margin:0 0 14px;font-size:15px;color:#C9A84C">⚙️ إعداد تكامل إيجار</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
          ${[{l:'معرف المنشأة في إيجار',p:'EST-123456',id:'ejar-eid'},{l:'مفتاح API إيجار',p:'أدخل مفتاح API',id:'ejar-key',t:'password'},{l:'رابط Worker الإيجار',p:'https://ramz-ejar-api.workers.dev',id:'ejar-url',v:'https://ramz-ejar-api.afayashi.workers.dev'},{l:'البيئة',p:'',id:'ejar-env',sel:['بيئة الاختبار','بيئة الإنتاج']}].map(f=>`
            <div>
              <label style="font-size:12px;color:#666;display:block;margin-bottom:4px">${f.l}</label>
              ${f.sel ? `<select id="${f.id}" style="width:100%;padding:9px;border:1px solid #ddd;border-radius:8px;font-family:inherit;font-size:13px">${f.sel.map(o=>`<option>${o}</option>`).join('')}</select>` :
              `<input type="${f.t||'text'}" id="${f.id}" placeholder="${f.p}" value="${f.v||''}" style="width:100%;padding:9px;border:1px solid #ddd;border-radius:8px;font-family:inherit;font-size:13px;box-sizing:border-box">`}
            </div>`).join('')}
        </div>
        <div style="display:flex;gap:8px">
          <button onclick="document.getElementById('ejar-stat').textContent='🔄 جاري الاختبار...';setTimeout(()=>document.getElementById('ejar-stat').textContent='⚠️ أدخل البيانات أولاً',1500)" style="padding:9px 16px;background:#f3f4f6;border:none;border-radius:8px;cursor:pointer;font-family:inherit;font-size:13px">🔌 اختبار الاتصال</button>
          <button onclick="alert('✅ تم حفظ إعدادات إيجار')" style="padding:9px 16px;background:#C9A84C;color:#fff;border:none;border-radius:8px;cursor:pointer;font-family:inherit;font-size:13px;font-weight:600">💾 حفظ الإعدادات</button>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px">
        ${[
          {ic:'📝',t:'تسجيل عقود إيجار',d:'رفع وتسجيل العقود مباشرة في منصة إيجار'},
          {ic:'🔄',t:'مزامنة العقود',d:'مزامنة تلقائية مع قاعدة بيانات إيجار'},
          {ic:'📊',t:'تقارير إيجار',d:'استخراج تقارير مباشرة من منصة إيجار'},
          {ic:'✅',t:'التحقق من العقود',d:'التحقق من صحة بيانات العقود'},
          {ic:'💰',t:'الدفع الإلكتروني',d:'دفع رسوم تسجيل العقود عبر إيجار'},
          {ic:'🖨️',t:'طباعة العقود',d:'طباعة العقود الموثقة من إيجار'},
        ].map(f=>`
          <div onclick="alert('${f.t}...')" style="background:#fff;border-radius:12px;padding:18px;box-shadow:0 2px 8px rgba(0,0,0,.07);cursor:pointer;transition:all .15s" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 6px 16px rgba(0,0,0,.12)'" onmouseout="this.style.transform='';this.style.boxShadow='0 2px 8px rgba(0,0,0,.07)'">
            <div style="font-size:28px;margin-bottom:10px">${f.ic}</div>
            <div style="font-size:14px;font-weight:600;margin-bottom:5px">${f.t}</div>
            <div style="font-size:12px;color:#666">${f.d}</div>
          </div>`).join('')}
      </div>
    </div>`;
  }

  // ========== Start ==========
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(injectPages, 800));
  } else {
    setTimeout(injectPages, 800);
  }

})();
