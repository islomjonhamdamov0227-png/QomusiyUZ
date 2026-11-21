# QomusiyAPP — Raqamli Kutubxona va Reliz Platformasi

## Fayllar tuzilmasi
- `index.html` — Asosiy sahifa, o'quvchi modal, Sign In / Register modal
- `style.css` — Zamonaviy qorong'i interfeys, statistika, filtrlar va responsiv dizayn
- `app.js` — Supabase Auth, Storage, PostgreSQL CRUD, qidiruv/filtr va PWA o'rnatish mantiqi
- `manifest.json` — PWA manifest sozlamalari
- `service-worker.js` — Statik resurslarni keshlash
- `supabase_setup.sql` — `books` jadvali va `pdfs` storage bucket RLS sozlamalari

## Ishga tushirish bosqichlari
1. Supabase loyihasida `supabase_setup.sql` kodini SQL Editor orqali bajaring.
2. `app.js` ichidagi `SUPABASE_URL` va `SUPABASE_ANON_KEY` qiymatlarini o'z loyihangiz kalitlariga almashtiring.
3. `icons/` papkasiga `icon-192.png` va `icon-512.png` fayllarini joylang.
4. Loyihani Vercel'ga yuklang va foydalanishni boshlang.
