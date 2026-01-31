from database import engine
import models

def reset_users():
    try:
        models.User.__table__.drop(engine)
        print("Table users dropped.")
    except Exception as e:
        print(f"Error dropping table: {e}")

    models.Base.metadata.create_all(bind=engine)
    print("Tables recreated.")

if __name__ == "__main__":
    reset_users()
