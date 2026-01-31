import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FaSave, FaPlus, FaTrashAlt } from "react-icons/fa";
import API_BASE_URL from "../api_config";
import "./AddInvoice.css";

function AddInvoice() {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEdit = !!id;
    const user = JSON.parse(localStorage.getItem("user") || "{}");

    const [clients, setClients] = useState([]);
    const [systems, setSystems] = useState([]);

    // Form States
    const [invoiceNumber, setInvoiceNumber] = useState(`F-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000)}`);
    const [clientId, setClientId] = useState("");
    const [systemId, setSystemId] = useState("");
    const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
    const [dueDate, setDueDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() + 30);
        return d.toISOString().split("T")[0];
    });
    const [status, setStatus] = useState("EN ATTENTE");
    const [notes, setNotes] = useState("");

    // Items
    const [items, setItems] = useState([
        { description: "", qty: 1, price: 0 }
    ]);

    useEffect(() => {
        // Fetch clients and systems
        const fetchResources = async () => {
            try {
                const [cliRes, sysRes] = await Promise.all([
                    fetch(`${API_BASE_URL}/api/clients`),
                    fetch(`${API_BASE_URL}/api/systems`)
                ]);
                if (cliRes.ok && sysRes.ok) {
                    setClients(await cliRes.json());
                    setSystems(await sysRes.json());
                }
            } catch (err) {
                console.error("Error loading resources:", err);
            }
        };
        fetchResources();

        if (isEdit) {
            const fetchInvoice = async () => {
                try {
                    const res = await fetch(`${API_BASE_URL}/api/invoices`);
                    if (res.ok) {
                        const all = await res.json();
                        const found = all.find(i => i.id === id);
                        if (found) {
                            setInvoiceNumber(found.invoice_number);
                            setClientId(found.client_id);
                            setSystemId(found.system_id || "");
                            setDate(found.date);
                            setDueDate(found.due_date);
                            setStatus(found.status);
                            setNotes(found.notes || "");
                            setItems(found.items && found.items.length > 0 ? found.items : [{ description: "", qty: 1, price: 0 }]);
                        }
                    }
                } catch (err) {
                    console.error("Error fetching invoice for edit:", err);
                }
            };
            fetchInvoice();
        }
    }, [id, isEdit]);

    const calculateTotal = () => {
        return items.reduce((acc, item) => acc + (item.qty * item.price), 0);
    };

    const handleItemChange = (index, field, value) => {
        const newItems = [...items];
        newItems[index][field] = value;
        setItems(newItems);
    };

    const addItem = () => {
        setItems([...items, { description: "", qty: 1, price: 0 }]);
    };

    const removeItem = (index) => {
        if (items.length > 1) {
            setItems(items.filter((_, i) => i !== index));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        console.log("🔵 Form submission started");

        const invoiceData = {
            invoice_number: invoiceNumber,
            client_id: clientId,
            system_id: systemId || null,
            date: date,
            due_date: dueDate,
            status: status,
            total_amount: calculateTotal(),
            items: items, // Will handle backend JSON conversion
            notes: notes
        };

        console.log("📦 Invoice data to send:", invoiceData);
        console.log("👤 User info:", { full_name: user.full_name, role: user.role });

        try {
            const url = isEdit
                ? `${API_BASE_URL}/api/invoices/${id}?user_name=${encodeURIComponent(user.full_name || "Admin")}`
                : `${API_BASE_URL}/api/invoices?user_name=${encodeURIComponent(user.full_name || "Admin")}&user_role=${user.role}`;

            const response = await fetch(url, {
                method: isEdit ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(invoiceData)
            });

            if (response.ok) {
                alert(isEdit ? "Facture mise à jour !" : "Facture créée avec succès !");
                navigate("/invoices");
            } else {
                const errorText = await response.text();
                alert(`Erreur: ${errorText}`);
            }
        } catch (error) {
            console.error("Error:", error);
            alert(`Erreur serveur: ${error.message}`);
        }
    };

    return (
        <div className="add-invoice-container">
            <div className="add-invoice-card animate-fadeIn">
                <div className="add-invoice-header">
                    <h1 className="add-invoice-title">{isEdit ? "Modifier la Facture" : "Nouvelle Facture"}</h1>
                    <p style={{ color: 'rgba(255,255,255,0.6)' }}>{isEdit ? "Mettez à jour les détails de la facture" : "Créez et envoyez une facture client"}</p>
                </div>

                <form onSubmit={handleSubmit} className="add-invoice-form">
                    <div className="form-grid">
                        <label>
                            Numéro de Facture
                            <input
                                type="text"
                                value={invoiceNumber}
                                onChange={(e) => setInvoiceNumber(e.target.value)}
                                required
                            />
                        </label>

                        <label>
                            Statut
                            <select value={status} onChange={(e) => setStatus(e.target.value)}>
                                <option value="EN ATTENTE">En Attente</option>
                                <option value="PAYEE">Payée</option>
                                <option value="RETARD">En Retard</option>
                                <option value="ANNULEE">Annulée</option>
                            </select>
                        </label>

                        <label>
                            Client
                            <select value={clientId} onChange={(e) => setClientId(e.target.value)} required>
                                <option value="">Sélectionner un client...</option>
                                {clients.map(c => (
                                    <option key={c.id} value={c.id}>{c.nom}</option>
                                ))}
                            </select>
                        </label>

                        <label>
                            Système associé (Optionnel)
                            <select value={systemId} onChange={(e) => setSystemId(e.target.value)}>
                                <option value="">Aucun</option>
                                {systems
                                    .filter(s => !clientId || s.client_id === clientId)
                                    .map(s => (
                                        <option key={s.id} value={s.id}>{s.monitoring_name}</option>
                                    ))
                                }
                            </select>
                        </label>

                        <label>
                            Date d'émission
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                required
                            />
                        </label>

                        <label>
                            Date d'échéance
                            <input
                                type="date"
                                value={dueDate}
                                onChange={(e) => setDueDate(e.target.value)}
                                required
                            />
                        </label>
                    </div>

                    <div className="form-section-title">Articles & Services</div>

                    <div className="items-section">
                        {items.map((item, index) => (
                            <div key={index} className="invoice-item-row">
                                <label>
                                    Description
                                    <input
                                        type="text"
                                        value={item.description}
                                        onChange={(e) => handleItemChange(index, "description", e.target.value)}
                                        placeholder="Ex: Maintenance préventive"
                                        required
                                    />
                                </label>
                                <label>
                                    Quantité
                                    <input
                                        type="number"
                                        min="1"
                                        value={item.qty}
                                        onChange={(e) => handleItemChange(index, "qty", parseFloat(e.target.value))}
                                        required
                                    />
                                </label>
                                <label>
                                    Prix Unitaire (Ar)
                                    <input
                                        type="number"
                                        min="0"
                                        step="100"
                                        value={item.price}
                                        onChange={(e) => handleItemChange(index, "price", parseFloat(e.target.value))}
                                        required
                                    />
                                </label>
                                <button type="button" className="remove-item-btn" onClick={() => removeItem(index)}>
                                    <FaTrashAlt />
                                </button>
                            </div>
                        ))}

                        <button type="button" className="add-item-btn" onClick={addItem}>
                            <FaPlus /> Ajouter une ligne
                        </button>
                    </div>

                    <div className="total-display">
                        Total: {calculateTotal().toLocaleString()} Ar
                    </div>

                    <label className="full-width">
                        Notes / Conditions
                        <textarea
                            rows="3"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Conditions de paiement, instructions bancaires..."
                        />
                    </label>

                    <button type="submit" className="submit-btn">
                        <FaSave /> Enregistrer la Facture
                    </button>
                </form>
            </div>
        </div>
    );
}

export default AddInvoice;
