const r = ['black'].map(c => new RegExp(`\\\\b${c}\\\\b`, 'i'));
console.log(r);
