import React, { useEffect, useState } from "react";
import "./Dashboard.css";
import { FaUser, FaCogs, FaTicketAlt, FaShieldAlt, FaExclamationTriangle } from "react-icons/fa";

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

    return (
        <div className="dashboard-container">
            <div className="dashboard-header">
                <h1>Dashboard</h1>
            </div>

            <div className="stats-grid">
                <div className="stat-card clients-card">
                    <div className="stat-icon">
                        <FaUser size={30} />
                    </div>
                    <div className="stat-info">
                        <h3>Clients</h3>
                        <p className="stat-number">{stats.clients}</p>
                    </div>
                </div>

                <div className="stat-card systems-card">
                    <div className="stat-icon">
                        <FaCogs size={30} />
                    </div>
                    <div className="stat-info">
                        <h3>Systèmes installés</h3>
                        <p className="stat-number">{stats.systems}</p>
                    </div>
                </div>

                <div className="stat-card tickets-card">
                    <div className="stat-icon">
                        <FaTicketAlt size={30} />
                    </div>
                    <div className="stat-info">
                        <h3>Tickets Ouverts</h3>
                        <p className="stat-number">{stats.tickets}</p>
                    </div>
                </div>

                <div className="stat-card closed-tickets-card">
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

                <div className="stat-card unlinked-ip-card">
                    <div className="stat-icon">
                        <FaShieldAlt size={30} />
                    </div>
                    <div className="stat-info">
                        <h3>IP Hors Ticket</h3>
                        <p className="stat-number">{stats.unlinkedIP}</p>
                    </div>
                </div>

                <div className="stat-card unlinked-ic-card">
                    <div className="stat-icon">
                        <FaExclamationTriangle size={30} />
                    </div>
                    <div className="stat-info">
                        <h3>IC Hors Ticket</h3>
                        <p className="stat-number">{stats.unlinkedIC}</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Dashboard;
