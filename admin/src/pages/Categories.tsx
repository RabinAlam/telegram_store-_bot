import { useMemo, useState } from 'react';
import { ArrowUp, ArrowDown, FolderOpen, Trash2, Plus, Tags } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { tzGetCategories, tzGetProducts, tzCreateCategory, tzReorderCategories, tzDeleteCategory, type TzCategory } from '../tzstore';
import { Badge, Button, Card, Modal, Empty, Field, Input, Skeleton, toast } from '../ui';

// Admin Categories — reads LIVE TZ Store data (Next.js :3000), same catalog the bot + storefront use.
export default function Categories() {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const list = useQuery({ queryKey: ['tz-cats-page'], queryFn: tzGetCategories });
  const prods = useQuery({ queryKey: ['tz-products-for-cats'], queryFn: tzGetProducts });

  const rows = useMemo(() => {
    const cats = ((list.data?.categories ?? []) as (TzCategory & { sort?: number })[]);
    const counts = new Map<string, number>();
    for (const p of (prods.data?.products ?? [])) counts.set(p.categorySlug, (counts.get(p.categorySlug) ?? 0) + 1);
    return cats.map((c, i) => ({ ...c, idx: i, productCount: counts.get(c.slug) ?? 0 }));
  }, [list.data, prods.data]);

  async function save() {
    setFormError('');
    if (name.trim().length < 2) { setFormError('Name needs 2+ characters'); return; }
    setSaving(true);
    try {
      const j = await tzCreateCategory(name.trim());
      toast(`Category "${j.category.name}" added`);
      setCreating(false); setName('');
      list.refetch();
    } catch (e) { setFormError(e instanceof Error ? e.message : 'create failed'); }
    finally { setSaving(false); }
  }

  async function move(slug: string, dir: -1 | 1) {
    const ordered = rows.map((r) => r.slug);
    const i = ordered.indexOf(slug);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= ordered.length) return;
    [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
    try { await tzReorderCategories(ordered); list.refetch(); }
    catch (e) { toast(e instanceof Error ? e.message : 'reorder failed'); }
  }

  async function del(slug: string, catName: string) {
    if (!confirm(`Delete category "${catName}"?`)) return;
    try { await tzDeleteCategory(slug); toast('Deleted'); list.refetch(); }
    catch (e) { toast(e instanceof Error ? e.message : 'delete failed'); }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center">
        <h1 className="flex items-center gap-2 text-xl font-extrabold"><Tags size={20} /> Categories ({rows.length})</h1>
        <span className="ml-2 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">TZ Store live</span>
        <div className="flex-1" />
        <Button variant="green" onClick={() => { setName(''); setFormError(''); setCreating(true); }}>
          <span className="flex items-center gap-1"><Plus size={15} /> New category</span>
        </Button>
      </div>
      <Card>
        {list.isLoading ? <Skeleton className="h-64" /> : rows.length === 0 ? (
          <Empty text={list.error ? `TZ Store unreachable: ${(list.error as Error).message} — is :3000 running?` : 'No categories'} />
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase text-slate-500">
              <th className="p-2">#</th><th className="p-2">Name</th><th className="p-2">Products</th><th className="p-2 text-right">Actions</th>
            </tr></thead>
            <tbody>{rows.map((c) => (
              <tr key={c.slug} className="border-t dark:border-slate-800">
                <td className="p-2">{c.idx + 1}</td>
                <td className="p-2 font-semibold">
                  <span className="flex items-center gap-2"><FolderOpen size={16} className="text-slate-400" />{c.name}</span>
                </td>
                <td className="p-2"><Badge>{String(c.productCount)}</Badge></td>
                <td className="p-2"><div className="flex justify-end gap-1">
                  <Button variant="outline" onClick={() => move(c.slug, -1)}><ArrowUp size={15} /></Button>
                  <Button variant="outline" onClick={() => move(c.slug, 1)}><ArrowDown size={15} /></Button>
                  <Button variant="danger" onClick={() => del(c.slug, c.name)}><Trash2 size={15} /></Button>
                </div></td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </Card>
      <Modal open={creating} onClose={() => setCreating(false)} title="New category — TZ Store">
        <div className="space-y-3">
          <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Kiro" onKeyDown={(e) => { if (e.key === 'Enter') save(); }} /></Field>
          {formError && <p className="rounded-xl bg-red-50 p-2.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">{formError}</p>}
          <Button onClick={save} disabled={saving} className="w-full">{saving ? 'Saving…' : 'Save'}</Button>
          <p className="text-center text-xs text-slate-500">Saved to TZ Store live catalog — usable in New product instantly.</p>
        </div>
      </Modal>
    </div>
  );
}
