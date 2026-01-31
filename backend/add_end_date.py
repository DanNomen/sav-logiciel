from sqlalchemy import text
from database import engine

def add_column():
    try:
        with engine.connect() as conn:
            # Pour SQLite ou PostgreSQL
            conn.execute(text('ALTER TABLE interventions ADD COLUMN end_date VARCHAR'))
            conn.commit()
            print("Colonne end_date ajoutée avec succès.")
    except Exception as e:
        if "duplicate column name" in str(e).lower() or "already exists" in str(e).lower():
            print("La colonne end_date existe déjà.")
        else:
            print(f"Erreur : {e}")

if __name__ == "__main__":
    add_column()
