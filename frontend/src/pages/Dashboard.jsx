import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Dashboard.css";
import { FaUser, FaCogs, FaTicketAlt, FaShieldAlt, FaExclamationTriangle, FaClock, FaCalendarAlt, FaFileInvoiceDollar, FaCheckCircle, FaHourglassHalf, FaSun, FaCloudSun, FaCloudRain } from "react-icons/fa";

import API_BASE_URL from "../api_config";

function Dashboard() {
    const [stats, setStats] = useState({
        clients: 0,
        systems: 0,
        tickets: 0,
        closedTickets: 0,
        unlinkedIC: 0,
        pendingInvoices: 0,
        pendingTotal: 0,
        overdueInvoices: 0,
        overdueTotal: 0,
        paidInvoices: 0,
        paidTotal: 0
    });

    const [currentTime, setCurrentTime] = useState(new Date());
    const [weather, setWeather] = useState(null);
    const navigate = useNavigate();
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const isFacturation = user.role === "FACTURATION";

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const fetchWeather = async () => {
            try {
                const location = user.location || "Antananarivo";
                const res = await fetch(`${API_BASE_URL}/api/weather?location=${encodeURIComponent(location)}`);
                if (res.ok) {
                    const data = await res.json();
                    setWeather(data);
                }
            } catch (err) { }
        };
        fetchWeather();
    }, [user.location]);

    const getWeatherIcon = (code) => {
        if (code === 0) return <FaSun style={{ color: '#fbbf24' }} />;
        if (code >= 1 && code <= 3) return <FaCloudSun style={{ color: '#fbbf24' }} />;
        if (code >= 51 && code <= 67) return <FaCloudRain style={{ color: '#60a5fa' }} />;
        if (code >= 80 && code <= 82) return <FaCloudRain style={{ color: '#60a5fa' }} />;
        return <FaCloudSun style={{ color: '#94a3b8' }} />;
    };

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const [cliRes, sysRes, tickRes, intRes, invRes] = await Promise.all([
                    fetch(`${API_BASE_URL}/api/clients`),
                    fetch(`${API_BASE_URL}/api/systems`),
                    fetch(`${API_BASE_URL}/api/tickets`),
                    fetch(`${API_BASE_URL}/api/interventions`),
                    fetch(`${API_BASE_URL}/api/invoices`)
                ]);

                if (cliRes.ok && sysRes.ok && tickRes.ok && intRes.ok && invRes.ok) {
                    const clients = await cliRes.json();
                    const systems = await sysRes.json();
                    const tickets = await tickRes.json();
                    const interventions = await intRes.json();
                    const invoices = await invRes.json();

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
                        unlinkedIC,
                        pendingInvoices: invoices.filter(i => i.status === "EN ATTENTE").length,
                        pendingTotal: invoices.filter(i => i.status === "EN ATTENTE").reduce((acc, curr) => acc + (curr.total_amount || 0), 0),
                        overdueInvoices: invoices.filter(i => i.status === "RETARD").length,
                        overdueTotal: invoices.filter(i => i.status === "RETARD").reduce((acc, curr) => acc + (curr.total_amount || 0), 0),
                        paidInvoices: invoices.filter(i => i.status === "PAYEE").length,
                        paidTotal: invoices.filter(i => i.status === "PAYEE").reduce((acc, curr) => acc + (curr.total_amount || 0), 0)
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
                </div>

                {weather && (
                    <div className="weather-widget">
                        <div className="weather-icon-main">
                            {getWeatherIcon(weather.weathercode)}
                        </div>
                        <div className="weather-info-main">
                            <span className="weather-temp">{Math.round(weather.temp)}°C</span>
                            <span className="weather-city">{weather.city}</span>
                        </div>
                    </div>
                )}

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
                <div className="stat-card clients-card" onClick={() => !isFacturation && navigate("/clients")} style={{ cursor: isFacturation ? 'default' : 'pointer' }}>
                    <div className="stat-icon">
                        <FaUser size={30} />
                    </div>
                    <div className="stat-info">
                        <h3>Clients</h3>
                        <p className="stat-number">{stats.clients}</p>
                    </div>
                </div>

                <div className="stat-card systems-card" onClick={() => !isFacturation && navigate("/systems")} style={{ cursor: isFacturation ? 'default' : 'pointer' }}>
                    <div className="stat-icon">
                        <FaCogs size={30} />
                    </div>
                    <div className="stat-info">
                        <h3>Systèmes installés</h3>
                        <p className="stat-number">{stats.systems}</p>
                    </div>
                </div>



                <div className="stat-card unlinked-ip-card" onClick={() => !isFacturation && navigate("/interventions?type=preventive")} style={{ cursor: isFacturation ? 'default' : 'pointer' }}>
                    <div className="stat-icon">
                        <FaShieldAlt size={30} />
                    </div>
                    <div className="stat-info">
                        <h3>Interventions IP</h3>
                        <p className="stat-number">{stats.unlinkedIP + stats.closedIP}</p>
                    </div>
                </div>

                <div className="stat-card unlinked-ic-card" onClick={() => !isFacturation && navigate("/interventions?type=corrective")} style={{ cursor: isFacturation ? 'default' : 'pointer' }}>
                    <div className="stat-icon">
                        <FaExclamationTriangle size={30} />
                    </div>
                    <div className="stat-info">
                        <h3>Interventions IC</h3>
                        <p className="stat-number">{stats.unlinkedIC + stats.closedIC}</p>
                    </div>
                </div>

                <div className="stat-card pending-invoices-card" onClick={() => navigate("/invoices?status=EN ATTENTE")}>
                    <div className="stat-icon">
                        <FaHourglassHalf size={30} />
                    </div>
                    <div className="stat-info">
                        <h3>Factures en Attente</h3>
                        <p className="stat-number">{stats.pendingInvoices}</p>
                        <p className="stat-subtitle">{stats.pendingTotal.toLocaleString()} Ar</p>
                    </div>
                </div>

                <div className="stat-card overdue-invoices-card" onClick={() => navigate("/invoices?status=RETARD")}>
                    <div className="stat-icon">
                        <FaExclamationTriangle size={30} />
                    </div>
                    <div className="stat-info">
                        <h3>Factures en Retard</h3>
                        <p className="stat-number">{stats.overdueInvoices}</p>
                        <p className="stat-subtitle">{stats.overdueTotal.toLocaleString()} Ar</p>
                    </div>
                </div>

                <div className="stat-card paid-invoices-card" onClick={() => navigate("/invoices?status=PAYEE")}>
                    <div className="stat-icon">
                        <FaCheckCircle size={30} />
                    </div>
                    <div className="stat-info">
                        <h3>Factures Payées</h3>
                        <p className="stat-number">{stats.paidInvoices}</p>
                        <p className="stat-subtitle" style={{ color: '#10b981' }}>{stats.paidTotal.toLocaleString()} Ar</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Dashboard;
