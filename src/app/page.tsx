import Link from 'next/link';
import { Shirt, Store, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <header className="px-4 py-6">
        <div className="mx-auto max-w-6xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center">
              <Shirt className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-xl">FreshFold</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            Laundry Delivery
            <br />
            <span className="text-blue-600">Made Simple</span>
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Connect with local laundromats for pickup and delivery service. 
            Schedule, track, and pay - all in one app.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          <Link href="/customer">
            <div className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-md transition-shadow cursor-pointer text-center group">
              <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4 group-hover:bg-blue-500 transition-colors">
                <Shirt className="h-8 w-8 text-blue-600 group-hover:text-white transition-colors" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Customer App</h2>
              <p className="text-gray-600">Schedule pickups, track orders, and pay for laundry service</p>
            </div>
          </Link>

          <Link href="/laundromat">
            <div className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-md transition-shadow cursor-pointer text-center group">
              <div className="h-16 w-16 rounded-full bg-indigo-100 flex items-center justify-center mx-auto mb-4 group-hover:bg-indigo-500 transition-colors">
                <Store className="h-8 w-8 text-indigo-600 group-hover:text-white transition-colors" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Laundromat Portal</h2>
              <p className="text-gray-600">Manage orders, assign drivers, and track deliveries</p>
            </div>
          </Link>

          <Link href="/admin">
            <div className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-md transition-shadow cursor-pointer text-center group">
              <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4 group-hover:bg-gray-800 transition-colors">
                <Shield className="h-8 w-8 text-gray-600 group-hover:text-white transition-colors" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Admin Dashboard</h2>
              <p className="text-gray-600">Manage partners, track revenue, and view analytics</p>
            </div>
          </Link>
        </div>

        <div className="mt-16 text-center">
          <p className="text-sm text-gray-500">
            Password for admin: <code className="bg-gray-200 px-2 py-1 rounded">admin</code>
          </p>
        </div>
      </main>
    </div>
  );
}
