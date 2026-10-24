// Routes. Each screen lives in src/screens/<Name>.tsx and exports default. Onboarding gates everything until a mode is chosen.
// Frame: <Nav/> (tab bar on phones, sidebar ≥ 900 px) + the screen column.
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useStore } from './lib/store';
import Nav from './components/Nav';
import Onboarding from './screens/Onboarding';
import Home from './screens/Home';
import Dashboard from './screens/Dashboard';
import Bottle from './screens/Bottle';
import Place from './screens/Place';
import Run from './screens/Run';
import Runs from './screens/Runs';
import Evaluation from './screens/Evaluation';
import Deliveries from './screens/Deliveries';
import Delivery from './screens/Delivery';
import Medicines from './screens/Medicines';
import Schedule from './screens/Schedule';
import Activity from './screens/Activity';
import Log from './screens/Log';
import Calibration from './screens/Calibration';
import Verify from './screens/Verify';
import Ask from './screens/Ask';
import Kiosk from './screens/Kiosk';
import Story from './screens/Story';
import Settings from './screens/Settings';
import AgentRecord from './screens/AgentRecord';
import Demo, { DemoDriver } from './screens/Demo';

function Frame({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const kiosk = pathname.startsWith('/kiosk');
  return (
    <div className="frame">
      {!kiosk && <Nav />}
      <div className={'app' + (kiosk ? ' kiosk' : '')}>{children}</div>
      <DemoDriver />
    </div>
  );
}

function Gate({ children }: { children: React.ReactNode }) {
  const mode = useStore((s) => s.mode);
  const { pathname } = useLocation();
  if (!mode && !pathname.startsWith('/kiosk')) return <Navigate to="/welcome" replace />;
  return <>{children}</>;
}

/** "/" is the dashboard in medical mode and Today (Home) in personal mode. */
function Root() {
  const mode = useStore((s) => s.mode);
  return mode === 'medical' ? <Dashboard /> : <Home />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Frame>
        <Routes>
          <Route path="/welcome" element={<Onboarding />} />
          <Route path="/kiosk" element={<Kiosk />} />
          <Route path="/" element={<Gate><Root /></Gate>} />
          <Route path="/home" element={<Gate><Home /></Gate>} />
          <Route path="/bottle" element={<Gate><Bottle /></Gate>} />
          <Route path="/place" element={<Gate><Place /></Gate>} />
          <Route path="/run/:id" element={<Gate><Run /></Gate>} />
          <Route path="/runs" element={<Gate><Runs /></Gate>} />
          <Route path="/evaluation/:id" element={<Gate><Evaluation /></Gate>} />
          <Route path="/deliveries" element={<Gate><Deliveries /></Gate>} />
          <Route path="/delivery/:id" element={<Gate><Delivery /></Gate>} />
          <Route path="/medicines" element={<Gate><Medicines /></Gate>} />
          <Route path="/schedule" element={<Gate><Schedule /></Gate>} />
          <Route path="/activity" element={<Gate><Activity /></Gate>} />
          <Route path="/log" element={<Gate><Log /></Gate>} />
          <Route path="/calibration" element={<Gate><Calibration /></Gate>} />
          <Route path="/verify" element={<Gate><Verify /></Gate>} />
          <Route path="/ask" element={<Gate><Ask /></Gate>} />
          <Route path="/story" element={<Story />} />
          <Route path="/settings" element={<Gate><Settings /></Gate>} />
          <Route path="/agent" element={<Gate><AgentRecord /></Gate>} />
          <Route path="/demo" element={<Demo />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Frame>
    </BrowserRouter>
  );
}
