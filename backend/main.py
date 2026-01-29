from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
import uuid
import datetime

# Imports Base de données corrigés pour le serveur
from database import engine, get_db, SessionLocal
import models

# Création automatique des tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- CRÉATION UTILISATEUR PAR DÉFAUT ---
def create_default_admin():
    db = SessionLocal()
    try:
        admin_exists = db.query(models.User).filter(models.User.email == "admin@example.com").first()
        if not admin_exists:
            new_admin = models.User(
                id=str(uuid.uuid4()),
                email="admin@example.com",
                password="admin", # En prod, vous devriez hacher le mot de passe
                role="ADMIN",
                full_name="Administrateur Système"
            )
            db.add(new_admin)
            db.commit()
            print("Utilisateur admin par défaut créé : admin@example.com / admin")
    except Exception as e:
        print(f"Erreur lors de la création de l'admin : {e}")
    finally:
        db.close()

create_default_admin()

# --- SCHÉMAS DE DONNÉES (Validation Pydantic) ---

class UserBase(BaseModel):
    email: str
    password: str
    role: str
    full_name: str | None = None

class ClientBase(BaseModel):
    client: str | None = None
    nom: str
    telephone: str
    email: str | None = None
    categorie: str
    localisation: str | None = None
    technicien: str | None = None

class SystemBase(BaseModel):
    monitoring_name: str
    engineer: str
    agency: str
    installation_type: str
    power_va: int
    commissioning_date: str
    contract_type: str
    contract_duration_months: int
    client_id: str
    site_technician_name: str | None = None
    site_technician_phone: str | None = None
    victron_site_id: str | None = None
    comments: str | None = None
    location: str | None = None
    pv_type: str | None = None
    pv_count: int | None = 0
    inverter_charger_type: str | None = None
    inverter_charger_count: int | None = 0
    paid: bool = False

class InterventionBase(BaseModel):
    type: str # preventive / corrective
    title: str
    client_id: str
    system_id: str
    technician: str
    date: str
    status: str = "NOUVEAU"
    ticket_id: str | None = None
    observation: str | None = None
    context: str | None = None
    resolution: str | None = None

class TicketBase(BaseModel):
    ticket_number: str
    subject: str
    request_date: str
    requester: str
    priority: str
    client_id: str
    assigned_to: str
    description: str
    status: str
    deadline_date: str | None = None

# --- ENDPOINTS API ---

@app.get("/")
def root():
    return {"status": "SAV API Fully Connected to Database"}

# --- UTILISATEURS ---
@app.post("/api/login")
def login(request: dict, db: Session = Depends(get_db)):
    email = request.get("email")
    password = request.get("password")
    print(f"Tentative de connexion pour : {email}")
    
    user = db.query(models.User).filter(models.User.email == email, models.User.password == password).first()
    
    if not user:
        print(f"Échec de connexion pour : {email}")
        raise HTTPException(status_code=401, detail="Identifiants invalides")
    
    print(f"Connexion réussie pour : {email} (Rôle: {user.role})")
    return {"token": "abcd1234", "user": {"id": user.id, "email": user.email, "role": user.role, "full_name": user.full_name}}

@app.get("/api/users")
def get_users(db: Session = Depends(get_db)):
    return db.query(models.User).all()

