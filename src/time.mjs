export function zoneParts(instant, zone) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(instant)).map(p => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
// Resolve wall time by the zone's actual offsets. Reject missing and repeated times.
export function resolveTime(local, zone, occurrence = 'reject') {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local || '')) throw new Error('Enter a date and time.');
  const naive = Date.parse(`${local}:00Z`);
  if (!Number.isFinite(naive) || new Date(naive).toISOString().slice(0,16) !== local) throw new Error('Invalid calendar date.');
  const offsets = new Set();
  for (let h = -48; h <= 48; h += 6) { const t = naive + h * 3600000; offsets.add(Date.parse(`${zoneParts(t, zone)}:00Z`) - t); }
  const matches = [...offsets].map(offset => naive - offset).filter(t => zoneParts(t, zone) === local).sort((a,b) => a-b);
  if (!matches.length) throw new Error('This local time does not exist because the clock changes.');
  if (matches.length > 1 && !['earlier','later'].includes(occurrence)) throw new Error('This local time occurs twice. Choose earlier or later.');
  return new Date(occurrence === 'later' ? matches.at(-1) : matches[0]).toISOString();
}
