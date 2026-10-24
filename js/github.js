/* Live GitHub repos.
   GitHub's public REST API can't return a user's *pinned* repos (that's
   GraphQL-only and needs an auth token, which we can't ship in a static site).
   So instead we curate the list here — the same repos you'd pin — and still
   pull each one's live description / language / update date in a single call.
   Edit PINNED to change what shows, in the order you want them.
   If none of the pinned names resolve, we fall back to stars-then-recency. */
(function () {
  const grid = document.getElementById('repoGrid');
  if (!grid) return;
  const USER = 'arugoa';
  const PINNED = [
    'cad-to-urdf',
    'TR-mbed',
    'drone',
  ];
  const langColor = { JavaScript:'#f1e05a', TypeScript:'#3178c6', Python:'#3572A5', 'C++':'#f34b7d',
    C:'#555555', Java:'#b07219', HTML:'#e34c26', CSS:'#563d7c', CUDA:'#3A4E3A', 'C#':'#178600',
    MATLAB:'#e16737', Jupyter:'#DA5B0B', Shell:'#89e051' };

  fetch(`https://api.github.com/users/${USER}/repos?sort=updated&per_page=100`)
    .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(repos => {
      const byName = new Map(repos.map(r => [r.name.toLowerCase(), r]));
      const pinned = PINNED.map(n => byName.get(n.toLowerCase())).filter(Boolean);
      const list = pinned.length
        ? pinned.slice(0, 6)
        : repos
            .filter(r => !r.fork)
            .sort((a, b) => (b.stargazers_count - a.stargazers_count) || (new Date(b.updated_at) - new Date(a.updated_at)))
            .slice(0, 6);
      if (!list.length) { showNote('No public repositories yet — check back soon.'); return; }
      grid.innerHTML = list.map(r => {
        const color = langColor[r.language] || 'var(--muted)';
        const updated = new Date(r.updated_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        return `<a class="repo" href="${r.html_url}" target="_blank" rel="noopener">
          <div class="rname">${r.name}</div>
          <div class="rdesc">${r.description ? escapeHtml(r.description) : 'No description provided.'}</div>
          <div class="rmeta">
            ${r.language ? `<span><span class="dot" style="background:${color}"></span>${r.language}</span>` : ''}
            ${r.stargazers_count ? `<span>★ ${r.stargazers_count}</span>` : ''}
            <span>${updated}</span>
          </div></a>`;
      }).join('');
    })
    .catch(() => showNote(`Couldn't load repos right now (GitHub's public API rate-limits by IP). Browse them directly at <a href="https://github.com/${USER}?tab=repositories" target="_blank" rel="noopener" style="color:var(--path)">github.com/${USER}</a>.`));

  function showNote(msg) { grid.innerHTML = `<div class="gh-note">${msg}</div>`; }
  function escapeHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
})();
