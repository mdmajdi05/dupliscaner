'use client';

import { useEffect } from 'react';
import Dashboard from '../shared/components/Dashboard';

export default function Page() {
  useEffect(() => {
    // Initialize database on app startup
    const init = async () => {
      try {
        const res = await fetch('/api/db/init');
        if (!res.ok) {
          console.error('Database initialization failed:', await res.json());
        } else {
          const data = await res.json();
          console.log('✅ Database initialized:', data.stats);
        }
      } catch (err) {
        console.error('Database initialization error:', err);
      }
    };
    
    init();
  }, []);

  return <Dashboard />;
}
