from fastapi import FastAPI, HTTPException, Depends, Query, BackgroundTasks, WebSocket, WebSocketDisconnect
from typing import List
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
import uuid
import datetime
import requests
import threading
import os
from api_vrm import VictronVRM
from email_utils import send_overdue_invoice_email, send_payment_confirmation_email, send_upcoming_due_email

# Imports Base de données corrigés pour le serveur
from database import engine, get_db, SessionLocal
import models
import asyncio
from api_meteo import get_weather
import logging
import google.generativeai as genai

# Configuration Gemini
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

# Configuration des logs vers un fichier
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("app_prod.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Synchronisation automatique de la structure (Tables + Colonnes)
from sync_db_prod import sync_database
sync_database()

# --- VRM SYNC LOGIC ---
IS_SYNCING = False
SYNC_LOCK = threading.Lock()

def sync_vrm_data():
    global IS_SYNCING
    with SYNC_LOCK:
        if IS_SYNCING:
            return
        IS_SYNCING = True
    
    db = SessionLocal()
    try:
        vrm = VictronVRM()
        installations_all = vrm.get_all_installations()
        if not installations_all:
            return

        # No more filter for testing: Take all systems
        installations = installations_all

        # Default client logic removed - we now create clients per system

        for inst in installations:
            site_id = str(inst.get("idSite"))
            # Check if system exists
            existing_sys = db.query(models.System).filter(models.System.victron_site_id == site_id).first()
            
            # Format data
            sys_data = vrm.format_installation_for_system_form(inst)
            sys_data = vrm.enrich_system_with_devices(sys_data, site_id)
            
            # Remove client_id from sys_data if it exists (placeholder in vrm_api)
            if "client_id" in sys_data:
                del sys_data["client_id"]
            
            # Determine Client Name from System Name
            # CLEANING LOGIC: Remove generic suffixes and standardize separators
            sys_name = inst.get("name", "Unknown System")
            
            import re
            # 1. Standardize separators: Replace " - " or "-" with space
            clean_name = sys_name.replace("-", " ")
            
            # 2. Key words to strip from the end to find the "Client Name"
            keywords_to_remove = ["Ecole", "Dispensaire", "Maison", "Villa", "Bureaux", "Site", "5kVA", "3kVA", "10kVA", "15kVA", "System", "Garage", "Logement"]
            
            for kw in keywords_to_remove:
                # Case insensitive replacement at the end or middle
                clean_name = re.sub(f"\\b{kw}\\b", "", clean_name, flags=re.IGNORECASE)
                
            # 3. Trim extra spaces
            clean_name = " ".join(clean_name.split())
            
            # Fallback if name becomes empty
            client_name = clean_name if len(clean_name) > 2 else sys_name
            
            # Check if this client already exists
            db_client = db.query(models.Client).filter(models.Client.nom == client_name).first()
            now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

            if not db_client:
                # Create new client for this system
                new_client_id = str(uuid.uuid4())
                db_client = models.Client(
                    id=new_client_id,
                    nom=client_name,
                    client="Particulier",
                    telephone="", # No data from VRM
                    email="",     # No data from VRM
                    categorie="Bronze",
                    localisation=inst.get("timezone", ""),
                    technicien="Non spécifié",
                    created_at=now,
                    updated_at=now,
                    created_by="VRM Auto-Sync",
                    updated_by="VRM Auto-Sync",
                    history=[{"action": "Création Automatique via VRM", "date": now, "user": "System"}]
                )
                db.add(db_client)
                db.commit()
                db.refresh(db_client)
                print(f"Created new client from VRM: {client_name}")

            if existing_sys:
                # Update existing system
                # We do NOT update the client_id here to avoid moving systems if user manually organized them
                for key, value in sys_data.items():
                    setattr(existing_sys, key, value)
                existing_sys.updated_at = now
                existing_sys.updated_by = "VRM Sync"
            else:
                # Create new system
                new_sys = models.System(
                    **sys_data,
                    id=str(uuid.uuid4()),
                    client_id=db_client.id, # Link to the newly created/found client
                    created_at=now,
                    updated_at=now,
                    created_by="VRM Sync",
                    updated_by="VRM Sync"
                )
                db.add(new_sys)
        
        db.commit()
        print(f"VRM Sync completed at {datetime.datetime.now()}")
    except Exception as e:
        print(f"Error during VRM Sync: {e}")
        db.rollback()
    finally:
        db.close()
        with SYNC_LOCK:
            IS_SYNCING = False

# --- AUTO EMAIL REMINDERS LOGIC ---

def process_invoice_reminders(db: Session = None):
    """
    Logique centrale : 
    1. Marque les factures comme RETARD si échéance dépassée.
    2. Envoie des emails pour les factures RETARD (max 1 par jour par facture).
    """
    manage_session = False
    if db is None:
        db = SessionLocal()
        manage_session = True
        
    try:
        today = datetime.datetime.now().date()
        today_str = today.strftime("%Y-%m-%d")
        
        # 1. Mise à jour des statuts
        invoices_to_update = db.query(models.Invoice).filter(models.Invoice.status == "EN ATTENTE").all()
        updated = False
        for inv in invoices_to_update:
            if inv.due_date:
                try:
                    due_date = datetime.datetime.strptime(inv.due_date, "%Y-%m-%d").date()
                    if due_date < today:
                        inv.status = "RETARD"
                        inv.updated_at = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                        updated = True
                except ValueError:
                    pass
        if updated:
            db.commit()

        # 2. Envoi des emails
        admin_email = os.getenv("EMAIL_DEST")
        if admin_email:
            overdue_invoices = db.query(models.Invoice).filter(models.Invoice.status == "RETARD").all()
            for inv in overdue_invoices:
                # Vérifier si un email a déjà été envoyé aujourd'hui pour cette facture
                notif_exists = db.query(models.Notification).filter(
                    models.Notification.item_type == "Invoice",
                    models.Notification.item_name == inv.invoice_number,
                    models.Notification.type == "email_reminder",
                    models.Notification.date.like(f"{today_str}%")
                ).first()

                if not notif_exists:
                    client = db.query(models.Client).filter(models.Client.id == inv.client_id).first()
                    client_name = client.nom if client else "Client"
                    
                    print(f"Envoi rappel auto pour {inv.invoice_number}...")
                    success = send_overdue_invoice_email(
                        recipient_email=admin_email,
                        invoice_number=inv.invoice_number,
                        amount=inv.total_amount,
                        client_name=client_name,
                        due_date=inv.due_date
                    )
                    
                    if success:
                        db.add(models.Notification(
                            id=str(uuid.uuid4()),
                            type="email_reminder",
                            item_type="Invoice",
                            item_name=inv.invoice_number,
                            user="System",
                            role="SYSTEM",
                            date=datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                            details=f"Rappel email automatique envoyé pour {inv.invoice_number}",
                            read=True
                        ))
                        db.commit()

        # 3. Rappel préventif J-2
        if admin_email:
            upcoming_date = today + datetime.timedelta(days=2)
            upcoming_str = upcoming_date.strftime("%Y-%m-%d")
            
            # On cherche les factures EN ATTENTE qui arrivent à échéance dans 2 jours
            upcoming_invoices = db.query(models.Invoice).filter(
                models.Invoice.status == "EN ATTENTE",
                models.Invoice.due_date == upcoming_str
            ).all()

            for inv in upcoming_invoices:
                # Vérifier si un rappel J-2 a déjà été envoyé pour cette facture
                reminder_exists = db.query(models.Notification).filter(
                    models.Notification.item_type == "Invoice",
                    models.Notification.item_name == inv.invoice_number,
                    models.Notification.type == "email_upcoming_due"
                ).first()

                if not reminder_exists:
                    client = db.query(models.Client).filter(models.Client.id == inv.client_id).first()
                    client_name = client.nom if client else "Client"
                    
                    print(f"Envoi rappel J-2 pour {inv.invoice_number}...")
                    success = send_upcoming_due_email(
                        recipient_email=admin_email,
                        invoice_number=inv.invoice_number,
                        amount=inv.total_amount,
                        client_name=client_name,
                        due_date=inv.due_date
                    )
                    
                    if success:
                        db.add(models.Notification(
                            id=str(uuid.uuid4()),
                            type="email_upcoming_due",
                            item_type="Invoice",
                            item_name=inv.invoice_number,
                            user="System",
                            role="SYSTEM",
                            date=datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                            details=f"Rappel préventif J-2 envoyé pour {inv.invoice_number}",
                            read=True
                        ))
                        db.commit()
    except Exception as e:
        print(f"Erreur dans process_invoice_reminders: {e}")
    finally:
        if manage_session:
            db.close()

def auto_send_reminders_loop():
    """Tâche de fond qui tourne périodiquement."""
    import time
    time.sleep(15) # Attendre le démarrage
    print("Boucle de rappel activée.")
    while True:
        try:
            process_invoice_reminders()
        except:
            pass
        time.sleep(1800) # Toutes les 30 min

# Lancement du thread
threading.Thread(target=auto_send_reminders_loop, daemon=True).start()

# --- CHAT REALTIME MANAGER ---
class ConnectionManager:
    def __init__(self):
        self.active_connections: dict = {} # Map user_id -> List of WebSockets

    async def connect(self, user_id: str, websocket: WebSocket):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)

    def disconnect(self, user_id: str, websocket: WebSocket):
        if user_id in self.active_connections:
            if websocket in self.active_connections[user_id]:
                self.active_connections[user_id].remove(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]

    async def broadcast(self, message: dict):
        # Envoie à tout le monde
        for user_sockets in self.active_connections.values():
            for connection in user_sockets:
                try:
                    await connection.send_json(message)
                except:
                    pass

    async def send_to_user(self, user_id: str, message: dict):
        if user_id in self.active_connections:
            for connection in self.active_connections[user_id]:
                try:
                    await connection.send_json(message)
                except:
                    pass

