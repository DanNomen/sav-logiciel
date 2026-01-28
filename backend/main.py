from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
import uuid
import datetime
import os

import models, database
from database import engine, get_db

# Création des tables dans PostgreSQL au démarrage
models.Base.metadata.create_all(bind=engine)

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class User(BaseModel):
    id: str | None = None
    email: str
    password: str
    role: str  # "ADMIN" or "TECHNICIEN"
    full_name: str | None = None

# Seed default users if database is empty
def seed_db():
    db = next(get_db())
    if db.query(models.User).count() == 0:
        default_users = [
            models.User(id="1", email="admin@example.com", password="admin", role="ADMIN", full_name="Admin Principal"),
            models.User(id="2", email="tech@example.com", password="tech", role="TECHNICIEN", full_name="Technicien Test"),
            models.User(id="3", email="test@example.com", password="123456", role="ADMIN", full_name="Utilisateur Test (Admin)")
        ]
        db.add_all(default_users)
        db.commit()

@app.on_event("startup")
def on_startup():
    seed_db()

@app.get("/")
def root():
    return {"status": "SAV API running"}

@app.post("/api/login")
def login(request: dict, db: Session = Depends(get_db)):
    email = request.get("email")
    password = request.get("password")
    
    user = db.query(models.User).filter(models.User.email == email, models.User.password == password).first()
    
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    return {
        "token": "abcd1234",
        "message": "Login successful",
        "user": {
            "id": user.id,
            "email": user.email,
            "role": user.role,
            "full_name": user.full_name
        }
    }

@app.get("/api/users")
def get_users(db: Session = Depends(get_db)):
    return db.query(models.User).all()

