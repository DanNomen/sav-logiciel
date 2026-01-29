from fastapi import FastAPI, HTTPException, Depends, Query
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

# --- CREATION UTILISATEUR PAR DEFAUT ---
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
                full_name="Administrateur"
            )
            db.add(new_admin)
            db.commit()
            print("Utilisateur admin par defaut cree : admin@example.com / admin")
    except Exception as e:
        print(f"Erreur lors de la creation de l'admin : {e}")
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
    engineer: str | None = ""
    agency: str | None = ""
    installation_type: str | None = ""
    power_va: int | None = 0
    commissioning_date: str | None = ""
    contract_type: str | None = ""
    contract_duration_months: int | None = 0
    client_id: str
    site_technician_name: str | None = ""
    site_technician_phone: str | None = ""
    victron_site_id: str | None = ""
    comments: str | None = ""
    location: str | None = ""
    pv_type: str | None = ""
    pv_count: int | None = 0
    inverter_charger_type: str | None = ""
    inverter_charger_count: int | None = 0
    pv_inverter_type: str | None = ""
    pv_inverter_count: int | None = 0
    battery_type: str | None = ""
    battery_count: int | None = 0
    solar_regulator_type: str | None = ""
    solar_regulator_count: int | None = 0
    paid: bool = False
    next_payment_date: str | None = ""

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
    material_changed: str | None = None
    images: list | None = []

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
    next_step: str | None = None
    resolution_time: float | None = 0
    comment: str | None = None
    resolution_date: str | None = None
    files: list | None = []

# --- ENDPOINTS API ---

@app.get("/")
def root():
    return {
        "status": "SAV API Fully Connected",
        "version": "1.0.2",
        "database": "PostgreSQL" if "postgresql" in engine.url.drivername else "SQLite",
        "time": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }

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
    clients = db.query(models.Client).all()
    print(f"DEBUG: Fetching clients list. Found {len(clients)} clients.")
    return clients

@app.post("/api/clients")
def create_client(client: ClientBase, db: Session = Depends(get_db), user_name: str = Query("Systeme"), user_role: str = Query("TECHNICIEN")):
    try:
        client_id = str(uuid.uuid4())
        now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        new_client = models.Client(**client.model_dump(), id=client_id, created_at=now, updated_at=now, created_by=user_name, history=[{"action": "Creation", "date": now, "user": user_name}])
        
        # Notif auto
        db.add(models.Notification(id=str(uuid.uuid4()), type="creation", item_type="Client", item_name=client.nom, user=user_name, role=user_role, date=now, details=f"Nouveau client cree par {user_name} : {client.nom}", read=False))
        
        db.add(new_client)
        db.commit()
        return new_client
    except Exception as e:
        db.rollback()
        print(f"Erreur create_client: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/clients/{client_id}")
def delete_client(client_id: str, db: Session = Depends(get_db)):
    try:
        # Suppression manuelle des dépendances pour PostgreSQL (évite les erreurs de clé étrangère)
        db.query(models.Intervention).filter(models.Intervention.client_id == client_id).delete()
        db.query(models.System).filter(models.System.client_id == client_id).delete()
        db.query(models.Ticket).filter(models.Ticket.client_id == client_id).delete()
        
        db.query(models.Client).filter(models.Client.id == client_id).delete()
        db.commit()
        return {"message": "Client et toutes ses données liées ont été supprimés"}
    except Exception as e:
        db.rollback()
        print(f"Erreur delete_client: {e}")
        raise HTTPException(status_code=500, detail=f"Impossible de supprimer le client : {str(e)}")

