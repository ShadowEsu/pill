// Routes. Each screen lives in src/screens/<Name>.tsx and exports default. Onboarding gates everything until a mode is chosen.
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useStore } from './lib/store';
import Onboarding from './screens/Onboarding';
import Home from './screens/Home';
import Bottle from './screens/Bottle';
import Place from './screens/Place';
import Run from './screens/Run';
import Evaluation from './screens/Evaluation';
import Deliveries from './screens/Deliveries';
import Delivery from './screens/Delivery';
import Medicines from './screens/Medicines';
import Log from './screens/Log';
import Calibration from './screens/Calibration';
import Verify from './screens/Verify';
import Ask from './screens/Ask';
import Kiosk from './screens/Kiosk';

function Frame({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  return <div className={'app' + (pathname.startsWith('/kiosk') ? ' kiosk' : '')}>{children}</div>;
}

function Gate({ children }: { children: React.ReactNode }) {
  const mode = useStore((s) => s.mode);
  const { pathname } = useLocation();
  if (!mode && !pathname.startsWith('/kiosk')) return <Navigate to="/welcome" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Frame>
        <Routes>
          <Route path="/welcome" element={<Onboarding />} />
          <Route path="/kiosk" element={<Kiosk />} />
          <Route path="/" element={<Gate><Home /></Gate>} />
          <Route path="/bottle" element={<Gate><Bottle /></Gate>} />
          <Route path="/place" element={<Gate><Place /></Gate>} />
          <Route path="/run/:id" element={<Gate><Run /></Gate>} />
          <Route path="/evaluation/:id" element={<Gate><Evaluation /></Gate>} />
          <Route path="/deliveries" element={<Gate><Deliveries /></Gate>} />
          <Route path="/delivery/:id" element={<Gate><Delivery /></Gate>} />
          <Route path="/medicines" element={<Gate><Medicines /></Gate>} />
          <Route path="/log" element={<Gate><Log /></Gate>} />
          <Route path="/calibration" element={<Gate><Calibration /></Gate>} />
          <Route path="/verify" element={<Gate><Verify /></Gate>} />
          <Route path="/ask" element={<Gate><Ask /></Gate>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Frame>
    </BrowserRouter>
  );
}
