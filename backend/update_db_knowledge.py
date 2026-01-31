from database import engine, Base
from sqlalchemy import text
from models import KnowledgeArticle

def update_db():
    print("Creating KnowledgeArticle table...")
    # This will create only tables that don't exist
    Base.metadata.create_all(bind=engine)
    print("Database updated successfully.")

if __name__ == "__main__":
    update_db()
