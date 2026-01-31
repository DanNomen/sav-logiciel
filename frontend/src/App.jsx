import { Routes, Route } from "react-router-dom";
import Login from "./Login";
import AddClient from "./pages/AddClient";
import Dashboard from "./pages/Dashboard";
import Sidebar from "./sidebar"; // <-- Import du Sidebar

import ClientList from "./pages/ClientList";
import SystemList from "./pages/SystemList";
import AddSystem from "./pages/AddSystem";
import InterventionList from "./pages/InterventionList";
import AddIntervention from "./pages/AddIntervention";
import TicketList from "./pages/TicketList";
import AddTicket from "./pages/AddTicket";
import InvoiceList from "./pages/InvoiceList";
import AddInvoice from "./pages/AddInvoice";
import Settings from "./pages/Settings";
import Notifications from "./pages/Notifications";
import ViewInvoice from "./pages/ViewInvoice";
import Messages from "./pages/Messages";
import Planning from "./pages/Planning";
import KnowledgeBase from "./pages/KnowledgeBase";


import Background from "./components/Background";

const Layout = ({ children }) => (
  <div style={{ display: "flex", minHeight: "100vh", position: "relative" }}>
    <Sidebar />
    <div className="sidebar-layout-content" style={{ flex: 1, width: "100%" }}>{children}</div>
  </div>
);

function App() {

  return (
    <>
      <Background />
      <Routes>
        <Route path="/" element={<Login />} />
        <Route
          path="/add-client"
          element={
            <Layout>
              <AddClient />
            </Layout>
          }
        />
        <Route
          path="/dashboard"
          element={
            <Layout>
              <Dashboard />
            </Layout>
          }
        />
        <Route
          path="/clients"
          element={
            <Layout>
              <ClientList />
            </Layout>
          }
        />
        <Route
          path="/systems"
          element={
            <Layout>
              <SystemList />
            </Layout>
          }
        />
        <Route
          path="/add-system"
          element={
            <Layout>
              <AddSystem />
            </Layout>
          }
        />
        <Route
          path="/interventions"
          element={
            <Layout>
              <InterventionList />
            </Layout>
          }
        />
        <Route
          path="/add-intervention"
          element={
            <Layout>
              <AddIntervention />
            </Layout>
          }
        />
        <Route
          path="/tickets"
          element={
            <Layout>
              <TicketList />
            </Layout>
          }
        />
        <Route
          path="/add-ticket"
          element={
            <Layout>
              <AddTicket />
            </Layout>
          }
        />
        <Route
          path="/invoices"
          element={
            <Layout>
              <InvoiceList />
            </Layout>
          }
        />
        <Route
          path="/invoices/:id"
          element={
            <Layout>
              <ViewInvoice />
            </Layout>
          }
        />
        <Route
          path="/add-invoice"
          element={
            <Layout>
              <AddInvoice />
            </Layout>
          }
        />
        <Route
          path="/edit-invoice/:id"
          element={
            <Layout>
              <AddInvoice />
            </Layout>
          }
        />
        <Route
          path="/settings"
          element={
            <Layout>
              <Settings />
            </Layout>
          }
        />
        <Route
          path="/notifications"
          element={
            <Layout>
              <Notifications />
            </Layout>
          }
        />
        <Route
          path="/messages"
          element={
            <Layout>
              <Messages />
            </Layout>
          }
        />
        <Route
          path="/planning"
          element={
            <Layout>
              <Planning />
            </Layout>
          }
        />
        <Route
          path="/knowledge-base"
          element={
            <Layout>
              <KnowledgeBase />
            </Layout>
          }
        />
      </Routes>
    </>
  );
}

export default App;
