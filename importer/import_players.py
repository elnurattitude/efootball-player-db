"""
Import a properly licensed/authorized CSV into Supabase.
Never place the secret key in frontend files or commit .env to GitHub.

CSV columns:
player_external_id,player_name,nationality,position,team_name,
card_external_id,card_type,overall_rating,playing_style
"""
import csv
import os
import sys
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
url = os.getenv("SUPABASE_URL")
secret = os.getenv("SUPABASE_SECRET_KEY")

if not url or not secret:
    raise SystemExit("Missing SUPABASE_URL or SUPABASE_SECRET_KEY in importer/.env")

if len(sys.argv) != 2:
    raise SystemExit("Usage: python import_players.py path/to/authorized_players.csv")

csv_path = Path(sys.argv[1])
if not csv_path.is_file():
    raise SystemExit(f"CSV not found: {csv_path}")

client = create_client(url, secret)
players_by_id = {}
cards_by_id = {}

with csv_path.open("r", encoding="utf-8-sig", newline="") as f:
    reader = csv.DictReader(f)
    required = {
        "player_external_id", "player_name", "nationality", "position",
        "team_name", "card_external_id", "card_type", "overall_rating",
        "playing_style"
    }
    missing = required - set(reader.fieldnames or [])
    if missing:
        raise SystemExit("CSV is missing columns: " + ", ".join(sorted(missing)))

    for line_no, row in enumerate(reader, start=2):
        player_id = (row.get("player_external_id") or "").strip()
        card_id = (row.get("card_external_id") or "").strip()
        name = (row.get("player_name") or "").strip()
        if not player_id or not card_id or not name:
            print(f"Skipping line {line_no}: player ID, card ID and name are required")
            continue

        players_by_id[player_id] = {
            "external_id": player_id,
            "name": name,
            "nationality": (row.get("nationality") or "").strip() or None,
            "position": (row.get("position") or "").strip() or None,
            "team_name": (row.get("team_name") or "").strip() or None,
        }

        rating_text = (row.get("overall_rating") or "").strip()
        try:
            rating = int(rating_text) if rating_text else None
        except ValueError:
            print(f"Skipping line {line_no}: invalid overall_rating")
            continue

        cards_by_id[card_id] = {
            "external_id": card_id,
            "player_external_id": player_id,
            "card_type": (row.get("card_type") or "").strip() or None,
            "overall_rating": rating,
            "playing_style": (row.get("playing_style") or "").strip() or None,
        }

def upsert_batches(table, rows, batch_size=200):
    rows = list(rows)
    for start in range(0, len(rows), batch_size):
        batch = rows[start:start + batch_size]
        client.table(table).upsert(batch, on_conflict="external_id").execute()
        print(f"{table}: imported {min(start + len(batch), len(rows))}/{len(rows)}")

upsert_batches("players", players_by_id.values())
upsert_batches("player_cards", cards_by_id.values())
print(f"Finished. Players: {len(players_by_id)} | Cards: {len(cards_by_id)}")