@app.put("/api/clients/{client_id}")
def update_client(client_id: str, client: ClientBase, db: Session = Depends(get_db), user_name: str = Query("Systeme"), user_role: str = Query("TECHNICIEN")):
    try:
        db_client = db.query(models.Client).filter(models.Client.id == client_id).first()
        if not db_client:
            raise HTTPException(status_code=404, detail="Client non trouve")
        
        now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        update_data = client.model_dump()
        
        for key, value in update_data.items():
            setattr(db_client, key, value)
        
        db_client.updated_at = now
        db_client.updated_by = user_name
        
        # Notif auto
        db.add(models.Notification(id=str(uuid.uuid4()), type="modification", item_type="Client", item_name=client.nom, user=user_name, role=user_role, date=now, details=f"Client '{client.nom}' mis a jour par {user_name}", read=False))
        
        db.commit()
        db.refresh(db_client)
        return db_client
    except Exception as e:
        db.rollback()
        print(f"Erreur update_client: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# --- SYSTÈMES ---
@app.get("/api/systems")
def get_systems(db: Session = Depends(get_db)):
    return db.query(models.System).all()

@app.post("/api/systems")
def create_system(system: SystemBase, db: Session = Depends(get_db), user_name: str = Query("Systeme"), user_role: str = Query("TECHNICIEN")):
    try:
        now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        print(f"DEBUG RECEIVED DATA (POST): {system.model_dump()}")
        new_sys = models.System(**system.model_dump(), id=str(uuid.uuid4()), created_at=now, updated_at=now, created_by=user_name)
        
        # Notif auto
        db.add(models.Notification(id=str(uuid.uuid4()), type="creation", item_type="Systeme", item_name=system.monitoring_name, user=user_name, role=user_role, date=now, details=f"Nouveau systeme cree par {user_name} : {system.monitoring_name}", read=False))
        
        db.add(new_sys)
        db.commit()
        return new_sys
    except Exception as e:
        db.rollback()
        print(f"Erreur create_system: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/systems/{system_id}")
def update_system(system_id: str, system: SystemBase, db: Session = Depends(get_db), user_name: str = Query("Systeme"), user_role: str = Query("TECHNICIEN")):
    try:
        db_system = db.query(models.System).filter(models.System.id == system_id).first()
        if not db_system:
            raise HTTPException(status_code=404, detail="Systeme non trouve")
        
        now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        print(f"DEBUG RECEIVED DATA (PUT): {system.model_dump()}")
        for key, value in system.model_dump().items():
            setattr(db_system, key, value)
        
        db_system.updated_at = now
        db_system.updated_by = user_name
        
        # Notif auto
        db.add(models.Notification(id=str(uuid.uuid4()), type="modification", item_type="Systeme", item_name=system.monitoring_name, user=user_name, role=user_role, date=now, details=f"Systeme '{system.monitoring_name}' mis a jour par {user_name}", read=False))
        
        db.commit()
        db.refresh(db_system)
        return db_system
    except Exception as e:
        db.rollback()
        print(f"Erreur update_system: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/systems/{system_id}")
def delete_system(system_id: str, db: Session = Depends(get_db)):
    try:
        # Suppression des interventions liées
        db.query(models.Intervention).filter(models.Intervention.system_id == system_id).delete()
        db.query(models.System).filter(models.System.id == system_id).delete()
        db.commit()
        return {"message": "Systeme supprimé avec succès"}
    except Exception as e:
        db.rollback()
        print(f"Erreur delete_system: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        db.rollback()
        print(f"Erreur update_system: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# --- INTERVENTIONS ---
@app.get("/api/interventions")
def get_interventions(db: Session = Depends(get_db)):
    return db.query(models.Intervention).all()

@app.post("/api/interventions")
def create_intervention(intervention: InterventionBase, db: Session = Depends(get_db), user_name: str = Query("Systeme"), user_role: str = Query("TECHNICIEN")):
    try:
        now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        # Génération du numéro IP ou IC
        prefix = "IP" if intervention.type == "preventive" else "IC"
        count = db.query(models.Intervention).filter(models.Intervention.type == intervention.type).count() + 1
        num = f"{prefix}-{datetime.datetime.now().year}-{count:03d}"
        
        new_int = models.Intervention(**intervention.model_dump(), id=str(uuid.uuid4()), intervention_number=num, created_at=now, updated_at=now, created_by=user_name)
        
        # Notif auto
        db.add(models.Notification(id=str(uuid.uuid4()), type="creation", item_type="Intervention", item_name=intervention.title, user=user_name, role=user_role, date=now, details=f"Nouvelle intervention creee par {user_name} : {intervention.title}", read=False))
        
        db.add(new_int)
        db.commit()
        return new_int
    except Exception as e:
        db.rollback()
        print(f"Erreur create_intervention: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/interventions/{intervention_id}")
def update_intervention(intervention_id: str, intervention: InterventionBase, db: Session = Depends(get_db), user_name: str = Query("Systeme"), user_role: str = Query("TECHNICIEN")):
    try:
        db_int = db.query(models.Intervention).filter(models.Intervention.id == intervention_id).first()
        if not db_int:
            raise HTTPException(status_code=404, detail="Intervention non trouvee")
        
        now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        for key, value in intervention.model_dump().items():
            setattr(db_int, key, value)
        
        db_int.updated_at = now
        db_int.updated_by = user_name
        
        # Notif auto
        db.add(models.Notification(id=str(uuid.uuid4()), type="modification", item_type="Intervention", item_name=intervention.title, user=user_name, role=user_role, date=now, details=f"Intervention '{intervention.title}' mise a jour par {user_name}", read=False))
        
        db.commit()
        db.refresh(db_int)
        return db_int
    except Exception as e:
        db.rollback()
        print(f"Erreur update_intervention: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/interventions/{intervention_id}")
def delete_intervention(intervention_id: str, db: Session = Depends(get_db)):
    try:
        db.query(models.Intervention).filter(models.Intervention.id == intervention_id).delete()
        db.commit()
        return {"message": "Intervention supprimée"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@app.patch("/api/interventions/{intervention_id}/status")
def update_intervention_status(intervention_id: str, request: dict, db: Session = Depends(get_db)):
    try:
        db_int = db.query(models.Intervention).filter(models.Intervention.id == intervention_id).first()
        if not db_int:
            raise HTTPException(status_code=404, detail="Intervention non trouvée")
        
        db_int.status = request.get("status")
        db_int.updated_at = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        db.commit()
        return {"message": "Statut mis à jour"}
    except Exception as e:
        db.rollback()
        print(f"Erreur update_intervention_status: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# --- TICKETS ---
@app.get("/api/tickets")
def get_tickets(db: Session = Depends(get_db)):
    return db.query(models.Ticket).all()

@app.post("/api/tickets")
def create_ticket(ticket: TicketBase, db: Session = Depends(get_db), user_name: str = Query("Systeme"), user_role: str = Query("TECHNICIEN")):
    try:
        now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        new_ticket = models.Ticket(**ticket.model_dump(), id=str(uuid.uuid4()), created_at=now, updated_at=now, created_by=user_name)
        
        # Notif auto
        db.add(models.Notification(id=str(uuid.uuid4()), type="creation", item_type="Ticket", item_name=ticket.subject, user=user_name, role=user_role, date=now, details=f"Nouveau ticket cree par {user_name} : {ticket.subject}", read=False))
        
        db.add(new_ticket)
        db.commit()
        return new_ticket
    except Exception as e:
        db.rollback()
        print(f"Erreur create_ticket: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/tickets/{ticket_id}")
def update_ticket(ticket_id: str, ticket: TicketBase, db: Session = Depends(get_db), user_name: str = Query("Systeme"), user_role: str = Query("TECHNICIEN")):
    try:
        db_ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
        if not db_ticket:
            raise HTTPException(status_code=404, detail="Ticket non trouve")
        
        now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        for key, value in ticket.model_dump().items():
            setattr(db_ticket, key, value)
        
        db_ticket.updated_at = now
        db_ticket.updated_by = user_name
        
        # Notif auto
        db.add(models.Notification(id=str(uuid.uuid4()), type="modification", item_type="Ticket", item_name=ticket.subject, user=user_name, role=user_role, date=now, details=f"Ticket '{ticket.subject}' mis a jour par {user_name}", read=False))
        
        db.commit()
        db.refresh(db_ticket)
        return db_ticket
    except Exception as e:
        db.rollback()
        print(f"Erreur update_ticket: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/tickets/{ticket_id}")
def delete_ticket(ticket_id: str, db: Session = Depends(get_db)):
    try:
        db.query(models.Ticket).filter(models.Ticket.id == ticket_id).delete()
        db.commit()
        return {"message": "Ticket supprimé"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@app.patch("/api/tickets/{ticket_id}/status")
def update_ticket_status(ticket_id: str, request: dict, db: Session = Depends(get_db)):
    try:
        db_ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
        if not db_ticket:
            raise HTTPException(status_code=404, detail="Ticket non trouvé")
        
        db_ticket.status = request.get("status")
        db_ticket.updated_at = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        db.commit()
        return {"message": "Statut mis à jour"}
    except Exception as e:
        db.rollback()
        print(f"Erreur update_ticket_status: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# --- NOTIFICATIONS ---
@app.get("/api/notifications")
def get_notifications(db: Session = Depends(get_db)):
    return db.query(models.Notification).order_by(models.Notification.date.desc()).all()

@app.post("/api/notifications/read-all")
def mark_all_read(db: Session = Depends(get_db)):
    db.query(models.Notification).update({models.Notification.read: True})
    db.commit()
    return {"message": "Lu"}
