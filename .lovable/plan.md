# إصلاح خطأ "type app_role does not exist" في ملف SQL

## سبب المشكلة
في ملف `public/full-migration.sql` يوجد في السطر 31 أمر:
```sql
SELECT pg_catalog.set_config('search_path', '', false);
```
هذا الأمر (القادم من نسخة pg_dump) يُفرغ `search_path` لكامل الجلسة. جزء الـ dump يعمل لأنه يكتب الأسماء بشكل كامل (`public.app_role`)، لكن باقي الترحيلات (migrations) تستخدم أسماء مختصرة مثل `'admin'::app_role` و`has_role(...)`. مع `search_path` الفارغ لا يستطيع Postgres إيجاد النوع → الخطأ `type "app_role" does not exist` (يوجد أكثر من 70 موضعًا متأثرًا).

## الإصلاح (سطر واحد)
تعديل السطر 31 في `public/full-migration.sql` ليصبح:
```sql
SELECT pg_catalog.set_config('search_path', 'public, extensions', false);
```
هذا لا يؤثر على جزء الـ dump (لأنه مؤهَّل بالكامل)، ويجعل كل الأسماء المختصرة في الترحيلات اللاحقة تُحَل بشكل صحيح.

## الخطوات
1. أعدّل ملف `public/full-migration.sql` (السطر 31 فقط).
2. تفتح الرابط من جديد:
   `https://id-preview--0f98331b-af49-49fe-995a-5a4a4bd68342.lovable.app/full-migration.sql`
   (اضغط تحديث/Refresh لتحصل على النسخة الجديدة)، انسخ كل المحتوى.
3. **مهم:** قبل اللصق، شغّل هذا في الـ SQL Editor لمسح أي بقايا من المحاولة الفاشلة (اختياري لكن مُستحسن):
   ```sql
   DROP SCHEMA public CASCADE; CREATE SCHEMA public;
   ```
   (يحذف كل ما تم إنشاؤه جزئيًا ويبدأ من نظيف — آمن لأن قاعدة البيانات فارغة).
4. الصق ملف SQL الجديد واضغط **Run**.
5. إن ظهر أي خطأ آخر، أرسله لي وسأصلحه.

## بعد نجاح قاعدة البيانات
ننتقل لرفع الـ 53 دالة طرفية وضبط الأسرار — وهذا يحتاج منك: Supabase Access Token + كلمة مرور قاعدة البيانات + مفتاح service_role.
