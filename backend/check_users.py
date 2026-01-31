from database import SessionLocal
import models
db = SessionLocal()
print("--- UTILISATEURS EXISTANTS ---")
users = db.query(models.User).all()
for u in users:
    print(f"Email: {u.email} | Pass: {u.password} | Role: {u.role}")

# Si admin manquant, le recréer de force
if not any(u.email == "admin@example.com" for u in users):
    print("Admin manquant. Création...")
    import uuid
    admin = models.User(
        id=str(uuid.uuid4()),
        email="admin@example.com",
        password="admin",
        role="ADMIN",
        full_name="Administrateur"
    )
    db.add(admin)
    db.commit()
    print("Admin recréé : admin@example.com / admin")
db.close()
