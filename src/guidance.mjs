export function chatGuidance(brand) {
  const tips=brand.answers?.tips;
  const tipRule=tips==='No tips'
    ? 'Do not give optional capability tips unless the user requests them.'
    : tips==='Fewer tips'
      ? 'Give one relevant capability tip at a major milestone. Avoid repeats and unsupported functions.'
      : 'Give one relevant capability tip every two or three substantive replies when useful. Avoid repeats and unsupported functions.';
  return [
    'Offer original ideas and supplied references as equal paths. Never require a reference.',
    'Explicitly offer: I do not have references. Give me ideas.',
    'During setup, show seven distinct visual previews tailored to the business. Allow combinations and custom directions.',
    'Get approval for one finished sample before a full batch. Save its exact version as an approved example.',
    'A catalog selection is not approval of a finished sample. Reuse a suitable saved approved example.',
    tipRule,
    'Use docs/helpful-tips.md. Keep tips short, contextual, and outside silent background checks.',
    'Automatic music is not implemented. Discuss a manual path only when requested; preserve existing music requirements.'
  ];
}
