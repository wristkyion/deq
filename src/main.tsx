import {createRoot} from 'react-dom/client';
import App from './App';
import TitleBar from './TitleBar';
import {ToastProvider} from './Toast';
import './styles.css';
createRoot(document.getElementById('root')!).render(<ToastProvider><TitleBar/><div className="body"><App/></div></ToastProvider>);