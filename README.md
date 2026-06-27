# Study Abroad Gate — Handoff Templates

تسليم للـ backend developer: **قالب واحد (template) من كل نوع صفحة** في الموقع، بدل الـ144 صفحة الستاتيك.
كل قالب هنا = الـ markup + الـ CSS classes النهائية الجاهزة. المطلوب من الـ dynamic side هو حقن البيانات (المتغيّرة) في نفس الـ markup.

> ملاحظة: كل الصفحات هنا منسوخة كما هي من الموقع الحالي، بمساراتها النسبية الأصلية، فبتفتح وتشتغل مباشرة من فولدر `handoff/`.

---

## 1. القوالب الديناميكية (مجموعة صفحات → قالب واحد + بيانات)

| القالب (الملف هنا) | بيغطّي | عدد الصفحات الحيّة | الحقول الديناميكية الأساسية |
|---|---|---|---|
| `index.html` | الصفحة الرئيسية | 1 (+ `ar/index.html`) | إحصائيات، وجهات مميّزة، شهادات، نموذج الأهلية |
| `destination.html` | قائمة الوجهات | 1 | كروت الوجهات (تتولّد من قائمة الدول) |
| `destination-australia.html` | تفاصيل وجهة | **10** (`destination-*.html`) | اسم الدولة، رسوم، تأشيرة، جامعات، ساعات عمل، تصريح ما بعد التخرّج |
| `program.html` | قائمة البرامج | 1 | كروت البرامج + فلترة |
| `program-cs-tum.html` | تفاصيل برنامج (النموذج المعتمد) | **33** (`program-*.html`) | الجامعة، المستوى، المدة، الرسوم، المنح، التأشيرة، تكلفة المعيشة، FAQ، شهادات، جدول مقارنة |
| `university.html` | قائمة الجامعات | 1 | كروت الجامعات |
| `university-tum.html` | تفاصيل جامعة | **31** (`university-*.html`) | الترتيب، البلد، البرامج، الرسوم، القبول |
| `institute-kings.html` | تفاصيل معهد لغة | **9** (`institute-*.html`) | المعهد، الاعتمادات، الفروع، أنواع الكورسات، نموذج الحجز |
| `english-courses.html` | صفحة كورسات الإنجليزية (تبويب 7 وجهات) | 1 | الوجهات، المعاهد |

**ثيمات قالب البرنامج:** الهيرو بيتغيّر حسب المستوى عبر class —
`.prog-hero-masters` (كحلي) / `.prog-hero-bachelors` (ذهبي) / `.prog-hero-phd` (بنفسجي).

---

## 2. الأدوات التفاعلية (كل واحدة قالب مستقل بمنطقها الخاص)

| الملف | الوظيفة |
|---|---|
| `cost-calculator.html` | حاسبة تكلفة الدراسة |
| `academic-matcher.html` | مطابق أكاديمي (يقترح برامج) |
| `english-course-matcher.html` | مطابق كورس إنجليزي (بسعر صرف live) |
| `country-match.html` | مطابقة الدولة |
| `compare-destinations.html` | مقارنة الوجهات |
| `deadlines.html` | مواعيد التقديم |
| `course-search.html` | بحث الكورسات |

---

## 3. صفحات المحتوى الثابت (CMS pages)

`about.html` · `services.html` · `scholarships.html` · `success-stories.html` · `visa-support.html` ·
`ielts-prep.html` · `accommodation-arrival.html` · `faq.html` (أكورديون) · `contact.html` (نموذج) ·
`privacy.html` · `terms.html` · `accessibility.html`

دي صفحات محتوى ثابت — على الأرجح هتتدار كـ CMS pages، الـ layout واحد والمحتوى مختلف.

---

## 4. الأصول المشتركة (Shared assets)

| الملف | الدور |
|---|---|
| `styles.css` | **كل** الـ CSS للموقع (header/footer/كروت/جداول/نماذج). مشترك عبر كل الصفحات. |
| `analytics.js` | تتبّع. |
| `image-slot.js` | عنصر `<image-slot>` — placeholder صور قابل للتعبئة (drag-drop / أو يتحوّل لـ `<img>` ديناميكي). |
| `eligibility-widget.js` | ودجت الأهلية المشترك في الهيرو. |
| `assets/brand/` | الشعارات + الـ favicons. |
| `assets/hero-students.webp` | صورة هيرو/مشاركة. |

**الهيدر والفوتر** موحّدان عبر classes في `styles.css` (`.site-head` / `.site-foot`، كحلي داكن) — يفضّل يبقوا partial/component واحد في الديناميكي.

---

## 5. الصور — `<image-slot>`

كل الصور في الموقع عبارة عن `<image-slot id="فريد" placeholder="...">`. الـ id فريد عبر المشروع كله.
في الديناميكي: استبدلها بـ `<img>` مصدرها من قاعدة البيانات، أو خلّي `image-slot.js` يقرأ الـ src من attribute.

---

## 6. الترجمة / RTL (i18n)

النسخة العربية موجودة كـ **mirror** تحت `ar/` بنفس أسماء الملفات + RTL:
- `ar/index.html` — نموذج الصفحة العربية (مرفق هنا كمرجع للنمط).
- `ar/ar-rtl.css` — تعديلات RTL فوق `styles.css`.
- `ar/ar-forms.js` — منطق النماذج بالعربي.

النمط: نفس الـ markup، `dir="rtl"` + `lang="ar"`، يحمّل `../styles.css` ثم `ar-rtl.css`.
في الديناميكي يُفضّل **locale واحد** (قالب واحد لكل نوع + الترجمة من البيانات) بدل ملفات منفصلة.
كل صفحة فيها `hreflang` + `canonical` للربط بين النسختين.

---

## 7. ملاحظات للـ dynamic build

- **مصدر البيانات:** بيانات الـ33 برنامج والـ31 جامعة مُستخلصة ومنظّمة في ملفات JSON بالمشروع
  (`_program-data.json`, `_university-data.json`, `_university-full-data.json`). تقدر أزوّدك بيها كـ seed لقاعدة البيانات — قوللي.
- **SEO:** كل صفحة فيها `JSON-LD` (Course / FAQPage / Organization) + meta + canonical — حافظ عليها في القوالب.
- **حقول متكررة في قالب البرنامج:** جدول المقارنة، المنح بمصادرها، الـ timeline، تكلفة المعيشة، التأشيرة، الشهادات، الـ FAQ — كلها أقسام قابلة للتكرار (repeatable blocks).
