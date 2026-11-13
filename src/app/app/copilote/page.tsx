import { adaptTasks } from '@/components/app/adapters';
import { Copilot, type CopilotContext } from '@/components/app/Copilot';
import { PageHeader } from '@/components/app/PageHeader';
import { FACT_LABEL, fmtDate, PROVIDER_LABEL } from '@/components/app/tokens';
import { auditDate, myShare, rankOf, ranking } from '@/components/app/workspace';
import { loadActionContext } from '@/components/app/action/context';
import type { BrandFactField } from '@/lib/engine/types-v2';
import { copilotSuggestions } from '@/lib/copilot/prompt';

export const metadata = { title: 'Copilote' };

export default async function CopilotePage({ searchParams }: { searchParams: Promise<{ context?: string; q?: string }> }) {
  const sp = await searchParams;
  const screen = sp.context && /^[a-z-]{1,30}$/.test(sp.context) ? sp.context : undefined;
  const initialQuestion = typeof sp.q === 'string' ? sp.q.slice(0, 300) : undefined;
  const { ws, ent } = await loadActionContext();
  const a = ws.latest;
  const tasks = await adaptTasks(ws.business.id, ws.fb);
  const rows = a ? ranking(a) : [];
  const meIdx = rows.findIndex((r) => r.isMe);
  const priceRe = /prix|tarif|€|cher|coût/i;
  const ctx: CopilotContext = {
    name: ws.business.name,
    dataDate: a ? fmtDate(auditDate(a), { day: 'numeric', month: 'long' }) : '—',
    benchmark: a ? rankOf(a).label : '—',
    score: a ? Math.round(a.score) : 0,
    scoreDelta: a && ws.previous ? Math.round(a.score - ws.previous.score) : null,
    share: a ? myShare(a) : 0,
    topCompetitor: meIdx > 0 ? rows[0].name : null,
    gaps: (a?.gaps ?? []).map((g) => ({ competitor: g.competitor, reasons: g.reasons, presentOn: g.presentOn })),
    opportunities: (a?.sources?.opportunities ?? []).map((o) => ({ label: o.label, action: o.action, effort: o.effort, impact: o.impact, why: o.why })),
    questions: a?.queries.map((q) => q.text) ?? [],
    priceQuotes: (a?.perception?.quotes ?? []).filter((q) => priceRe.test(q.text)).map((q) => ({ provider: PROVIDER_LABEL[q.provider], text: q.text })),
    priceFact: ws.facts.facts.prix ?? null,
    facts: (Object.entries(ws.facts.facts) as [BrandFactField, string][]).map(([k, v]) => ({ label: FACT_LABEL[k], value: v })),
    jsonLd: null,
    errors: a?.factCheck?.errors ?? 0,
    tasksDone: tasks.filter((t) => t.status === 'done').length,
    suggestions: copilotSuggestions(ws.segment, { name: ws.business.name, topCompetitor: (a?.gaps ?? []).find((g) => g.mentions > (rows[meIdx]?.mentions ?? 0))?.competitor ?? (meIdx > 0 ? rows[0].name : null) }),
  };
  return (
    <>
      <PageHeader
        title="Copilote"
        meta={<>Répond à partir de vos données uniquement{ws.demo ? ' · démo' : ''}</>}
      />
      <div className="rp-page">
        <Copilot businessId={ws.business.id} context={ctx} demo={ws.demo} screen={screen} initialQuestion={initialQuestion} dailyLimit={ent.copilotDaily} />
      </div>
    </>
  );
}