manager = ConnectionManager()

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
                full_name="Administrateur",
                location="Antananarivo"

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
    location: str | None = None


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
    end_date: str | None = None

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
    files: list[str] | None = []

class InvoiceBase(BaseModel):
    invoice_number: str
    client_id: str
    system_id: str | None = None
    date: str
    due_date: str
    status: str = "EN ATTENTE"
    total_amount: float = 0.0
    items: list[dict] = [] # {description, qty, price, total}
    notes: str | None = None

class EventBase(BaseModel):
    title: str
    description: str | None = None
    start_date: str
    end_date: str
    type: str
    user_id: str
    user_name: str | None = None
    location: str | None = None
    color: str = "#6366f1"


class ArticleBase(BaseModel):
    title: str
    content: str
    category: str
    tags: str
    author_name: str


# --- ENDPOINTS API ---

@app.get("/api/articles")
def get_articles(db: Session = Depends(get_db)):
    return db.query(models.KnowledgeArticle).all()

@app.post("/api/articles")
def create_article(article: ArticleBase, db: Session = Depends(get_db)):
    now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    new_article = models.KnowledgeArticle(
        id=str(uuid.uuid4()),
        created_at=now,
        updated_at=now,
        **article.model_dump()
    )
    db.add(new_article)
    db.commit()
    db.refresh(new_article)
    return new_article