@app.post("/api/users")
def create_user(user: User, db: Session = Depends(get_db)):
    db_user = models.User(
        id=str(uuid.uuid4()),
        email=user.email,
        password=user.password,
        role=user.role,
        full_name=user.full_name
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return {"message": "User added", "user": db_user}

@app.delete("/api/users/{user_id}")
def delete_user(user_id: str, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    if user_id == "1":
        raise HTTPException(status_code=400, detail="Cannot delete main admin")
    db.delete(db_user)
    db.commit()
    return {"message": "User deleted"}

@app.put("/api/users/{user_id}")
def update_user(user_id: str, user: User, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    db_user.email = user.email
    db_user.password = user.password
    db_user.role = user.role
    db_user.full_name = user.full_name
    
    db.commit()
    return {"message": "User updated", "user": db_user}


# Mock user data

class Client(BaseModel):
    id: str | None = None
    client: str | None = None
    nom: str
    telephone: str
    email: str | None = None
    categorie: str
    localisation: str | None = None
    technicien: str | None = None
    created_at: str | None = None
    updated_at: str | None = None
    created_by: str | None = None
    updated_by: str | None = None
    history: list[dict] | None = []

@app.get("/api/clients")
def get_clients(db: Session = Depends(get_db)):
    return db.query(models.Client).all()

@app.post("/api/clients")
def create_client(client: Client, user_name: str | None = "Système", user_role: str | None = "ADMIN", db: Session = Depends(get_db)):
    client_id = str(uuid.uuid4())
    now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    db_client = models.Client(
        **client.model_dump(exclude={"id"}),
        id=client_id,
        created_at=now,
        updated_at=now,
        created_by=user_name,
        updated_by=user_name,
        history=[{"action": "Création", "date": now, "user": user_name}]
    )
    
    # Notification
    db_notif = models.Notification(
        id=str(uuid.uuid4()),
        type="creation",
        item_type="Client",
        item_name=client.nom,
        user=user_name,
        role=user_role,
        date=now,
        details=f"Nouveau client créé : {client.nom}",
        read=False
    )
    
    db.add(db_client)
    db.add(db_notif)
    db.commit()
    db.refresh(db_client)
    return {"message": "Client added", "client": db_client}

@app.delete("/api/clients/{client_id}")
def delete_client(client_id: str, db: Session = Depends(get_db)):
    db_client = db.query(models.Client).filter(models.Client.id == client_id).first()
    if not db_client:
        raise HTTPException(status_code=404, detail="Client not found")
    db.delete(db_client)
    db.commit()
    return {"message": "Client deleted"}

@app.put("/api/clients/{client_id}")
def update_client(client_id: str, client: Client, user_name: str | None = "Système", user_role: str | None = "ADMIN", db: Session = Depends(get_db)):
    db_client = db.query(models.Client).filter(models.Client.id == client_id).first()
    if not db_client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    new_data = client.model_dump(exclude={"id"})
    changes = []
    fields_to_check = ["nom", "client", "telephone", "email", "categorie", "localisation", "technicien"]
    for field in fields_to_check:
        old_val = getattr(db_client, field)
        new_val = new_data.get(field)
        if old_val != new_val:
            changes.append(f"{field.upper()} : '{old_val}' → '{new_val}'")
            setattr(db_client, field, new_val)
    
    now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    db_client.updated_at = now
    db_client.updated_by = user_name
    
    history = list(db_client.history) if db_client.history else []
    history.append({"action": "Modification", "date": now, "user": user_name})
    db_client.history = history
    
    if changes:
        db_notif = models.Notification(
            id=str(uuid.uuid4()),
            type="modification",
            item_type="Client",
            item_name=db_client.nom,
            user=user_name,
            role=user_role,
            date=now,
            details=" | ".join(changes),
            read=False
        )
        db.add(db_notif)
    
    db.commit()
    return {"message": "Client updated", "client": db_client}
class System(BaseModel):
    id: str | None = None
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
    pv_inverter_type: str | None = None
    pv_inverter_count: int | None = 0
    battery_type: str | None = None
    battery_count: int | None = 0
    solar_regulator_type: str | None = None
    solar_regulator_count: int | None = 0
    paid: bool = False
    next_payment_date: str | None = None

@app.get("/api/systems")
def get_systems(db: Session = Depends(get_db)):
    return db.query(models.System).all()

@app.post("/api/systems")
def create_system(system: System, db: Session = Depends(get_db)):
    db_system = models.System(
        **system.model_dump(exclude={"id"}),
        id=str(uuid.uuid4())
    )
    db.add(db_system)
    db.commit()
    db.refresh(db_system)
    return {"message": "System added", "system": db_system}

@app.delete("/api/systems/{system_id}")
def delete_system(system_id: str):
    global SYSTEMS
    SYSTEMS = [s for s in SYSTEMS if s.get("id") != system_id]
    return {"message": "System deleted"}

@app.put("/api/systems/{system_id}")
def update_system(system_id: str, system: System, db: Session = Depends(get_db)):
    db_system = db.query(models.System).filter(models.System.id == system_id).first()
    if not db_system:
        raise HTTPException(status_code=404, detail="System not found")
    
    update_data = system.model_dump(exclude={"id"})
    for key, value in update_data.items():
        setattr(db_system, key, value)
    
    db.commit()
    return {"message": "System updated", "system": db_system}

class Intervention(BaseModel):
    id: str | None = None
    intervention_number: str | None = None
    type: str  # "preventive" or "corrective"
    title: str
    client_id: str
    system_id: str
    technician: str
    date: str
    status: str = "NOUVEAU"  # NOUVEAU, EN COURS, TERMINÉ, EN ATTENTE, ANNULÉ
    ticket_id: str | None = None
    observation: str | None = None  # for preventive
    context: str | None = None       # for corrective
    resolution: str | None = None    # for corrective
    material_changed: str | None = None # for corrective
    images: list[str] | None = []

@app.get("/api/interventions")
def get_interventions(db: Session = Depends(get_db)):
    return db.query(models.Intervention).all()

@app.post("/api/interventions")
def create_intervention(intervention: Intervention, db: Session = Depends(get_db)):
    year = datetime.datetime.now().year
    prefix = "IP" if intervention.type == "preventive" else "IC"
    count = db.query(models.Intervention).filter(models.Intervention.type == intervention.type).count() + 1
    
    db_intervention = models.Intervention(
        **intervention.model_dump(exclude={"id", "intervention_number"}),
        id=str(uuid.uuid4()),
        intervention_number=f"{prefix}-{year}-{count:03d}"
    )
    db.add(db_intervention)
    db.commit()
    db.refresh(db_intervention)
    return {"message": "Intervention added", "intervention": db_intervention}

@app.delete("/api/interventions/{intervention_id}")
def delete_intervention(intervention_id: str):
    global INTERVENTIONS
    INTERVENTIONS = [i for i in INTERVENTIONS if i.get("id") != intervention_id]
    return {"message": "Intervention deleted"}

@app.put("/api/interventions/{intervention_id}")
def update_intervention(intervention_id: str, intervention: Intervention):
    for i, item in enumerate(INTERVENTIONS):
        if item.get("id") == intervention_id:
            updated_data = intervention.model_dump()
            updated_data["id"] = intervention_id
            INTERVENTIONS[i] = updated_data
            return {"message": "Intervention updated", "intervention": updated_data}
    raise HTTPException(status_code=404, detail="Intervention not found")

class StatusUpdate(BaseModel):
    status: str

@app.patch("/api/interventions/{intervention_id}/status")
def update_intervention_status(intervention_id: str, status_data: StatusUpdate):
    for i, item in enumerate(INTERVENTIONS):
        if item.get("id") == intervention_id:
            INTERVENTIONS[i]["status"] = status_data.status
            return {"message": "Status updated", "intervention": INTERVENTIONS[i]}
    raise HTTPException(status_code=404, detail="Intervention not found")

class Ticket(BaseModel):
    id: str | None = None
    ticket_number: str
    subject: str
    request_date: str
    requester: str  # MGP, Client, Autres
    priority: str   # Urgente, Haute, Normale, Faible
    client_id: str
    assigned_to: str
    description: str
    status: str      # En Attente, Ouvert, Fermé
    next_step: str | None = None
    resolution_time: float | None = 0
    comment: str | None = None
    deadline_date: str | None = None
    resolution_date: str | None = None
    files: list[str] | None = []

@app.get("/api/notifications")
def get_notifications(db: Session = Depends(get_db)):
    return db.query(models.Notification).order_by(models.Notification.date.desc()).all()

@app.post("/api/notifications/clear")
def clear_notifications(db: Session = Depends(get_db)):
    db.query(models.Notification).delete()
    db.commit()
    return {"message": "Notifications cleared"}

@app.post("/api/notifications/read-all")
def mark_all_notifications_read(db: Session = Depends(get_db)):
    db.query(models.Notification).update({models.Notification.read: True})
    db.commit()
    return {"message": "All notifications marked as read"}

@app.post("/api/notifications/{notif_id}/read")
def mark_notification_read(notif_id: str, db: Session = Depends(get_db)):
    db_notif = db.query(models.Notification).filter(models.Notification.id == notif_id).first()
    if not db_notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    db_notif.read = True
    db.commit()
    return {"message": "Notification marked as read"}

@app.get("/api/tickets")
def get_tickets(db: Session = Depends(get_db)):
    return db.query(models.Ticket).all()

@app.post("/api/tickets")
def create_ticket(ticket: Ticket, db: Session = Depends(get_db)):
    db_ticket = models.Ticket(
        **ticket.model_dump(exclude={"id"}),
        id=str(uuid.uuid4())
    )
    db.add(db_ticket)
    db.commit()
    db.refresh(db_ticket)
    return {"message": "Ticket added", "ticket": db_ticket}

@app.delete("/api/tickets/{ticket_id}")
def delete_ticket(ticket_id: str, db: Session = Depends(get_db)):
    db_ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    if not db_ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    db.delete(db_ticket)
    db.commit()
    return {"message": "Ticket deleted"}

@app.put("/api/tickets/{ticket_id}")
def update_ticket(ticket_id: str, ticket: Ticket, db: Session = Depends(get_db)):
    db_ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    if not db_ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    update_data = ticket.model_dump(exclude={"id"})
    for key, value in update_data.items():
        setattr(db_ticket, key, value)
    
    db.commit()
    return {"message": "Ticket updated", "ticket": db_ticket}

@app.patch("/api/tickets/{ticket_id}/status")
def update_ticket_status(ticket_id: str, status_data: StatusUpdate, db: Session = Depends(get_db)):
    db_ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    if not db_ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    db_ticket.status = status_data.status
    db.commit()
    return {"message": "Status updated", "ticket": db_ticket}


