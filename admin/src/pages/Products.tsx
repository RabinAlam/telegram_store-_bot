import { useMemo, useRef, useState, Fragment } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Pencil, Package, Plus, ImagePlus, X, KeyRound, Eye, EyeOff, Trash2, Copy, Upload } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useReactTable, getCoreRowModel, getPaginationRowModel, flexRender, createColumnHelper } from '@tanstack/react-table';
import { tzGetProducts, tzGetCategories, tzCreateProduct, tzCreateCategory, tzUpdateProduct, tzUploadPhoto, tzLogoUrl, tzVaultList, tzVaultAdd, tzVaultImport, tzVaultDelete, type TzProduct, type VaultRow } from '../tzstore';
import { Badge, Button, Card, Modal, Empty, Field, Input, Select, Skeleton, Textarea, toast } from '../ui';

const col = createColumnHelper<TzProduct & { categoryName: string }>();

function VaultSection({ productId, stock, onChanged }: { productId: string; stock: number; onChanged: () => void }) {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [bulk, setBulk] = useState('');
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const vault = useQuery({ queryKey: ['tz-vault', productId], queryFn: () => tzVaultList(productId) });
  const rows = (vault.data?.rows ?? []) as VaultRow[];

  async function refresh() { await vault.refetch(); onChanged(); }

  async function addOne() {
    if (!login.trim() || !password) { toast('Account ID and password required'); return; }
    setBusy(true);
    try {
      await tzVaultAdd(productId, login.trim(), password);
      toast('Account added'); setLogin(''); setPassword('');
      await refresh();
    } catch (e) { toast(e instanceof Error ? e.message : 'add failed'); }
    finally { setBusy(false); }
  }

  async function importBulk() {
    const lines = bulk.split('\n').map((s) => s.trim()).filter(Boolean);
    if (!lines.length) return;
    setBusy(true);
    try {
      const j = await tzVaultImport(productId, lines.join('\n'));
      toast(`Imported ${j.imported}${j.skipped ? `, skipped ${j.skipped}` : ''}`);
      setBulk('');
      await refresh();
    } catch (e) { toast(e instanceof Error ? e.message : 'import failed'); }
    finally { setBusy(false); }
  }

  async function remove(id: string) {
    if (!confirm('Delete this account?')) return;
    try { await tzVaultDelete(id); toast('Deleted'); await refresh(); }
    catch (e) { toast(e instanceof Error ? e.message : 'delete failed'); }
  }

  return (
    <div className="space-y-2">
      <h3 className="flex items-center gap-2 font-bold"><KeyRound size={16} /> Delivery vault <Badge tone="green">{vault.data ? `${vault.data.available} available` : `${stock} in stock`}</Badge></h3>
      <p className="text-xs text-slate-500">Accounts auto-deliver on successful payment — one row per unit bought.</p>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Account ID"><Input value={login} onChange={(e) => setLogin(e.target.value)} placeholder="user@mail.com" /></Field>
        <Field label="Password"><Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="secret" /></Field>
      </div>
      <Button onClick={addOne} disabled={busy} className="w-full">{busy ? '…' : 'Add account'}</Button>
      <Textarea rows={3} placeholder="Bulk: one `login | password` per line…" value={bulk} onChange={(e) => setBulk(e.target.value)} />
      <Button variant="green" onClick={importBulk} disabled={busy} className="w-full">Import to vault</Button>
      <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700">
        {vault.isLoading ? <p className="p-3 text-xs text-slate-500">Loading…</p> : rows.length === 0 ? (
          <p className="p-3 text-xs text-slate-500">Vault empty — paid orders will wait for manual review.</p>
        ) : (
          <table className="w-full text-xs">
            <tbody>{rows.map((r) => (
              <tr key={r.id} className="border-b last:border-0 dark:border-slate-800">
                <td className="p-2 font-mono">{r.login}</td>
                <td className="p-2 font-mono">{revealed[r.id] ? r.password : '••••••'}</td>
                <td className="p-2">
                  <button onClick={() => setRevealed((v) => ({ ...v, [r.id]: !v[r.id] }))} className="text-slate-400 hover:text-slate-600">
                    {revealed[r.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </td>
                <td className="p-2"><Badge tone={r.status === 'AVAILABLE' ? 'green' : 'gray'}>{r.status === 'AVAILABLE' ? 'READY' : `SOLD ${r.orderId?.slice(-6) ?? ''}`}</Badge></td>
                <td className="p-2 text-right">
                  {r.status === 'AVAILABLE' && (
                    <button onClick={() => remove(r.id)} className="text-slate-400 hover:text-red-600"><Trash2 size={14} /></button>
                  )}
                </td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// Delivery-ready table — expandable sub-row under a product.
// Shows vault credentials ready for auto-delivery + add/bulk-import.
function DeliveryReadyTable({ product, onCollapse, onChanged }: { product: TzProduct; onCollapse: () => void; onChanged: () => void }) {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [bulk, setBulk] = useState('');
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const vault = useQuery({ queryKey: ['tz-vault', product.id], queryFn: () => tzVaultList(product.id) });
  const rows = (vault.data?.rows ?? []) as VaultRow[];
  const available = rows.filter((r) => r.status === 'AVAILABLE').length;
  const sold = rows.length - available;

  const copy = async (text: string, msg: string) => {
    try { await navigator.clipboard.writeText(text); toast(msg); }
    catch { toast('Copy failed'); }
  };

  async function refresh() { await vault.refetch(); onChanged(); }

  async function addOne() {
    if (!login.trim() || !password) { toast('Login and password required'); return; }
    setBusy(true);
    try {
      await tzVaultAdd(product.id, login.trim(), password);
      toast('Delivery item added'); setLogin(''); setPassword('');
      await refresh();
    } catch (e) { toast(e instanceof Error ? e.message : 'add failed'); }
    finally { setBusy(false); }
  }

  async function importBulk() {
    const lines = bulk.split('\n').map((s) => s.trim()).filter(Boolean);
    if (!lines.length) return;
    setBusy(true);
    try {
      const j = await tzVaultImport(product.id, lines.join('\n'));
      toast(`Imported ${j.imported}${j.skipped ? `, skipped ${j.skipped}` : ''}`);
      setBulk('');
      await refresh();
    } catch (e) { toast(e instanceof Error ? e.message : 'import failed'); }
    finally { setBusy(false); }
  }

  async function remove(id: string) {
    if (!confirm('Delete this delivery item?')) return;
    try { await tzVaultDelete(id); toast('Deleted'); await refresh(); }
    catch (e) { toast(e instanceof Error ? e.message : 'delete failed'); }
  }

  const shortDate = (iso: string | null) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return isNaN(d.getTime()) ? iso.slice(0, 10) : d.toISOString().slice(0, 10);
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40"><Package size={20} /></span>
        <h3 className="text-[15px] font-extrabold">Delivery ready — {product.title}</h3>
        <div className="flex-1" />
        <Badge tone="green">AVAILABLE&nbsp;&nbsp;{vault.data ? available : product.stock}</Badge>
        <Badge>SOLD&nbsp;&nbsp;{sold}</Badge>
        <button onClick={onCollapse} aria-label="Collapse" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><ChevronUp size={16} /></button>
      </div>
      <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
        <table className="w-full text-sm">
          <thead><tr className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500 dark:bg-slate-800">
            <th className="p-2.5">Login</th><th className="p-2.5">Password</th><th className="p-2.5">Status</th>
            <th className="p-2.5">Order / Sold at</th><th className="p-2.5 text-right">Actions</th>
          </tr></thead>
          <tbody>
            {vault.isLoading ? (
              <tr><td colSpan={5} className="p-3 text-xs text-slate-500">Loading delivery items…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={5} className="p-3 text-xs text-slate-500">No delivery items yet — add below. Paid orders will wait for manual review until stock exists.</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id} className="border-t dark:border-slate-800">
                <td className="p-2.5 font-mono text-[13px]">{r.login}</td>
                <td className="p-2.5">
                  <span className="flex items-center gap-1.5 font-mono text-[13px]">
                    {revealed[r.id] ? r.password : '••••••••'}
                    <button onClick={() => setRevealed((v) => ({ ...v, [r.id]: !v[r.id] }))} className="rounded-md border border-slate-200 p-1 text-slate-500 hover:text-slate-700 dark:border-slate-700" aria-label="Reveal">
                      {revealed[r.id] ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                    <button onClick={() => copy(r.password, 'Password copied')} className="rounded-md border border-slate-200 p-1 text-slate-500 hover:text-slate-700 dark:border-slate-700" aria-label="Copy password"><Copy size={13} /></button>
                  </span>
                </td>
                <td className="p-2.5"><Badge tone={r.status === 'AVAILABLE' ? 'green' : 'gray'}>{r.status}</Badge></td>
                <td className="p-2.5 font-mono text-xs text-slate-500">{r.orderId ? `#${r.orderId.slice(-8).toUpperCase()}` : '#—'} · {shortDate(r.soldAt)}</td>
                <td className="p-2.5">
                  <span className="flex justify-end gap-1.5">
                    <button onClick={() => copy(`${r.login} | ${r.password}`, 'Login + password copied')} className="rounded-md border border-slate-200 p-1.5 text-slate-500 hover:text-slate-700 dark:border-slate-700" aria-label="Copy row"><Copy size={13} /></button>
                    {r.status === 'AVAILABLE' && (
                      <button onClick={() => remove(r.id)} className="rounded-md border border-slate-200 p-1.5 text-red-500 hover:bg-red-50 dark:border-slate-700" aria-label="Delete"><Trash2 size={13} /></button>
                    )}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
          <p className="flex items-center gap-1.5 text-[13px] font-bold"><span className="flex h-5 w-5 items-center justify-center rounded-md bg-emerald-500 text-xs text-white">+</span> Add new delivery item</p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <Input value={login} onChange={(e) => setLogin(e.target.value)} placeholder="Login (email/username)" />
            <Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" />
            <Button variant="green" onClick={addOne} disabled={busy} className="shrink-0">Add</Button>
          </div>
        </div>
        <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
          <p className="flex items-center gap-1.5 text-[13px] font-bold"><span className="flex h-5 w-5 items-center justify-center rounded-md bg-emerald-500 text-xs text-white">+</span> Bulk import <span className="font-normal text-slate-500">(login | password per line)</span></p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <Textarea rows={3} value={bulk} onChange={(e) => setBulk(e.target.value)} placeholder={'user1@mail.com | password1\nuser2@mail.com | password2'} className="font-mono text-xs" />
            <Button onClick={importBulk} disabled={busy} className="shrink-0"><span className="flex items-center gap-1"><Upload size={14} /> Import</span></Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Admin Products — reads LIVE TZ Store data (Next.js :3000 /api/admin/products).
export default function Products() {
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('');
  const [editing, setEditing] = useState<TzProduct | null>(null);
  const [creating, setCreating] = useState(false);
  // edit-form fields (TZ Store live data)
  const [eTitle, setETitle] = useState('');
  const [eCat, setECat] = useState('');
  const [ePrice, setEPrice] = useState('');
  const [eDesc, setEDesc] = useState('');
  const [ePhoto, setEPhoto] = useState('');
  const [ePreview, setEPreview] = useState('');
  const [eUploading, setEUploading] = useState(false);
  const [eSaving, setESaving] = useState(false);
  const [editError, setEditError] = useState('');
  const editFileRef = useRef<HTMLInputElement>(null);
  const [nTitle, setNTitle] = useState('');
  const [nCat, setNCat] = useState('');
  const [nPrice, setNPrice] = useState('');
  const [nDesc, setNDesc] = useState('');
  const [nStock, setNStock] = useState('0');
  const [nPhoto, setNPhoto] = useState(''); // uploaded /uploads/... url
  const [nPreview, setNPreview] = useState(''); // local preview before upload
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showNewCat, setShowNewCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [creatingCat, setCreatingCat] = useState(false);
  const [formError, setFormError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const cats = useQuery({ queryKey: ['tz-cats'], queryFn: tzGetCategories });
  const list = useQuery({ queryKey: ['tz-products'], queryFn: tzGetProducts });
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const catName = useMemo(() => Object.fromEntries(((cats.data?.categories ?? []) as { slug: string; name: string }[]).map((c) => [c.slug, c.name])), [cats.data]);
  const rows = useMemo(() => {
    const items = (list.data?.products ?? []).map((p) => ({ ...p, categoryName: catName[p.categorySlug] ?? p.categorySlug }));
    const q = search.trim().toLowerCase();
    return items.filter((p) =>
      (!cat || p.categorySlug === cat) &&
      (!q || p.title.toLowerCase().includes(q) || p.id.toLowerCase().includes(q)));
  }, [list.data, catName, search, cat]);

  const columns = useMemo(() => [
    col.accessor('title', { header: 'Product' }),
    col.accessor('categoryName', { header: 'Category' }),
    col.accessor('priceUsdt', { header: 'Price', cell: (c) => `$${Number(c.getValue()).toFixed(2)}` }),
    col.accessor('stock', { header: 'Stock', cell: (c) => <Badge tone={Number(c.getValue()) > 5 ? 'green' : 'amber'}>{String(c.getValue())}</Badge> }),
    col.accessor('status', { header: 'Status', cell: (c) => <Badge tone={c.getValue() === 'ACTIVE' ? 'green' : 'red'}>{String(c.getValue())}</Badge> }),
    col.display({ id: 'actions', header: '', cell: (c) => {
      const p = c.row.original;
      const open = expandedId === p.id;
      const toggle = () => setExpandedId((v) => (v === p.id ? null : p.id));
      return (
        <span className="flex items-center justify-end gap-1.5">
          <Button variant="outline" onClick={() => openEdit(p)}>
            <span className="flex items-center gap-1"><Pencil size={14} /> Edit</span>
          </Button>
          <Button variant={open ? 'primary' : 'outline'} onClick={toggle}>
            <span className="flex items-center gap-1 text-blue-600"><Package size={14} /> Delivery</span>
          </Button>
          <button onClick={toggle} aria-label="Toggle delivery" className="rounded-[10px] border border-slate-300 p-2 text-slate-500 hover:bg-slate-100 dark:border-slate-700">
            {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </span>
      );
    } }),
  ], [expandedId]);

  const table = useReactTable({ data: rows, columns, getCoreRowModel: getCoreRowModel(), getPaginationRowModel: getPaginationRowModel() });

  function openEdit(p: TzProduct) {
    setEditing(p);
    setETitle(p.title); setECat(p.categorySlug); setEPrice(String(p.priceUsdt)); setEDesc(p.desc ?? '');
    setEPhoto(p.logo ?? ''); setEPreview(p.logo ?? '');
    setEditError(''); setEUploading(false); setESaving(false);
    if (editFileRef.current) editFileRef.current.value = '';
  }

  async function onEditPhotoFile(f: File | undefined) {
    if (!f) return;
    if (!f.type.startsWith('image/')) { toast('Please choose an image file'); return; }
    if (f.size > 2 * 1024 * 1024) { toast('Image must be under 2MB'); return; }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(new Error('read failed'));
      r.readAsDataURL(f);
    });
    setEPreview(dataUrl);
    setEUploading(true);
    try {
      const j = await tzUploadPhoto(f.name, dataUrl);
      setEPhoto(j.url);
      toast('Photo uploaded');
    } catch (e) { toast(e instanceof Error ? e.message : 'upload failed'); }
    finally { setEUploading(false); }
  }

  async function saveEdit() {
    if (!editing) return;
    setEditError('');
    if (!eTitle.trim() || !eCat || !Number(ePrice)) { setEditError('Title, category and price are required'); return; }
    setESaving(true);
    try {
      await tzUpdateProduct(editing.id, { title: eTitle.trim(), categorySlug: eCat, priceUsdt: Number(ePrice), desc: eDesc, contents: eDesc, logo: ePhoto || undefined });
      toast('Saved to TZ Store'); setEditing(null); list.refetch();
    } catch (e) { setEditError(e instanceof Error ? e.message : 'save failed'); }
    finally { setESaving(false); }
  }


  async function onPhotoFile(f: File | undefined) {
    if (!f) return;
    if (!f.type.startsWith('image/')) { toast('Please choose an image file'); return; }
    if (f.size > 2 * 1024 * 1024) { toast('Image must be under 2MB'); return; }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(new Error('read failed'));
      r.readAsDataURL(f);
    });
    setNPreview(dataUrl);
    setUploading(true);
    try {
      const j = await tzUploadPhoto(f.name, dataUrl);
      setNPhoto(j.url);
      toast('Photo uploaded');
    } catch (e) { toast(e instanceof Error ? e.message : 'upload failed'); setNPreview(''); }
    finally { setUploading(false); }
  }

  function resetCreate() {
    setCreating(false); setNTitle(''); setNCat(''); setNPrice(''); setNDesc(''); setNStock('0');
    setNPhoto(''); setNPreview(''); setSaving(false); setFormError('');
    setShowNewCat(false); setNewCatName(''); setCreatingCat(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function createCategoryInline() {
    const name = newCatName.trim();
    if (name.length < 2) { toast('Type a category name (2+ chars)'); return; }
    setCreatingCat(true);
    try {
      const j = await tzCreateCategory(name);
      await cats.refetch();
      setNCat(j.category.slug);
      setShowNewCat(false); setNewCatName('');
      toast(`Category "${j.category.name}" added`);
    } catch (e) { toast(e instanceof Error ? e.message : 'category create failed'); }
    finally { setCreatingCat(false); }
  }

  async function createProduct() {
    // If user typed a new-category name but never pressed Add, create it now automatically.
    let slug = nCat;
    setFormError('');
    if (!slug && newCatName.trim().length >= 2) {
      try {
        const j = await tzCreateCategory(newCatName.trim());
        await cats.refetch();
        slug = j.category.slug;
        setNCat(slug);
        setShowNewCat(false); setNewCatName('');
        toast(`Category "${j.category.name}" added`);
      } catch (e) { setFormError(e instanceof Error ? e.message : 'category create failed'); return; }
    }
    const missing: string[] = [];
    if (!nTitle.trim()) missing.push('title');
    if (!slug) missing.push('category (pick one, or type a new name and press Add)');
    if (!Number(nPrice)) missing.push('price (must be over 0)');
    if (missing.length) { setFormError(`Missing: ${missing.join(' · ')}`); toast('Title, category and price are required'); return; }
    setSaving(true);
    try {
      await tzCreateProduct({ title: nTitle.trim(), categorySlug: slug, priceUsdt: Number(nPrice), desc: nDesc, contents: nDesc, stock: Number(nStock) || 0, logo: nPhoto || undefined });
      toast('Product added to TZ Store');
      resetCreate();
      cats.refetch(); list.refetch();
    } catch (e) { toast(e instanceof Error ? e.message : 'create failed'); }
    finally { setSaving(false); }
  }

  function csv() {
    const csvText = ['id,title,category,price,stock,status', ...rows.map((r) => `"${r.id}","${r.title.replace(/"/g, '""')}","${r.categoryName}",${r.priceUsdt},${r.stock},${r.status}`)].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csvText], { type: 'text/csv' }));
    a.download = 'tz-products.csv'; a.click();
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="flex items-center gap-2 text-xl font-extrabold"><Package size={20} /> Category Product</h1>
        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">TZ Store live</span>
        <Input placeholder="Search title or id…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-52" />
        <Select value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">All categories</option>{((cats.data?.categories ?? []) as { slug: string; name: string }[]).map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
        </Select>
        <div className="flex-1" />
        <Button variant="outline" onClick={csv}>CSV export</Button>
        <Button variant="green" onClick={() => { setNCat(cat || ''); setFormError(''); setCreating(true); }}><span className="flex items-center gap-1"><Plus size={15} /> New product</span></Button>
      </div>
      <Card>
        {list.isLoading ? <Skeleton className="h-64" /> : rows.length === 0 ? <Empty text={list.error ? `TZ Store unreachable: ${(list.error as Error).message} — is :3000 running?` : 'No products in TZ Store'} /> : (
          <>
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead>{table.getHeaderGroups().map((hg) => <tr key={hg.id}>{hg.headers.map((h) => <th key={h.id} className="border-b p-2 text-left text-xs uppercase text-slate-500">{flexRender(h.column.columnDef.header, h.getContext())}</th>)}</tr>)}</thead>
              <tbody>{table.getRowModel().rows.map((r) => (
                <Fragment key={r.id}>
                  <tr className="border-b last:border-0 dark:border-slate-800">{r.getVisibleCells().map((c) => <td key={c.id} className="p-2">{flexRender(c.column.columnDef.cell, c.getContext())}</td>)}</tr>
                  {expandedId === (r.original as TzProduct).id && (
                    <tr key={`${r.id}-delivery`}>
                      <td colSpan={table.getAllColumns().length} className="bg-slate-50 p-3 dark:bg-slate-800/40">
                        <DeliveryReadyTable
                          product={r.original as TzProduct}
                          onCollapse={() => setExpandedId(null)}
                          onChanged={() => list.refetch()}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}</tbody>
            </table></div>
            <div className="mt-2 flex items-center gap-2 text-sm">
              <Button variant="outline" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}><ChevronLeft size={16} /></Button>
              <span>Page {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}</span>
              <Button variant="outline" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}><ChevronRight size={16} /></Button>
            </div>
          </>
        )}
      </Card>
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing ? `Edit — ${editing.title}` : ''} wide>
        {editing && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">ID <code>{editing.id}</code> · Stock <b>{editing.stock}</b></p>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => editFileRef.current?.click()} className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 hover:border-blue-500 hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-800">
                {ePreview ? <img src={ePreview.startsWith('data:') ? ePreview : tzLogoUrl(ePreview)} alt="preview" className="h-full w-full object-cover" /> : <ImagePlus size={26} className="text-slate-400" />}
              </button>
              <div className="text-sm">
                <div className="font-semibold">Product photo</div>
                <p className="text-xs text-slate-500">PNG/JPG/WebP under 2MB. Click the box or drag a file.</p>
                <input ref={editFileRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => onEditPhotoFile(e.target.files?.[0])} />
                <div className="mt-1 flex gap-2">
                  <Button variant="outline" onClick={() => editFileRef.current?.click()} disabled={eUploading}>{eUploading ? 'Uploading…' : 'Change photo'}</Button>
                  {ePreview && <button onClick={() => { setEPreview(''); setEPhoto(''); if (editFileRef.current) editFileRef.current.value = ''; }} className="flex items-center gap-1 text-xs text-slate-500 hover:text-red-600"><X size={14} /> Remove</button>}
                </div>
              </div>
            </div>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); onEditPhotoFile(e.dataTransfer.files?.[0]); }}
              className="rounded-xl bg-slate-50 p-2 text-center text-[11px] text-slate-400 dark:bg-slate-800/60">
              Drop an image anywhere on this box to upload instantly
            </div>
            <Field label="Title"><Input value={eTitle} onChange={(e) => setETitle(e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Category"><Select value={eCat} onChange={(e) => setECat(e.target.value)}>
                <option value="">Select category…</option>{((cats.data?.categories ?? []) as { slug: string; name: string }[]).map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
              </Select></Field>
              <Field label="Price USDT"><Input type="number" step="0.01" min="0" value={ePrice} onChange={(e) => setEPrice(e.target.value)} /></Field>
            </div>
            <Field label="Description"><Textarea rows={3} value={eDesc} onChange={(e) => setEDesc(e.target.value)} /></Field>
            {editError && <p className="rounded-xl bg-red-50 p-2.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">{editError}</p>}
            <Button onClick={saveEdit} disabled={eSaving || eUploading} className="w-full">{eSaving ? 'Saving…' : 'Save to TZ Store'}</Button>
            <hr className="dark:border-slate-800" />
            {editing && <VaultSection productId={editing.id} stock={editing.stock} onChanged={() => list.refetch()} />}
          </div>
        )}
      </Modal>
      <Modal open={creating} onClose={() => setCreating(false)} title="New product — TZ Store">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => fileRef.current?.click()} className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 hover:border-blue-500 hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-800">
              {nPreview ? <img src={nPreview} alt="preview" className="h-full w-full object-cover" /> : <ImagePlus size={26} className="text-slate-400" />}
            </button>
            <div className="text-sm">
              <div className="font-semibold">Product photo</div>
              <p className="text-xs text-slate-500">PNG/JPG/WebP under 2MB. Click the box or drag a file.</p>
              <input ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => onPhotoFile(e.target.files?.[0])} />
              <div className="mt-1 flex gap-2">
                <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>{uploading ? 'Uploading…' : nPhoto ? 'Change photo' : 'Add photo'}</Button>
                {nPreview && <button onClick={() => { setNPreview(''); setNPhoto(''); if (fileRef.current) fileRef.current.value = ''; }} className="flex items-center gap-1 text-xs text-slate-500 hover:text-red-600"><X size={14} /> Remove</button>}
              </div>
            </div>
          </div>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); onPhotoFile(e.dataTransfer.files?.[0]); }}
            className="rounded-xl bg-slate-50 p-2 text-center text-[11px] text-slate-400 dark:bg-slate-800/60">
            Drop an image anywhere on this box to upload instantly
          </div>
          <Field label="Title"><Input value={nTitle} onChange={(e) => setNTitle(e.target.value)} placeholder="e.g. Netflix Premium 1M" /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Category">
              <Select value={nCat} onChange={(e) => setNCat(e.target.value)}>
                <option value="">Select category…</option>{((cats.data?.categories ?? []) as { slug: string; name: string }[]).map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
              </Select>
              {!showNewCat ? (
                <button onClick={() => setShowNewCat(true)} className="mt-1 flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800"><Plus size={13} /> New category</button>
              ) : (
                <div className="mt-1 flex gap-1">
                  <Input value={newCatName} onChange={(e) => setNewCatName(e.target.value)} placeholder="e.g. Kiro" className="!py-1.5 text-xs"
                    onKeyDown={(e) => { if (e.key === 'Enter') createCategoryInline(); }} />
                  <Button onClick={createCategoryInline} disabled={creatingCat} className="!px-3 !py-1.5 text-xs">{creatingCat ? '…' : 'Add'}</Button>
                </div>
              )}
            </Field>
            <Field label="Price USDT"><Input type="number" step="0.01" min="0" value={nPrice} onChange={(e) => setNPrice(e.target.value)} placeholder="4.99" /></Field>
          </div>
          <Field label="Description"><Textarea rows={3} value={nDesc} onChange={(e) => setNDesc(e.target.value)} placeholder="What the buyer gets…" /></Field>
          <Field label="Initial stock"><Input type="number" min="0" value={nStock} onChange={(e) => setNStock(e.target.value)} /></Field>
          {formError && <p className="rounded-xl bg-red-50 p-2.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">{formError}</p>}
          <Button variant="green" onClick={createProduct} disabled={saving || uploading} className="w-full">{saving ? 'Saving…' : 'Add product'}</Button>
          <p className="text-center text-xs text-slate-500">Saved to TZ Store live catalog — appears in the storefront and bot instantly.</p>
        </div>
      </Modal>
    </div>
  );
}
