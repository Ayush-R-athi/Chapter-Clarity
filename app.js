(() => {
  const input = document.querySelector('#chapter-input');
  const count = document.querySelector('#word-count');
  const error = document.querySelector('#input-error');
  const empty = document.querySelector('#empty-state');
  const content = document.querySelector('#results-content');
  const list = document.querySelector('#sentence-list');
  const charLimit = 100000;
  const feedback = new Map();
  const sampleText = `The old observatory stood above the harbor, where the last light of evening gathered on its cracked windows. Mara had promised herself she would only stay for a moment, but the brass key in her pocket felt warmer each time she thought about leaving.\n\n“Did you hear that?” she asked.\n\nNo one answered. Dr. Vale had warned her that the building was unsafe, and that the stairs, which had survived a century of storms, might not survive another winter. Still, somewhere beneath the floorboards, a slow and steady ticking began. Mara took one breath, then another, and opened the door.`;
  const wordPattern = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu;

  function wordsOf(text) { return text.match(wordPattern) || []; }
  function syllables(word) {
    const cleaned = word.toLowerCase().replace(/[^a-z]/g, '');
    if (!cleaned) return 1;
    if (cleaned.length <= 3) return 1;
    const normalized = cleaned.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');
    const groups = normalized.match(/[aeiouy]{1,2}/g);
    return Math.max(1, groups ? groups.length : 1);
  }
  function splitSentences(text) {
    const normalized = text.replace(/\r\n?/g, '\n').trim();
    if (!normalized) return [];
    const protectedText = normalized
      .replace(/\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|vs|etc|e\.g|i\.e|No|Fig|Capt|Gen|Rev|Lt|Col|Sgt|Maj|Gov|Sen|Rep|Hon|Inc|Ltd|Co)\./gi, m => m.replace(/\./g, '\uE000'))
      .replace(/\b(?:[A-Z]\.){2,}/g, m => m.replace(/\./g, '\uE000'))
      .replace(/\b([A-Z])\./g, '$1\uE000');
    const result = [];
    let start = 0;
    for (let i = 0; i < protectedText.length; i++) {
      if (!'.!?'.includes(protectedText[i])) continue;
      if (protectedText[i] === '.' && protectedText[i + 1] === '.') {
        let ellipsisEnd = i;
        while (protectedText[ellipsisEnd] === '.') ellipsisEnd++;
        while (/[”’"')\]]/.test(protectedText[ellipsisEnd] || '')) ellipsisEnd++;
        let nextText = ellipsisEnd;
        while (/\s/.test(protectedText[nextText] || '')) nextText++;
        if ((nextText === protectedText.length || /[A-Z“"'“]/.test(protectedText[nextText] || '')) && (ellipsisEnd === protectedText.length || /\s/.test(protectedText[ellipsisEnd]))) {
          const sentence = protectedText.slice(start, ellipsisEnd).replace(/\uE000/g, '.').trim();
          if (wordsOf(sentence).length) result.push(sentence);
          start = nextText; i = ellipsisEnd - 1; continue;
        }
        i = ellipsisEnd - 1; continue;
      }
      if (protectedText[i] === '.' && (protectedText[i - 1] === '.' || /\d/.test(protectedText[i - 1] || '') && /\d/.test(protectedText[i + 1] || ''))) continue;
      let end = i + 1;
      while (/[.!?]/.test(protectedText[end] || '')) end++;
      while (/[”’"')\]]/.test(protectedText[end] || '')) end++;
      if (end === protectedText.length || /\s/.test(protectedText[end])) {
        const sentence = protectedText.slice(start, end).replace(/\uE000/g, '.').trim();
        if (wordsOf(sentence).length) result.push(sentence);
        start = end;
        while (/\s/.test(protectedText[start] || '')) start++;
        i = end - 1;
      }
    }
    const remainder = protectedText.slice(start).replace(/\uE000/g, '.').trim();
    if (wordsOf(remainder).length) result.push(remainder);
    return result;
  }
  function clauseMarkers(sentence) {
    const markers = sentence.toLowerCase().match(/\b(?:although|because|since|unless|whereas|while|which|who|whom|whose|that|if|when|where|after|before|though|until|once|even though|so that)\b/g) || [];
    return markers.length;
  }
  function sentenceInfo(sentence) {
    const words = wordsOf(sentence);
    const syllableCount = words.reduce((sum, word) => sum + syllables(word), 0);
    const average = syllableCount / Math.max(words.length, 1);
    const punctuation = (sentence.match(/[;,—:()]/g) || []).length;
    const clauses = clauseMarkers(sentence);
    const score = .7 * words.length + 9 * average + 2 * punctuation + 4 * clauses;
    const reasons = [];
    if (words.length >= 25) reasons.push(`at ${words.length} words, it’s longer than many sentences`);
    else if (words.length >= 18) reasons.push(`it has ${words.length} words to hold in mind`);
    if (average >= 1.65) reasons.push('some words may take longer to process');
    if (clauses >= 2) reasons.push(`${clauses} clause signals add layers`);
    else if (clauses === 1) reasons.push('a dependent clause adds another layer');
    if (punctuation >= 3) reasons.push('several punctuation breaks interrupt the flow');
    if (!reasons.length) reasons.push('a mix of length and phrasing signals nudged its score up');
    return { sentence, words: words.length, score, reasons: reasons.slice(0, 2) };
  }
  function appendHighlightedSentence(node, sentence) {
    const parts = sentence.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*|[;,—:]|[^\p{L}\p{N};,—:]+/gu) || [sentence];
    const clauses = /^(?:although|because|since|unless|whereas|while|which|who|whom|whose|that|if|when|where|after|before|though|until|once)$/i;
    parts.forEach(part => {
      const token = part.trim();
      const syllableSignal = wordsOf(token).length > 0 && syllables(token) >= 3;
      const clauseSignal = clauses.test(token);
      const punctuationSignal = /^[;,—:]$/.test(token);
      if (syllableSignal || clauseSignal || punctuationSignal) {
        const mark = document.createElement('mark');
        mark.className = clauseSignal ? 'signal-clause' : punctuationSignal ? 'signal-punctuation' : 'signal-word';
        mark.textContent = part;
        mark.title = clauseSignal ? 'Clause signal' : punctuationSignal ? 'Punctuation signal' : 'Longer word signal';
        node.append(mark);
      } else node.append(document.createTextNode(part));
    });
  }
  function reviewSentence(sentence, button) {
    let offset = 0;
    const inputText = input.value;
    while (offset < inputText.length) {
      const found = inputText.indexOf(sentence, offset);
      if (found < 0) break;
      const before = found === 0 ? '' : inputText[found - 1];
      const after = inputText[found + sentence.length] || '';
      if ((!before || /\s/.test(before)) && (!after || /\s/.test(after))) {
        input.focus(); input.setSelectionRange(found, found + sentence.length);
        const lineHeight = parseFloat(getComputedStyle(input).lineHeight) || 23;
        const precedingLines = inputText.slice(0, found).split('\n').length - 1;
        input.scrollTop = Math.max(0, precedingLines * lineHeight - input.clientHeight / 2);
        button.textContent = 'Passage selected ✓';
        return;
      }
      offset = found + sentence.length;
    }
    input.focus(); input.setSelectionRange(0, 0);
    button.textContent = 'Text changed — analyze again';
  }
  function readability(words, sentences) {
    const syllableCount = words.reduce((sum, word) => sum + syllables(word), 0);
    return Math.max(0, Math.min(100, 206.835 - 1.015 * (words.length / sentences.length) - 84.6 * (syllableCount / words.length)));
  }
  function band(score) {
    if (score >= 90) return ['Very easy', 'Most readers should find this passage straightforward.'];
    if (score >= 80) return ['Easy', 'This passage may feel comfortable for most readers.'];
    if (score >= 70) return ['Fairly easy', 'This passage may feel clear and approachable to many readers.'];
    if (score >= 60) return ['Standard', 'This passage sits around the middle of the reading ease scale.'];
    if (score >= 50) return ['Fairly difficult', 'Some readers may need to slow down in places.'];
    if (score >= 30) return ['Difficult', 'This passage may ask readers to do more work.'];
    return ['Very difficult', 'This passage may be demanding for many readers.'];
  }
  function updateCount() {
    const number = wordsOf(input.value).length;
    count.textContent = `${number.toLocaleString()} ${number === 1 ? 'word' : 'words'}`;
    error.hidden = true;
    input.removeAttribute('aria-invalid');
  }
  function analyze() {
    const text = input.value.trim();
    const wordList = wordsOf(text);
    const sentences = splitSentences(text);
    if (!text || wordList.length < 3 || sentences.length === 0) {
      error.textContent = !text ? 'Paste a little of your chapter first.' : 'Add at least three words and one complete sentence to get a useful read.';
      error.hidden = false;
      input.setAttribute('aria-invalid', 'true');
      input.focus();
      return;
    }
    const score = readability(wordList, sentences);
    const [label, explanation] = band(score);
    const ranked = sentences.map(sentenceInfo).sort((a, b) => b.score - a.score || b.words - a.words || a.sentence.localeCompare(b.sentence)).slice(0, 5);
    document.querySelector('#score-number').textContent = Math.round(score);
    document.querySelector('#score-label').textContent = label;
    document.querySelector('#score-explainer').textContent = `${explanation} Flesch Reading Ease is an estimate, not a measure of writing quality.`;
    document.querySelector('#ring-number').textContent = Math.round(score);
    document.querySelector('#score-ring').setAttribute('aria-label', `Readability score ${Math.round(score)} out of 100`);
    document.querySelector('#ring-value').style.strokeDashoffset = String(264 - 264 * score / 100);
    document.querySelector('#stat-words').textContent = wordList.length.toLocaleString();
    document.querySelector('#stat-sentences').textContent = sentences.length.toLocaleString();
    document.querySelector('#stat-minutes').textContent = Math.max(1, Math.ceil(wordList.length / 200));
    document.querySelector('#result-count').textContent = `${ranked.length} ${ranked.length === 1 ? 'SENTENCE' : 'SENTENCES'}`;
    list.replaceChildren();
    ranked.forEach((item, index) => {
      const li = document.createElement('li'); li.className = 'sentence-item';
      const top = document.createElement('div'); top.className = 'sentence-topline';
      const rank = document.createElement('span'); rank.className = 'sentence-rank'; rank.textContent = `#${index + 1} · REVIEW`; 
      const words = document.createElement('span'); words.className = 'sentence-words'; words.textContent = `${item.words} words`;
      top.append(rank, words);
      const quote = document.createElement('p'); quote.className = 'sentence-text'; appendHighlightedSentence(quote, item.sentence);
      const reason = document.createElement('p'); reason.className = 'sentence-reason'; reason.textContent = `Why it surfaced: ${item.reasons.join('; ')}.`;
      const actions = document.createElement('div'); actions.className = 'sentence-actions';
      const review = document.createElement('button'); review.type = 'button'; review.className = 'review-button'; review.textContent = 'Find in chapter ↗';
      review.addEventListener('click', () => reviewSentence(item.sentence, review));
      const vote = document.createElement('div'); vote.className = 'feedback-actions'; vote.setAttribute('role', 'group'); vote.setAttribute('aria-label', 'Was this suggestion useful?');
      [['useful', 'Useful'], ['not-useful', 'Not useful']].forEach(([value, label]) => {
        const choice = document.createElement('button'); choice.type = 'button'; choice.textContent = label;
        choice.className = feedback.get(item.sentence) === value ? 'feedback-choice selected' : 'feedback-choice';
        choice.setAttribute('aria-pressed', String(feedback.get(item.sentence) === value));
        choice.addEventListener('click', () => {
          if (feedback.get(item.sentence) === value) feedback.delete(item.sentence); else feedback.set(item.sentence, value);
          vote.querySelectorAll('button').forEach(b => { const selected = b === choice && feedback.get(item.sentence) === value; b.classList.toggle('selected', selected); b.setAttribute('aria-pressed', String(selected)); });
          document.querySelector('#feedback-note').textContent = feedback.has(item.sentence) ? 'Thanks — your feedback stays in this session.' : 'Was this list useful? Your feedback stays in this session.';
        });
        vote.append(choice);
      });
      actions.append(review, vote);
      li.append(top, quote, reason, actions); list.append(li);
    });
    document.querySelector('#no-sentences').hidden = sentences.length > 0;
    empty.hidden = true; content.hidden = false; error.hidden = true;
    document.querySelector('#results').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  input.addEventListener('input', updateCount);
  input.addEventListener('paste', () => setTimeout(() => { if (input.value.length > charLimit) input.value = input.value.slice(0, charLimit); updateCount(); }, 0));
  document.querySelector('#analyze-button').addEventListener('click', analyze);
  document.querySelector('#reanalyze-button').addEventListener('click', analyze);
  document.querySelector('#clear-button').addEventListener('click', () => { input.value = ''; updateCount(); input.focus(); });
  document.querySelector('#sample-button').addEventListener('click', () => { input.value = sampleText; updateCount(); input.focus(); });
  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); analyze(); }
  });
  document.querySelector('#copy-button').addEventListener('click', async event => {
    const text = `Chapter Clarity — Readability ${document.querySelector('#score-number').textContent}/100 (${document.querySelector('#score-label').textContent})\n${document.querySelector('#stat-words').textContent} words · ${document.querySelector('#stat-sentences').textContent} sentences\n\nSentences worth a second look:\n${[...list.querySelectorAll('.sentence-text')].map((node, i) => `${i + 1}. ${node.textContent}`).join('\n')}\n\nEstimate only; chapter analyzed privately in the browser.`;
    const button = event.currentTarget;
    try { await navigator.clipboard.writeText(text); button.textContent = '✓'; button.setAttribute('aria-label', 'Summary copied'); }
    catch { button.setAttribute('title', 'Clipboard access is unavailable in this browser'); }
  });
  document.querySelector('#method-link').addEventListener('click', () => { document.querySelector('#method').open = true; });
  updateCount();
})();
