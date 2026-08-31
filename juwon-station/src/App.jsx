import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ChargeDashboard from './ChargeDashboard';
import NewChargeDashboard from './NewChargeDashboard';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ChargeDashboard />} />
        <Route path="/NewChargeDashboard" element={<NewChargeDashboard />} />
      </Routes>
    </BrowserRouter>
  );
}