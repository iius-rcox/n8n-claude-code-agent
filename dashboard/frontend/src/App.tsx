import { MsalProvider } from '@azure/msal-react';
import { PublicClientApplication } from '@azure/msal-browser';
import { msalConfig } from './lib/msal-config';
import { AuthGuard } from './components/auth-guard';
import { Dashboard } from './pages/dashboard';
import './index.css';

const msalInstance = new PublicClientApplication(msalConfig);

function App() {
  return (
    <MsalProvider instance={msalInstance}>
      <AuthGuard>
        <Dashboard />
      </AuthGuard>
    </MsalProvider>
  );
}

export default App;
