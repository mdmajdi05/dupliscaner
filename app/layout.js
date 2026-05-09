import './globals.css';
import { initializeDatabase } from '../lib/init-db.js';

// Initialize database on app startup
await initializeDatabase().catch(err => console.error('Failed to initialize database:', err));

export const metadata = { title: 'DupScan', description: 'Duplicate File Dashboard' };
export default function Root({ children }) {
  return <html lang="en"><body>{children}</body></html>;
}
