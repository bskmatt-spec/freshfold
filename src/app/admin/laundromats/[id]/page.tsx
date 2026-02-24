"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { updateLaundromat } from "@/lib/actions";
import type { Laundromat } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function EditLaundromatPage() {
  const router = useRouter();
  const params = useParams();
  const search = useSearchParams();
  const idFromParams = (params as any)?.id ?? "";
  const idFromQuery = search?.get ? search.get('id') ?? "" : "";
  const id = idFromParams || idFromQuery;

  const [laundromat, setLaundromat] = useState<Laundromat | null>(null);
  const [form, setForm] = useState({ name: "", address: "", latitude: "", longitude: "", deliveryRadius: "5", phone: "", email: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!id) {
        // no id available — bail out and show "not found" instead of leaving loading state
        setLoading(false);
        return;
      }
      try {
        setError(null);
        const res = await fetch('/api/admin/data');
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          console.error('/api/admin/data returned non-OK', res.status, text);
          setError(`Server returned ${res.status} when loading laundromat data`);
          return;
        }
        const text = await res.text();
        let parsed: any;
        try {
          parsed = JSON.parse(text);
        } catch (e) {
          console.error('Failed to parse /api/admin/data response', e);
          setError('Invalid server response while loading laundromat data');
          return;
        }
        const laundromats: Laundromat[] = parsed.laundromats ?? [];
        const l = laundromats.find((x: Laundromat) => x.id === id) ?? null;
        if (l) {
          setLaundromat(l);
          setForm({
            name: l.name,
            address: l.address,
            latitude: l.latitude?.toString() ?? "",
            longitude: l.longitude?.toString() ?? "",
            deliveryRadius: l.deliveryRadius?.toString() ?? "5",
            phone: l.phone ?? "",
            email: l.email ?? "",
          });
        } else {
          setError('Laundromat not found');
        }
      } catch (err) {
        console.error('Failed to load laundromat data', err);
        setError(String(err instanceof Error ? err.message : err));
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!laundromat) return;
    setSaving(true);
    await updateLaundromat(laundromat.id, {
      name: form.name,
      address: form.address,
      latitude: form.latitude ? parseFloat(form.latitude) : undefined,
      longitude: form.longitude ? parseFloat(form.longitude) : undefined,
      deliveryRadius: parseFloat(form.deliveryRadius),
      phone: form.phone || undefined,
      email: form.email || undefined,
    });
    setSaving(false);
    router.push('/admin');
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading…</div>;
  if (error) return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-white p-6 rounded shadow">
        <h2 className="text-lg font-semibold mb-2">Error loading laundromat</h2>
        <p className="text-sm text-red-600 mb-4">{error}</p>
        <div className="flex gap-2">
          <Button onClick={() => { setLoading(true); setError(null); /* re-run effect */ setTimeout(() => { /* noop to trigger */ }, 0); }}>Retry</Button>
          <Button variant="outline" onClick={() => router.push('/admin')}>Back to Admin</Button>
        </div>
      </div>
    </div>
  );
  if (!laundromat) return <div className="min-h-screen flex items-center justify-center">Laundromat not found</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-3xl">
        <Button variant="ghost" onClick={() => router.push('/admin')} className="mb-4">← Back to Admin</Button>
        <Card>
          <CardHeader>
            <CardTitle>Edit Laundromat — {laundromat.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div>
                <Label>Address</Label>
                <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} required />
              </div>
              <div>
                <Label>Delivery Radius (miles)</Label>
                <Input type="number" value={form.deliveryRadius} onChange={(e) => setForm({ ...form, deliveryRadius: e.target.value })} required />
              </div>
              <div>
                <Label>Latitude</Label>
                <Input type="number" step="any" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} />
              </div>
              <div>
                <Label>Longitude</Label>
                <Input type="number" step="any" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} />
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="md:col-span-2 flex gap-2">
                <Button variant="outline" onClick={() => router.push('/admin')}>Cancel</Button>
                <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
