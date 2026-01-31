import os
from dotenv import load_dotenv
from email_utils import send_overdue_invoice_email

# Charger les variables d'environnement
load_dotenv()

def test_manual_email():
    dest = os.getenv("EMAIL_DEST")
    print(f"Tentative d'envoi d'un email de test à : {dest}...")
    
    success = send_overdue_invoice_email(
        recipient_email=dest,
        invoice_number="TEST-2026-001",
        amount=150000,
        client_name="Client Test",
        due_date="2026-01-25"
    )
    
    if success:
        print("✅ SUCCÈS : L'email a été envoyé ! Vérifiez votre boîte dan.nomen@gmail.com")
    else:
        print("❌ ÉCHEC : L'email n'a pas pu être envoyé. Vérifiez vos identifiants dans le .env")

if __name__ == "__main__":
    test_manual_email()
