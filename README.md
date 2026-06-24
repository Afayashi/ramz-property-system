# Ramz Property System

منصة إدارة عقارات سحابية لشركة رمز الإبداع لإدارة الأملاك.

## المكونات

- `cloudflare-pages-deploy/`: واجهة النظام المنشورة على Cloudflare Pages مع Functions الخاصة بالتكاملات.
- `ramz-taqnyat-api/`: Worker مستقل لتكامل الرسائل النصية، إدارة المستخدمين، وتخزين D1.
- `tests/`: اختبارات تحقق للصفحات والتكاملات المهمة.

## النشر

نشر الواجهة:

```powershell
cd cloudflare-pages-deploy
wrangler pages deploy . --project-name ramz-property-system --branch main
```

نشر Worker الرسائل:

```powershell
cd ramz-taqnyat-api
wrangler deploy
```

## المتغيرات السرية

لا تحفظ الأسرار داخل GitHub. اضبطها من Cloudflare Dashboard أو باستخدام `wrangler secret put`:

- `TAQNYAT_API_KEY`
- `RAMZ_ENTERPRISE_SECRET`
- `JWT_SECRET`
- `ZATCA_CSID`
- `ZATCA_SECRET`
- أي مفاتيح بريد أو تكاملات خارجية أخرى

## قاعدة البيانات

- مخطط النظام الرئيسي موجود في `cloudflare-pages-deploy/assets/`.
- مخططات Worker موجودة في `ramz-taqnyat-api/migrations/`.

## ملاحظات الأمان

- المستودع يفضل أن يكون خاصاً لأنه يحتوي على منطق تكاملات النظام ومخططات قاعدة البيانات.
- مفاتيح Supabase العامة المستخدمة في الواجهة ليست بديلاً عن صلاحيات الخادم، ولا يجب إضافة مفاتيح service role إلى الملفات.