@app.post("/api/users")
def create_user(user: UserBase, db: Session = Depends(get_db)):
    new_user = models.User(id=str(uuid.uuid4()), **user.model_dump())
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@app.delete("/api/users/{user_id}")
def delete_user(user_id: str, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
    db.delete(user)
    db.commit()
    return {"message": "Utilisateur supprimé"}

@app.put("/api/users/{user_id}")
def update_user(user_id: str, user: UserBase, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
    for key, value in user.model_dump().items():
        setattr(db_user, key, value)
    db.commit()
    db.refresh(db_user)
    return db_user

# --- CLIENTS ---
@app.get("/api/clients")
def get_clients(db: Session = Depends(get_db)):
    return db.query(models.Client).all()

@app.post("/api/clients")
def create_client(client: ClientBase, db: Session = Depends(get_db)):
    client_id = str(uuid.uuid4())
    now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    new_client = models.Client(**client.model_dump(), id=client_id, created_at=now, updated_at=now, history=[{"action": "Création", "date": now, "user": "Système"}])
    
    # Notif auto
    db.add(models.Notification(id=str(uuid.uuid4()), type="creation", item_type="Client", item_name=client.nom, date=now, details=f"Nouveau client : {client.nom}", read=False))
    
    db.add(new_client)
    db.commit()
    return new_client

@app.delete("/api/clients/{client_id}")
def delete_client(client_id: str, db: Session = Depends(get_db)):
    db.query(models.Client).filter(models.Client.id == client_id).delete()
    db.commit()
    return {"message": "Supprimé"}

@app.put("/api/clients/{client_id}")
def update_client(client_id: str, client: ClientBase, db: Session = Depends(get_db)):
    db_client = db.query(models.Client).filter(models.Client.id == client_id).first()
    if not db_client:
        raise HTTPException(status_code=404, detail="Client non trouvé")
    
    now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    update_data = client.model_dump()
    
    for key, value in update_data.items():
        setattr(db_client, key, value)
    
    db_client.updated_at = now
    db.commit()
    db.refresh(db_client)
    return db_client

# --- SYSTÈMES ---
@app.get("/api/systems")
def get_systems(db: Session = Depends(get_db)):
    return db.query(models.System).all()

@app.post("/api/systems")
def create_system(system: SystemBase, db: Session = Depends(get_db)):
    new_sys = models.System(**system.model_dump(), id=str(uuid.uuid4()))
    db.add(new_sys)
    db.commit()
    return new_sys

@app.put("/api/systems/{system_id}")
def update_system(system_id: str, system: SystemBase, db: Session = Depends(get_db)):
    db_system = db.query(models.System).filter(models.System.id == system_id).first()
    if not db_system:
        raise HTTPException(status_code=404, detail="Système non trouvé")
    
    for key, value in system.model_dump().items():
        setattr(db_system, key, value)
    
    db.commit()
    db.refresh(db_system)
    return db_system

# --- INTERVENTIONS ---
@app.get("/api/interventions")
def get_interventions(db: Session = Depends(get_db)):
    return db.query(models.Intervention).all()

@app.post("/api/interventions")
def create_intervention(intervention: InterventionBase, db: Session = Depends(get_db)):
    # Génération du numéro IP ou IC
    prefix = "IP" if intervention.type == "preventive" else "IC"
    count = db.query(models.Intervention).filter(models.Intervention.type == intervention.type).count() + 1
    num = f"{prefix}-{datetime.datetime.now().year}-{count:03d}"
    
    new_int = models.Intervention(**intervention.model_dump(), id=str(uuid.uuid4()), intervention_number=num)
    db.add(new_int)
    db.commit()
    return new_int

# --- TICKETS ---
@app.get("/api/tickets")
def get_tickets(db: Session = Depends(get_db)):
    return db.query(models.Ticket).all()

@app.post("/api/tickets")
def create_ticket(ticket: TicketBase, db: Session = Depends(get_db)):
    new_ticket = models.Ticket(**ticket.model_dump(), id=str(uuid.uuid4()))
    db.add(new_ticket)
    db.commit()
    return new_ticket

# --- NOTIFICATIONS ---
@app.get("/api/notifications")
def get_notifications(db: Session = Depends(get_db)):
    return db.query(models.Notification).order_by(models.Notification.date.desc()).all()

@app.post("/api/notifications/read-all")
def mark_all_read(db: Session = Depends(get_db)):
    db.query(models.Notification).update({models.Notification.read: True})
    db.commit()
    return {"message": "Lu"}
