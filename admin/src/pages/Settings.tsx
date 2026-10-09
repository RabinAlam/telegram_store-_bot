import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, get, post } from '../api';
import { Button, Card, Field, Input, Skeleton, toast } from '../ui';

const TABS = ['Bot', 'Payments', 'Referral', 'Wallet', 'Security'] as const;

import { displaySettingValue, secretPlaceholder, shouldSkipSecret, normalizeSettingInput } from '../settings-util';

export default function Settings() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Bot');
  const [form, setForm] = useState<Record<string, string>>({});
  const [pwd, setPwd] = useState({ cur: '', next: '' });
  const settings = useQuery({ queryKey: ['settings'], queryFn: () => get('/api/settings') as Promise<Record<string, unknown>> });
  const s = settings.data ?? {};
  const val = (k: string) => displaySettingValue(form, s, k);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const secretPh = (k: string) => secretPlaceholder(s[k]);

  async function save(keys: string[], parseJson: string[] = []) {
    try {
      for (const k of keys) {
        const raw = normalizeSettingInput(val(k));
        if (shouldSkipSecret(k, raw)) continue; // keep saved secret
        const value = parseJson.includes(k) ? JSON.parse(raw || '{}') : (isNaN(Number(raw)) || raw === '' ? raw : Number(raw));
        await api('/api/settings', { method: 'PUT', body: JSON.stringify({ key: k, value }) });
      }
      toast('Settings saved'); setForm({}); settings.refetch();
    } catch (e) { toast(e instanceof Error ? e.message : 'failed'); }
  }

  async function changePwd() {
    try {
      await post('/api/auth/change-password', { oldPassword: pwd.cur, newPassword: pwd.next });
      toast('Password changed'); setPwd({ cur: '', next: '' });
    } catch (e) { toast(e instanceof Error ? e.message : 'failed'); }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1">{TABS.map((t) => (
        <button key={t} onClick={() => setTab(t)} className={`rounded-xl px-4 py-2 text-sm font-semibold ${tab === t ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-900'}`}>{t}</button>
      ))}</div>
      {settings.isLoading ? <Skeleton className="h-48" /> : (
        <>
          {tab === 'Bot' && <Card><div className="grid gap-3 md:grid-cols-2">
            <Field label="Bot token"><Input type="password" value={val('botToken')} onChange={(e) => set('botToken', e.target.value)} placeholder={secretPh('botToken')} /></Field>
            <Field label="Admin notify chat id"><Input value={val('adminNotifyChatId')} onChange={(e) => set('adminNotifyChatId', e.target.value)} /></Field>
            <Field label="Support URL"><Input value={val('supportUrl')} onChange={(e) => set('supportUrl', e.target.value)} /></Field>
            <Field label="Channel URL"><Input value={val('channelUrl')} onChange={(e) => set('channelUrl', e.target.value)} /></Field>
            <div className="md:col-span-2"><Button onClick={() => save(['botToken', 'adminNotifyChatId', 'supportUrl', 'channelUrl'])}>Save bot settings</Button></div>
          </div></Card>}
          {tab === 'Payments' && <div className="space-y-3">
            <Card><h3 className="font-bold">🟡 Personal Binance account <span className="text-xs font-normal text-slate-500">(no merchant needed — recommended)</span></h3>
              <p className="mt-1 text-xs text-slate-500">Buyers send USDT to your UID, submit the TXID/Order ID, and the panel auto-checks your Spot deposit history. UID-to-UID transfers still need one-tap manual approve.</p>
              <div className="mt-2 grid gap-3 md:grid-cols-2">
                <Field label="Store Binance UID (shown to buyers)"><Input value={val('binanceUid')} onChange={(e) => set('binanceUid', e.target.value)} placeholder="e.g. 1134278389" inputMode="numeric" /></Field>
                <Field label="Spot API Key (auto-verify)"><Input value={val('binanceSpotApiKey')} onChange={(e) => set('binanceSpotApiKey', e.target.value)} placeholder={secretPh('binanceSpotApiKey')} /></Field>
                <Field label="Spot API Secret"><Input type="password" value={val('binanceSpotSecret')} onChange={(e) => set('binanceSpotSecret', e.target.value)} placeholder={secretPh('binanceSpotSecret')} /></Field>
              </div>
              <div className="mt-2"><Button onClick={() => save(['binanceUid', 'binanceSpotApiKey', 'binanceSpotSecret'])}>Save personal account</Button></div>
            </Card>
            <Card><h3 className="font-bold">🏦 Binance Pay merchant <span className="text-xs font-normal text-slate-500">(optional — only with merchant account)</span></h3>
              <div className="mt-2 grid gap-3 md:grid-cols-2">
                <Field label="Binance Merchant ID"><Input value={val('binanceMerchantId')} onChange={(e) => set('binanceMerchantId', e.target.value)} /></Field>
                <Field label="Binance API Key"><Input value={val('binanceApiKey')} onChange={(e) => set('binanceApiKey', e.target.value)} placeholder={secretPh('binanceApiKey')} /></Field>
                <Field label="Binance Secret"><Input type="password" value={val('binanceSecret')} onChange={(e) => set('binanceSecret', e.target.value)} placeholder={secretPh('binanceSecret')} /></Field>
                <div className="md:col-span-2"><Button onClick={() => save(['binanceMerchantId', 'binanceApiKey', 'binanceSecret'])}>Save merchant keys</Button></div>
              </div>
            </Card>
          </div>}
          {tab === 'Referral' && <Card><div className="max-w-60">
            <Field label="Commission %"><Input type="number" value={val('referralPercent')} onChange={(e) => set('referralPercent', e.target.value)} /></Field>
            <div className="mt-2"><Button onClick={() => save(['referralPercent'])}>Save</Button></div>
          </div></Card>}
          {tab === 'Wallet' && <Card><div className="grid gap-3 md:grid-cols-2">
            <Field label="Min deposit"><Input type="number" value={val('minDeposit')} onChange={(e) => set('minDeposit', e.target.value)} /></Field>
            <Field label="Manual addresses JSON {TRC20,BEP20}"><Input value={val('manualAddresses')} onChange={(e) => set('manualAddresses', e.target.value)} /></Field>
            <div className="md:col-span-2"><Button onClick={() => save(['minDeposit', 'manualAddresses'], ['manualAddresses'])}>Save wallet settings</Button></div>
          </div></Card>}
          {tab === 'Security' && <Card><div className="grid max-w-md gap-3">
            <Field label="Current password"><Input type="password" value={pwd.cur} onChange={(e) => setPwd({ ...pwd, cur: e.target.value })} /></Field>
            <Field label="New password"><Input type="password" value={pwd.next} onChange={(e) => setPwd({ ...pwd, next: e.target.value })} /></Field>
            <Button onClick={changePwd}>Change password</Button>
          </div></Card>}
        </>
      )}
    </div>
  );
}