@app.put("/api/articles/{article_id}")
def update_article(article_id: str, article: ArticleBase, db: Session = Depends(get_db)):
    db_article = db.query(models.KnowledgeArticle).filter(models.KnowledgeArticle.id == article_id).first()
    if not db_article:
        raise HTTPException(status_code=404, detail="Article not found")
    
    for key, value in article.model_dump().items():
        setattr(db_article, key, value)
    
    db_article.updated_at = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    db.commit()
    db.refresh(db_article)
    return db_article

@app.delete("/api/articles/{article_id}")
def delete_article(article_id: str, db: Session = Depends(get_db)):
    db_article = db.query(models.KnowledgeArticle).filter(models.KnowledgeArticle.id == article_id).first()
    if not db_article:
        raise HTTPException(status_code=404, detail="Article not found")
    db.delete(db_article)
    db.commit()
    return {"message": "Article deleted"}

@app.get("/api/events")
def get_events(db: Session = Depends(get_db)):
    return db.query(models.CalendarEvent).all()

@app.post("/api/events")
def create_event(event: EventBase, db: Session = Depends(get_db)):
    new_event = models.CalendarEvent(
        id=str(uuid.uuid4()),
        created_at=datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        **event.model_dump()
    )
    db.add(new_event)
    db.commit()
    db.refresh(new_event)
    return new_event

