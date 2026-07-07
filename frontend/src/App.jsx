import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import DashboardLayout from './components/DashboardLayout';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import Generator from './pages/Generator';
import TitleGenerator from './pages/TitleGenerator';
import MetaGenerator from './pages/MetaGenerator';
import Translator from './pages/Translator';
import SchemaGenerator from './pages/SchemaGenerator';
import ImageOptimizer from './pages/ImageOptimizer';
import BulkUpload from './pages/BulkUpload';
import Projects from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail';
import History from './pages/History';
import SeoAudit from './pages/SeoAudit';
import HistoryDetail from './pages/HistoryDetail';
import Settings from './pages/Settings';
import Pricing from './pages/Pricing';
import Admin from './pages/Admin';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          <Route element={<DashboardLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/generator" element={<Generator />} />
            <Route path="/bulk-upload" element={<BulkUpload />} />
            <Route path="/title-generator" element={<TitleGenerator />} />
            <Route path="/meta-generator" element={<MetaGenerator />} />
            <Route path="/seo-audit" element={<SeoAudit />} />
            <Route path="/translator" element={<Translator />} />
            <Route path="/schema-generator" element={<SchemaGenerator />} />
            <Route path="/image-optimizer" element={<ImageOptimizer />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/projects/:id" element={<ProjectDetail />} />
            <Route path="/history" element={<History />} />
            <Route path="/history/:id" element={<HistoryDetail />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/admin" element={<Admin />} />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
