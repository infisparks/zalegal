'use client';

import { useAuth } from '@/contexts/AuthContext';
import { Login } from '@/components/Login';
import { Layout } from '@/components/Layout';
import { BillList } from '@/components/BillList';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function BillListPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

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
        <div className="space-y-6">
             <div className="flex items-center gap-4">
                <button
                onClick={() => router.back()}
                className="flex items-center gap-2 text-white/80 hover:text-white"
                >
                <ArrowLeft className="h-5 w-5" />
                <span className="font-medium">Back</span>
                </button>
            </div>
            <BillList />
        </div>
    </Layout>
  );
}