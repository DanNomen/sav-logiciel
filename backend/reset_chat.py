from database import engine
from sqlalchemy import text
import models

with engine.connect() as conn:
    conn.execute(text("DROP TABLE IF EXISTS chat_messages"))
    conn.commit()
    print("Table chat_messages dropped.")

# Trigger recreation
models.Base.metadata.create_all(bind=engine)
print("Tables recreated.")