@app.put("/api/events/{event_id}")
def update_event(event_id: str, event_data: EventBase, db: Session = Depends(get_db)):
    db_event = db.query(models.CalendarEvent).filter(models.CalendarEvent.id == event_id).first()
    if not db_event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    for key, value in event_data.model_dump().items():
        setattr(db_event, key, value)
    
    db.commit()
    db.refresh(db_event)
    return db_event

@app.delete("/api/events/{event_id}")
def delete_event(event_id: str, db: Session = Depends(get_db)):

    event = db.query(models.CalendarEvent).filter(models.CalendarEvent.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    db.delete(event)
    db.commit()
    return {"message": "Event deleted"}

@app.get("/")

def root():
    return {
        "status": "SAV API Fully Connected",
        "version": "1.0.2",
        "database": "PostgreSQL" if "postgresql" in engine.url.drivername else "SQLite",
        "time": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }

# --- DEBUG LOGS ENDPOINT ---
@app.get("/api/debug/logs")
def get_debug_logs(lines: int = 100):
    """Permet de voir les derniers logs directement depuis l'API"""
    try:
        if not os.path.exists("app_prod.log"):
            return {"message": "Aucun log trouvé."}
        with open("app_prod.log", "r") as f:
            content = f.readlines()
            return {"logs": content[-lines:]}
    except Exception as e:
        return {"error": str(e)}

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
    return {"token": "abcd1234", "user": {"id": user.id, "email": user.email, "role": user.role, "full_name": user.full_name, "location": user.location}}


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

@app.post("/api/systems/sync")
def trigger_vrm_sync():
    global IS_SYNCING
    if IS_SYNCING:
        return {"message": "Synchronisation déjà en cours"}
    
    thread = threading.Thread(target=sync_vrm_data)
    thread.start()
    return {"message": "Synchronisation VRM lancée en arrière-plan"}

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

@app.post("/api/notifications/{notif_id}/read")
def mark_notification_read(notif_id: str, db: Session = Depends(get_db)):
    db_notif = db.query(models.Notification).filter(models.Notification.id == notif_id).first()
    if db_notif:
        db_notif.read = True
        db.commit()
    return {"message": "Notification lue"}

@app.post("/api/notifications/clear")
def clear_notifications(db: Session = Depends(get_db)):
    db.query(models.Notification).delete()
    db.commit()
    return {"message": "Toutes les notifications ont ete supprimees"}

# --- INVOICES ---
@app.get("/api/invoices")
def get_invoices(background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Récupère les factures et vérifie les retards en tâche de fond."""
    background_tasks.add_task(process_invoice_reminders)
    return db.query(models.Invoice).all()

@app.post("/api/invoices")
def create_invoice(invoice: InvoiceBase, background_tasks: BackgroundTasks, db: Session = Depends(get_db), user_name: str = Query("Systeme"), user_role: str = Query("ADMIN")):
    try:
        now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        background_tasks.add_task(process_invoice_reminders)
        new_invoice = models.Invoice(**invoice.model_dump(), id=str(uuid.uuid4()), created_at=now, updated_at=now, created_by=user_name)
        
        db.add(new_invoice)
        db_notif = models.Notification(
            id=str(uuid.uuid4()), 
            type="creation", 
            item_type="Invoice", 
            item_name=invoice.invoice_number, 
            user=user_name, 
            role=user_role, 
            date=now, 
            details=f"Nouvelle facture creee : {invoice.invoice_number}", 
            read=False
        )
        db.add(db_notif)
        db.commit()
        return new_invoice
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/invoices/{invoice_id}")
def update_invoice(invoice_id: str, invoice: InvoiceBase, background_tasks: BackgroundTasks, db: Session = Depends(get_db), user_name: str = Query("Systeme")):
    try:
        background_tasks.add_task(process_invoice_reminders)
        db_inv = db.query(models.Invoice).filter(models.Invoice.id == invoice_id).first()
        if not db_inv:
            raise HTTPException(status_code=404, detail="Facture non trouvée")
        
        now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        for key, value in invoice.model_dump().items():
            setattr(db_inv, key, value)
            
        db_inv.updated_at = now
        db.commit()
        return db_inv
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/invoices/send-reminders")
def send_invoice_reminders(db: Session = Depends(get_db)):
    try:
        overdue_invoices = db.query(models.Invoice).filter(models.Invoice.status == "RETARD").all()
        sent_count = 0
        admin_email = os.getenv("EMAIL_DEST")
        
        if not admin_email:
            raise HTTPException(status_code=400, detail="EMAIL_DEST non configuré")

        for invoice in overdue_invoices:
            client_name = "Client"
            client = db.query(models.Client).filter(models.Client.id == invoice.client_id).first()
            if client:
                client_name = client.nom
                
            success = send_overdue_invoice_email(
                recipient_email=admin_email,
                invoice_number=invoice.invoice_number,
                amount=invoice.total_amount,
                client_name=client_name,
                due_date=invoice.due_date
            )
            if success:
                sent_count += 1
        
        return {"message": f"{sent_count} rappel(s) envoyé(s) avec succès"}
    except Exception as e:
        print(f"ERREUR DANS send_invoice_reminders: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.patch("/api/invoices/{invoice_id}/status")
def update_invoice_status(invoice_id: str, request: dict, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    try:
        db_inv = db.query(models.Invoice).filter(models.Invoice.id == invoice_id).first()
        if not db_inv:
            raise HTTPException(status_code=404, detail="Facture non trouvée")
        
        old_status = db_inv.status
        new_status = request.get("status")
        
        db_inv.status = new_status
        db_inv.updated_at = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        client = db.query(models.Client).filter(models.Client.id == db_inv.client_id).first()
        client_name = client.nom if client else "Client"
        admin_email = os.getenv("EMAIL_DEST")

        # Cas 1 : Passage manuel à RETARD -> Email d'alerte immédiat
        if new_status == "RETARD" and old_status != "RETARD":
            if admin_email:
                background_tasks.add_task(
                    send_overdue_invoice_email,
                    recipient_email=admin_email,
                    invoice_number=db_inv.invoice_number,
                    amount=db_inv.total_amount,
                    client_name=client_name,
                    due_date=db_inv.due_date
                )
        
        # Cas 2 : Passage de RETARD à PAYEE -> Confirmation
        if old_status == "RETARD" and new_status == "PAYEE":
            if admin_email:
                background_tasks.add_task(
                    send_payment_confirmation_email,
                    recipient_email=admin_email,
                    invoice_number=db_inv.invoice_number,
                    amount=db_inv.total_amount,
                    client_name=client_name
                )

        db.commit()
        return {"message": "Statut mis à jour"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/invoices/{invoice_id}")
def delete_invoice(invoice_id: str, db: Session = Depends(get_db)):
    try:
        db.query(models.Invoice).filter(models.Invoice.id == invoice_id).delete()
        db.commit()
        return {"message": "Facture supprimee"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

# --- AI ASSISTANT ENDPOINT ---
@app.post("/api/ai/chat")
async def ai_chat(request: dict):
    """Assistant IA Expert pour le SAV Solaire via OpenRouter"""
    user_message = request.get("message")
    user_context = request.get("context", "")
    
    # Utilisation d'OpenRouter (plus fiable pour les restrictions géographiques)
    OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
    
    if not OPENROUTER_API_KEY:
        # Fallback sur GEMINI_API_KEY si présent
        OPENROUTER_API_KEY = os.getenv("GEMINI_API_KEY")

    if not OPENROUTER_API_KEY:
        return {"content": "Désolé, l'IA n'est pas configurée. Veuillez ajouter OPENROUTER_API_KEY dans votre fichier .env"}

    url = "https://openrouter.ai/api/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "HTTP-Referer": "http://localhost:8000", # Optionnel
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": "google/gemini-flash-1.5-8b:free", # Modèle 100% GRATUIT sur OpenRouter
        "messages": [
            {"role": "system", "content": "Tu es l'Expert SAV de Madagascar Green Power (MGP), expert technique Victron. Réponds en Français de manière concise."},
            {"role": "user", "content": f"Contexte: {user_context}\n\nQuestion: {user_message}"}
        ]
    }
    
    try:
        response = await asyncio.to_thread(requests.post, url, headers=headers, json=payload, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            ai_response = data['choices'][0]['message']['content']
            return {"content": ai_response}
        else:
            return {"content": f"Erreur OpenRouter ({response.status_code}): {response.text}"}
            
    except Exception as e:
        return {"content": f"Erreur de connexion IA : {str(e)}"}

# --- CHAT ENDPOINTS ---

@app.get("/api/weather")
def fetch_weather(location: str = Query("Antananarivo")):
    data = get_weather(location)
    if data:
        return data
    raise HTTPException(status_code=500, detail="Could not fetch weather")


@app.websocket("/ws/chat")

async def websocket_endpoint(websocket: WebSocket, user_id: str = Query(...)):
    await manager.connect(user_id, websocket)
    try:
        while True:
            data = await websocket.receive_json()
            recipient_id = data.get("recipient_id")
            
            if recipient_id:
                # Message privé : envoyer au destinataire ET à l'expéditeur
                await manager.send_to_user(recipient_id, data)
                if recipient_id != user_id:
                    await manager.send_to_user(user_id, data)
            else:
                # Message public
                await manager.broadcast(data)
    except WebSocketDisconnect:
        manager.disconnect(user_id, websocket)
    except Exception as e:
        print(f"WS Error: {e}")
        manager.disconnect(user_id, websocket)

@app.get("/api/messages")
def get_messages(user_id: str = Query(...), db: Session = Depends(get_db)):
    # Filtre : messages publics (recipient_id is None) 
    # OU messages où l'utilisateur est l'expéditeur 
    # OU messages où l'utilisateur est le destinataire
    from sqlalchemy import or_
    return db.query(models.ChatMessage).filter(
        or_(
            models.ChatMessage.recipient_id == None,
            models.ChatMessage.sender_id == user_id,
            models.ChatMessage.recipient_id == user_id
        )
    ).order_by(models.ChatMessage.timestamp.asc()).all()


@app.post("/api/messages/mark-read")
def mark_messages_read(request: dict, db: Session = Depends(get_db)):
    try:
        sender_id = request.get("sender_id")
        recipient_id = request.get("recipient_id")
        
        # Marque comme lus les messages reçus de cet expéditeur précis
        db.query(models.ChatMessage).filter(
            models.ChatMessage.sender_id == sender_id,
            models.ChatMessage.recipient_id == recipient_id,
            models.ChatMessage.read == False
        ).update({models.ChatMessage.read: True})
        
        db.commit()
        return {"message": "Messages marqués comme lus"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/messages")
def save_message(msg: dict, db: Session = Depends(get_db)):
    try:
        new_msg = models.ChatMessage(
            id=str(uuid.uuid4()),
            sender_id=msg.get("sender_id"),
            sender_name=msg.get("sender_name"),
            recipient_id=msg.get("recipient_id"),
            content=msg.get("content"),
            timestamp=datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            read=False
        )
        db.add(new_msg)
        db.commit()
        return new_msg
    except Exception as e:
        db.rollback()
        print(f"Error saving message: {e}")
        raise HTTPException(status_code=500, detail=str(e))



