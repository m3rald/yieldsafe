import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {PrivyProvider} from '@privy-io/react-auth';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PrivyProvider
      appId="cmrrvyo3m011g0cjmci39xv0l"
      config={{
        loginMethods: ['email', 'wallet', 'google'],
      }}
    >
      <App />
    </PrivyProvider>
  </StrictMode>,
);
