export function generateCSV(submissions) {
  const answerLabels = new Set();
  for (const sub of submissions) {
    for (const a of sub.answers) {
      answerLabels.add(a.label || a.id);
    }
  }
  const labels = Array.from(answerLabels);

  let csv = 'ID,Discord,Timestamp,Archived,' + labels.join(',') + '\n';

  for (const sub of submissions) {
    const row = [
      sub.id,
      sub.discord || '',
      new Date(sub.timestamp).toISOString(),
      sub.archived ? 'Yes' : 'No',
    ];
    for (const label of labels) {
      const answer = sub.answers.find((a) => (a.label || a.id) === label);
      if (answer) {
        const val = Array.isArray(answer.value) ? answer.value.join('; ') : String(answer.value);
        row.push('"' + val.replace(/"/g, '""') + '"');
      } else {
        row.push('');
      }
    }
    csv += row.join(',') + '\n';
  }

  return csv;
}
