import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Dashboard.css";
import { FaUser, FaCogs, FaTicketAlt, FaShieldAlt, FaExclamationTriangle, FaClock, FaCalendarAlt } from "react-icons/fa";

function Dashboard() {
    const [stats, setStats] = useState({
        clients: 0,
        systems: 0,
        tickets: 0,
        closedTickets: 0,
        closedIP: 0,
        closedIC: 0,
        unlinkedIP: 0,
        unlinkedIC: 0
    });

    const [currentTime, setCurrentTime] = useState(new Date());
    const navigate = useNavigate();

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const [cliRes, sysRes, tickRes, intRes] = await Promise.all([
                    fetch("http://localhost:8000/api/clients"),
                    fetch("http://localhost:8000/api/systems"),
                    fetch("http://localhost:8000/api/tickets"),
                    fetch("http://localhost:8000/api/interventions")
                ]);

                if (cliRes.ok && sysRes.ok && tickRes.ok && intRes.ok) {
                    const clients = await cliRes.json();
                    const systems = await sysRes.json();
                    const tickets = await tickRes.json();
                    const interventions = await intRes.json();

                    const closed = tickets.filter(t => t.status === "Fermé");
                    const closedIds = new Set(closed.map(t => t.id));

                    const closedIP = interventions.filter(i => i.ticket_id && closedIds.has(i.ticket_id) && i.type === "preventive").length;
                    const closedIC = interventions.filter(i => i.ticket_id && closedIds.has(i.ticket_id) && i.type === "corrective").length;

                    const unlinkedIP = interventions.filter(i => (!i.ticket_id || i.ticket_id === "") && i.type === "preventive").length;
                    const unlinkedIC = interventions.filter(i => (!i.ticket_id || i.ticket_id === "") && i.type === "corrective").length;

                    setStats({
                        clients: clients.length,
                        systems: systems.length,
                        tickets: tickets.filter(t => t.status !== "Fermé").length,
                        closedTickets: closed.length,
                        closedIP,
                        closedIC,
                        unlinkedIP,
                        unlinkedIC
                    });
                }
            } catch (error) {
                console.error("Error fetching stats:", error);
            }
        };

        fetchStats();
    }, []);

    const formatTime = (date) => {
        return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };

    const formatDate = (date) => {
        return date.toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    };

    return (
        <div className="dashboard-container">
            <div className="dashboard-header">
                <div>
                    <h1>Dashboard</h1>
                    <p className="dashboard-subtitle">Aperçu global de l'activité</p>
                </div>
                <div className="real-time-clock">
                    <div className="clock-item">
                        <FaClock className="clock-icon" />
                        <span className="time-text">{formatTime(currentTime)}</span>
                    </div>
                    <div className="date-item">
                        <FaCalendarAlt className="date-icon" />
                        <span className="date-text">{formatDate(currentTime)}</span>
                    </div>
                </div>
            </div>

            <div className="stats-grid">
                <div className="stat-card clients-card" onClick={() => navigate("/clients")}>
                    <div className="stat-icon">
                        <FaUser size={30} />
                    </div>
                    <div className="stat-info">
                        <h3>Clients</h3>
                        <p className="stat-number">{stats.clients}</p>
                    </div>
                </div>

                <div className="stat-card systems-card" onClick={() => navigate("/systems")}>
                    <div className="stat-icon">
                        <FaCogs size={30} />
                    </div>
                    <div className="stat-info">
                        <h3>Systèmes installés</h3>
                        <p className="stat-number">{stats.systems}</p>
                    </div>
                </div>

                <div className="stat-card tickets-card" onClick={() => navigate("/tickets?status=Ouvert,En Attente")}>
                    <div className="stat-icon">
                        <FaTicketAlt size={30} />
                    </div>
                    <div className="stat-info">
                        <h3>Tickets Ouverts</h3>
                        <p className="stat-number">{stats.tickets}</p>
                    </div>
                </div>

                <div className="stat-card closed-tickets-card" onClick={() => navigate("/tickets?status=Fermé")}>
                    <div className="stat-icon">
                        <FaTicketAlt size={30} />
                    </div>
                    <div className="stat-info">
                        <h3>Tickets Fermés</h3>
                        <p className="stat-number">{stats.closedTickets}</p>
                        <div className="stat-subtitle-row">
                            <span className="mini-stat"><FaShieldAlt size={12} color="#10b981" /> {stats.closedIP} IP</span>
                            <span className="stat-separator">|</span>
                            <span className="mini-stat"><FaExclamationTriangle size={12} color="#f59e0b" /> {stats.closedIC} IC</span>
                        </div>
                    </div>
                </div>

                <div className="stat-card unlinked-ip-card" onClick={() => navigate("/interventions?type=preventive")}>
                    <div className="stat-icon">
                        <FaShieldAlt size={30} />
                    </div>
                    <div className="stat-info">
                        <h3>Interventions IP</h3>
                        <p className="stat-number">{stats.unlinkedIP + stats.closedIP}</p>
                    </div>
                </div>

                <div className="stat-card unlinked-ic-card" onClick={() => navigate("/interventions?type=corrective")}>
                    <div className="stat-icon">
                        <FaExclamationTriangle size={30} />
                    </div>
                    <div className="stat-info">
                        <h3>Interventions IC</h3>
                        <p className="stat-number">{stats.unlinkedIC + stats.closedIC}</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Dashboard;
