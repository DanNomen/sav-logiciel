import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FaPlus, FaFileInvoiceDollar, FaTrashAlt, FaEdit, FaEye, FaExclamationTriangle } from "react-icons/fa";
import API_BASE_URL from "../api_config";
import "./InvoiceList.css";

function InvoiceList() {
    const navigate = useNavigate();
    const location = useLocation();
    const queryParams = new URLSearchParams(location.search);
    const statusFilter = queryParams.get("status");

    const [invoices, setInvoices] = useState([]);
    const [clients, setClients] = useState({});
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [invRes, cliRes] = await Promise.all([
                fetch(`${API_BASE_URL}/api/invoices`),
                fetch(`${API_BASE_URL}/api/clients`)
            ]);

            if (invRes.ok && cliRes.ok) {
                const invData = await invRes.json();
                const cliData = await cliRes.json();

                const cliMap = {};
                cliData.forEach(c => cliMap[c.id] = c);

                setInvoices(invData);
                setClients(cliMap);
            }
        } catch (error) {
            console.error("Error fetching data:", error);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm("Voulez-vous vraiment supprimer cette facture ?")) {
            try {
                const response = await fetch(`${API_BASE_URL}/api/invoices/${id}`, { method: 'DELETE' });
                if (response.ok) {
                    setInvoices(invoices.filter(i => i.id !== id));
                }
            } catch (error) {
                console.error("Error deleting invoice:", error);
            }
        }
    };

    const handleStatusChange = async (id, newStatus) => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/invoices/${id}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });
            if (response.ok) {
                setInvoices(invoices.map(inv => inv.id === id ? { ...inv, status: newStatus } : inv));
            }
        } catch (error) {
            console.error("Error updating status:", error);
        }
    };

    const getStatusClass = (status) => {
        switch (status?.toUpperCase()) {
            case 'PAYEE': return 'payee';
            case 'RETARD': return 'retard';
            default: return 'attente';
        }
    };

    const isOverdue = (invoice) => {
        if (invoice.status === 'RETARD') {
            return true;
        }
        return false;
    };

    const cycleStatus = (inv) => {
        if (inv.status === 'PAYEE') return; // Verrouillé si payé

        const statuses = ['EN ATTENTE', 'RETARD', 'PAYEE', 'ANNULEE'];
        const currentIndex = statuses.indexOf(inv.status);
        const nextIndex = (currentIndex + 1) % statuses.length;
        const nextStatus = statuses[nextIndex];

        handleStatusChange(inv.id, nextStatus);
    };

    const filteredInvoices = invoices
        .filter(inv => {
            const matchesStatus = statusFilter ? inv.status === statusFilter : true;
            const clientName = clients[inv.client_id]?.nom || "";
            const matchesSearch = inv.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                clientName.toLowerCase().includes(searchTerm.toLowerCase());
            return matchesStatus && matchesSearch;
        })
        .sort((a, b) => {
            const priority = { 'RETARD': 1, 'EN ATTENTE': 2, 'ANNULEE': 3, 'PAYEE': 4 };
            return (priority[a.status] || 99) - (priority[b.status] || 99);
        });

    return (
        <div className="invoice-list-container">
            <div className="invoice-list-header">
                <div className="header-title-area">
                    <h1>Facturation</h1>
                    <div className="header-filter-container">
                        <select
                            className="header-filter-select"
                            value={statusFilter || ""}
                            onChange={(e) => navigate(e.target.value ? `/invoices?status=${e.target.value}` : "/invoices")}
                        >
                            <option value="">Tous les statuts</option>
                            <option value="EN ATTENTE">En Attente</option>
                            <option value="RETARD">En Retard</option>
                            <option value="PAYEE">Payées</option>
                            <option value="ANNULEE">Annulées</option>
                        </select>
                        <div className="search-bar-container">
                            <input
                                type="text"
                                className="header-search-input"
                                placeholder="Rechercher une facture ou un client..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </div>
                <div className="header-actions">
                    <button className="new-invoice-btn" onClick={() => navigate("/add-invoice")}>
                        <FaPlus size={18} /> Nouvelle Facture
                    </button>
                </div>
            </div>

            <div className="invoices-container">
                {filteredInvoices.length === 0 ? (
                    <div className="no-invoices">
                        <FaFileInvoiceDollar size={64} style={{ marginBottom: '1rem', opacity: 0.5 }} />
                        <h3>{statusFilter ? `Aucune facture ${statusFilter}` : "Aucune facture pour le moment"}</h3>
                        <p>{statusFilter ? "Essayez d'enlever le filtre." : "Commencez par en créer une nouvelle."}</p>
                    </div>
                ) : (
                    <div className="table-responsive">
                        <table className="invoices-table">
                            <thead>
                                <tr>
                                    <th>N° Facture</th>
                                    <th>Client</th>
                                    <th>Date</th>
                                    <th>Échéance</th>
                                    <th>Montant</th>
                                    <th>Statut</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredInvoices.map(inv => (
                                    <tr key={inv.id} className={`${isOverdue(inv) ? 'row-overdue' : ''} ${inv.status === 'ANNULEE' ? 'row-cancelled' : ''}`}>
                                        <td>
                                            <div className="invoice-number-container">
                                                <span className={`invoice-number-cell ${isOverdue(inv) ? 'overdue' : ''} ${inv.status === 'EN ATTENTE' ? 'pending' : ''}`}>
                                                    {inv.invoice_number}
                                                </span>
                                            </div>
                                        </td>
                                        <td><strong>{clients[inv.client_id]?.nom || "Client Inconnu"}</strong></td>
                                        <td>{inv.date}</td>
                                        <td className={isOverdue(inv) ? 'overdue-date-cell' : ''}>{inv.due_date}</td>
                                        <td className="amount-cell">{inv.total_amount?.toLocaleString()} Ar</td>
                                        <td>
                                            <select
                                                className={`status-badge-select-mini ${getStatusClass(inv.status)}`}
                                                value={inv.status}
                                                onChange={(e) => handleStatusChange(inv.id, e.target.value)}
                                                disabled={inv.status === 'PAYEE' || inv.status === 'ANNULEE'}
                                            >
                                                <option value="EN ATTENTE">EN ATTENTE</option>
                                                <option value="PAYEE">PAYÉE</option>
                                                <option value="RETARD">EN RETARD</option>
                                                <option value="ANNULEE">ANNULÉE</option>
                                            </select>
                                        </td>
                                        <td>
                                            <div className="table-actions">
                                                {inv.status !== 'ANNULEE' && (
                                                    <button className="table-action-btn view" title="Voir" onClick={() => navigate(`/invoices/${inv.id}`)}>
                                                        <FaEye />
                                                    </button>
                                                )}

                                                {inv.status !== 'PAYEE' && (
                                                    <button className="table-action-btn edit" title="Modifier" onClick={() => navigate(`/edit-invoice/${inv.id}`)}>
                                                        <FaEdit />
                                                    </button>
                                                )}

                                                {inv.status !== 'PAYEE' && inv.status !== 'ANNULEE' && (
                                                    <button className="table-action-btn delete" title="Supprimer" onClick={() => handleDelete(inv.id)}>
                                                        <FaTrashAlt />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

export default InvoiceList;
