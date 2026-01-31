import React, { useState, useEffect } from "react";
import "./Planning.css";
import { FaChevronLeft, FaChevronRight, FaPlus, FaTrash, FaMapMarkerAlt, FaClock } from "react-icons/fa";
import API_BASE_URL from "../api_config";

function Planning() {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [events, setEvents] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [interventions, setInterventions] = useState([]);
    const [clients, setClients] = useState({});
    const [draggedItem, setDraggedItem] = useState(null);
    const currentUser = JSON.parse(localStorage.getItem("user") || "{}");


    const [newEvent, setNewEvent] = useState({
        title: "",
        description: "",
        start_date: "",
        end_date: "",
        type: "TASK",
        location: currentUser.location || "",
        color: "#6366f1"
    });

    useEffect(() => {
        fetchEvents();
        fetchInterventions();
        fetchClients();
    }, []);

    const fetchClients = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/clients`);
            if (res.ok) {
                const data = await res.json();
                const cliMap = {};
                data.forEach(c => cliMap[c.id] = c.nom);
                setClients(cliMap);
            }
        } catch (err) { }
    };


    const fetchEvents = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/events`);
            if (res.ok) {
                const data = await res.json();
                setEvents(data);
            }
        } catch (err) { }
    };

    const fetchInterventions = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/interventions`);
            if (res.ok) {
                const data = await res.json();
                setInterventions(data);
            }
        } catch (err) { }
    };

    const handleAddEvent = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch(`${API_BASE_URL}/api/events`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...newEvent, user_id: currentUser.id, user_name: currentUser.full_name })
            });

            if (res.ok) {
                fetchEvents();
                setShowModal(false);
                setNewEvent({
                    title: "",
                    description: "",
                    start_date: "",
                    end_date: "",
                    type: "TASK",
                    location: currentUser.location || "",
                    color: "#6366f1"
                });
            }
        } catch (err) { }
    };

    const handleDeleteEvent = async (id) => {
        if (window.confirm("Supprimer cet événement ?")) {
            try {
                await fetch(`${API_BASE_URL}/api/events/${id}`, { method: "DELETE" });
                fetchEvents();
            } catch (err) { }
        }
    };

    const handleDragStart = (item, type) => {
        setDraggedItem({ ...item, dragType: type });
    };

    const handleDrop = async (dateStr) => {
        if (!draggedItem) return;

        try {
            if (draggedItem.dragType === "EVENT") {
                // Calculate shift if multi-day
                const oldStart = draggedItem.start_date.split('T')[0];
                const diffDays = Math.round((new Date(dateStr) - new Date(oldStart)) / (1000 * 60 * 60 * 24));

                const newStart = new Date(draggedItem.start_date);
                newStart.setDate(newStart.getDate() + diffDays);

                const newEnd = new Date(draggedItem.end_date);
                newEnd.setDate(newEnd.getDate() + diffDays);

                const updatedEvent = {
                    ...draggedItem,
                    start_date: newStart.toISOString(),
                    end_date: newEnd.toISOString()
                };
                delete updatedEvent.dragType;

                await fetch(`${API_BASE_URL}/api/events/${draggedItem.id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(updatedEvent)
                });
                fetchEvents();
            } else {
                // Intervention
                const updatedIntervention = { ...draggedItem };
                const oldStart = draggedItem.date;
                const diffDays = Math.round((new Date(dateStr) - new Date(oldStart)) / (1000 * 60 * 60 * 24));

                const newDate = new Date(draggedItem.date);
                newDate.setDate(newDate.getDate() + diffDays);
                updatedIntervention.date = newDate.toISOString().split('T')[0];

                if (draggedItem.end_date) {
                    const newEnd = new Date(draggedItem.end_date);
                    newEnd.setDate(newEnd.getDate() + diffDays);
                    updatedIntervention.end_date = newEnd.toISOString().split('T')[0];
                }

                delete updatedIntervention.dragType;

                const userName = currentUser.full_name || "Admin";
                const userRole = currentUser.role || "ADMIN";

                await fetch(`${API_BASE_URL}/api/interventions/${draggedItem.id}?user_name=${encodeURIComponent(userName)}&user_role=${encodeURIComponent(userRole)}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(updatedIntervention)
                });
                fetchInterventions();
            }
        } catch (err) {
            console.error("Drop error:", err);
        }
        setDraggedItem(null);
    };


    const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

    const renderHeader = () => {
        const months = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
        return (
            <div className="calendar-header">
                <div className="month-nav">
                    <h2>{months[currentDate.getMonth()]} {currentDate.getFullYear()}</h2>
                    <div className="nav-btns">
                        <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))}><FaChevronLeft /></button>
                        <button onClick={() => setCurrentDate(new Date())} className="today-btn">Aujourd'hui</button>
                        <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))}><FaChevronRight /></button>
                    </div>
                </div>
                <button className="add-event-btn" onClick={() => setShowModal(true)}>
                    <FaPlus /> Nouvel Événement
                </button>
            </div>
        );
    };

    const renderDays = () => {
        const days = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
        return (
            <div className="calendar-days-header">
                {days.map(d => <div key={d} className="day-name">{d}</div>)}
            </div>
        );
    };

    const renderCells = () => {
        const month = currentDate.getMonth();
        const year = currentDate.getFullYear();
        const numDays = daysInMonth(year, month);
        const firstDay = firstDayOfMonth(year, month);
        const offset = firstDay === 0 ? 6 : firstDay - 1;

        const cells = [];
        for (let i = 0; i < offset; i++) {
            cells.push(<div key={`empty-${i}`} className="calendar-cell empty"></div>);
        }

        for (let d = 1; d <= numDays; d++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const dayEvents = events.filter(e => {
                const start = e.start_date.split('T')[0];
                const end = e.end_date ? e.end_date.split('T')[0] : start;
                return dateStr >= start && dateStr <= end;
            });
            const dayInterventions = interventions.filter(i => {
                const start = i.date;
                const end = i.end_date || start;
                return dateStr >= start && dateStr <= end;
            });


            const isToday = new Date().toDateString() === new Date(year, month, d).toDateString();

            cells.push(
                <div
                    key={d}
                    className={`calendar-cell ${isToday ? "today" : ""}`}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handleDrop(dateStr)}
                >
                    <span className="cell-number">{d}</span>

                    <div className="cell-events">
                        {dayEvents.map(e => {
                            const isStart = e.start_date.split('T')[0] === dateStr;
                            const isEnd = (e.end_date ? e.end_date.split('T')[0] : e.start_date.split('T')[0]) === dateStr;
                            return (
                                <div key={e.id}
                                    draggable
                                    onDragStart={() => handleDragStart(e, "EVENT")}
                                    className={`event-item ${!isStart ? "not-start" : ""} ${!isEnd ? "not-end" : ""}`}
                                    style={{ borderLeft: isStart ? `3px solid ${e.color}` : 'none' }}
                                    title={`${e.description} - Créé par: ${e.user_name || 'Inconnu'}`}>
                                    <div className="event-info-wrapper">
                                        <span className="event-title">{e.title}</span>
                                        <span className="event-tech-name">{e.user_name || currentUser.full_name}</span>
                                    </div>
                                    {isEnd && <button className="del-ev" onClick={(e_stop) => { e_stop.stopPropagation(); handleDeleteEvent(e.id); }}><FaTrash size={8} /></button>}
                                </div>
                            );
                        })}
                        {dayInterventions.map(i => {
                            const isStart = i.date === dateStr;
                            const isEnd = (i.end_date || i.date) === dateStr;
                            return (
                                <div key={i.id}
                                    draggable
                                    onDragStart={() => handleDragStart(i, "INTERVENTION")}
                                    className={`event-item intervention ${i.type} ${!isStart ? "not-start" : ""} ${!isEnd ? "not-end" : ""}`}
                                    title={`Intervention: ${i.title} - Client: ${clients[i.client_id] || "Inconnu"}`}>
                                    <div className="event-info-wrapper">
                                        <span className="event-title">🔧 {clients[i.client_id] || "Intervention"}</span>
                                        <span className="event-tech-name">{i.technician || "NC"}</span>
                                    </div>
                                </div>

                            );
                        })}

                    </div>

                </div>
            );
        }

        return <div className="calendar-grid">{cells}</div>;
    };

    return (
        <div className="planning-container">
            <div className="planning-content">
                {renderHeader()}
                {renderDays()}
                {renderCells()}
            </div>

            {showModal && (
                <div className="modal-overlay">
                    <div className="event-modal">
                        <h3>Planifier un événement</h3>
                        <form onSubmit={handleAddEvent}>
                            <div className="form-group">
                                <label>Titre</label>
                                <input type="text" required value={newEvent.title} onChange={e => setNewEvent({ ...newEvent, title: e.target.value })} placeholder="Ex: Réunion SAV" />
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Début</label>
                                    <input type="datetime-local" required value={newEvent.start_date} onChange={e => setNewEvent({ ...newEvent, start_date: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label>Fin</label>
                                    <input type="datetime-local" required value={newEvent.end_date} onChange={e => setNewEvent({ ...newEvent, end_date: e.target.value })} />
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Type</label>
                                    <select value={newEvent.type} onChange={e => setNewEvent({ ...newEvent, type: e.target.value })}>
                                        <option value="TASK">Tâche</option>
                                        <option value="MEETING">Réunion</option>
                                        <option value="INTERVENTION">Intervention</option>
                                        <option value="OTHER">Autre</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Couleur</label>
                                    <input type="color" value={newEvent.color} onChange={e => setNewEvent({ ...newEvent, color: e.target.value })} />
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Lieu</label>
                                <input type="text" value={newEvent.location} onChange={e => setNewEvent({ ...newEvent, location: e.target.value })} placeholder="Ville / Bureau" />
                            </div>
                            <div className="form-group">
                                <label>Description</label>
                                <textarea value={newEvent.description} onChange={e => setNewEvent({ ...newEvent, description: e.target.value })} placeholder="Détails de la mission..." />
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="close-btn" onClick={() => setShowModal(false)}>Annuler</button>
                                <button type="submit" className="save-btn">Enregistrer</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Planning;
