import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "./context/AuthContext.jsx";
import Layout from "./layouts/Layout.jsx";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Patients from "./pages/Patients.jsx";
import PatientDetail from "./pages/PatientDetail.jsx";
import OPD from "./pages/OPD.jsx";
import OPDVisitDetail from "./pages/OPDVisitDetail.jsx";
import Billing from "./pages/Billing.jsx";
import Pharmacy from "./pages/Pharmacy.jsx";
import Lab from "./pages/Lab.jsx";
import Inventory from "./pages/Inventory.jsx";
import Finance from "./pages/Finance.jsx";
import HR from "./pages/HR.jsx";
import Reports from "./pages/Reports.jsx";
import Settings from "./pages/Settings.jsx";
import CalendarPage from "./pages/CalendarPage.jsx";
import Optical from "./pages/Optical.jsx";
import Operations from "./pages/Operations.jsx";
import Communications from "./pages/Communications.jsx";
import LiveConsultation from "./pages/LiveConsultation.jsx";
import Setup from "./pages/Setup.jsx";
import HospitalModule from "./pages/HospitalModule.jsx";
import RequireRole from "./components/RequireRole.jsx";

const ProtectedRoute = ({ children }) => {
  const { t } = useTranslation();
  const { user, loading } = useAuth();
  if (loading) return <div className="flex h-screen items-center justify-center text-slate-400">{t("app.loading")}</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
};

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Layout>
              <RequireRole>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/patients" element={<Patients />} />
                  <Route path="/patients/:id" element={<PatientDetail />} />
                  <Route path="/appointments" element={<HospitalModule type="appointments" />} />
                  <Route path="/opd" element={<OPD />} />
                  <Route path="/opd/:id" element={<OPDVisitDetail />} />
                  <Route path="/emergency" element={<HospitalModule type="emergency" />} />
                  <Route path="/ipd" element={<HospitalModule type="ipd" />} />
                  <Route path="/emr" element={<HospitalModule type="emr" />} />
                  <Route path="/nursing" element={<HospitalModule type="nursing" />} />
                  <Route path="/billing" element={<Billing />} />
                  <Route path="/pharmacy" element={<Pharmacy />} />
                  <Route path="/lab/:type" element={<Lab />} />
                  <Route path="/diagnostics" element={<HospitalModule type="diagnostics" />} />
                  <Route path="/inventory" element={<Inventory />} />
                  <Route path="/finance" element={<Finance />} />
                  <Route path="/hr" element={<HR />} />
                  <Route path="/reports" element={<Reports />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/calendar" element={<CalendarPage />} />
                  <Route path="/optical" element={<Optical />} />
                  <Route path="/operations" element={<Operations />} />
                  <Route path="/ot-schedule" element={<HospitalModule type="ot" />} />
                  <Route path="/documents" element={<HospitalModule type="documents" />} />
                  <Route path="/insurance" element={<HospitalModule type="insurance" />} />
                  <Route path="/print-center" element={<HospitalModule type="print" />} />
                  <Route path="/communications" element={<Communications />} />
                  <Route path="/live-consultation" element={<LiveConsultation />} />
                  <Route path="/setup" element={<Setup />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </RequireRole>
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
