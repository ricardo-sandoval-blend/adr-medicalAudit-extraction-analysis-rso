'use client';

import { useKeycloak } from '@/lib/keycloak';
import { useEffect, useState } from 'react';

export default function ProtectedPage() {
  const { initialized, authenticated, user, logout } = useKeycloak();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (initialized) {
      setLoading(false);
    }
  }, [initialized]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Initializing Keycloak...</p>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-600">Not authenticated</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Protected Page</h1>

      {user && (
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <h2 className="text-xl font-semibold">User Information</h2>
          <div className="space-y-2">
            <p>
              <span className="font-semibold">Name:</span> {user.name}
            </p>
            <p>
              <span className="font-semibold">Email:</span> {user.email}
            </p>
            <p>
              <span className="font-semibold">ID:</span> {user.sub}
            </p>
          </div>
        </div>
      )}

      <div className="bg-blue-50 rounded-lg p-6 space-y-4">
        <h2 className="text-xl font-semibold">API Examples</h2>
        <p className="text-sm text-gray-600">
          Test the authentication endpoints with your token:
        </p>
        <ul className="list-disc list-inside space-y-2 text-sm">
          <li>
            <code className="bg-gray-100 px-2 py-1 rounded">GET /api/user</code> - Get user info
          </li>
          <li>
            <code className="bg-gray-100 px-2 py-1 rounded">POST /api/admin</code> - Protected endpoint
          </li>
        </ul>
      </div>

      <button
        onClick={logout}
        className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded"
      >
        Logout
      </button>
    </div>
  );
}
