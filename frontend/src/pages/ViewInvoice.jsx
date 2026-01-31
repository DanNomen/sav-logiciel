import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FaArrowLeft, FaPrint, FaDownload, FaFileInvoiceDollar } from "react-icons/fa";
import API_BASE_URL from "../api_config";
import "./ViewInvoice.css";

function ViewInvoice() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [invoice, setInvoice] = useState(null);
    const [client, setClient] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchInvoiceData = async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/api/invoices`);
                if (res.ok) {
                    const invoices = await res.json();
                    const found = invoices.find(inv => inv.id === id);
                    if (found) {
                        setInvoice(found);
                        // Fetch client info
                        const cliRes = await fetch(`${API_BASE_URL}/api/clients`);
                        if (cliRes.ok) {
                            const clients = await cliRes.json();
                            setClient(clients.find(c => c.id === found.client_id));
                        }
                    }
                }
            } catch (err) {
                console.error("Error fetching invoice:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchInvoiceData();
    }, [id]);

    const handlePrint = () => {
        window.print();
    };

    if (loading) return <div className="loading-state">Chargement...</div>;
    if (!invoice) return <div className="error-state">Facture non trouvée</div>;

    return (
        <div className="view-invoice-container animate-fadeIn">
            <div className="view-invoice-header no-print">
                <button className="back-btn" onClick={() => navigate("/invoices")}>
                    <FaArrowLeft /> Retour
                </button>
                <div className="header-actions">
                    <button className="print-btn" onClick={handlePrint}>
                        <FaPrint /> Imprimer
                    </button>
                </div>
            </div>

            <div className="invoice-paper" id="invoice-to-print">
                <div className="invoice-paper-header">
                    <div className="company-info">
                        <div className="company-logo">
                            <FaFileInvoiceDollar size={40} color="#3b82f6" />
                            <span>SAV LOGICIEL</span>
                        </div>
                        <p>Madagascar Green Power</p>
                        <p>Antananarivo, Madagascar</p>
                        <p>Contact: informatique.mgp@madagreen.com</p>
                    </div>
                    <div className="invoice-meta">
                        <h1>FACTURE</h1>
                        <p className="invoice-number">#{invoice.invoice_number}</p>
                        <div className="meta-grid">
                            <span>Date:</span> <strong>{invoice.date}</strong>
                            <span>Échéance:</span> <strong>{invoice.due_date}</strong>
                            <span>Statut:</span> <strong className={`status-${invoice.status.toLowerCase()}`}>{invoice.status}</strong>
                        </div>
                    </div>
                </div>

                <div className="invoice-addresses">
                    <div className="bill-to">
                        <h3>Facturé à :</h3>
                        <strong>{client?.nom || "Client inconnu"}</strong>
                        <p>{client?.localisation || "Adresse non spécifiée"}</p>
                        <p>{client?.email}</p>
                        <p>{client?.telephone}</p>
                    </div>
                </div>

                <table className="invoice-items-table">
                    <thead>
                        <tr>
                            <th>Description</th>
                            <th className="text-center">Qté</th>
                            <th className="text-right">Prix Unitaire</th>
                            <th className="text-right">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {invoice.items && invoice.items.map((item, index) => (
                            <tr key={index}>
                                <td>{item.description}</td>
                                <td className="text-center">{item.qty}</td>
                                <td className="text-right">{item.price?.toLocaleString()} Ar</td>
                                <td className="text-right">{(item.qty * item.price)?.toLocaleString()} Ar</td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                <div className="invoice-summary">
                    <div className="notes-section">
                        <h4>Notes :</h4>
                        <p>{invoice.notes || "Aucune note particulière."}</p>
                    </div>
                    <div className="totals-section">
                        <div className="total-row grand-total">
                            <span>TOTAL</span>
                            <span>{invoice.total_amount?.toLocaleString()} Ar</span>
                        </div>
                    </div>
                </div>

                <div className="invoice-footer-msg">
                    <p>Merci de votre confiance !</p>
                    <p>Paiement par virement ou chèque à l'ordre de Madagascar Green Power.</p>
                </div>
            </div>
        </div>
    );
}

export default ViewInvoice;
