# eFootball Player Database starter

A static HTML/CSS/JS catalogue backed by Supabase Postgres, plus a local Python CSV importer.

## 1. Create the Supabase database

1. Create a Supabase project.
2. Open **SQL Editor** in the project dashboard.
3. Paste and run `sql/schema.sql`.
4. In **Project Settings / API Keys**, copy the Project URL and **publishable** key.

The SQL enables Row Level Security and grants the public read-only access to the player catalogue.

## 2. Configure the website

1. Copy `config.example.js` to `config.js`.
2. Put your Supabase Project URL and publishable key in `config.js`.
3. Upload `index.html`, `styles.css`, `app.js`, and `config.js` to your GitHub Pages repository.
4. Open the website.

`config.js` is public. It must contain only the publishable key, never a secret/service_role key.

## 3. Import an authorized CSV

The source website's public visibility does not automatically grant permission to bulk-copy or republish its database. Use a dataset/export you are authorized to use, or obtain permission from the data owner. This project deliberately does not scrape eFootballDB or bypass its controls.

1. Install Python 3.10+.
2. Open a terminal in the `importer` folder.
3. Run: `pip install -r requirements.txt`
4. Copy `.env.example` to `.env`.
5. Add your Supabase URL and **secret key** to `.env`. Keep this file private and out of GitHub.
6. Prepare a CSV with the columns in `authorized_players_template.csv`.
7. Run: `python import_players.py path/to/your_authorized_players.csv`

The importer upserts records by external IDs, so re-importing updated data will update existing records rather than duplicate them.

## 4. Notes

- One `players` row represents a footballer; one `player_cards` row represents a card/version.
- The website currently searches player name, position and minimum overall rating.
- The current frontend is read-only. Account listings, user login, seller dashboards and listing moderation should be added separately.
- Use original/licensed images and data. The starter stores no player photos.
- Do not expose the Supabase secret key in browser JavaScript, HTML, CSS or a public repository.
