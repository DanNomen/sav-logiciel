from sqlalchemy import text
from database import engine

def fix_all_columns():
    with engine.connect() as conn:
        # Check interventions table
        try:
            conn.execute(text('ALTER TABLE interventions ADD COLUMN end_date VARCHAR'))
            conn.commit()
            print("interventions.end_date added")
        except:
            print("interventions.end_date already exists or error")

        # Check calendar_events table
        try:
            conn.execute(text('ALTER TABLE calendar_events ADD COLUMN user_name VARCHAR'))
            conn.commit()
            print("calendar_events.user_name added")
        except:
            print("calendar_events.user_name already exists or error")

if __name__ == "__main__":
    fix_all_columns()
