from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uuid
import datetime

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mock data storage (in-memory)
USERS = [
    {"id": "1", "email": "admin@example.com", "password": "admin", "role": "ADMIN", "full_name": "Admin Principal"},
    {"id": "2", "email": "tech@example.com", "password": "tech", "role": "TECHNICIEN", "full_name": "Technicien Test"},
    {"id": "3", "email": "test@example.com", "password": "123456", "role": "ADMIN", "full_name": "Utilisateur Test (Admin)"}
]
CLIENTS = []
SYSTEMS = []
INTERVENTIONS = []
TICKETS = []
NOTIFICATIONS = []

class User(BaseModel):
    id: str | None = None
    email: str
    password: str
    role: str  # "ADMIN" or "TECHNICIEN"
    full_name: str | None = None

@app.get("/")
def root():
    return {"status": "SAV API running"}

@app.post("/api/login")
def login(request: dict):
    email = request.get("email")
    password = request.get("password")
    user = next((u for u in USERS if u["email"] == email and u["password"] == password), None)
    
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    return {
        "token": "abcd1234",
        "message": "Login successful",
        "user": {
            "id": user["id"],
            "email": user["email"],
            "role": user["role"],
            "full_name": user.get("full_name")
        }
    }

@app.get("/api/users")
def get_users():
    return USERS

@app.post("/api/users")
def create_user(user: User):
    user_data = user.model_dump()
    user_data["id"] = str(uuid.uuid4())
    USERS.append(user_data)
    return {"message": "User added", "user": user_data}

@app.delete("/api/users/{user_id}")
def delete_user(user_id: str):
    global USERS
    if user_id == "1":
        raise HTTPException(status_code=400, detail="Cannot delete main admin")
    USERS = [u for u in USERS if u.get("id") != user_id]
    return {"message": "User deleted"}

@app.put("/api/users/{user_id}")
def update_user(user_id: str, user: User):
    for i, u in enumerate(USERS):
        if u.get("id") == user_id:
            updated_data = user.model_dump()
            updated_data["id"] = user_id
            USERS[i] = updated_data
            return {"message": "User updated", "user": updated_data}
    raise HTTPException(status_code=404, detail="User not found")

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
def get_clients():
    return CLIENTS

@app.post("/api/clients")
def create_client(client: Client, user_name: str | None = "Système", user_role: str | None = "ADMIN"):
    client_data = client.model_dump()
    client_data["id"] = str(uuid.uuid4())
    
    now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    client_data["created_at"] = now
    client_data["updated_at"] = now
    client_data["created_by"] = user_name
    client_data["updated_by"] = user_name
    client_data["history"] = [
        {"action": "Création", "date": now, "user": user_name}
    ]
    
    # Notification
    NOTIFICATIONS.insert(0, {
        "id": str(uuid.uuid4()),
        "type": "creation",
        "item_type": "Client",
        "item_name": client_data["nom"],
        "user": user_name,
        "role": user_role,
        "date": now,
        "details": f"Nouveau client créé : {client_data['nom']}",
        "read": False
    })
    
    CLIENTS.append(client_data)
    return {"message": "Client added", "client": client_data}

@app.delete("/api/clients/{client_id}")
def delete_client(client_id: str):
    global CLIENTS
    CLIENTS = [c for c in CLIENTS if c.get("id") != client_id]
    return {"message": "Client deleted"}

@app.put("/api/clients/{client_id}")
def update_client(client_id: str, client: Client, user_name: str | None = "Système", user_role: str | None = "ADMIN"):
    for i, c in enumerate(CLIENTS):
        if c.get("id") == client_id:
            new_data = client.model_dump()
            
            changes = []
            fields_to_check = ["nom", "client", "telephone", "email", "categorie", "localisation", "technicien"]
            for field in fields_to_check:
                old_val = c.get(field)
                new_val = new_data.get(field)
                if old_val != new_val:
                    changes.append(f"{field.upper()} : '{old_val}' → '{new_val}'")
            
            now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            
            new_data["id"] = client_id
            new_data["created_at"] = c.get("created_at")
            new_data["created_by"] = c.get("created_by")
            new_data["updated_at"] = now
            new_data["updated_by"] = user_name
            
            history = c.get("history", [])
            history.append({"action": "Modification", "date": now, "user": user_name})
            new_data["history"] = history
            
            if changes:
                NOTIFICATIONS.insert(0, {
                    "id": str(uuid.uuid4()),
                    "type": "modification",
                    "item_type": "Client",
                    "item_name": c["nom"],
                    "user": user_name,
                    "role": user_role,
                    "date": now,
                    "details": " | ".join(changes),
                    "read": False
                })
            
            CLIENTS[i] = new_data
            return {"message": "Client updated", "client": new_data}
    raise HTTPException(status_code=404, detail="Client not found")

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
def get_systems():
    return SYSTEMS

