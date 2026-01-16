import { useEffect, useState } from 'react';
import { MsalProvider } from '@azure/msal-react';
import { PublicClientApplication, EventType, AuthenticationResult } from '@azure/msal-browser';
import { msalConfig } from './lib/msal-config';
import { AuthGuard } from './components/auth-guard';
import { Dashboard } from './pages/dashboard';
import { setMsalInstance } from './services/api';
import './index.css';

const msalInstance = new PublicClientApplication(msalConfig);

function App() {
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const initializeMsal = async () => {
      // Handle redirect promise (for redirect flows)
      await msalInstance.initialize();
      await msalInstance.handleRedirectPromise();

      // Set active account if available
      const accounts = msalInstance.getAllAccounts();
      if (accounts.length > 0) {
        msalInstance.setActiveAccount(accounts[0]);
      }

      // Listen for login events
      msalInstance.addEventCallback((event) => {
        if (event.eventType === EventType.LOGIN_SUCCESS && event.payload) {
          const payload = event.payload as AuthenticationResult;
          msalInstance.setActiveAccount(payload.account);
        }
      });

      // Share instance with API service
      setMsalInstance(msalInstance);
      setIsInitialized(true);
    };

    initializeMsal();
  }, []);

  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">Initializing...</div>
      </div>
    );
  }

  return (
    <MsalProvider instance={msalInstance}>
      <AuthGuard>
        <Dashboard />
      </AuthGuard>
    </MsalProvider>
  );
}

export default App;
