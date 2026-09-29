import { BrowserRouter, Routes, Route } from 'react-router-dom';
import NewChargeDashboard from './NewChargeDashboard';
import Flow1 from './flow/flow-1';
import Flow2 from './flow/flow-2';
import Flow3 from './flow/flow-3';
import Flow4 from './flow/flow-4';
import Flow5 from './flow/flow-5';
import Flow6 from './flow/flow-6';
import Flow7 from './flow/flow-7';
import Flow8 from './flow/flow-8';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Flow1 />} />
        <Route path="/NewChargeDashboard" element={<NewChargeDashboard />} />

        <Route path="/flow/flow-1" element={<Flow1 />} />
        <Route path="/flow/flow-2" element={<Flow2 />} />
        <Route path="/flow/flow-3" element={<Flow3 />} />
        <Route path="/flow/flow-4" element={<Flow4 />} />
        <Route path="/flow/flow-5" element={<Flow5 />} />
        <Route path="/flow/flow-6" element={<Flow6 />} />
        <Route path="/flow/flow-7" element={<Flow7 />} />
        <Route path="/flow/flow-8" element={<Flow8 />} />
      </Routes>
    </BrowserRouter>
  );
}