@app.post("/api/systems")
def create_system(system: System):
    system_data = system.model_dump()
    system_data["id"] = str(uuid.uuid4())
    SYSTEMS.append(system_data)
    return {"message": "System added", "system": system_data}

@app.delete("/api/systems/{system_id}")
def delete_system(system_id: str):
    global SYSTEMS
    SYSTEMS = [s for s in SYSTEMS if s.get("id") != system_id]
    return {"message": "System deleted"}

@app.put("/api/systems/{system_id}")
def update_system(system_id: str, system: System):
    for i, s in enumerate(SYSTEMS):
        if s.get("id") == system_id:
            updated_data = system.model_dump()
            updated_data["id"] = system_id
            SYSTEMS[i] = updated_data
            return {"message": "System updated", "system": updated_data}
    raise HTTPException(status_code=404, detail="System not found")

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
def get_interventions():
    return INTERVENTIONS

@app.post("/api/interventions")
def create_intervention(intervention: Intervention):
    intervention_data = intervention.model_dump()
    intervention_data["id"] = str(uuid.uuid4())
    
    # Generate intervention number (IP-YYYY-XXX or IC-YYYY-XXX)
    year = datetime.datetime.now().year
    prefix = "IP" if intervention_data["type"] == "preventive" else "IC"
    count = len([i for i in INTERVENTIONS if i["type"] == intervention_data["type"]]) + 1
    intervention_data["intervention_number"] = f"{prefix}-{year}-{count:03d}"
    
    INTERVENTIONS.append(intervention_data)
    return {"message": "Intervention added", "intervention": intervention_data}

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
def get_notifications():
    return NOTIFICATIONS

@app.post("/api/notifications/clear")
def clear_notifications():
    global NOTIFICATIONS
    NOTIFICATIONS = []
    return {"message": "Notifications cleared"}

@app.post("/api/notifications/read-all")
def mark_all_notifications_read():
    for notif in NOTIFICATIONS:
        notif["read"] = True
    return {"message": "All notifications marked as read"}

@app.post("/api/notifications/{notif_id}/read")
def mark_notification_read(notif_id: str):
    for notif in NOTIFICATIONS:
        if notif.get("id") == notif_id:
            notif["read"] = True
            return {"message": "Notification marked as read"}
    raise HTTPException(status_code=404, detail="Notification not found")

@app.get("/api/tickets")
def get_tickets():
    return TICKETS

@app.post("/api/tickets")
def create_ticket(ticket: Ticket):
    ticket_data = ticket.model_dump()
    ticket_data["id"] = str(uuid.uuid4())
    TICKETS.append(ticket_data)
    return {"message": "Ticket added", "ticket": ticket_data}

@app.delete("/api/tickets/{ticket_id}")
def delete_ticket(ticket_id: str):
    global TICKETS
    TICKETS = [t for t in TICKETS if t.get("id") != ticket_id]
    return {"message": "Ticket deleted"}

@app.put("/api/tickets/{ticket_id}")
def update_ticket(ticket_id: str, ticket: Ticket):
    for i, item in enumerate(TICKETS):
        if item.get("id") == ticket_id:
            updated_data = ticket.model_dump()
            updated_data["id"] = ticket_id
            TICKETS[i] = updated_data
            return {"message": "Ticket updated", "ticket": updated_data}
    raise HTTPException(status_code=404, detail="Ticket not found")

@app.patch("/api/tickets/{ticket_id}/status")
def update_ticket_status(ticket_id: str, status_data: StatusUpdate):
    for i, t in enumerate(TICKETS):
        if t.get("id") == ticket_id:
            TICKETS[i]["status"] = status_data.status
            return {"message": "Status updated", "ticket": TICKETS[i]}
    raise HTTPException(status_code=404, detail="Ticket not found")
