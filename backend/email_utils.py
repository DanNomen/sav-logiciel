import smtplib
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

load_dotenv()

# Configuration Gmail via variables d'environnement
SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 587
EMAIL_ADDRESS = os.getenv("EMAIL_USER")  # Votre email : dan.nomen@gmail.com
EMAIL_PASSWORD = os.getenv("EMAIL_PASSWORD") # Mot de passe d'application Google

def send_overdue_invoice_email(recipient_email, invoice_number, amount, client_name, due_date):
    """
    Envoie un email de notification pour une facture en retard.
    """
    if not EMAIL_ADDRESS or not EMAIL_PASSWORD:
        print("Erreur : EMAIL_USER ou EMAIL_PASSWORD non configurés dans le fichier .env")
        return False

    msg = MIMEMultipart()
    msg['From'] = f"SAV Logiciel <{EMAIL_ADDRESS}>"
    msg['To'] = recipient_email
    msg['Subject'] = f"Alerte : Facture en retard n°{invoice_number} - {client_name}"

    body = f"""
    Bonjour,

    Ceci est une notification automatique pour vous informer qu'une facture est en retard de paiement.

    Détails de la facture :
    - Numéro : {invoice_number}
    - Client : {client_name}
    - Montant : {amount} Ar
    - Date d'échéance : {due_date}

    Merci de faire le nécessaire.

    Cordialement,
    Le système SAV Logiciel
    """

    msg.attach(MIMEText(body, 'plain'))

    try:
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(EMAIL_ADDRESS, EMAIL_PASSWORD)
        text = msg.as_string()
        server.sendmail(EMAIL_ADDRESS, recipient_email, text)
        server.quit()
        print(f"Email envoyé avec succès pour la facture {invoice_number}")
        return True
    except Exception as e:
        print(f"Erreur lors de l'envoi de l'email : {e}")
        return False

def send_payment_confirmation_email(recipient_email, invoice_number, amount, client_name):
    """
    Envoie un email de confirmation quand une facture en retard est payée.
    """
    if not EMAIL_ADDRESS or not EMAIL_PASSWORD:
        return False

    msg = MIMEMultipart()
    msg['From'] = f"SAV Logiciel <{EMAIL_ADDRESS}>"
    msg['To'] = recipient_email
    msg['Subject'] = f"Confirmation de Paiement : Facture n°{invoice_number} - {client_name}"

    body = f"""
    Bonjour,

    La facture suivante, qui était en retard, a été marquée comme PAYÉE.

    Détails du paiement :
    - Numéro : {invoice_number}
    - Client : {client_name}
    - Montant : {amount} Ar

    Le dossier a été mis à jour automatiquement.

    Cordialement,
    Le système SAV Logiciel
    """

    msg.attach(MIMEText(body, 'plain'))

    try:
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(EMAIL_ADDRESS, EMAIL_PASSWORD)
        text = msg.as_string()
        server.sendmail(EMAIL_ADDRESS, recipient_email, text)
        server.quit()
        print(f"Confirmation de paiement envoyée pour la facture {invoice_number}")
        return True
    except Exception as e:
        print(f"Erreur envoi confirmation paiement : {e}")
        return False

def send_upcoming_due_email(recipient_email, invoice_number, amount, client_name, due_date):
    """
    Envoie un email de rappel préventif (J-2 avant échéance).
    """
    if not EMAIL_ADDRESS or not EMAIL_PASSWORD:
        return False

    msg = MIMEMultipart()
    msg['From'] = f"SAV Logiciel <{EMAIL_ADDRESS}>"
    msg['To'] = recipient_email
    msg['Subject'] = f"Rappel préventif : Échéance proche (J-2) - Facture n°{invoice_number}"

    body = f"""
    Bonjour,

    Ceci est un rappel automatique pour vous informer que l'échéance d'une facture approche.

    Détails de la facture :
    - Numéro : {invoice_number}
    - Client : {client_name}
    - Montant : {amount} Ar
    - Date d'échéance : {due_date} (dans 2 jours)

    Cordialement,
    Le système SAV Logiciel
    """

    msg.attach(MIMEText(body, 'plain'))

    try:
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(EMAIL_ADDRESS, EMAIL_PASSWORD)
        text = msg.as_string()
        server.sendmail(EMAIL_ADDRESS, recipient_email, text)
        server.quit()
        print(f"Rappel J-2 envoyé avec succès pour {invoice_number}")
        return True
    except Exception as e:
        print(f"Erreur envoi rappel J-2 : {e}")
        return False
