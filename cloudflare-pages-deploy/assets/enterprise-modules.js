(function(){
'use strict';

var STORE_KEY='ramz_enterprise_store_v1';
var USERS_KEY='ramz_system_users_v2';
var AUDIT_KEY='ramz_audit_log_v2';
var SESSION_KEY='ramz_admin_session_v1';
var QUEUE_KEY='ramz_sync_queue_v2';
var cloudReady=false;

function read(key,fallback){try{var v=JSON.parse(localStorage.getItem(key)||'null');return v==null?fallback:v;}catch(e){return fallback;}}
function write(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true;}catch(e){return false;}}
function esc(v){return typeof window.ramzEsc==='function'?window.ramzEsc(v):String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function money(v){return typeof window.ramzMoney==='function'?window.ramzMoney(Number(v||0)):Number(v||0).toLocaleString('ar-SA')+' ر.س';}
function now(){return new Date().toISOString();}
function today(){return now().slice(0,10);}
function uid(prefix){return (prefix||'rec')+'-'+Date.now()+'-'+Math.random().toString(36).slice(2,7);}
function currentSession(){return read(SESSION_KEY,{})||{};}
function notify(msg,type){if(typeof window.toast==='function')window.toast(msg,type||'info');}
async function serverApi(action,payload){try{var r=await fetch('/api/enterprise',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(Object.assign({action:action},payload||{}))});var j=await r.json().catch(function(){return {};});return {ok:r.ok,status:r.status,data:j};}catch(e){return {ok:false,status:0,data:{error:String(e)}};}}

var roleLabels={admin:'مدير النظام',manager:'مدير أملاك',finance:'محاسب',operations:'تشغيل وصيانة',viewer:'مراقب',owner:'مالك',tenant:'مستأجر'};
var rolePermissions={
 admin:['*'],
 manager:['dashboard','properties','owners','lessors-dashboard','tenants','contracts','finance','expenses','accounting','maintenance','inspections','reports','property-report','crm','owners-union','owner-settlements','bank-reconciliation','document-center','contract-lifecycle','procurement','legal-cases','utilities','insurance','service-portals','leasing','zatca','calendar','notifications'],
 finance:['dashboard','properties','owners','lessors-dashboard','tenants','contracts','finance','expenses','accounting','reports','owner-settlements','bank-reconciliation','zatca','calendar','notifications'],
 operations:['dashboard','properties','owners','tenants','contracts','maintenance','inspections','procurement','document-center','utilities','insurance','calendar','notifications'],
 viewer:['dashboard','properties','owners','lessors-dashboard','tenants','contracts','reports','property-report','calendar','notifications'],
 owner:['dashboard','service-portals','owner-settlements','document-center','maintenance','notifications'],
 tenant:['dashboard','service-portals','finance','maintenance','notifications']
};

function users(){
 var list=read(USERS_KEY,[]);
 if(!Array.isArray(list)||!list.length){
  list=[{id:'usr-admin',name:'علي عياشي',username:'AliAyashi',email:'info@ramzabdae.com',role:'admin',status:'active',created_at:now()}];
  write(USERS_KEY,list);
 }
 return list;
}
function saveUsers(list){write(USERS_KEY,list);}
function currentUser(){var s=currentSession();return users().find(function(u){return u.id===s.userId||u.username===s.user;})||{};}
function can(page){var u=currentUser(),allowed=rolePermissions[u.role||'viewer']||[];return allowed.includes('*')||allowed.includes(page);}

window.ramzSecuritySessionValid=function(){
 var s=currentSession();if(!s.user||Date.now()-Number(s.at||0)>1000*60*60*10)return false;
 var u=users().find(function(x){return x.username===s.user&&x.status!=='inactive';});return !!u;
};
window.ramzSecureLogin=async function(ev){
  ev.preventDefault();var username=(document.getElementById('auth-user')?.value||'').trim();var password=document.getElementById('auth-pass')?.value||'';
  var err=document.getElementById('auth-error'),ok=document.getElementById('auth-ok');if(err)err.classList.remove('show');if(ok)ok.classList.remove('show');
  var btn=document.querySelector('#auth-form .btn.pr');if(btn){btn.disabled=true;btn.textContent='...جارٍ التحقق';}
  try{
    // 1) Try local admin hash first (offline / no DB)
    var ADMIN_HASH='d69b89e4da4de53845092771cb2a7c3643cacf73e60acad72eaacf05b80102ed';
    var ADMIN_USER='AliAyashi';
    async function sha256(t){var b=new TextEncoder().encode(t);var h=await crypto.subtle.digest('SHA-256',b);return Array.from(new Uint8Array(h)).map(function(x){return x.toString(16).padStart(2,'0');}).join('');}
    var hash=await sha256(password);
    if(username===ADMIN_USER&&hash===ADMIN_HASH){
      var u={username:ADMIN_USER,id:'usr-admin',name:'علي العياشي',role:'admin'};
      write(SESSION_KEY,{user:u.username,userId:u.id,name:u.name,role:u.role,at:Date.now()});
      ramzSetAuthState(true);ramzBootAfterAuth();applyAccess();
      loadCloud().catch(function(){});
      notify('تم تسجيل الدخول بصلاحية المدير','success');
      return;
    }
    // 2) Try server login
    var auth=await serverApi('login',{username:username,password:password}),u=auth.data&&auth.data.user;
    if(auth.ok&&u){
      write(SESSION_KEY,{user:u.username,userId:u.id,name:u.name,role:u.role,at:Date.now()});
      ramzSetAuthState(true);ramzBootAfterAuth();applyAccess();await loadCloud();
      if(read(QUEUE_KEY,[]).length)window.ramzSyncQueue();
      audit('login','تسجيل دخول',u.username);
      notify('تم تسجيل الدخول بصلاحية '+(roleLabels[u.role]||u.role),'success');
      return;
    }
    if(err){err.textContent='بيانات الدخول غير صحيحة. تحقق من اسم المستخدم وكلمة المرور.';err.classList.add('show');}
  }catch(e){if(err){err.textContent='حدث خطأ أثناء التحقق، حاول مجدداً.';err.classList.add('show');}}
  finally{if(btn){btn.disabled=false;btn.textContent='دخول ›';}}
};
window.ramzSecurityLogout=function(){audit('logout','تسجيل خروج','');serverApi('logout');localStorage.removeItem(SESSION_KEY);ramzSetAuthState(false);};

function audit(action,title,details,entity,entityId){
 var s=currentSession(),row={id:uid('audit'),action:action,title:title,details:String(details||''),entity:entity||'',entity_id:entityId||'',user_id:s.userId||'',user_name:s.name||s.user||'النظام',created_at:now()};
 var logs=read(AUDIT_KEY,[]);logs.unshift(row);write(AUDIT_KEY,logs.slice(0,1000));
 serverApi('audit',{record:{source_id:row.id,action:row.action,title:row.title,details:row.details,entity:row.entity,entity_id:row.entity_id,user_id:row.user_id,user_name:row.user_name,created_at:row.created_at}});
 return row;
}
window.ramzAudit=audit;

function store(){var s=read(STORE_KEY,{});return s&&typeof s==='object'?s:{};}
function records(module){var s=store();return Array.isArray(s[module])?s[module]:[];}
function setRecords(module,list){var s=store();s[module]=list;write(STORE_KEY,s);}
function queue(table,payload){var q=read(QUEUE_KEY,[]);q.push({id:uid('q'),table:table,payload:payload,created_at:now()});write(QUEUE_KEY,q.slice(-500));updateSyncBadge();}

async function cloudUpsert(table,payload,queueOnFail){
 if(table==='business_records'){var api=await serverApi('upsert_record',{record:payload});if(api.ok){cloudReady=true;return {saved:true};}if(queueOnFail!==false)queue(table,payload);return {localOnly:true,error:api.data};}
 if(!window.db||!window.isConnected){if(queueOnFail!==false)queue(table,payload);return {localOnly:true};}
 try{var result=await window.db.from(table).upsert(payload,{onConflict:'source_id'});if(result.error)throw result.error;cloudReady=true;return {saved:true};}
 catch(e){if(queueOnFail!==false)queue(table,payload);return {localOnly:true,error:e};}
}
async function saveRecord(module,payload){
 payload=Object.assign({id:uid(module),status:'new',created_at:now()},payload||{});var list=records(module);list.unshift(payload);setRecords(module,list);
 var row={source_id:payload.id,module:module,title:payload.title||payload.name||module,status:payload.status||'new',property_id:payload.property_id||'',unit_id:payload.unit_id||'',contract_id:payload.contract_id||'',owner_id:payload.owner_id||'',tenant_id:payload.tenant_id||'',amount:Number(payload.amount||payload.total||0),due_date:payload.due_date||payload.expiry_date||null,payload:payload,created_by:currentSession().userId||'',created_at:payload.created_at};
 var result=await cloudUpsert('business_records',row,true);audit('create','إنشاء سجل: '+(row.title||module),module,module,payload.id);renderModule(module);notify(result.localOnly?'تم الحفظ محلياً وأضيف إلى طابور المزامنة':'تم الحفظ في قاعدة البيانات','success');return payload;
}
function updateRecord(module,id,patch){var list=records(module),row=list.find(function(x){return x.id===id;});if(!row)return;Object.assign(row,patch,{updated_at:now()});setRecords(module,list);saveBusinessCloud(module,row);audit('update','تحديث سجل',module,module,id);renderModule(module);}
function deleteRecord(module,id){if(!confirm('هل تريد حذف السجل؟'))return;setRecords(module,records(module).filter(function(x){return x.id!==id;}));serverApi('delete_record',{source_id:id});audit('delete','حذف سجل',module,module,id);renderModule(module);}
async function saveBusinessCloud(module,payload){return cloudUpsert('business_records',{source_id:payload.id,module:module,title:payload.title||payload.name||module,status:payload.status||'',property_id:payload.property_id||'',unit_id:payload.unit_id||'',contract_id:payload.contract_id||'',owner_id:payload.owner_id||'',tenant_id:payload.tenant_id||'',amount:Number(payload.amount||payload.total||0),due_date:payload.due_date||payload.expiry_date||null,payload:payload,created_by:currentSession().userId||'',created_at:payload.created_at||now()},true);}

function applyReportSchedule(){
 var saved=records('report-schedule').find(function(x){return x.id==='report-schedule-default';})||records('report-schedule')[0];
 if(!saved)return;
 var frequency=document.getElementById('report-frequency'),channel=document.getElementById('report-channel');
 if(frequency&&saved.frequency)frequency.value=saved.frequency;
 if(channel&&saved.channel)channel.value=saved.channel;
}
window.ramzLoadReportSchedule=applyReportSchedule;
window.saveReportSchedule=async function(){
 if(!can('reports'))return notify('لا تملك صلاحية تعديل جدولة التقارير','warning');
 var frequency=document.getElementById('report-frequency'),channel=document.getElementById('report-channel');
 if(!frequency||!channel)return notify('تعذر قراءة إعدادات الجدولة','warning');
 var list=records('report-schedule'),previous=list.find(function(x){return x.id==='report-schedule-default';})||{};
 var payload={id:'report-schedule-default',title:'جدولة التقارير',frequency:frequency.value,channel:channel.value,status:'active',created_at:previous.created_at||now(),updated_at:now()};
 setRecords('report-schedule',[payload]);
 var button=document.querySelector('[onclick="saveReportSchedule()"]'),oldText=button&&button.textContent;
 if(button){button.disabled=true;button.textContent='جارٍ الحفظ...';}
 var result=await saveBusinessCloud('report-schedule',payload);
 if(button){button.disabled=false;button.textContent=oldText||'حفظ الجدولة';}
 if(result.localOnly)return notify('تعذر تأكيد الحفظ السحابي، أضيفت العملية إلى طابور المزامنة','warning');
 audit('update','تحديث جدولة التقارير',payload.frequency+' - '+payload.channel,'report-schedule',payload.id);
 notify('تم حفظ جدولة التقارير في قاعدة البيانات','success');
};

var modules={
 'owner-settlements':{label:'تسويات الملاك',desc:'كشوف الحساب وعمولة الإدارة والمبالغ المستحقة والتحويلات',icon:'$',fields:[['owner_id','المالك','owners'],['property_id','العقار','properties'],['period','الفترة','month'],['gross','إجمالي التحصيل','number'],['expenses','المصروفات','number'],['commission','عمولة الإدارة','number'],['amount','صافي المستحق','number'],['status','الحالة','settlementStatus'],['due_date','تاريخ التحويل','date'],['reference','مرجع التحويل','text']],columns:[['owner_id','المالك','ownerName'],['period','الفترة'],['gross','التحصيل','money'],['expenses','المصروفات','money'],['commission','العمولة','money'],['amount','صافي المستحق','money'],['status','الحالة','status'],['due_date','التحويل']]},
 'bank-reconciliation':{label:'المصالحة البنكية',desc:'ربط الإيداعات والحوالات بالفواتير والدفعات',icon:'B',fields:[['title','وصف الحركة','text'],['bank_name','البنك','text'],['reference','مرجع العملية','text'],['amount','المبلغ','number'],['due_date','تاريخ الإيداع','date'],['invoice_number','رقم الفاتورة','payments'],['status','حالة المطابقة','bankStatus']],columns:[['title','الحركة'],['bank_name','البنك'],['reference','المرجع'],['amount','المبلغ','money'],['due_date','التاريخ'],['invoice_number','الفاتورة'],['status','المطابقة','status']]},
 'document-center':{label:'مركز الوثائق',desc:'تصنيف ملفات العقارات والعقود ومتابعة تواريخ الانتهاء',icon:'D',fields:[['title','اسم الوثيقة','text'],['category','التصنيف','documentType'],['property_id','العقار','properties'],['contract_id','العقد','contracts'],['issuer','جهة الإصدار','text'],['document_no','رقم الوثيقة','text'],['issue_date','تاريخ الإصدار','date'],['expiry_date','تاريخ الانتهاء','date'],['file_name','إرفاق الملف','file'],['status','الحالة','documentStatus']],columns:[['title','الوثيقة'],['category','التصنيف'],['property_id','العقار','propertyName'],['document_no','الرقم'],['issuer','الجهة'],['expiry_date','الانتهاء'],['status','الحالة','status']]},
 'contract-lifecycle':{label:'دورة العقود',desc:'التجديد والإنهاء والإخلاء وتسوية مبلغ التأمين',icon:'C',fields:[['title','الإجراء','text'],['contract_id','العقد','contracts'],['process_type','نوع العملية','contractProcess'],['notice_date','تاريخ الإشعار','date'],['due_date','موعد التنفيذ','date'],['deposit_amount','مبلغ التأمين','number'],['refund_amount','المبلغ المسترد','number'],['deductions','الاستقطاعات','number'],['status','الحالة','workflowStatus'],['notes','الملاحظات','textarea']],columns:[['title','الإجراء'],['contract_id','العقد','contractName'],['process_type','النوع'],['notice_date','الإشعار'],['due_date','التنفيذ'],['deposit_amount','التأمين','money'],['refund_amount','المسترد','money'],['status','الحالة','status']]},
 'procurement':{label:'الموردون والمشتريات',desc:'الموردون وعروض الأسعار وأوامر الشراء وقطع الغيار',icon:'P',fields:[['title','الطلب / أمر الشراء','text'],['vendor_name','المورد','text'],['vendor_phone','جوال المورد','text'],['property_id','العقار','properties'],['request_type','النوع','purchaseType'],['quote_count','عدد عروض الأسعار','number'],['amount','القيمة','number'],['due_date','موعد التوريد','date'],['status','الحالة','purchaseStatus'],['items','الأصناف وقطع الغيار','textarea']],columns:[['title','الطلب'],['vendor_name','المورد'],['request_type','النوع'],['property_id','العقار','propertyName'],['quote_count','العروض'],['amount','القيمة','money'],['due_date','التوريد'],['status','الحالة','status']]},
 'legal-cases':{label:'القضايا والمتابعة القانونية',desc:'التعثر والمطالبات والإخلاء ومواعيد الجلسات',icon:'L',fields:[['title','عنوان القضية','text'],['case_number','رقم القضية','text'],['case_type','النوع','legalType'],['tenant_id','المستأجر','tenants'],['contract_id','العقد','contracts'],['amount','المبلغ المطالب به','number'],['due_date','الجلسة القادمة','date'],['lawyer','المحامي / المكتب','text'],['status','الحالة','legalStatus'],['notes','الملاحظات','textarea']],columns:[['title','القضية'],['case_number','الرقم'],['case_type','النوع'],['tenant_id','المستأجر','tenantName'],['amount','المطالبة','money'],['due_date','الجلسة'],['lawyer','المحامي'],['status','الحالة','status']]},
 'utilities':{label:'العدادات والمرافق',desc:'الكهرباء والمياه والخدمات المشتركة وقراءات الاستهلاك',icon:'U',fields:[['title','اسم العداد / المرفق','text'],['utility_type','نوع المرفق','utilityType'],['property_id','العقار','properties'],['unit_id','الوحدة','units'],['meter_number','رقم العداد','text'],['previous_reading','القراءة السابقة','number'],['current_reading','القراءة الحالية','number'],['amount','قيمة الفاتورة','number'],['due_date','تاريخ الاستحقاق','date'],['status','الحالة','utilityStatus']],columns:[['title','العداد'],['utility_type','النوع'],['property_id','العقار','propertyName'],['unit_id','الوحدة','unitName'],['meter_number','رقم العداد'],['current_reading','القراءة'],['amount','الفاتورة','money'],['due_date','الاستحقاق'],['status','الحالة','status']]},
 'insurance':{label:'التأمين والمطالبات',desc:'وثائق تأمين العقارات والوحدات ومتابعة المطالبات',icon:'I',fields:[['title','الوثيقة / المطالبة','text'],['record_type','نوع السجل','insuranceRecord'],['property_id','العقار','properties'],['unit_id','الوحدة','units'],['provider','شركة التأمين','text'],['policy_number','رقم الوثيقة','text'],['coverage_amount','قيمة التغطية','number'],['amount','قيمة المطالبة / القسط','number'],['expiry_date','تاريخ الانتهاء','date'],['status','الحالة','insuranceStatus']],columns:[['title','السجل'],['record_type','النوع'],['provider','شركة التأمين'],['property_id','العقار','propertyName'],['policy_number','الوثيقة'],['coverage_amount','التغطية','money'],['amount','القيمة','money'],['expiry_date','الانتهاء'],['status','الحالة','status']]},
 'service-portals':{label:'بوابات الخدمة الذاتية',desc:'طلبات الملاك والمستأجرين وكشوف الحساب والصيانة والوثائق',icon:'S',fields:[['title','عنوان الطلب','text'],['portal_type','البوابة','portalType'],['request_type','نوع الخدمة','portalRequest'],['owner_id','المالك','owners'],['tenant_id','المستأجر','tenants'],['property_id','العقار','properties'],['contract_id','العقد','contracts'],['due_date','التاريخ المطلوب','date'],['status','الحالة','workflowStatus'],['notes','تفاصيل الطلب','textarea']],columns:[['title','الطلب'],['portal_type','البوابة'],['request_type','الخدمة'],['owner_id','المالك','ownerName'],['tenant_id','المستأجر','tenantName'],['property_id','العقار','propertyName'],['due_date','الموعد'],['status','الحالة','status']]},
 'leasing':{label:'التسويق والتأجير',desc:'الإعلانات وطلبات الاستئجار وفحص المتقدمين والتحويل إلى عقد',icon:'M',fields:[['title','الإعلان / الطلب','text'],['record_type','نوع السجل','leasingType'],['property_id','العقار','properties'],['unit_id','الوحدة','units'],['applicant_name','اسم المتقدم','text'],['applicant_phone','الجوال','text'],['monthly_income','الدخل الشهري','number'],['screening_score','درجة الفحص %','number'],['amount','الإيجار المطلوب','number'],['status','الحالة','leasingStatus']],columns:[['title','السجل'],['record_type','النوع'],['property_id','العقار','propertyName'],['unit_id','الوحدة','unitName'],['applicant_name','المتقدم'],['screening_score','الفحص'],['amount','الإيجار','money'],['status','الحالة','status']]},
 'zatca':{label:'الفوترة الإلكترونية ZATCA',desc:'إعداد الربط، توليد رقم UUID، وإرسال الفواتير الموقعة عبر Worker',icon:'Z',fields:[['title','عنوان الفاتورة','text'],['invoice_number','رقم الفاتورة','text'],['invoice_uuid','UUID','text'],['invoice_hash','بصمة الفاتورة','text'],['amount','الإجمالي','number'],['tax_amount','الضريبة','number'],['invoice_type','نوع الفاتورة','zatcaType'],['due_date','تاريخ الإصدار','date'],['status','حالة الإرسال','zatcaStatus'],['xml','XML موقع / Base64','textarea']],columns:[['invoice_number','الفاتورة'],['invoice_uuid','UUID'],['invoice_type','النوع'],['amount','الإجمالي','money'],['tax_amount','الضريبة','money'],['due_date','الإصدار'],['status','ZATCA','status']]}
};

var optionSets={
 settlementStatus:[['draft','مسودة'],['approved','معتمدة'],['transferred','تم التحويل']],bankStatus:[['unmatched','غير مطابقة'],['matched','مطابقة'],['review','تحتاج مراجعة']],documentType:[['deed','صك ملكية'],['license','رخصة'],['insurance','تأمين'],['contract','عقد'],['certificate','شهادة']],documentStatus:[['valid','سارية'],['expiring','تنتهي قريباً'],['expired','منتهية']],contractProcess:[['renewal','تجديد'],['termination','إنهاء'],['eviction','إخلاء'],['deposit_refund','استرداد تأمين']],workflowStatus:[['new','جديد'],['in_progress','قيد التنفيذ'],['approved','معتمد'],['completed','مكتمل'],['rejected','مرفوض']],purchaseType:[['request','طلب شراء'],['quote','عرض سعر'],['order','أمر شراء'],['part','قطعة غيار'],['vendor','مورد']],purchaseStatus:[['requested','مطلوب'],['quoted','تم التسعير'],['approved','معتمد'],['ordered','تم الطلب'],['received','تم الاستلام']],legalType:[['default','تعثر'],['claim','مطالبة مالية'],['eviction','إخلاء'],['dispute','نزاع عقدي']],legalStatus:[['notice','إنذار'],['filed','مرفوعة'],['hearing','جلسة'],['judgment','حكم'],['closed','مغلقة']],utilityType:[['electricity','كهرباء'],['water','مياه'],['gas','غاز'],['common','خدمات مشتركة'],['internet','اتصالات']],utilityStatus:[['active','نشط'],['due','مستحق'],['paid','مدفوع'],['disconnected','مفصول']],insuranceRecord:[['policy','وثيقة تأمين'],['claim','مطالبة']],insuranceStatus:[['active','سارية'],['pending','قيد المعالجة'],['approved','معتمدة'],['rejected','مرفوضة'],['expired','منتهية']],portalType:[['owner','بوابة المالك'],['tenant','بوابة المستأجر']],portalRequest:[['statement','كشف حساب'],['maintenance','طلب صيانة'],['document','طلب وثيقة'],['payment','إثبات سداد'],['approval','موافقة']],leasingType:[['listing','إعلان'],['application','طلب استئجار'],['screening','فحص متقدم'],['offer','عرض تأجير']],leasingStatus:[['draft','مسودة'],['published','منشور'],['applied','طلب جديد'],['screened','تم الفحص'],['approved','مقبول'],['rejected','مرفوض'],['converted','تم إنشاء عقد']],zatcaType:[['standard','فاتورة ضريبية'],['simplified','فاتورة مبسطة'],['credit','إشعار دائن'],['debit','إشعار مدين']],zatcaStatus:[['draft','مسودة'],['signed','موقعة'],['reported','تم الإبلاغ'],['cleared','تمت الموافقة'],['rejected','مرفوضة']]
};

function coreData(){return window.data||{};}
function optionsFor(type){var d=coreData(),aliases={propertyName:'properties',unitName:'units',contractName:'contracts',tenantName:'tenants',ownerName:'owners'};type=aliases[type]||type;
 if(type==='properties')return (d.properties||[]).map(function(x){return [x.id||x.source_id||x.name,x.name||'عقار'];});
 if(type==='units')return (d.units||[]).map(function(x){var p=(d.properties||[]).find(function(y){return String(y.id||y.source_id)===String(x.property_id||x.real_property_id);});return [x.id||x.source_id,(x.unit_number||x.unit_num||'وحدة')+(p?' — '+p.name:'')];});
 if(type==='contracts')return (d.contracts||[]).map(function(x){return [x.id||x.source_id||x.contract_number,x.contract_number||x.id||'عقد'];});
 if(type==='tenants')return (d.tenants||[]).map(function(x){return [x.id||x.source_id||x.full_name,x.full_name||x.tenant_name||'مستأجر'];});
 if(type==='owners'){var map=new Map();(d.properties||[]).forEach(function(x){var k=x.owner_id||x.owner_name;if(k&&!map.has(k))map.set(k,[k,x.owner_name||'مالك']);});return Array.from(map.values());}
 if(type==='payments')return (d.invoices||[]).map(function(x){return [x.invoice_number||x.id,x.invoice_number||x.id||'فاتورة'];});
 return optionSets[type]||[];
}
function lookup(type,value){var opts=optionsFor(type);var hit=opts.find(function(x){return String(x[0])===String(value);});return hit?hit[1]:value||'—';}
function statusLabel(v){var all=Object.keys(optionSets).reduce(function(a,k){return a.concat(optionSets[k]);},[]),hit=all.find(function(x){return x[0]===v;});return hit?hit[1]:v||'—';}
var workflowSequences={
 'owner-settlements':['draft','approved','transferred'],'bank-reconciliation':['unmatched','review','matched'],
 'contract-lifecycle':['new','in_progress','approved','completed'],'procurement':['requested','quoted','approved','ordered','received'],
 'legal-cases':['notice','filed','hearing','judgment','closed'],'utilities':['active','due','paid'],
 'insurance':['pending','approved','completed'],'service-portals':['new','in_progress','approved','completed'],
 'leasing':['draft','published','applied','screened','approved','converted'],'zatca':['draft','signed','reported','cleared']
};
var moduleRequired={
 'owner-settlements':['owner_id','period'],'bank-reconciliation':['title','amount','due_date'],
 'document-center':['title','category'],'contract-lifecycle':['contract_id','process_type'],
 'procurement':['title','vendor_name'],'legal-cases':['title','case_type'],'utilities':['title','utility_type','property_id'],
 'insurance':['title','provider'],'service-portals':['title','portal_type'],'leasing':['title','record_type'],
 'zatca':['invoice_number','amount']
};
var moduleFilters={};
function normalizeRecord(module,p){var t=today(),exp=p.expiry_date||'';
 if(!p.status&&workflowSequences[module])p.status=workflowSequences[module][0];
 if(module==='owner-settlements')p.amount=Math.max(0,Number(p.gross||0)-Number(p.expenses||0)-Number(p.commission||0));
 if(module==='bank-reconciliation'&&p.invoice_number&&Number(p.amount||0)>0&&p.status==='unmatched')p.status='review';
 if(module==='document-center'&&exp)p.status=exp<t?'expired':(exp<=new Date(Date.now()+30*86400000).toISOString().slice(0,10)?'expiring':'valid');
 if(module==='contract-lifecycle')p.refund_amount=Math.max(0,Number(p.deposit_amount||0)-Number(p.deductions||0));
 if(module==='utilities')p.consumption=Math.max(0,Number(p.current_reading||0)-Number(p.previous_reading||0));
 if(module==='insurance'&&exp&&exp<t)p.status='expired';
 if(module==='leasing'&&Number(p.screening_score||0)>=80&&p.status==='screened')p.status='approved';
 return p;
}
function nextStatus(module,current){var seq=workflowSequences[module]||['new','in_progress','approved','completed'],i=seq.indexOf(current);return seq[Math.min(i<0?0:i+1,seq.length-1)];}
function nextStatusLabel(module,current){var n=nextStatus(module,current);return n===current?'مكتمل':statusLabel(n);}

function fieldHtml(f){var key=f[0],label=f[1],type=f[2],id='ent-'+key;var opts=optionsFor(type);
 if(opts.length)return '<div class="fg"><label class="fl">'+esc(label)+'</label><select class="fi ent-field" data-key="'+esc(key)+'" data-option-type="'+esc(type)+'" id="'+id+'"><option value="">-- اختر --</option>'+opts.map(function(o){return '<option value="'+esc(o[0])+'">'+esc(o[1])+'</option>';}).join('')+'</select></div>';
 if(type==='file')return '<div class="fg"><label class="fl">'+esc(label)+'</label><input class="fi ent-field" data-key="'+esc(key)+'" id="'+id+'" type="file" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"></div>';
 if(type==='textarea')return '<div class="fg" style="grid-column:1/-1"><label class="fl">'+esc(label)+'</label><textarea class="fi ent-field" data-key="'+esc(key)+'" id="'+id+'"></textarea></div>';
 var inputType=['number','date','month','email','tel'].includes(type)?type:'text';return '<div class="fg"><label class="fl">'+esc(label)+'</label><input class="fi ent-field" data-key="'+esc(key)+'" id="'+id+'" type="'+inputType+'"></div>';
}
function cell(row,col){var key=col[0],fmt=col[2],v=row[key];if(fmt==='money')return money(v);if(fmt==='status')return '<span class="b '+(['paid','active','approved','completed','matched','cleared','reported','transferred','valid','received','published','converted'].includes(v)?'bs':(['rejected','expired','disconnected'].includes(v)?'br':'yw'))+'">'+esc(statusLabel(v))+'</span>';if(fmt)return esc(lookup(fmt,v));return esc(v||'—');}
function summary(module,list){var amount=list.reduce(function(s,x){return s+Number(x.amount||x.refund_amount||0);},0),open=list.filter(function(x){return !['completed','closed','paid','matched','transferred','cleared','reported','received','converted'].includes(x.status);}).length,exp=list.filter(function(x){var d=x.expiry_date||x.due_date;return d&&d>=today()&&d<=new Date(Date.now()+30*86400000).toISOString().slice(0,10);}).length;return '<div class="ent-kpis"><div><b>'+list.length+'</b><span>إجمالي السجلات</span></div><div><b>'+open+'</b><span>مفتوح للمتابعة</span></div><div><b>'+money(amount)+'</b><span>إجمالي القيم</span></div><div><b>'+exp+'</b><span>خلال 30 يوماً</span></div></div>';}

function pageHtml(id,cfg){return '<div class="pc ent-page" id="p-'+id+'" style="display:none"><div class="ph"><div class="ph-t"><h2>'+esc(cfg.label)+'</h2><p>'+esc(cfg.desc)+'</p></div><div class="ph-a">'+(id==='zatca'?'<button class="btn" onclick="ramzTestZatca()">اختبار Worker</button>':'')+'<button class="btn" onclick="ramzExportEnterprise(\''+id+'\')">تصدير CSV</button><button class="btn pr" onclick="ramzOpenEnterpriseForm(\''+id+'\')">+ سجل جديد</button></div></div><div id="ent-summary-'+id+'"></div><div class="ent-toolbar"><input class="fi" id="ent-search-'+id+'" placeholder="بحث في '+esc(cfg.label)+'" oninput="ramzFilterEnterprise(\''+id+'\')"><select class="fi" id="ent-status-'+id+'" onchange="ramzFilterEnterprise(\''+id+'\')"><option value="">كل الحالات</option>'+Array.from(new Map(Object.keys(optionSets).reduce(function(a,k){return a.concat(optionSets[k]);},[]).map(function(x){return [x[0],x[1]];})).entries()).map(function(x){return '<option value="'+esc(x[0])+'">'+esc(x[1])+'</option>';}).join('')+'</select></div><div class="card"><div class="ch"><div class="ct">سجل '+esc(cfg.label)+'</div><span class="b bn" id="ent-count-'+id+'">0</span></div><div class="cb0" id="ent-table-'+id+'"></div></div>'+(id==='zatca'?zatcaReadinessHtml():'')+'</div>';}
function zatcaReadinessHtml(){return '<div class="card" style="margin-top:12px"><div class="ch"><div class="ct">جاهزية الربط الفعلي</div></div><div class="cb"><div class="ent-readiness"><div><b>1</b><span>شهادة Compliance CSID</span></div><div><b>2</b><span>Production CSID وSecret داخل Worker</span></div><div><b>3</b><span>توقيع XML وحساب Invoice Hash وQR</span></div><div><b>4</b><span>Clearance أو Reporting عبر API</span></div></div><div class="al i" style="margin-top:10px">لا تحفظ الشهادات أو الأسرار في المتصفح. نقطة الربط الآمنة هي <b>/api/zatca</b> وتعمل بعد إضافة أسرار ZATCA في Cloudflare.</div></div></div>';}

function renderModule(id){var cfg=modules[id];if(!cfg)return;var all=records(id),filter=moduleFilters[id]||{},q=String(filter.q||'').toLowerCase(),list=all.filter(function(row){if(filter.status&&row.status!==filter.status)return false;if(!q)return true;return Object.keys(row).some(function(k){return String(row[k]||'').toLowerCase().includes(q);});});var count=document.getElementById('ent-count-'+id),sum=document.getElementById('ent-summary-'+id),tbl=document.getElementById('ent-table-'+id);if(count)count.textContent=list.length+(list.length!==all.length?' / '+all.length:'');if(sum)sum.innerHTML=summary(id,all);if(!tbl)return;
 var headers=cfg.columns.map(function(c){return c[1];}).concat(['إجراء']);var rows=list.map(function(row){var next=nextStatus(id,row.status);return cfg.columns.map(function(c){return '<td>'+cell(row,c)+'</td>';}).join('')+'<td><div class="ent-actions"><button class="btn sm" onclick="ramzEditEnterprise(\''+id+'\',\''+esc(row.id)+'\')">تعديل</button>'+(next!==row.status?'<button class="btn sm" onclick="ramzAdvanceEnterprise(\''+id+'\',\''+esc(row.id)+'\')">'+esc(nextStatusLabel(id,row.status))+'</button>':'')+'<button class="btn sm rd" onclick="ramzDeleteEnterprise(\''+id+'\',\''+esc(row.id)+'\')" title="حذف">حذف</button></div></td>';});
 tbl.innerHTML='<div class="tbl-wrap"><table class="tbl"><thead><tr>'+headers.map(function(h){return '<th>'+esc(h)+'</th>';}).join('')+'</tr></thead><tbody>'+(rows.length?rows.map(function(r){return '<tr>'+r+'</tr>';}).join(''):'<tr><td colspan="'+headers.length+'" style="text-align:center;padding:28px;color:var(--t3)">لا توجد سجلات بعد</td></tr>')+'</tbody></table></div>';
}

function renderSecurity(){var page=document.getElementById('p-access-control');if(!page)return;var list=users(),logs=read(AUDIT_KEY,[]),q=read(QUEUE_KEY,[]);document.getElementById('sec-users-count').textContent=list.length;document.getElementById('sec-active-count').textContent=list.filter(function(x){return x.status!=='inactive';}).length;document.getElementById('sec-audit-count').textContent=logs.length;document.getElementById('sec-queue-count').textContent=q.length;
 document.getElementById('sec-users-table').innerHTML='<div class="tbl-wrap"><table class="tbl"><thead><tr><th>المستخدم</th><th>اسم الدخول</th><th>البريد</th><th>الدور</th><th>الحالة</th><th>إجراء</th></tr></thead><tbody>'+list.map(function(u){return '<tr><td><b>'+esc(u.name)+'</b></td><td dir="ltr">'+esc(u.username)+'</td><td dir="ltr">'+esc(u.email||'—')+'</td><td>'+esc(roleLabels[u.role]||u.role)+'</td><td><span class="b '+(u.status==='inactive'?'br':'bs')+'">'+(u.status==='inactive'?'موقوف':'نشط')+'</span></td><td><button class="btn sm" onclick="ramzToggleUser(\''+esc(u.id)+'\')">'+(u.status==='inactive'?'تفعيل':'إيقاف')+'</button></td></tr>';}).join('')+'</tbody></table></div>';
 document.getElementById('sec-audit-table').innerHTML='<div class="tbl-wrap"><table class="tbl"><thead><tr><th>الوقت</th><th>المستخدم</th><th>العملية</th><th>التفاصيل</th></tr></thead><tbody>'+logs.slice(0,80).map(function(x){return '<tr><td>'+esc(new Date(x.created_at).toLocaleString('ar-SA'))+'</td><td>'+esc(x.user_name)+'</td><td>'+esc(x.title)+'</td><td>'+esc(x.details||x.entity||'—')+'</td></tr>';}).join('')+'</tbody></table></div>';
 updateSyncBadge();
}
function securityPageHtml(){return '<div class="pc ent-page" id="p-access-control" style="display:none"><div class="ph"><div class="ph-t"><h2>المستخدمون والصلاحيات</h2><p>إدارة الحسابات والأدوار وسجل العمليات وطابور المزامنة</p></div><div class="ph-a"><a class="btn" href="assets/ramz-enterprise-schema.sql" download>مخطط قاعدة البيانات</a><button class="btn" onclick="ramzSyncQueue()">مزامنة الآن</button><button class="btn pr" onclick="ramzOpenUserForm()">+ مستخدم</button></div></div><div class="ent-kpis"><div><b id="sec-users-count">0</b><span>المستخدمون</span></div><div><b id="sec-active-count">0</b><span>الحسابات النشطة</span></div><div><b id="sec-audit-count">0</b><span>عمليات مسجلة</span></div><div><b id="sec-queue-count">0</b><span>بانتظار المزامنة</span></div></div><div class="card" style="margin-bottom:12px"><div class="ch"><div class="ct">الحسابات والأدوار</div></div><div class="cb0" id="sec-users-table"></div></div><div class="card"><div class="ch"><div class="ct">سجل العمليات</div><span class="b yw" id="sec-sync-state">محلي</span></div><div class="cb0" id="sec-audit-table"></div></div></div>';}

function navItem(id,label){return '<div class="ni ent-nav" onclick="nav(\''+id+'\')"><span class="ni-ico ent-letter">'+esc((modules[id]?.icon)||'A')+'</span><span>'+esc(label)+'</span></div>';}
function inject(){
 var foot=document.querySelector('.sb-foot');if(foot&&!document.getElementById('ent-nav-anchor')){var wrap=document.createElement('div');wrap.id='ent-nav-anchor';wrap.innerHTML='<div class="sb-divider"></div><div class="sb-sec">الإدارة المتقدمة</div>'+navItem('access-control','المستخدمون والصلاحيات')+Object.keys(modules).map(function(id){return navItem(id,modules[id].label);}).join('');foot.parentNode.insertBefore(wrap,foot);}
 var mw=document.querySelector('.mw');if(mw&&!document.getElementById('p-access-control')){var holder=document.createElement('div');holder.id='enterprise-pages';holder.innerHTML=securityPageHtml()+Object.keys(modules).map(function(id){return pageHtml(id,modules[id]);}).join('');mw.appendChild(holder);}
 if(!document.getElementById('m-enterprise')){document.body.insertAdjacentHTML('beforeend','<div class="overlay" id="m-enterprise" onclick="if(event.target===this)closeM(\'m-enterprise\')"><div class="modal" style="width:min(850px,calc(100vw - 24px))"><div class="mh"><h3 id="ent-form-title">إضافة سجل</h3><button class="mc" onclick="closeM(\'m-enterprise\')">×</button></div><div class="mb"><div class="g3" id="ent-form-fields"></div></div><div class="mf"><button class="btn" onclick="closeM(\'m-enterprise\')">إلغاء</button><button class="btn pr" onclick="ramzSaveEnterpriseForm()">حفظ</button></div></div></div><div class="overlay" id="m-system-user" onclick="if(event.target===this)closeM(\'m-system-user\')"><div class="modal"><div class="mh"><h3>إضافة مستخدم</h3><button class="mc" onclick="closeM(\'m-system-user\')">×</button></div><div class="mb"><div class="fr"><div class="fg"><label class="fl">الاسم</label><input class="fi" id="sys-name"></div><div class="fg"><label class="fl">اسم الدخول</label><input class="fi" id="sys-username" dir="ltr"></div></div><div class="fr"><div class="fg"><label class="fl">البريد</label><input class="fi" id="sys-email" type="email" dir="ltr"></div><div class="fg"><label class="fl">الدور</label><select class="fi" id="sys-role">'+Object.keys(roleLabels).map(function(k){return '<option value="'+k+'">'+roleLabels[k]+'</option>';}).join('')+'</select></div></div><div class="fg"><label class="fl">كلمة المرور المؤقتة</label><input class="fi" id="sys-password" type="password" dir="ltr"></div></div><div class="mf"><button class="btn" onclick="closeM(\'m-system-user\')">إلغاء</button><button class="btn pr" onclick="ramzSaveSystemUser()">حفظ المستخدم</button></div></div></div>');}
 if(typeof RAMZ_PAGE_LABELS!=='undefined') Object.assign(RAMZ_PAGE_LABELS,Object.keys(modules).reduce(function(a,id){a[id]=modules[id].label;return a;},{'access-control':'المستخدمون والصلاحيات'}));
 injectContextActions();
}

function injectContextActions(){var routes={
 'properties':['document-center','utilities','insurance','leasing'],
 'contracts':['contract-lifecycle','legal-cases','document-center'],
 'finance':['bank-reconciliation','owner-settlements','zatca'],
 'maintenance':['procurement','utilities','insurance'],
 'owners':['owner-settlements','service-portals','document-center'],
 'tenants':['service-portals','legal-cases','leasing']
 };Object.keys(routes).forEach(function(page){var host=document.getElementById('p-'+page);if(!host||host.querySelector('.ent-context'))return;var bar=document.createElement('div');bar.className='ent-context';bar.innerHTML='<span>إجراءات مرتبطة</span>'+routes[page].map(function(id){return '<button class="btn sm" data-ent-page="'+id+'" onclick="nav(\''+id+'\')">'+esc(modules[id].label)+'</button>';}).join('');var ph=host.querySelector('.ph');if(ph&&ph.parentNode)ph.parentNode.insertBefore(bar,ph.nextSibling);else host.insertBefore(bar,host.firstChild);});}

function css(){var s=document.createElement('style');s.textContent='.ent-letter{display:flex;align-items:center;justify-content:center;border:1px solid currentColor;border-radius:5px;font-size:9px;font-weight:800}.ent-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:14px}.ent-kpis>div,.ent-readiness>div{background:var(--sf);border:1px solid var(--br);padding:14px;border-radius:8px}.ent-kpis b{display:block;font-size:20px;color:var(--n);margin-bottom:3px}.ent-kpis span,.ent-readiness span{font-size:11px;color:var(--t3)}.ent-readiness{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.ent-readiness b{display:block;color:var(--g);font-size:18px}.ent-page .tbl{min-width:760px}.ent-toolbar{display:grid;grid-template-columns:minmax(220px,1fr) 220px;gap:8px;margin:0 0 12px}.ent-actions{display:flex;gap:4px;white-space:nowrap}.ent-context{display:flex;align-items:center;gap:7px;flex-wrap:wrap;padding:9px 12px;margin:0 0 12px;background:var(--sf);border:1px solid var(--br);border-radius:8px}.ent-context>span{font-size:11px;font-weight:800;color:var(--t3);margin-left:3px}@media(max-width:760px){.ent-kpis,.ent-readiness{grid-template-columns:repeat(2,1fr)}.ent-page .ph-a{width:100%}.ent-page .ph-a .btn{flex:1}.ent-page .g3,.ent-toolbar{grid-template-columns:1fr}.ent-actions{flex-wrap:wrap}.ent-context{overflow-x:auto;flex-wrap:nowrap}.ent-context .btn{flex:0 0 auto}}';document.head.appendChild(s);}

var activeModule='',activeEditId='';
function wireEnterpriseRelations(id){var prop=document.getElementById('ent-property_id'),unit=document.getElementById('ent-unit_id'),contract=document.getElementById('ent-contract_id'),d=coreData();function refill(){if(unit){var list=(d.units||[]).filter(function(x){return !prop.value||String(x.property_id||x.real_property_id)===String(prop.value);});unit.innerHTML='<option value="">-- اختر --</option>'+list.map(function(x){return '<option value="'+esc(x.id||x.source_id)+'">'+esc(x.unit_number||x.unit_num||'وحدة')+'</option>';}).join('');}if(contract){var allowedUnits=new Set((d.units||[]).filter(function(x){return !prop.value||String(x.property_id||x.real_property_id)===String(prop.value);}).map(function(x){return String(x.id||x.source_id);}));var listC=(d.contracts||[]).filter(function(x){return !prop.value||allowedUnits.has(String(x.unit_id));});contract.innerHTML='<option value="">-- اختر --</option>'+listC.map(function(x){return '<option value="'+esc(x.id||x.source_id||x.contract_number)+'">'+esc(x.contract_number||x.id||'عقد')+'</option>';}).join('');}}if(prop&&(unit||contract)){prop.addEventListener('change',refill);refill();}if(id==='owner-settlements'){var gross=document.getElementById('ent-gross'),expenses=document.getElementById('ent-expenses'),commission=document.getElementById('ent-commission'),net=document.getElementById('ent-amount');var calc=function(){net.value=Math.max(0,Number(gross.value||0)-Number(expenses.value||0)-Number(commission.value||0));};[gross,expenses,commission].forEach(function(x){if(x)x.addEventListener('input',calc);});}}
window.ramzOpenEnterpriseForm=function(id){if(!can(id)){notify('لا تملك صلاحية إضافة سجلات في هذا القسم','warning');return;}var cfg=modules[id];if(!cfg)return;activeModule=id;activeEditId='';document.getElementById('ent-form-title').textContent='إضافة سجل - '+cfg.label;document.getElementById('ent-form-fields').innerHTML=cfg.fields.map(fieldHtml).join('');wireEnterpriseRelations(id);if(id==='zatca'){var uuid=document.getElementById('ent-invoice_uuid');if(uuid)uuid.value=crypto.randomUUID?crypto.randomUUID():uid('uuid');var dt=document.getElementById('ent-due_date');if(dt)dt.value=today();}openM('m-enterprise');};
window.ramzEditEnterprise=function(id,recordId){var cfg=modules[id],row=records(id).find(function(x){return x.id===recordId;});if(!cfg||!row)return;activeModule=id;activeEditId=recordId;document.getElementById('ent-form-title').textContent='تعديل - '+cfg.label;document.getElementById('ent-form-fields').innerHTML=cfg.fields.map(fieldHtml).join('');wireEnterpriseRelations(id);cfg.fields.forEach(function(f){var el=document.getElementById('ent-'+f[0]);if(el&&el.type!=='file')el.value=row[f[0]]==null?'':row[f[0]];});openM('m-enterprise');};
window.ramzSaveEnterpriseForm=function(){var cfg=modules[activeModule];if(!cfg)return;var payload={};document.querySelectorAll('#ent-form-fields .ent-field').forEach(function(el){var old=activeEditId?records(activeModule).find(function(x){return x.id===activeEditId;}):null;payload[el.dataset.key]=el.type==='number'?Number(el.value||0):(el.type==='file'?(el.files&&el.files[0]?el.files[0].name:(old&&old[el.dataset.key]||'')):el.value);});var missing=(moduleRequired[activeModule]||[]).find(function(k){return payload[k]==null||payload[k]==='';});if(missing){var field=cfg.fields.find(function(f){return f[0]===missing;});return notify('الحقل مطلوب: '+(field?field[1]:missing),'warning');}payload=normalizeRecord(activeModule,payload);if(!payload.title&&activeModule!=='zatca')payload.title=cfg.label+' '+new Date().toLocaleDateString('ar-SA');closeM('m-enterprise');if(activeEditId){updateRecord(activeModule,activeEditId,payload);notify('تم تحديث السجل','success');}else saveRecord(activeModule,payload);activeEditId='';};
window.ramzFilterEnterprise=function(id){var q=document.getElementById('ent-search-'+id),s=document.getElementById('ent-status-'+id);moduleFilters[id]={q:q?q.value:'',status:s?s.value:''};renderModule(id);};
window.ramzDeleteEnterprise=deleteRecord;
window.ramzAdvanceEnterprise=function(module,id){var row=records(module).find(function(x){return x.id===id;});if(!row)return;var status=nextStatus(module,row.status);if(status===row.status)return notify('السجل في آخر مرحلة','info');updateRecord(module,id,{status:status});notify('تم تحديث الحالة إلى '+statusLabel(status),'success');};
window.ramzExportEnterprise=function(module){var cfg=modules[module],list=records(module);if(!list.length)return notify('لا توجد بيانات للتصدير','warning');var rows=[cfg.columns.map(function(c){return c[1];})].concat(list.map(function(x){return cfg.columns.map(function(c){return x[c[0]]||'';});}));var csv='\uFEFF'+rows.map(function(r){return r.map(function(v){return '"'+String(v).replace(/"/g,'""')+'"';}).join(',');}).join('\n');var a=document.createElement('a');a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);a.download=module+'.csv';a.click();};

window.ramzOpenUserForm=function(){if(!can('access-control'))return notify('لا تملك صلاحية إدارة المستخدمين','warning');['sys-name','sys-username','sys-email','sys-password'].forEach(function(id){document.getElementById(id).value='';});openM('m-system-user');};
window.ramzSaveSystemUser=async function(){var name=document.getElementById('sys-name').value.trim(),username=document.getElementById('sys-username').value.trim(),password=document.getElementById('sys-password').value,role=document.getElementById('sys-role').value,email=document.getElementById('sys-email').value.trim();if(!name||!username||password.length<8)return notify('أدخل الاسم واسم الدخول وكلمة مرور من 8 أحرف','warning');var list=users();if(list.some(function(x){return x.username.toLowerCase()===username.toLowerCase();}))return notify('اسم الدخول مستخدم بالفعل','warning');var row={id:uid('usr'),source_id:uid('usr'),name:name,username:username,email:email,role:role,status:'active',password:password,created_at:now()},api=await serverApi('create_user',{user:row});if(!api.ok)return notify(api.status===403?'هذه العملية للمدير فقط':'تعذر حفظ المستخدم في الخادم','error');delete row.password;row.id=row.source_id;list.push(row);saveUsers(list);audit('create_user','إنشاء مستخدم',username,'user',row.id);closeM('m-system-user');renderSecurity();notify('تم إنشاء المستخدم في قاعدة البيانات','success');};
window.ramzToggleUser=async function(id){var list=users(),u=list.find(function(x){return x.id===id||x.source_id===id;});if(!u||id==='usr-admin')return notify('لا يمكن إيقاف حساب المدير الأساسي','warning');var api=await serverApi('toggle_user',{source_id:id});if(!api.ok)return notify('تعذر تغيير حالة المستخدم','error');u.status=u.status==='inactive'?'active':'inactive';saveUsers(list);audit('user_status','تغيير حالة مستخدم',u.username,'user',id);renderSecurity();};

function updateSyncBadge(){var q=read(QUEUE_KEY,[]),el=document.getElementById('sec-sync-state');if(el){el.textContent=q.length?(q.length+' بانتظار المزامنة'):(cloudReady?'Supabase متصل':'جاهز');el.className='b '+(q.length?'yw':'bs');}var c=document.getElementById('sec-queue-count');if(c)c.textContent=q.length;}
window.ramzSyncQueue=async function(){var q=read(QUEUE_KEY,[]);if(!q.length)return notify('لا توجد عمليات معلقة','info');var remain=[];for(var i=0;i<q.length;i++){try{var r=q[i].table==='business_records'?await serverApi('upsert_record',{record:q[i].payload}):(window.db&&window.isConnected?await window.db.from(q[i].table).upsert(q[i].payload,{onConflict:'source_id'}):{error:true});if((r.ok===false)||r.error)remain.push(q[i]);}catch(e){remain.push(q[i]);}}write(QUEUE_KEY,remain);updateSyncBadge();notify(remain.length?'بقيت '+remain.length+' عملية بانتظار المزامنة':'اكتملت المزامنة',remain.length?'warning':'success');};

window.ramzTestZatca=async function(){try{var r=await fetch('/api/zatca',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'status'})});var j=await r.json();notify(j.configured?'Worker ZATCA جاهز':'أضف أسرار ZATCA في Cloudflare',j.configured?'success':'warning');}catch(e){notify('تعذر الاتصال بنقطة ZATCA الآمنة','error');}};

var coreTables={properties:'real_properties',units:'real_units',tenants:'tenants',contracts:'real_contracts',invoices:'payments',maintenance_requests:'maintenance_requests',expenses:'expenses',inspections:'inspections'};
var coreAllowed={
 properties:['source_id','name','type','city','district','address','national_address','region','street','postal_code','building_number','additional_number','short_address','deed_number','deed_expiry','total_units','owner_name','owner_id','owner_phone','management_fee_type','management_fee_pct','management_fee_amount','area_sqm','usage'],
 units:['source_id','property_id','property_source_id','prop_name','unit_number','type','floor','area_sqm','rooms','bathrooms','status','monthly_rent','annual_rent'],
 tenants:['source_id','full_name','id_number','nationality','phone','email','employer','monthly_income','tenant_type','rating'],
 contracts:['source_id','contract_number','unit_id','unit_source_id','property_id','property_source_id','tenant_id','tenant_source_id','contract_type','start_date','end_date','monthly_rent','annual_rent','security_deposit','payment_method','ejar_number','status','owner_name','owner_id','tenant_name','unit_num'],
 invoices:['source_id','invoice_number','contract_id','contract_source_id','contract_number','property_id','property_source_id','unit_id','unit_source_id','tenant_id','tenant_source_id','invoice_type','amount','tax_amount','total_amount','paid_amount','remaining_amount','due_date','paid_date','payment_method','payment_reference','status','tenant_name','unit_num'],
 maintenance_requests:['source_id','property_id','unit_id','unit_source_id','title','category','priority','status','technician_name','cost','rating','unit_num','prop_name'],
 expenses:['source_id','property_id','property_source_id','prop_name','title','category','amount','expense_date'],inspections:['source_id','unit_id','unit_source_id','unit_num','prop_name','inspection_type','inspection_date','inspector_name','walls_condition','floors_condition','electrical_condition','plumbing_condition','signed','notes']
};
window.ramzPersistCoreRecord=function(key,rec,label,modal){if(!can(key==='invoices'?'finance':key==='maintenance_requests'?'maintenance':key)){notify('لا تملك صلاحية الإضافة','warning');return;}ramzPush(key,rec);if(modal)closeM(modal);audit('create','إنشاء '+label,key,key,rec.id);var table=coreTables[key];if(table){var payload={};(coreAllowed[key]||[]).forEach(function(k){if(rec[k]!=null&&rec[k]!=='')payload[k]=rec[k];});payload.source_id=rec.source_id||rec.id;cloudUpsert(table,payload,true).then(function(r){notify(r.localOnly?'تم الحفظ محلياً وبانتظار المزامنة':'تم الحفظ في قاعدة البيانات',r.localOnly?'warning':'success');});}else notify('تم الحفظ محلياً','success');};

function applyAccess(){var u=currentUser();document.querySelectorAll('.ni[onclick*="nav("]').forEach(function(el){var m=(el.getAttribute('onclick')||'').match(/nav\('([^']+)'\)/);if(m)el.style.display=can(m[1])?'':'none';});document.querySelectorAll('[data-ent-page]').forEach(function(el){el.style.display=can(el.dataset.entPage)?'':'none';});var info=document.querySelector('.uai p');if(info&&u.name)info.textContent=u.name+' — '+(roleLabels[u.role]||u.role);}
function wrapNav(){if(window.__ramzEnterpriseNav)return;window.__ramzEnterpriseNav=window.nav;window.nav=function(page){if(!can(page)){notify('لا تملك صلاحية الوصول إلى هذه الصفحة','warning');audit('access_denied','رفض وصول',page);return;}window.__ramzEnterpriseNav(page);if(page==='access-control')renderSecurity();else if(modules[page])renderModule(page);if(page!=='dashboard')audit('view','فتح صفحة',page,'page',page);};}

async function loadCloud(){try{var api=await serverApi('load');if(!api.ok)return;var body=api.data||{},s=store();(body.records||[]).forEach(function(x){var p=x.payload||{},m=x.module;if(!m)return;s[m]=s[m]||[];var i=s[m].findIndex(function(y){return y.id===(p.id||x.source_id);});var row=Object.assign({id:x.source_id},p);if(i<0)s[m].push(row);else s[m][i]=row;});write(STORE_KEY,s);if(Array.isArray(body.audit))write(AUDIT_KEY,body.audit.map(function(x){return Object.assign({id:x.source_id},x);}));if(Array.isArray(body.users))saveUsers(body.users.map(function(x){return Object.assign({id:x.source_id},x);}));cloudReady=true;Object.keys(modules).forEach(renderModule);renderSecurity();updateSyncBadge();applyReportSchedule();}catch(e){} }

function init(){css();inject();wrapNav();users();var hasLocalSession=window.ramzSecuritySessionValid();ramzSetAuthState(hasLocalSession);if(hasLocalSession)ramzBootAfterAuth();applyAccess();updateSyncBadge();var requested=window.ramzRequestedPage||new URLSearchParams(location.search).get('page');if(requested&&(requested==='access-control'||modules[requested]))nav(requested);if(hasLocalSession)serverApi('status').then(function(r){if(r.ok&&r.data.user){var u=r.data.user;write(SESSION_KEY,{user:u.username,userId:u.source_id||u.id,name:u.name,role:u.role,at:Date.now()});saveUsers(users().filter(function(x){return x.id!==(u.source_id||u.id);}).concat([Object.assign({id:u.source_id||u.id},u)]));ramzSetAuthState(true);applyAccess();loadCloud();if(read(QUEUE_KEY,[]).length)window.ramzSyncQueue();var tries=0,relations=setInterval(function(){tries++;if((coreData().properties||[]).length||tries>20){clearInterval(relations);Object.keys(modules).forEach(renderModule);}},500);}else if(location.protocol==='https:'&&!/localhost|127\.0\.0\.1/.test(location.hostname)){localStorage.removeItem(SESSION_KEY);ramzSetAuthState(false);}});}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
