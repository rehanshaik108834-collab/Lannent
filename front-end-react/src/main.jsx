import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './styles/styles.css';
import App from './App';

// No StrictMode: each page is one "page load" whose setup (Store.init, data
// writes on mount) must run exactly once, as it did on the static pages.
createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
);
