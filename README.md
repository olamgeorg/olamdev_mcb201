# OlamDev MCB201 Quiz (olamdev_mcb201)

Microbiology 201 - Microbiology. An installable quiz PWA with student login, Supabase score tracking and an admin dashboard.
Plain HTML + CSS + JavaScript. **No npm, no build step.** 487 questions, all taken only from the lecturer notes.

## Files
```
olamdev_mcb201/
  index.html  style.css  app.js  questions.js  supabase-config.js
  admin.html  admin.js  manifest.json  sw.js
  api/config.js     <- gives your Supabase keys to the app from Vercel (keys never sit in GitHub)
  vercel.json  schema.sql  .gitignore  README.md
  config.local.js   <- ONLY for testing on your PC. NEVER upload it (see below)
```

## 1. Create the Supabase project
1. Go to https://supabase.com and sign in (GitHub login is fine).
2. Click **New project**, choose a name (e.g. `olamdev-mcb201`), set a database password, pick the nearest region, click **Create**. Wait 1-2 minutes.
3. **Turn off email confirmation (easier for students):** Authentication > Sign In / Providers > Email > switch **Confirm email** OFF > Save. (If you keep it ON, students must click the link in their email before logging in.)

## 2. Run the SQL
1. Open `schema.sql` in any text editor.
2. Near the top, replace `YOUR_ADMIN_EMAIL@example.com` with **your own admin email**.
3. In Supabase click **SQL Editor > New query**, paste the whole file, click **Run**. You should see "Success".
4. This creates `profiles`, `results`, security rules, and the admin functions.

## 3. Where to copy the keys
Supabase > **Project Settings > API** (or **API Keys**):
- **Project URL** -> this is `SUPABASE_URL`
- **anon / publishable key** (starts with `sb_publishable_...` or `eyJ...`) -> this is `SUPABASE_ANON_KEY`

Never use the `service_role` / secret key anywhere in this app.

## 4. Test on your computer (optional)
`config.local.js` is already filled with your URL and publishable key, so double-clicking `index.html` works.
(Offline/installing PWA features need https, so they work on Vercel.)

## 5. Upload to GitHub
1. https://github.com > **New repository** > name `olamdev_mcb201` > Create.
2. Click **uploading an existing file**, drag in ALL files and the `api` folder from the project.
3. **Do NOT upload `config.local.js`** (delete it from the upload list). Click **Commit changes**.

## 6. Deploy on Vercel
1. https://vercel.com > sign in with GitHub > **Add New > Project** > import `olamdev_mcb201`.
2. Framework Preset: **Other**. Leave Build Command and Output Directory empty. Do not click Deploy yet.
3. Open **Environment Variables** and add:
   - `SUPABASE_URL` = your Project URL
   - `SUPABASE_ANON_KEY` = your anon/publishable key
4. Click **Deploy**. When done, open your link, e.g. `https://olamdev-mcb201.vercel.app`.
5. If you add the variables after deploying: Vercel > Settings > Environment Variables, then Deployments > ... > **Redeploy**.

## 7. Make yourself Admin
1. Open your live site, click **Sign Up** with the **same email you put in schema.sql**, set a password.
2. A shield icon appears in the top bar - tap it, or go to `/admin.html`. Only that email can see data there.
3. Admin can: see totals, all students, all scores, search, filter by topic/mode/date, weak vs strong topics (per student and overall), delete students/scores, export CSV.
   (If you signed up before running the SQL, run it again - it back-fills your profile.)

## 8. Share with students
Send the Vercel link on WhatsApp. On Android Chrome: menu > **Install app**. On iPhone Safari: Share > **Add to Home Screen**.

## Quiz rules built in
- **Practice:** instant answer + explanation, no timer.
- **Exam:** answers only at the end; countdown = 60 s x number of questions; pause button; auto-submit at 0.
- **Timed:** 60 s per question; auto-moves to the next at 0; auto-submits on the last.
- Pass mark 50%. Grades: A 70+, B 60-69, C 50-59, D 45-49, F below 45.
- Scores save to Supabase and the phone. If offline, they save on the phone and sync later.
- "Clear History" only clears the student's own phone; the lecturer's records stay in Supabase.

## Updating questions or the app
After changing files on GitHub, change `CACHE = 'olamdev-mcb201-v1'` in `sw.js` to `v2` so phones fetch the new version.
