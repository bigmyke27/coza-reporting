# COZA Department Reports

Attendance, tasks and monthly reporting for COZA departments. It started with **Childcare Guzape** and is built so any department can be added.

- **Free to run:** the website is hosted on GitHub Pages and the data lives in Supabase's free tier.
- **No build step:** plain HTML, CSS and JavaScript. Edit a file, push, and it's live.

## What it does

| | |
|---|---|
| **Service reports** | Sunday, Tuesday, Dominion Hour, Home Training, Evangelism, Departmental Prayer (Sat) and Prayer Call (Sun). Same sections as the Excel template. |
| **One category per name** | Tap a category (Early, Late with permission…), then tap names. A name placed in one category leaves the list, so it can't be picked twice in that section. "Put remaining in…" fills everyone left over in one tap. |
| **WhatsApp export** | "Copy for WhatsApp" produces the report in the template layout (headings, A/B/C lists, NONE, END OF REPORT). |
| **Dashboard** | Monthly attendance by service, attendance mix, who needs attention, top scorecards, member summary (CSV export). |
| **Tasks** | Assign tasks with due dates and tick members off. These feed the **Goals** score. |
| **Monthly scorecards** | The member scorecard (Attendance 15, Souls 30, Evangelism 10, Goals 15, Participation 20), worked out from the reports. Print it or save it as a PDF, one member at a time or all at once. |
| **Two admin levels** | **Department admins** see only their own department. **Global admins** see every department, add departments and approve admins. |

## Going live (about 10 minutes, one time)

Until step 3 is done, the site runs in **demo mode** with made-up sample data saved only in your browser.

### 1. Create the free database
1. Go to [supabase.com](https://supabase.com) and sign up (signing in with GitHub works).
2. **New project**. Name it `coza-reports`, choose a database password and keep it safe, and pick the region nearest to you (e.g. *West EU*).

### 2. Create the tables
1. In the project, open **SQL Editor → New query**.
2. Paste the whole of [`supabase/schema.sql`](supabase/schema.sql) and click **Run**. It should report "Success".

### 3. Connect the website
1. In Supabase: **Project Settings → API**. Copy the **Project URL** and the **anon public** key.
2. Paste both into [`js/config.js`](js/config.js) and push the change. The anon key is meant to be public. The database's security rules decide what each login can see.

### 4. Set up logins
1. In Supabase: **Authentication → URL Configuration** → set **Site URL** to the live site address (e.g. `https://bigmyke27.github.io/coza-reporting/`).
2. Open the site and click **Create an account**. **The first account created becomes the global admin**, so create yours first.
3. Each department head then creates an account on the same page. They will see "Waiting for approval" until you open **Departments & admins**, set them to *Department admin*, pick their department and click **Save**.

> Optional: under **Authentication → Providers → Email**, switch off "Confirm email" if you don't want people to confirm their email before signing in.

### 5. Add members
Open **Members → Import list** and paste the NAME column from the Excel sheet, one name per line. You can also paste `name, instagram, facebook` on each line. Names typed in capitals are tidied to normal case.

## Adding another department
In **Departments & admins → Add department**, enter its name and head, and tick the reports it files. Then approve its admin.

## Changing a report or the scoring
Everything about the reports is in [`js/templates.js`](js/templates.js):
- sections and categories for each report type
- how each category scores (`score.values`) and which pillar it feeds
- scorecard pillar points and the monthly souls target (`SOULS_MONTHLY_TARGET`)

A month is scored only on what was recorded that month. If there was no data for a pillar (for example, no evangelism outing that month), it shows "—" and is left out of the overall %, so nobody loses points for it.

## Running it locally
```bash
python3 -m http.server 8765
```
Then open http://localhost:8765.

## Files
```
index.html            app shell
css/app.css           styles (incl. scorecard + print)
js/app.js             screens and interactions
js/templates.js       report templates + scoring rules
js/scoring.js         scorecard / dashboard calculations
js/store.js           data layer (Supabase or demo)
js/config.js          Supabase keys
supabase/schema.sql   tables + access rules
```
