# Tailor Manager — Starter

یہ project Tailors کے لیے Offline-first PWA ہے۔

## اس version میں

- Google Login
- ہر Google account کا الگ data
- Firestore cloud database
- Offline local cache
- Internet واپس آنے پر Firestore sync
- Customer نمبر 001, 002, 003...
- محفوظ Measurements
- New Order
- Existing Customer سے ناپ auto-fill
- Pending / Complete-Unpaid / Complete-Paid
- Total / Received / Remaining
- Color selection
- Customer history
- JSON Export / Import
- PWA install support

## اہم

`firebase-config.js` میں Firebase Web App کی اپنی config ڈالیں۔

PDF کو database backup کے طور پر استعمال نہ کریں۔ Restore کے لیے JSON بہتر ہے۔ PDF بعد میں receipt/report کے لیے بنایا جا سکتا ہے۔

## Firebase setup

1. Firebase Console میں نیا project بنائیں۔
2. Web App add کریں۔
3. Authentication → Sign-in method → Google enable کریں۔
4. Firestore Database create کریں۔
5. `firebase-config.js` میں Web App config paste کریں۔
6. `firestore.rules` deploy کریں۔
7. اس folder کو GitHub Pages / Netlify / Vercel جیسے HTTPS hosting پر host کریں۔
8. Hosted HTTPS URL سے app کھولیں اور Google Login کریں۔

## اہم data rule

Google Email خود data storage نہیں ہے۔ Google account صرف identity/login دیتا ہے۔ اصل data Firestore میں Firebase UID کے تحت محفوظ ہے۔

## Offline rule

Firestore cache کی وجہ سے app پہلے سے loaded data کے ساتھ offline کام کر سکتی ہے۔ جب Internet واپس آئے تو pending local changes cloud کے ساتھ sync ہوتے ہیں۔

اگر app uninstall کرنے سے پہلے کوئی نئی data ابھی cloud تک sync نہیں ہوئی تھی تو وہ data خطرے میں ہو سکتی ہے۔ اسی لیے Export Backup بھی موجود ہے۔

## Import/Export

Export ایک `.json` backup بناتا ہے۔ دوسرے Tailor کے Google account میں وہ file Import کی جا سکتی ہے۔ Imported customers/orders اس دوسرے account کے اپنے Firestore data میں copy ہو جائیں گے۔

یہ version backup کو append/import کرتا ہے؛ duplicate customer merging کی advanced logic اگلے مرحلے میں شامل کی جا سکتی ہے۔
