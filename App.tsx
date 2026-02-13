import React, { useState, useEffect } from 'react';
import DriverForm from './components/DriverForm';
import AdminDashboard from './components/AdminDashboard';

const App: React.FC = () => {
  const [currentHash, setCurrentHash] = useState(window.location.hash);

  useEffect(() => {
    const onHashChange = () => setCurrentHash(window.location.hash);
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  return (
      <div className="min-h-screen bg-slate-50">
         {currentHash === '#/admin' ? (
             <AdminDashboard />
         ) : (
            <div className="pt-8 px-4 pb-20">
                <DriverForm />
            </div>
         )}
      </div>
  );
};

export default App;