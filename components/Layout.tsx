'use client';

import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { LogOut, Scale } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { logout, user } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#B8A799] to-[#CAA068]">
      <header className="bg-[#2B2F32] shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <Scale className="h-8 w-8 text-[#CAA068]" />
              <h1 className="text-2xl font-bold text-white">ZA Legal</h1>
            </div>
            <div className="flex items-center space-x-4">
              {/* <span className="text-[#B8A799] text-sm">
                {user?.email}
              </span> */}
              <Button
                onClick={handleLogout}
                variant="outline"
                size="sm"
                className="border-[#CAA068] text-[#CAA068] hover:bg-[#CAA068] hover:text-white"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>
    </div>
  );
}