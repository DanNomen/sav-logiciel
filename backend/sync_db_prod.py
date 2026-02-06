import models
from database import engine, Base
from sqlalchemy import inspect, text
import logging
logger = logging.getLogger(__name__)

def sync_database():
    inspector = inspect(engine)
    
    # 1. Créer les tables manquantes
    logger.info("Vérification des tables...")
    Base.metadata.create_all(bind=engine)
    
    # 2. Ajouter les colonnes manquantes
    logger.info("Vérification des colonnes...")
    with engine.connect() as conn:
        for table_name, table in Base.metadata.tables.items():
            # Récupérer les colonnes déjà présentes dans la base
            try:
                existing_columns = [c['name'] for c in inspector.get_columns(table_name)]
                
                for column in table.columns:
                    if column.name not in existing_columns:
                        logger.info(f"-> Ajout de la colonne '{column.name}' dans la table '{table_name}'")
                        
                        # Générer le type SQL
                        # On simplifie pour VARCHAR/INTEGER/BOOLEAN commun
                        col_type = str(column.type.compile(engine.dialect))
                        
                        # Exécuter l'ALTER TABLE
                        # Note: SQLite a des limitations sur ADD COLUMN (pas de constraints complexes), 
                        # mais pour des colonnes simples VARCHAR/TEXT/INT ça passe.
                        conn.execute(text(f'ALTER TABLE "{table_name}" ADD COLUMN "{column.name}" {col_type}'))
                        conn.commit()
            except Exception as e:
                print(f"Erreur sur la table {table_name}: {e}")

    print("Synchronisation terminée !")

if __name__ == "__main__":
    sync_database()
