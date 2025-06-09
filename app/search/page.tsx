'use client';

import { useAuth } from '@/contexts/AuthContext';
import { Login } from '@/components/Login';
import { SearchCases } from '@/components/SearchCases'; // <-- We will create this next
import { Layout } from '@/components/Layout';

export default function SearchPage() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#B8A799] to-[#CAA068] flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <Layout>
      <SearchCases />
    </Layout>
  );
}