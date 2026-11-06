'use strict';

const STORAGE_KEY = 'doubleWicketTournament_v1';
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const clone = value => JSON.parse(JSON.stringify(value));
const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = value => Number(value || 0).toLocaleString('en-US');
const app = {
  page: 'home',
  selectedMatchId: null,
  selectedGroupId: null,
  deferredInstall: null,
  state: loadState()
};

function defaultState() {
  return { version: 1, tournamentName: 'Double Wicket Tournament', groups: [{id:'group-a',name:'Group A'}], teams: [], matches: [], scheduleGenerated: false, createdAt: null };
}
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.teams) || !Array.isArray(parsed.matches)) return defaultState();
    if (!Array.isArray(parsed.groups) || !parsed.groups.length) parsed.groups = [{id:'group-a',name:'Group A'}];
    parsed.teams.forEach(t => { if (!t.groupId) t.groupId = parsed.groups[0].id; });
    parsed.matches.forEach(m => { if (m.stage === 'League' && !m.groupId) m.groupId = parsed.teams.find(t=>t.id===m.teamAId)?.groupId || parsed.groups[0].id; });
    return parsed;
  } catch (err) { console.warn('Could not load saved tournament', err); return defaultState(); }
}
function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(app.state));
    const stamp = $('#saveStatus');
    if (stamp) stamp.textContent = 'Saved on this device';
  } catch (err) {
    console.error(err);
    const stamp = $('#saveStatus');
    if (stamp) stamp.textContent = 'Storage full';
    toast('Data save nahi ho saka. Device storage check karein.');
  }
}
function toast(message) {
  let node = $('#toastMessage');
  if (!node) { node = document.createElement('div'); node.id = 'toastMessage'; node.style.cssText = 'position:fixed;z-index:99;left:50%;bottom:92px;transform:translateX(-50%);background:#e6f8d0;color:#142016;padding:10px 14px;border-radius:12px;font-size:11px;font-weight:800;max-width:90vw;box-shadow:0 8px 30px #0008;text-align:center'; document.body.appendChild(node); }
  node.textContent = message; node.classList.remove('hidden');
  clearTimeout(toast.timer); toast.timer = setTimeout(() => node.classList.add('hidden'), 2600);
}
function teamById(id) { return app.state.teams.find(t => t.id === id); }
function groupById(id) { return app.state.groups.find(g => g.id === id); }
function groupName(id) { return groupById(id)?.name || 'Unassigned'; }
function teamsInGroup(id) { return app.state.teams.filter(t => t.groupId === id); }
function teamName(id) { return teamById(id)?.name || 'Unknown team'; }
function playerName(teamId, playerId) {
  const team = teamById(teamId); if (!team) return 'Player';
  if (playerId === `${teamId}:c`) return team.captain;
  if (playerId === `${teamId}:p`) return team.partner;
  return 'Player';
}
function playerIds(teamId) { return [`${teamId}:c`, `${teamId}:p`]; }
function initials(name) { return String(name || '?').trim().split(/\s+/).slice(0,2).map(s => s[0] || '').join('').toUpperCase() || '?'; }
function setHeader() {
  const complete = app.state.matches.filter(m => !m.isBye && (m.status === 'completed' || m.status === 'abandoned')).length;
  const total = app.state.matches.filter(m => !m.isBye).length;
  const header = $('#headerStatus');
  if (!header) return;
  header.textContent = app.state.scheduleGenerated ? `${app.state.teams.length} teams · ${complete}/${total} matches decided` : 'Ready to set up your tournament';
}
function render() {
  setHeader();
  $$('.nav-item').forEach(btn => btn.classList.toggle('active', btn.dataset.page === app.page));
  const root = $('#mainContent');
  try {
    if (app.page === 'home') root.innerHTML = renderHome();
    else if (app.page === 'teams') root.innerHTML = renderTeams();
    else if (app.page === 'groups') root.innerHTML = renderGroups();
    else if (app.page === 'schedule') root.innerHTML = renderSchedule();
    else if (app.page === 'points') root.innerHTML = renderPoints();
    else if (app.page === 'leaders') root.innerHTML = renderBatters();
    else if (app.page === 'batters') root.innerHTML = renderBatters();
    else if (app.page === 'bowlers') root.innerHTML = renderBowlers();
    else if (app.page === 'history') root.innerHTML = renderHistory();
    else if (app.page === 'score') root.innerHTML = renderScorePage();
    else root.innerHTML = renderHome();
  } catch (error) {
    console.error('App page render failed:', error);
    root.innerHTML = `<section class="card"><h2>App could not load this page</h2><p>Please refresh the app. If it continues, update the GitHub files and reopen.</p><details><summary>Technical details</summary><pre style="white-space:pre-wrap;overflow-wrap:anywhere">${esc(error?.stack || error)}</pre></details><button class="btn" data-action="go-teams">Open Teams</button></section>`;
  }
  saveState();
}
function go(page) { app.page = page; render(); window.scrollTo({top:0, behavior:'smooth'}); }

function renderHome() {
  const total = app.state.matches.filter(m => !m.isBye).length;
  const done = app.state.matches.filter(m => !m.isBye && (m.status === 'completed' || m.status === 'abandoned')).length;
  const live = app.state.matches.filter(m => m.status === 'live' || m.status === 'awaiting-super').length;
  const league = app.state.matches.filter(m => m.stage === 'League');
  const next = app.state.matches.find(m => m.status === 'live' || m.status === 'awaiting-super') || app.state.matches.find(m => m.status === 'scheduled');
  const leaders = aggregatePlayers();
  const topRun = leaders.batters[0];
  const topWicket = leaders.bowlers[0];
  return `
    <section class="hero-card card">
      <div class="kicker">YOUR CRICKET SEASON STARTS HERE</div>
      <h2>Double Wicket<br>Tournament</h2>
      <p>2-player teams · 3-over matches · Round robin · Knockouts · Live scoring</p>
      <div class="hero-actions">
        ${!app.state.scheduleGenerated ? `<button class="btn" data-action="go-teams">Set Up Tournament</button>` : `<button class="btn" data-action="go-schedule">Open Schedule</button>`}
        <button class="btn secondary" data-action="rules">Tournament Rules</button>
      </div>
    </section>
    <div class="stat-grid">
      <div class="stat-tile"><div class="label">TEAMS</div><strong>${app.state.teams.length}<em> / 32</em></strong></div>
      <div class="stat-tile"><div class="label">MATCHES</div><strong>${done}<em> / ${total}</em></strong></div>
      <div class="stat-tile"><div class="label">LIVE / PENDING</div><strong>${live}<em> live</em></strong></div>
      <div class="stat-tile"><div class="label">LEAGUE FIXTURES</div><strong>${league.length}</strong></div>
    </div>
    ${next ? `<section class="card"><div class="card-title"><h3>${next.status === 'live' || next.status === 'awaiting-super' ? 'Continue live match' : 'Next match'}</h3><span class="pill ${next.status === 'live' ? '' : 'grey'}">${statusLabel(next.status)}</span></div>${matchRow(next)}<div style="margin-top:12px"><button class="btn" data-action="open-match" data-id="${next.id}">${next.status === 'scheduled' ? 'Start Match' : 'Open Scorer'}</button></div></section>` : app.state.scheduleGenerated ? `<section class="card"><div class="empty-state"><div class="empty-icon">✓</div><h3>All scheduled matches decided</h3><p>The tournament fixtures are complete. Check the points table and final result.</p><button class="btn small" data-page="points">View Points Table</button></div></section>` : `<section class="card"><div class="empty-state"><div class="empty-icon">＋</div><h3>No tournament yet</h3><p>Create groups, add at least 4 teams to each active group, then generate fixtures.</p><button class="btn small" data-action="go-teams">Add Teams</button></div></section>`}
    <section class="card"><div class="card-title"><h3>Tournament Leaders</h3><button class="text-btn" data-page="batters">View Top 5</button></div>
      <div class="split-two">
        <div class="player-chip"><small>Most Runs</small><b>${topRun ? esc(topRun.playerName) : '—'}</b><small>${topRun ? `${topRun.runs} runs` : 'No scores yet'}</small></div>
        <div class="player-chip"><small>Most Wickets</small><b>${topWicket ? esc(topWicket.playerName) : '—'}</b><small>${topWicket ? `${topWicket.wickets} wickets` : 'No wickets yet'}</small></div>
      </div>
    </section>
    <div class="footer-note">All tournament data is saved locally on this device.</div>`;
}
function statusLabel(status) { return ({scheduled:'SCHEDULED',live:'LIVE', 'awaiting-super':'TIE · DECISION',completed:'COMPLETED',abandoned:'RAIN / CANCELLED'})[status] || String(status).toUpperCase(); }
function matchRow(match) {
  const a = match.innings?.[0]; const b = match.innings?.[1];
  const scoreA = a ? `${a.runs}/${a.wickets} (${oversText(a)})` : '—';
  const scoreB = b ? `${b.runs}/${b.wickets} (${oversText(b)})` : '—';
  return `<div class="match-row"><div class="team-badge">${match.stage === 'League' ? 'L' : match.stage.startsWith('Semi')?'SF':match.stage==='Quarter Final'?'QF':match.stage==='Round of 16'?'R16':match.stage==='Round of 32'?'R32':match.stage==='Preliminary'?'PRE':'F'}</div><div class="match-center"><div class="match-teams"><span>${esc(teamName(match.teamAId))} <small>${scoreA}</small></span><b>VS</b><span>${esc(teamName(match.teamBId))} <small>${scoreB}</small></span></div><div class="match-meta">${esc(match.label)} · ${match.groupId?esc(groupName(match.groupId))+' · ':''}${esc(match.stage)} · ${statusLabel(match.status)}</div></div><div class="match-actions"><button class="text-btn" data-action="open-match" data-id="${match.id}">${match.status === 'scheduled' ? 'Start' : match.status === 'completed' || match.status === 'abandoned' ? 'View' : 'Open'}</button></div></div>`;
}
function renderGroups() {
  const locked=app.state.scheduleGenerated;
  return `<div class="page-head"><div><div class="kicker">TOURNAMENT STRUCTURE</div><h2>Groups Management</h2><p>Unlimited groups · Maximum 32 teams in one tournament · Top 4 qualify from each group.</p></div><span class="pill">${app.state.groups.length} groups</span></div>
    ${!locked?`<section class="card"><div class="card-title"><h3>Create a group</h3><span class="sub">No group limit</span></div><form id="groupForm"><div class="field"><label>Group name</label><input name="name" maxlength="32" required placeholder="e.g. Group A"></div><button class="btn" type="submit" style="width:100%;margin-top:12px">＋ Add Group</button></form></section>`:`<div class="notice info">Schedule generate ho chuka hai. Groups ko change karne se pehle tournament reset karna hoga.</div>`}
    <section class="card"><div class="card-title"><h3>Your groups</h3><span class="sub">${app.state.teams.length}/32 teams</span></div>${app.state.groups.map((g,i)=>{const n=teamsInGroup(g.id).length;return `<div class="team-row"><div class="team-badge">${i+1}</div><div class="team-info"><strong>${esc(g.name)}</strong><small>${n} team(s) · ${n>=4?'Ready for Top 4 qualification':`${4-n} more team(s) needed`}</small></div>${!locked?`<div class="row-actions"><button class="text-btn" data-action="rename-group" data-id="${g.id}">Rename</button><button class="text-btn danger-text" data-action="delete-group" data-id="${g.id}">Delete</button></div>`:''}</div>`}).join('')}</section>
    <div class="notice">Har group mein kam az kam 4 teams honi chahiye. Empty groups bana sakte hain; schedule banate waqt har active group ko 4 teams chahiye. Total teams 32 se zyada nahi ho sakti.</div>`;
}
function renderTeams() {
  const locked = app.state.scheduleGenerated;
  const teams = app.state.teams;
  return `<div class="page-head"><div><div class="kicker">TOURNAMENT SETUP</div><h2>Teams & Players</h2><p>Har team mein 1 Captain + 1 Partner.</p></div><span class="pill">${teams.length} / 32</span></div>
    ${!locked ? `<section class="card"><div class="card-title"><h3>Add a team</h3><span class="sub">Maximum 32 total teams</span></div><form id="teamForm"><div class="form-grid"><div class="field"><label for="teamGroup">Group</label><select id="teamGroup" name="groupId">${app.state.groups.map(g=>`<option value="${g.id}">${esc(g.name)}</option>`).join('')}</select></div><div class="field full"><label for="teamName">Team name</label><input id="teamName" name="name" maxlength="30" placeholder="e.g. Thunder XI" required></div><div class="field"><label for="captainName">Captain</label><input id="captainName" name="captain" maxlength="28" placeholder="Captain name" required></div><div class="field"><label for="partnerName">Partner</label><input id="partnerName" name="partner" maxlength="28" placeholder="Partner name" required></div></div><button class="btn" type="submit" style="width:100%;margin-top:12px" ${teams.length>=32?'disabled':''}>＋ Add Team</button></form><p class="help" style="margin:10px 0 0">Each active group needs at least 4 teams before fixtures can be generated.</p></section>` : `<div class="notice info">Schedule generate ho chuka hai. Team edit/delete karne ke liye pehle tournament reset karein; completed matches ko silently change nahi kiya jayega.</div>`}
    <section class="card"><div class="card-title"><h3>Registered Teams</h3><span class="sub">${teams.length} teams</span></div>
      ${teams.length ? teams.map((t,i)=>`<div class="team-row"><div class="team-badge">${String(i+1).padStart(2,'0')}</div><div class="team-info"><strong>${esc(t.name)}</strong><small>${esc(t.captain)} (C) · ${esc(t.partner)} (P) · ${esc(groupName(t.groupId))}</small></div>${!locked?`<div class="row-actions"><button class="text-btn" data-action="edit-team" data-id="${t.id}">Edit</button><button class="text-btn danger-text" data-action="delete-team" data-id="${t.id}">Delete</button></div>`:''}</div>`).join('') : `<div class="empty-state"><div class="empty-icon">♟</div><h3>No teams added</h3><p>Start by adding team name, captain and partner.</p></div>`}
    </section>
    ${!locked && teams.length>=4 ? `<section class="card"><div class="card-title"><h3>Generate fixtures</h3><span class="pill">Round Robin</span></div><p class="help">Each group plays its own round robin. Top 4 from every group qualify for cross-group knockouts. Every group must contain at least 4 teams.</p><button class="btn" data-action="generate-schedule" style="width:100%">Generate Group Fixtures</button></section>` : ''}
    ${locked ? `<section class="card"><div class="card-title"><h3>Reset tournament</h3><span class="pill amber">Careful</span></div><p class="help">Reset se fixtures, scores, points table aur match history clear ho jayegi. Team list rahegi taake aap dobara schedule bana sakein.</p><button class="btn danger" data-action="reset-tournament">Reset Schedule & Results</button></section>` : ''}`;
}
function renderSchedule() {
  if (!app.state.scheduleGenerated) return `<div class="page-head"><div><div class="kicker">FIXTURES</div><h2>Schedule</h2><p>Group-wise round-robin fixtures.</p></div></div><section class="card"><div class="empty-state"><div class="empty-icon">▦</div><h3>Schedule not generated</h3><p>Create groups and add at least 4 teams in every active group.</p><button class="btn" data-page="groups">Manage Groups</button></div></section>`;
  const leagueGroups=app.state.groups.map(g=>({title:`${g.name.toUpperCase()} · GROUP STAGE`,items:app.state.matches.filter(m=>m.stage==='League'&&m.groupId===g.id)})).filter(g=>g.items.length);
  const knockouts=app.state.matches.filter(m=>m.stage!=='League'&&!m.isBye);
  const stages=[...new Set(knockouts.map(m=>m.stage))];
  return `<div class="page-head"><div><div class="kicker">ALL FIXTURES</div><h2>Match Schedule</h2><p>${app.state.matches.filter(m=>!m.isBye).length} matches · ${app.state.groups.length} groups created.</p></div><span class="pill">${app.state.matches.filter(m=>m.status==='completed'&&!m.isBye).length} done</span></div>
    ${leagueGroups.map(g=>`<section class="card"><div class="card-title"><h3>${g.title}</h3><span class="sub">${g.items.length} matches</span></div>${g.items.map(matchRow).join('')}</section>`).join('')}
    ${stages.map(stage=>{const items=knockouts.filter(m=>m.stage===stage);return `<section class="card"><div class="card-title"><h3>${esc(stage.toUpperCase())}</h3><span class="sub">${items.length} matches</span></div>${items.map(matchRow).join('')}</section>`}).join('')}
    <div class="notice info">Har group se top 4 qualify karte hain. Knockout matches cross-group seeding ke saath automatically generate hote hain.</div>`;
}
function getLeagueTable(groupId=null) {
  const eligibleTeams = groupId ? teamsInGroup(groupId) : app.state.teams;
  const league = app.state.matches.filter(m=>m.stage==='League' && (!groupId || m.groupId===groupId) && (m.status==='completed'||m.status==='abandoned'));
  const stats = eligibleTeams.map(t=>({teamId:t.id,team:t.name,matches:0,won:0,lost:0,tie:0,points:0,runsFor:0,ballsFor:0,runsAgainst:0,ballsAgainst:0,boundaries:0,headToHead:{}}));
  const byId = Object.fromEntries(stats.map(s=>[s.teamId,s]));
  for (const m of league) {
    const a=byId[m.teamAId], b=byId[m.teamBId]; if(!a||!b) continue;
    a.matches++; b.matches++;
    if (m.status==='abandoned' || m.result?.type==='tie') { a.tie++;b.tie++;a.points++;b.points++;continue; }
    if (m.result?.winnerId===a.teamId) {a.won++;b.lost++;a.points+=2;a.headToHead[b.teamId]=(a.headToHead[b.teamId]||0)+2;}
    else if (m.result?.winnerId===b.teamId) {b.won++;a.lost++;b.points+=2;b.headToHead[a.teamId]=(b.headToHead[a.teamId]||0)+2;}
    if (m.innings?.length===2) {
      const ia=m.innings.find(x=>x.battingTeamId===a.teamId), ib=m.innings.find(x=>x.battingTeamId===b.teamId);
      if(ia&&ib){a.runsFor+=ia.runs;a.ballsFor+=ia.legalBalls;a.runsAgainst+=ib.runs;a.ballsAgainst+=ib.legalBalls;b.runsFor+=ib.runs;b.ballsFor+=ib.legalBalls;b.runsAgainst+=ia.runs;b.ballsAgainst+=ia.legalBalls;}
      a.boundaries+=sumBoundaries(ia);b.boundaries+=sumBoundaries(ib);
    }
  }
  for (const s of stats) {
    const runRate = s.ballsFor ? s.runsFor/(s.ballsFor/6) : 0;
    const againstRate = s.ballsAgainst ? s.runsAgainst/(s.ballsAgainst/6) : 0;
    s.nrr=runRate-againstRate;
  }
  stats.sort((x,y)=>y.points-x.points || y.nrr-x.nrr);
  // Apply head-to-head and boundary count only within equal points + equal NRR groups.
  for(let start=0;start<stats.length;){
    let end=start+1;
    while(end<stats.length && stats[end].points===stats[start].points && Math.abs(stats[end].nrr-stats[start].nrr)<=1e-9)end++;
    if(end-start>1){
      const group=stats.slice(start,end);
      group.sort((x,y)=>headToHeadPoints(y,group)-headToHeadPoints(x,group) || y.boundaries-x.boundaries || x.team.localeCompare(y.team));
      stats.splice(start,group.length,...group);
    }
    start=end;
  }
  return stats;
}
function headToHeadPoints(team, tiedGroup) { const ids=new Set(tiedGroup.map(s=>s.teamId)); return Object.entries(team.headToHead).reduce((sum,[id,pts])=>sum+(ids.has(id)?pts:0),0); }
function sumBoundaries(inn) { if(!inn)return 0; return Object.values(inn.batterStats||{}).reduce((s,b)=>s+(b.fours||0)+(b.sixes||0),0); }
function renderPoints() {
  if(!app.state.scheduleGenerated) return `<div class="page-head"><div><div class="kicker">GROUP STANDINGS</div><h2>Points Table</h2></div></div><section class="card"><div class="empty-state"><div class="empty-icon">▤</div><h3>No points table yet</h3><p>Create groups, add at least 4 teams to each group, then generate fixtures.</p><button class="btn" data-page="groups">Manage Groups</button></div></section>`;
  const groupBlocks=app.state.groups.map(g=>{
    const table=getLeagueTable(g.id), league=app.state.matches.filter(m=>m.stage==='League'&&m.groupId===g.id), done=league.filter(m=>m.status==='completed'||m.status==='abandoned').length;
    if(!table.length)return '';
    return `<section class="card"><div class="card-title"><h3>${esc(g.name)}</h3><span class="pill">${teamsInGroup(g.id).length===3?'Top 2 qualify':'Top 4 qualify'}</span></div><p class="help">${done} / ${league.length} matches decided.</p><div class="table-wrap"><table><thead><tr><th>#</th><th>TEAM</th><th>MAT</th><th>W</th><th>L</th><th>T</th><th>PTS</th><th>NRR</th></tr></thead><tbody>${table.map((x,i)=>`<tr class="${i<4?'highlight':''}"><td class="rank">${i+1}</td><td class="team-cell">${esc(x.team)}</td><td>${x.matches}</td><td>${x.won}</td><td>${x.lost}</td><td>${x.tie}</td><td><b>${x.points}</b></td><td class="${x.nrr>=0?'nrr-positive':'nrr-negative'}">${formatNrr(x.nrr)}</td></tr>`).join('')}</tbody></table></div>${done===league.length&&league.length?`<div class="qualification-list"><b>Qualified teams</b>${table.slice(0,teamsInGroup(g.id).length===3?2:4).map((x,i)=>`<div class="team-row"><div class="team-badge">${i+1}</div><div class="team-info"><strong>${esc(x.team)}</strong><small>${x.points} points · NRR ${formatNrr(x.nrr)}</small></div><span class="pill success">QUALIFIED</span></div>`).join('')}</div>`:''}</section>`;
  }).join('');
  const totalLeague=app.state.matches.filter(m=>m.stage==='League').length, done=app.state.matches.filter(m=>m.stage==='League'&&(m.status==='completed'||m.status==='abandoned')).length;
  return `<div class="page-head"><div><div class="kicker">GROUP STANDINGS</div><h2>Points Tables</h2><p>${done} of ${totalLeague} group matches decided.</p></div><button class="btn small secondary" data-action="share-points">Share ↗</button></div>${groupBlocks||'<section class="card"><p>No group standings available.</p></section>'}<div class="notice">Har group se top 4 teams qualify. Tie-break: Points → NRR → Head-to-head → total 4s + 6s.</div>`;
}
function aggregatePlayers(groupId=null) {
  const batters={}, bowlers={};
  for(const m of app.state.matches){
    if(m.status!=='completed'||!Array.isArray(m.innings)||(groupId&&m.groupId!==groupId))continue;
    for(const inn of m.innings){
      for(const [pid,s] of Object.entries(inn.batterStats||{})){
        const t=teamById(inn.battingTeamId);if(!t)continue;
        batters[pid] ||= {playerId:pid,playerName:playerName(inn.battingTeamId,pid),team:t.name,teamId:t.id,runs:0,balls:0,fours:0,sixes:0};
        batters[pid].runs+=s.runs||0;batters[pid].balls+=s.balls||0;batters[pid].fours+=s.fours||0;batters[pid].sixes+=s.sixes||0;
      }
      for(const [pid,s] of Object.entries(inn.bowlerStats||{})){
        const t=teamById(inn.bowlingTeamId);if(!t)continue;
        bowlers[pid] ||= {playerId:pid,playerName:playerName(inn.bowlingTeamId,pid),team:t.name,teamId:t.id,runs:0,wickets:0,legalBalls:0};
        bowlers[pid].runs+=s.runs||0;bowlers[pid].wickets+=s.wickets||0;bowlers[pid].legalBalls+=s.legalBalls||0;
      }
    }
  }
  const bat=Object.values(batters).sort((a,b)=>b.runs-a.runs||b.fours-a.fours||b.sixes-a.sixes||a.playerName.localeCompare(b.playerName));
  const bowl=Object.values(bowlers).map(s=>({...s,economy:s.legalBalls?s.runs/(s.legalBalls/6):0})).sort((a,b)=>b.wickets-a.wickets||a.economy-b.economy||a.playerName.localeCompare(b.playerName));
  return {batters:bat.slice(0,5),bowlers:bowl.slice(0,5)};
}
function leaderGroupSelector(){return `<div class="field leader-filter"><label>Leaderboard</label><select id="leaderGroupSelect"><option value="">All tournament matches</option>${app.state.groups.map(g=>`<option value="${g.id}" ${app.selectedGroupId===g.id?'selected':''}>${esc(g.name)}</option>`).join('')}</select></div>`;}
function renderBatters() {
  const stats=aggregatePlayers(app.selectedGroupId||null);
  return `<div class="page-head"><div><div class="kicker">TOURNAMENT RECORDS</div><h2>Top Batsmen</h2><p>Top 5 players by total tournament runs.</p></div><span class="pill">MOST RUNS</span></div>
    <section class="card">${leaderGroupSelector()}<div class="card-title"><h3>Batting leaderboard</h3><button class="text-btn" data-page="bowlers">Top Bowlers →</button></div>${stats.batters.length?stats.batters.map((p,i)=>`<div class="leader-row"><div class="leader-rank">${i+1}</div><div class="leader-main"><b>${esc(p.playerName)}</b><small>${esc(p.team)} · ${p.balls} balls · ${p.fours} fours · ${p.sixes} sixes</small></div><div class="leader-value">${p.runs}<small>runs</small></div></div>`).join(''):`<div class="empty-state"><p>Batting scores will appear after completed matches.</p></div>`}</section>
    <div class="notice info">Group select karne par sirf us group ke league matches ke stats dikhte hain. Super Over stats excluded hain.</div>`;
}
function renderBowlers() {
  const stats=aggregatePlayers(app.selectedGroupId||null);
  return `<div class="page-head"><div><div class="kicker">TOURNAMENT RECORDS</div><h2>Top Bowlers</h2><p>Top 5 players by total tournament wickets.</p></div><span class="pill">MOST WICKETS</span></div>
    <section class="card">${leaderGroupSelector()}<div class="card-title"><h3>Bowling leaderboard</h3><button class="text-btn" data-page="batters">Top Batsmen →</button></div>${stats.bowlers.length?stats.bowlers.map((p,i)=>`<div class="leader-row"><div class="leader-rank">${i+1}</div><div class="leader-main"><b>${esc(p.playerName)}</b><small>${esc(p.team)} · ${oversFromBalls(p.legalBalls)} overs · ${p.runs} runs · Econ ${p.economy.toFixed(2)}</small></div><div class="leader-value">${p.wickets}<small>wickets</small></div></div>`).join(''):`<div class="empty-state"><p>Bowling figures will appear after completed matches.</p></div>`}</section>
    <div class="notice info">Group select karne par sirf us group ke league matches ke stats dikhte hain. Super Over stats excluded hain.</div>`;
}
function renderHistory() {
  const completed=app.state.matches.filter(m=>!m.isBye&&(m.status==='completed'||m.status==='abandoned')).slice().reverse();
  return `<div class="page-head"><div><div class="kicker">RESULTS ARCHIVE</div><h2>Match History</h2><p>${completed.length} decided match(es).</p></div></div>
    <section class="card">${completed.length?completed.map(m=>`<div class="match-row"><div class="team-badge">✓</div><div class="match-center"><div class="match-teams"><span>${esc(teamName(m.teamAId))} <small>${scoreForTeam(m,m.teamAId)}</small></span><b>VS</b><span>${esc(teamName(m.teamBId))} <small>${scoreForTeam(m,m.teamBId)}</small></span></div><div class="match-meta">${esc(m.label)} · ${m.groupId?esc(groupName(m.groupId))+' · ':''}${esc(m.stage)} · ${esc(resultText(m))}</div></div><div class="match-actions"><button class="text-btn" data-action="view-result" data-id="${m.id}">Scorecard</button><button class="text-btn" data-action="share-score" data-id="${m.id}">Share</button></div></div>`).join(''):`<div class="empty-state"><div class="empty-icon">◷</div><h3>No completed matches</h3><p>Match results and scorecards will be saved here.</p></div>`}</section>`;
}
function scoreForTeam(match,teamId){const i=match.innings?.find(x=>x.battingTeamId===teamId);return i?`${i.runs}/${i.wickets}`:'—';}
function resultText(m){if(m.status==='abandoned')return 'Rain / Cancelled · 1 point each';if(m.result?.type==='tie')return 'Match Tied · 1 point each';return m.result?.winnerId?`${teamName(m.result.winnerId)} won${m.result.method==='superover'?' (Super Over)':''}`:'Result';}

function createInnings(battingTeamId,bowlingTeamId,strikerId,bowlerPlan,maxOvers){
  const batterStats={}; for(const id of playerIds(battingTeamId))batterStats[id]={runs:0,balls:0,fours:0,sixes:0,dismissals:0};
  const bowlerStats={}; for(const id of playerIds(bowlingTeamId))bowlerStats[id]={runs:0,wickets:0,legalBalls:0};
  const nonStrikerId=playerIds(battingTeamId).find(id=>id!==strikerId);
  return {battingTeamId,bowlingTeamId,strikerId,nonStrikerId,bowlerPlan,maxOvers,runs:0,wickets:0,legalBalls:0,extras:{wide:0,noBall:0},batterStats,bowlerStats,deliveries:[],undoStack:[],freeHit:false,finished:false};
}
function currentInnings(match){
  if(!match)return null;
  if(match.phase==='superover' || (match.phase==='completed' && match.result?.method==='superover')){
    const roundIndex=match.phase==='superover'?match.superOverRoundIndex:(match.superOvers?.length||1)-1;
    const round=match.superOvers?.[roundIndex];
    return round?.innings?.[round.innings.length-1]||null;
  }
  return match.innings?.[match.innings.length-1]||null;
}
function activeMatch(){return app.state.matches.find(m=>m.id===app.selectedMatchId)||null;}
function oversText(inn){return `${Math.floor((inn?.legalBalls||0)/6)}.${(inn?.legalBalls||0)%6}`;}
function oversFromBalls(balls){return `${Math.floor((balls||0)/6)}.${(balls||0)%6}`;}
function currentBowlerId(inn){if(!inn||inn.finished)return null;const overIndex=Math.floor(inn.legalBalls/6);return inn.bowlerPlan[overIndex]||null;}
function runRate(inn){return inn?.legalBalls?inn.runs/(inn.legalBalls/6):0;}
function playerBatStats(inn,pid){return inn?.batterStats?.[pid]||{runs:0,balls:0,fours:0,sixes:0};}
function playerBowlStats(inn,pid){return inn?.bowlerStats?.[pid]||{runs:0,wickets:0,legalBalls:0};}
function economy(stats){return stats.legalBalls?stats.runs/(stats.legalBalls/6):0;}
function formatNrr(n){return `${n>=0?'+':''}${n.toFixed(3)}`;}
function renderScorePage(){
  const match=activeMatch();
  if(!match)return `<div class="page-head"><div><div class="kicker">LIVE SCORING</div><h2>Live Score</h2><p>Select a fixture to open the scorer.</p></div></div><section class="card">${app.state.matches.filter(m=>m.status==='scheduled'||m.status==='live'||m.status==='awaiting-super').map(matchRow).join('')||`<div class="empty-state"><h3>No match selected</h3><p>Generate a schedule and start a match from Schedule.</p><button class="btn" data-action="go-schedule">Open Schedule</button></div>`}</section>`;
  if(match.status==='scheduled')return `<div class="page-head"><div><div class="kicker">MATCH SETUP</div><h2>${esc(match.label)}</h2><p>${esc(teamName(match.teamAId))} vs ${esc(teamName(match.teamBId))}</p></div></div><section class="card"><div class="empty-state"><div class="empty-icon">▶</div><h3>Ready to start</h3><p>Set batting first, opening batter and opening bowler.</p><button class="btn" data-action="start-setup" data-id="${match.id}">Set Up Match</button></div></section>`;
  if(match.status==='completed'||match.status==='abandoned')return renderResultCard(match);
  if(match.status==='awaiting-super')return renderTieDecision(match);
  return renderLiveScorer(match);
}
function renderLiveScorer(match){
  const inn=currentInnings(match); if(!inn)return `<section class="card"><div class="empty-state"><h3>Scoring data unavailable</h3><button class="btn" data-page="schedule">Back to Schedule</button></div></section>`;
  const isSuper=match.phase==='superover';
  const currentBowler=currentBowlerId(inn);
  const striker=playerBatStats(inn,inn.strikerId), non=playerBatStats(inn,inn.nonStrikerId);
  const strikerName=playerName(inn.battingTeamId,inn.strikerId), nonName=playerName(inn.battingTeamId,inn.nonStrikerId);
  const bowlerStats=playerBowlStats(inn,currentBowler);
  const title=isSuper?`SUPER OVER ${match.superOverRoundIndex+1}`:`${inn.battingTeamId===match.teamAId?'1ST':'2ND'} INNINGS`;
  const overNumber=Math.floor(inn.legalBalls/6)+1;
  const ballsInOver=inn.legalBalls%6;
  const latest=inn.deliveries.slice(-12).reverse();
  return `<div class="page-head"><div><div class="kicker">${isSuper?'KNOCKOUT / TIEBREAKER':'LIVE SCORING'}</div><h2>${esc(match.label)}</h2><p>${esc(teamName(match.teamAId))} vs ${esc(teamName(match.teamBId))}</p></div><span class="pill ${isSuper?'amber':''}">${isSuper?'SUPER OVER': 'LIVE'}</span></div>
    <section class="card">
      <div class="score-top"><div><div class="innings-label">${title} · ${esc(teamName(inn.battingTeamId))}</div><div class="score-big">${inn.runs}<small> / ${inn.wickets}</small></div><div class="score-meta"><span>Overs <b>${oversText(inn)} / ${inn.maxOvers}.0</b></span><span>CRR <b>${runRate(inn).toFixed(2)}</b></span><span>Wickets <b>${inn.wickets}</b></span></div></div><div style="text-align:right"><div class="kicker">BOWLING</div><div class="score-team">${esc(teamName(inn.bowlingTeamId))}</div>${inn.freeHit?`<span class="free-hit">FREE HIT</span>`:''}</div></div>
      <div class="score-sides"><div class="player-chip"><small>ON STRIKE</small><b>${esc(strikerName)} · ${striker.runs} (${striker.balls})</b></div><div class="player-chip"><small>NON-STRIKER</small><b>${esc(nonName)} · ${non.runs} (${non.balls})</b></div></div>
      <div class="score-sides"><div class="player-chip"><small>CURRENT BOWLER · ${esc(playerName(inn.bowlingTeamId,currentBowler))}</small><b>${oversFromBalls(bowlerStats.legalBalls)} · ${bowlerStats.runs} runs · ${bowlerStats.wickets} W</b></div><div class="player-chip"><small>EXTRAS</small><b>Wd ${inn.extras.wide} · Nb ${inn.extras.noBall}</b></div></div>
    </section>
    ${inn.finished?`<section class="card"><div class="notice success">${isSuper?'Super Over innings complete.':'Innings complete.'} Final score: <b>${inn.runs}/${inn.wickets}</b> in ${oversText(inn)} overs.</div><div class="score-actions"><button class="btn secondary" data-action="undo" data-id="${match.id}" ${inn.undoStack.length?'':'disabled'}>↶ Undo Last Ball</button><button class="btn" data-action="next-innings" data-id="${match.id}">${isSuper?(match.superOvers[match.superOverRoundIndex].innings.length===1?'Start Super Over chase':'Check Super Over result'):(match.innings.length===1?'Start 2nd Innings':'Finish Match')}</button></div></section>`:`<section class="card"><div class="card-title"><h3>Record next ball</h3><span class="sub">Over ${overNumber} · ${ballsInOver}/6 legal balls</span></div>${inn.freeHit?`<div class="notice">FREE HIT: next legal delivery. W is treated as run-out only; it still applies −5.</div>`:''}<div class="ball-grid">
      ${['0','1','2','3','4','6','W','Wd','Nb'].map(v=>`<button class="ball-btn ${v==='W'?'wicket':v==='4'||v==='6'?'run4':v==='Wd'||v==='Nb'?'extra':''}" data-action="ball" data-value="${v}" data-id="${match.id}">${v==='W'?'W −5':v}</button>`).join('')}
    </div><div class="score-actions"><button class="btn secondary" data-action="undo" data-id="${match.id}" ${inn.undoStack.length?'':'disabled'}>↶ Undo Last Ball</button><button class="btn ghost" data-action="share-score" data-id="${match.id}">Share Score ↗</button></div><p class="small-note">Wicket: −5 team runs, innings continues and strike stays unchanged. The same two players remain at the batting ends. Fielding is only by the two team players. Wide / No Ball: +1 extra and no legal ball. No Ball gives the next legal ball a Free Hit.</p></section>`}
    <section class="card"><div class="card-title"><h3>Batting card</h3><span class="sub">This innings</span></div>${renderBattingTable(inn)}</section>
    <section class="card"><div class="card-title"><h3>Bowling card</h3><span class="sub">This innings</span></div>${renderBowlingTable(inn)}</section>
    <section class="card"><div class="card-title"><h3>Recent balls</h3><span class="sub">Latest 12</span></div><div class="ball-log">${latest.length?latest.map(d=>`<span class="ball-dot ${d.type==='W'?'wicket':['4','6'].includes(d.type)?'boundary':['Wd','Nb'].includes(d.type)?'extra':''}" title="${esc(d.description)}">${d.type==='W'?'W−5':d.type}</span>`).join(''):`<span class="small-note">No balls recorded yet.</span>`}</div></section>
    ${!isSuper&&match.stage==='League'?`<section class="card"><div class="card-title"><h3>Rain / abandoned match</h3><span class="sub">League only</span></div><p class="small-note">Cancel only if the match is officially abandoned. Both teams receive 1 point and the match is excluded from NRR.</p><button class="btn danger small" data-action="abandon-match" data-id="${match.id}">Mark Rain / Cancelled</button></section>`:''}`;
}
function renderBattingTable(inn){
  return `<div class="table-wrap"><table class="scorecard-table"><thead><tr><th>BATTER</th><th>R</th><th>B</th><th>4s</th><th>6s</th></tr></thead><tbody>${playerIds(inn.battingTeamId).map(pid=>{const s=playerBatStats(inn,pid);return `<tr><td>${esc(playerName(inn.battingTeamId,pid))}${pid===inn.strikerId?' *':''}</td><td><b>${s.runs}</b></td><td>${s.balls}</td><td>${s.fours}</td><td>${s.sixes}</td></tr>`;}).join('')}</tbody></table></div>`;
}
function renderBowlingTable(inn){
  return `<div class="table-wrap"><table class="scorecard-table"><thead><tr><th>BOWLER</th><th>OV</th><th>R</th><th>W</th><th>ECON</th></tr></thead><tbody>${playerIds(inn.bowlingTeamId).map(pid=>{const s=playerBowlStats(inn,pid);return `<tr><td>${esc(playerName(inn.bowlingTeamId,pid))}</td><td>${oversFromBalls(s.legalBalls)}</td><td>${s.runs}</td><td>${s.wickets}</td><td>${economy(s).toFixed(2)}</td></tr>`;}).join('')}</tbody></table></div>`;
}
function renderTieDecision(match){
  const a=match.innings?.[0],b=match.innings?.[1];
  return `<div class="page-head"><div><div class="kicker">REGULATION MATCH TIED</div><h2>Super Over?</h2><p>${esc(teamName(match.teamAId))} ${a?.runs??0}/${a?.wickets??0} · ${esc(teamName(match.teamBId))} ${b?.runs??0}/${b?.wickets??0}</p></div><span class="pill amber">TIE</span></div><section class="card"><div class="notice">Kya aap Super Over karna chahte hain? YES par one-over Super Over hoga. NO par dono teams ko 1–1 point milega.</div><div class="split-two"><button class="btn" data-action="tie-super-yes" data-id="${match.id}">YES · Super Over</button><button class="btn secondary" data-action="tie-super-no" data-id="${match.id}">NO · 1 Point Each</button></div>${currentInnings(match)?.undoStack?.length?`<button class="btn ghost small" data-action="undo" data-id="${match.id}" style="margin-top:10px">↶ Undo Last Ball</button>`:''}</section>`;
}
function renderResultCard(match){
  const a=match.innings?.[0],b=match.innings?.[1];
  const mom=match.result?.manOfMatch;
  return `<div class="page-head"><div><div class="kicker">MATCH RESULT</div><h2>${esc(match.label)}</h2><p>${esc(match.stage)} · ${esc(resultText(match))}</p></div><span class="pill ${match.status==='abandoned'?'amber':'success'}">${match.status==='abandoned'?'ABANDONED':'FINAL'}</span></div>
    <section class="card"><div class="result-banner"><strong>${esc(resultText(match))}</strong><small>${a?`${esc(teamName(a.battingTeamId))} ${a.runs}/${a.wickets} (${oversText(a)})`:''}${b?` · ${esc(teamName(b.battingTeamId))} ${b.runs}/${b.wickets} (${oversText(b)})`:''}</small></div>${match.status==='completed'&&mom?`<div class="player-chip"><small>MAN OF THE MATCH</small><b>${esc(mom.name)} · Contribution ${mom.contribution} (Runs ${mom.runs} + Wickets ${mom.wickets})</b></div>`:''}<div class="score-actions">${currentInnings(match)?.undoStack?.length?`<button class="btn secondary" data-action="undo" data-id="${match.id}">↶ Undo Last Ball</button>`:''}<button class="btn" data-action="share-score" data-id="${match.id}">Share Score ↗</button><button class="btn secondary" data-action="go-history">Match History</button></div></section>
    ${match.innings?.map((inn,i)=>`<section class="card"><div class="card-title"><h3>${i===0?'1st':'2nd'} Innings · ${esc(teamName(inn.battingTeamId))}</h3><span class="pill grey">${inn.runs}/${inn.wickets}</span></div>${renderBattingTable(inn)}<div class="empty-spacer"></div>${renderBowlingTable(inn)}</section>`).join('')||''}
    ${match.superOvers?.length?`<section class="card"><div class="card-title"><h3>Super Over history</h3></div>${match.superOvers.map((r,i)=>`<div class="notice info">Round ${i+1}: ${r.innings.map(x=>`${esc(teamName(x.battingTeamId))} ${x.runs}/${x.wickets}`).join(' · ')}</div>`).join('')}</section>`:''}`;
}

function openModal(title, body) {
  $('#modalRoot').innerHTML = `<div class="modal-backdrop" data-action="backdrop-close"><section class="modal" role="dialog" aria-modal="true"><div class="modal-head"><h3>${esc(title)}</h3><button class="close-btn" data-action="close-modal" aria-label="Close">×</button></div>${body}</section></div>`;
}
function closeModal(){ $('#modalRoot').innerHTML=''; }
function showTeamModal(teamId=null){
  const old=teamId?teamById(teamId):null;
  openModal(old?'Edit team':'Add team',`<form id="modalTeamForm" data-id="${old?.id||''}"><div class="form-grid"><div class="field full"><label>Team name</label><input name="name" maxlength="30" required value="${esc(old?.name||'')}" placeholder="Team name"></div><div class="field"><label>Captain</label><input name="captain" maxlength="28" required value="${esc(old?.captain||'')}" placeholder="Captain"></div><div class="field"><label>Partner</label><input name="partner" maxlength="28" required value="${esc(old?.partner||'')}" placeholder="Partner"></div><div class="field full"><label>Group</label><select name="groupId">${app.state.groups.map(g=>`<option value="${g.id}" ${(old?.groupId||app.state.groups[0]?.id)===g.id?'selected':''}>${esc(g.name)}</option>`).join('')}</select></div></div><div class="modal-actions"><button class="btn" type="submit">${old?'Save Changes':'Add Team'}</button><button class="btn secondary" type="button" data-action="close-modal">Cancel</button></div></form>`);
}
function openStartSetup(matchId){
  const m=app.state.matches.find(x=>x.id===matchId);if(!m)return;
  const a=teamById(m.teamAId),b=teamById(m.teamBId);
  const battingDefault=m.teamAId;
  const battingOptions=`<option value="${m.teamAId}">${esc(a.name)}</option><option value="${m.teamBId}">${esc(b.name)}</option>`;
  openModal('Start match',`<form id="startMatchForm" data-id="${m.id}"><div class="field"><label>Batting first</label><select name="batting" id="startBatting">${battingOptions}</select></div><div class="field" style="margin-top:10px"><label>Opening batter (striker)</label><select name="striker" id="startStriker"><option value="${m.teamAId}:c">${esc(a.captain)}</option><option value="${m.teamAId}:p">${esc(a.partner)}</option></select></div><div class="field" style="margin-top:10px"><label>Opening bowler (other team's player)</label><select name="bowler" id="startBowler"><option value="${m.teamBId}:c">${esc(b.captain)}</option><option value="${m.teamBId}:p">${esc(b.partner)}</option></select></div><div class="notice info">3 overs per innings. Bowlers will alternate automatically: A–B–A or B–A–B. Both bowlers get at least 1 over; neither bowls consecutive overs.</div><div class="modal-actions"><button class="btn" type="submit">Start Live Scoring</button><button class="btn secondary" type="button" data-action="close-modal">Cancel</button></div></form>`);
  $('#startBatting').addEventListener('change',()=>updateStartChoices(m));
}
function updateStartChoices(match){
  const batting=$('#startBatting').value;const bowling=batting===match.teamAId?match.teamBId:match.teamAId;
  $('#startStriker').innerHTML=playerIds(batting).map(id=>`<option value="${id}">${esc(playerName(batting,id))}</option>`).join('');
  $('#startBowler').innerHTML=playerIds(bowling).map(id=>`<option value="${id}">${esc(playerName(bowling,id))}</option>`).join('');
}
function openInningsSetup(match, battingId, bowlingId, maxOvers, isSuper=false){
  const defaultStriker=playerIds(battingId)[0],defaultBowler=playerIds(bowlingId)[0];
  openModal(isSuper?'Super Over innings':'Start next innings',`<form id="nextInningsForm" data-id="${match.id}" data-batting="${battingId}" data-bowling="${bowlingId}" data-max="${maxOvers}" data-super="${isSuper?'1':'0'}"><div class="notice info">Batting: <b>${esc(teamName(battingId))}</b> · Bowling: <b>${esc(teamName(bowlingId))}</b> · ${maxOvers} over(s)</div><div class="field"><label>Opening batter (striker)</label><select name="striker">${playerIds(battingId).map(id=>`<option value="${id}">${esc(playerName(battingId,id))}</option>`).join('')}</select></div><div class="field" style="margin-top:10px"><label>${maxOvers===1?'Super Over bowler':'Opening bowler (first over)'}</label><select name="bowler">${playerIds(bowlingId).map(id=>`<option value="${id}">${esc(playerName(bowlingId,id))}</option>`).join('')}</select></div>${maxOvers===1?`<p class="help">Super Over mein dono batting players khelenge; one wicket still means −5 only and the innings continues for the full over.</p>`:`<p class="help">Bowling plan auto alternates A–B–A / B–A–B. Both players bowl and one cannot bowl consecutive overs.</p>`}<div class="modal-actions"><button class="btn" type="submit">Start Innings</button><button class="btn secondary" type="button" data-action="close-modal">Cancel</button></div></form>`);
}
function openRules(){
  openModal('Tournament rules',`<div class="rule-list">
    <div class="rule-line"><b>01</b><span>Each team has exactly 2 players: 1 Captain + 1 Partner. Tournament allows up to 32 teams across unlimited groups.</span></div>
    <div class="rule-line"><b>02</b><span>Each group plays its own round robin. Top 4 from every group qualify for cross-group knockout rounds. Each active group needs at least 4 teams; 32 teams maximum overall.</span></div>
    <div class="rule-line"><b>03</b><span>Each regulation innings is 3 overs. Both teams bat for 3 overs; both players are listed as batters.</span></div>
    <div class="rule-line"><b>04</b><span>Both opposing players bowl. The plan alternates A–B–A or B–A–B, so one bowls 2 overs, the other 1, and no bowler bowls consecutive overs. Fielding is restricted to those same two players; no outside fielder is used.</span></div>
    <div class="rule-line"><b>05</b><span>Every wicket adds 1 wicket and deducts 5 team runs. It never ends the innings. To preserve your no-strike-change rule with only two players, the two batting positions stay in place after a wicket.</span></div>
    <div class="rule-line"><b>06</b><span>Strike changes on 1 or 3 runs; not on 2, 4 or 6. Strike changes automatically at the end of each over. A wicket alone does not change strike.</span></div>
    <div class="rule-line"><b>07</b><span>Wide = +1 and an extra ball. No Ball = +1 and an extra ball; the next legal ball is a Free Hit. Free Hit wicket is treated as run-out only.</span></div>
    <div class="rule-line"><b>08</b><span>Points: win 2, loss 0, tie or rain cancellation 1 each. For a league tie, choose Super Over YES/NO. Knockout ties automatically go to repeated one-over Super Overs.</span></div>
    <div class="rule-line"><b>09</b><span>NRR = (net runs scored ÷ legal overs faced) − (net runs conceded ÷ legal overs bowled). Wicket deductions are included in net runs. Displayed to 3 decimals.</span></div>
    <div class="rule-line"><b>10</b><span>Ranking: points → NRR → head-to-head → total fours + sixes. Each group sends its top 4 to a cross-group seeded knockout bracket. Byes are added automatically when the qualifier count is not a power of two.</span></div>
    <div class="rule-line"><b>11</b><span>Man of the Match uses runs + wickets in regulation innings. Top 5 batters and top 5 bowlers are displayed; Super Over stats are excluded from leaderboards.</span></div>
    <div class="rule-line"><b>12</b><span>Data is saved in this browser on this device. Use Backup/Restore to move data to another phone. WhatsApp share opens your phone's share flow or WhatsApp.</span></div>
  </div><div class="modal-actions"><button class="btn" data-action="close-modal">Got it</button></div>`);
}

function generateRoundRobin(){
  const teams=app.state.teams;
  if(teams.length<4||teams.length>32){toast('Tournament needs 4 to 32 teams.');return;}
  if(app.state.scheduleGenerated){toast('Schedule already exists. Reset it first.');return;}
  const activeGroups=app.state.groups.filter(g=>teamsInGroup(g.id).length>0);
  if(!activeGroups.length){toast('Create a group and add teams first.');return;}
  const invalid=activeGroups.find(g=>teamsInGroup(g.id).length<4);
  if(invalid){toast(`${invalid.name} needs at least 4 teams for Top 4 qualification.`);return;}
  let fixtures=[];
  for(const group of activeGroups){
    const members=teamsInGroup(group.id);let arr=members.map(t=>t.id);if(arr.length%2===1)arr.push(null);
    const n=arr.length;let round=1,groupFixtures=0;
    for(let r=0;r<n-1;r++){
      for(let i=0;i<n/2;i++){
        const x=arr[i],y=arr[n-1-i];if(x&&y){const flip=(r+i)%2===1;groupFixtures++;fixtures.push({id:uid(),stage:'League',groupId:group.id,label:`${group.name} · Match ${groupFixtures}`,round,teamAId:flip?y:x,teamBId:flip?x:y,status:'scheduled',phase:'regulation',innings:[],superOvers:[],superOverRoundIndex:0,result:null});}
      }
      arr=[arr[0],arr[n-1],...arr.slice(1,n-1)];round++;
    }
  }
  app.state.matches=fixtures;app.state.scheduleGenerated=true;app.state.createdAt=new Date().toISOString();
  saveState();toast(`${fixtures.length} group fixtures generated.`);go('schedule');
}
function createKnockoutsIfReady(){
  const activeGroups=app.state.groups.filter(g=>teamsInGroup(g.id).length>0);
  const league=app.state.matches.filter(m=>m.stage==='League');
  if(!league.length||!league.every(m=>m.status==='completed'||m.status==='abandoned'))return;
  if(app.state.matches.some(m=>m.stage!=='League'))return;
  const qualifiers=[];
  for(const g of activeGroups){
    const table=getLeagueTable(g.id);
    table.slice(0,4).forEach((row,rank)=>qualifiers.push({...row,groupId:g.id,groupRank:rank+1}));
  }
  if(qualifiers.length<4)return;
  qualifiers.sort((a,b)=>a.groupRank-b.groupRank||b.points-a.points||b.nrr-a.nrr||activeGroups.findIndex(g=>g.id===a.groupId)-activeGroups.findIndex(g=>g.id===b.groupId));
  const n=qualifiers.length, bracketSize=2**Math.ceil(Math.log2(n)), byes=bracketSize-n, matchesNeeded=n-bracketSize/2;
  const initialStage=bracketSize===4?'Semi Final':bracketSize===8?'Quarter Final':bracketSize===16?'Round of 16':'Round of 32';
  const prelimPool=qualifiers.slice(byes);
  const prelimPairs=[];
  while(prelimPool.length){
    const first=prelimPool.shift();
    let partnerIndex=prelimPool.findIndex(t=>t.groupId!==first.groupId);
    if(partnerIndex<0)partnerIndex=0;
    const second=prelimPool.splice(partnerIndex,1)[0];
    if(second)prelimPairs.push([first,second]);
  }
  const firstRound=[];
  prelimPairs.forEach(([a,b],i)=>firstRound.push(newMatch(initialStage,a.teamId,b.teamId,`${initialStage} · ${i+1}`)));
  if(byes){
    for(let i=0;i<byes;i++){
      const t=qualifiers[i];
      const bye=newMatch(initialStage,t.teamId,null,`${initialStage} · Bye · ${t.team}`);
      bye.status='completed';bye.phase='completed';bye.isBye=true;bye.result={type:'bye',winnerId:t.teamId};firstRound.push(bye);
    }
  }
  firstRound.forEach(m=>{m.knockoutRound=1;app.state.matches.push(m);});
  advanceKnockoutRound(1);
}
function knockoutStage(teamCount){return teamCount===2?'Final':teamCount===4?'Semi Final':teamCount===8?'Quarter Final':teamCount===16?'Round of 16':'Round of 32';}
function advanceKnockoutRound(round){
  const current=app.state.matches.filter(m=>m.knockoutRound===round);
  if(!current.length||!current.every(m=>m.status==='completed'))return;
  if(app.state.matches.some(m=>m.knockoutRound===round+1))return;
  const winners=current.map(m=>m.result?.winnerId).filter(Boolean);
  if(winners.length===1){app.state.championId=winners[0];return;}
  if(winners.length<2)return;
  const stage=knockoutStage(winners.length),next=[];
  for(let i=0;i<winners.length;i+=2){if(winners[i+1]){const m=newMatch(stage,winners[i],winners[i+1],`${stage} · ${i/2+1}`);m.knockoutRound=round+1;next.push(m);}}
  app.state.matches.push(...next);
}
function newMatch(stage,a,b,label){return {id:uid(),stage,label,teamAId:a,teamBId:b,status:'scheduled',phase:'regulation',innings:[],superOvers:[],superOverRoundIndex:0,result:null};}
function createFinalIfReady(){
  if(app.state.matches.some(m=>m.stage==='Final'))return;
  const s1=app.state.matches.find(m=>m.stage==='Semi Final 1'),s2=app.state.matches.find(m=>m.stage==='Semi Final 2');
  if(!s1||!s2||s1.status!=='completed'||s2.status!=='completed'||!s1.result?.winnerId||!s2.result?.winnerId)return;
  app.state.matches.push(newMatch('Final',s1.result.winnerId,s2.result.winnerId,'Final · Semi Final Winners'));
}
function teamFormSubmit(form){
  const data=new FormData(form);const name=String(data.get('name')||'').trim(),captain=String(data.get('captain')||'').trim(),partner=String(data.get('partner')||'').trim(),groupId=String(data.get('groupId')||app.state.groups[0]?.id||'');
  if(!name||!captain||!partner){toast('All 3 fields are required.');return;}
  if(captain.toLowerCase()===partner.toLowerCase()){toast('Captain aur partner ke naam alag hon.');return;}
  const id=form.dataset.id;
  if(id){const t=teamById(id);if(t)Object.assign(t,{name,captain,partner,groupId});toast('Team updated.');}
  else{if(app.state.scheduleGenerated){toast('Reset schedule first.');return;}if(app.state.teams.length>=32){toast('Maximum 32 teams allowed.');return;}app.state.teams.push({id:uid(),name,captain,partner,groupId});toast('Team added.');}
  closeModal();render();
}
function startMatch(matchId, battingId, strikerId, openingBowlerId){
  const m=app.state.matches.find(x=>x.id===matchId);if(!m)return;
  const bowlingId=battingId===m.teamAId?m.teamBId:m.teamAId;
  const other=playerIds(bowlingId).find(x=>x!==openingBowlerId);
  const plan=[openingBowlerId,other,openingBowlerId];
  m.innings=[createInnings(battingId,bowlingId,strikerId,plan,3)];m.phase='regulation';m.status='live';m.startedAt=new Date().toISOString();
  app.selectedMatchId=m.id;closeModal();go('score');
}
function startNextInnings(match){
  const isSuper=match.phase==='superover';
  if(isSuper){
    const round=match.superOvers[match.superOverRoundIndex];
    if(round.innings.length!==1||!round.innings[0].finished)return;
    const batting=round.innings[0].bowlingTeamId,bowling=round.innings[0].battingTeamId;
    openInningsSetup(match,batting,bowling,1,true);
  }else{
    if(match.innings.length!==1||!match.innings[0].finished)return;
    const batting=match.innings[0].bowlingTeamId,bowling=match.innings[0].battingTeamId;
    openInningsSetup(match,batting,bowling,3,false);
  }
}
function submitNextInnings(form){
  const match=app.state.matches.find(x=>x.id===form.dataset.id);if(!match)return;
  const battingId=form.dataset.batting,bowlingId=form.dataset.bowling,max=Number(form.dataset.max),isSuper=form.dataset.super==='1';
  const data=new FormData(form),striker=data.get('striker'),openingBowler=data.get('bowler');
  let plan;
  if(max===1)plan=[openingBowler];
  else{const other=playerIds(bowlingId).find(x=>x!==openingBowler);plan=[openingBowler,other,openingBowler];}
  const innings=createInnings(battingId,bowlingId,striker,plan,max);
  if(isSuper){match.superOvers[match.superOverRoundIndex].innings.push(innings);}else{match.innings.push(innings);}
  closeModal();render();
}

function scoreDelivery(match, type){
  const inn=currentInnings(match);if(!inn||inn.finished)return;
  if(!['0','1','2','3','4','6','W','Wd','Nb'].includes(type))return;
  const hadFreeHit=inn.freeHit;
  const overIndex=Math.floor(inn.legalBalls/6);const bowlerId=inn.bowlerPlan[overIndex];
  if(!bowlerId){toast('Bowler assignment missing.');return;}
  const snapshot=clone({...inn,undoStack:undefined});
  delete snapshot.undoStack;
  inn.undoStack.push(snapshot);
  const batterId=inn.strikerId;
  const batter=inn.batterStats[batterId];const bowler=inn.bowlerStats[bowlerId];
  let legal=false,description=type;
  if(type==='W'){
    inn.runs-=5;inn.wickets+=1;inn.wickets=Math.max(0,inn.wickets);
    batter.balls+=1;batter.dismissals+=1;
    if(!hadFreeHit)bowler.wickets+=1;
    bowler.legalBalls+=1;inn.legalBalls+=1;legal=true;inn.freeHit=false;
    description=hadFreeHit?'W (run-out on Free Hit) · −5':'Wicket · −5 team runs';
  }else if(type==='Wd'){
    inn.runs+=1;inn.extras.wide+=1;bowler.runs+=1;inn.freeHit=hadFreeHit;
    description='Wide · +1 · extra ball';
  }else if(type==='Nb'){
    inn.runs+=1;inn.extras.noBall+=1;bowler.runs+=1;batter.balls+=1;inn.freeHit=true;
    description='No Ball · +1 · extra ball · Free Hit next legal ball';
  }else{
    const runs=Number(type);inn.runs+=runs;batter.runs+=runs;batter.balls+=1;bowler.runs+=runs;bowler.legalBalls+=1;inn.legalBalls+=1;legal=true;inn.freeHit=false;
    if(runs===4)batter.fours+=1;if(runs===6)batter.sixes+=1;
    if(runs===1||runs===3)swapStrike(inn);
    description=`${runs} run${runs===1?'':'s'}`;
  }
  inn.deliveries.push({type,over:overIndex+1,ball:(inn.legalBalls%6)||6,description,freeHit:hadFreeHit});
  if(legal&&inn.legalBalls%6===0){swapStrike(inn);}
  if(inn.legalBalls>=inn.maxOvers*6){inn.finished=true;}
  saveState();
  if(inn.finished){if(match.phase==='regulation'&&match.innings.length===2)completeRegulation(match);else if(match.phase==='superover'&&match.superOvers[match.superOverRoundIndex].innings.length===2)completeSuperOverRound(match);}
  render();
}
function swapStrike(inn){const old=inn.strikerId;inn.strikerId=inn.nonStrikerId;inn.nonStrikerId=old;}
function undoLast(match){
  const inn=currentInnings(match);if(!inn?.undoStack?.length){toast('No ball available to undo.');return;}
  // Do not change already-started downstream knockout matches when undoing a league/semi result.
  if(match.stage==='League'){
    const downstream=app.state.matches.filter(m=>m.stage!=='League');
    if(downstream.some(m=>m.status!=='scheduled')){toast('A knockout match has already started. This result cannot be undone now.');return;}
    app.state.matches=app.state.matches.filter(m=>m.stage==='League');
  }else if(match.stage==='Semi Final 1'||match.stage==='Semi Final 2'){
    const final=app.state.matches.find(m=>m.stage==='Final');
    if(final&&final.status!=='scheduled'){toast('The final has already started. This result cannot be undone now.');return;}
    app.state.matches=app.state.matches.filter(m=>m.stage!=='Final');
  }
  const stack=inn.undoStack.slice();const snapshot=stack.pop();for(const key of Object.keys(inn))delete inn[key];Object.assign(inn,clone(snapshot));inn.undoStack=stack;
  match.status='live';match.result=null;match.completedAt=null;match.phase=(inn.maxOvers===1?'superover':'regulation');
  if(inn.maxOvers===1){const round=match.superOvers?.findIndex(r=>r.innings.includes(inn));match.superOverRoundIndex=Math.max(0,round);}
  toast('Last ball undone.');render();
}
function completeRegulation(match){
  const [a,b]=match.innings;if(!a||!b)return;
  if(a.runs===b.runs){
    if(match.stage==='League'){match.status='awaiting-super';match.result=null;}
    else{beginSuperOver(match,a.battingTeamId);}
  }else{const winner=a.runs>b.runs?a.battingTeamId:b.battingTeamId;finalizeMatch(match,winner,'regulation');}
}
function beginSuperOver(match,firstBattingTeamId){
  match.phase='superover';match.status='live';match.superOvers ||= [];
  const roundIndex=match.superOvers.length;
  if(roundIndex>0){firstBattingTeamId=match.superOvers[roundIndex-1].innings[1].battingTeamId;}
  match.superOvers.push({round:roundIndex+1,innings:[]});match.superOverRoundIndex=roundIndex;
  const batting=firstBattingTeamId,bowling=batting===match.teamAId?match.teamBId:match.teamAId;
  const innings=createInnings(batting,bowling,playerIds(batting)[0],[playerIds(bowling)[0]],1);
  match.superOvers[roundIndex].innings.push(innings);
  app.selectedMatchId=match.id;
}
function completeSuperOverRound(match){
  const round=match.superOvers[match.superOverRoundIndex];const [a,b]=round.innings;if(!a||!b)return;
  if(a.runs===b.runs){beginSuperOver(match,a.battingTeamId);toast('Super Over tied. Another Super Over starts.');}
  else{const winner=a.runs>b.runs?a.battingTeamId:b.battingTeamId;finalizeMatch(match,winner,'superover');}
}
function calculateManOfMatch(match){
  const totals={};
  for(const inn of match.innings||[]){
    for(const pid of playerIds(inn.battingTeamId)){const s=inn.batterStats[pid]||{};totals[pid] ||= {runs:0,wickets:0,teamId:inn.battingTeamId};totals[pid].runs+=s.runs||0;}
    for(const pid of playerIds(inn.bowlingTeamId)){const s=inn.bowlerStats[pid]||{};totals[pid] ||= {runs:0,wickets:0,teamId:inn.bowlingTeamId};totals[pid].wickets+=s.wickets||0;}
  }
  const ranked=Object.entries(totals).map(([pid,s])=>({pid,...s,contribution:s.runs+s.wickets})).sort((a,b)=>b.contribution-a.contribution||b.runs-a.runs||b.wickets-a.wickets||a.pid.localeCompare(b.pid));
  const p=ranked[0];return p?{playerId:p.pid,name:playerName(p.teamId,p.pid),runs:p.runs,wickets:p.wickets,contribution:p.contribution}:null;
}
function finalizeMatch(match,winnerId,method){
  match.status='completed';match.phase='completed';match.completedAt=new Date().toISOString();
  match.result={type:'win',winnerId,method,manOfMatch:calculateManOfMatch(match)};
  if(match.stage==='League')createKnockoutsIfReady();
  if(match.knockoutRound)advanceKnockoutRound(match.knockoutRound);
  else if(match.stage==='Semi Final 1'||match.stage==='Semi Final 2')createFinalIfReady();
  saveState();
}
function finalizeTie(match){match.status='completed';match.phase='completed';match.completedAt=new Date().toISOString();match.result={type:'tie',manOfMatch:calculateManOfMatch(match)};createKnockoutsIfReady();if(match.knockoutRound)advanceKnockoutRound(match.knockoutRound);saveState();}
function abandonMatch(match){match.status='abandoned';match.phase='completed';match.completedAt=new Date().toISOString();match.result={type:'abandoned'};createKnockoutsIfReady();if(match.knockoutRound)advanceKnockoutRound(match.knockoutRound);saveState();}

function sharePointsTable(){
  const lines=[`${app.state.tournamentName} — Group Points Tables`];
  for(const g of app.state.groups){const table=getLeagueTable(g.id);if(!table.length)continue;lines.push('',g.name,'Team | M | W | L | T | Pts | NRR');table.forEach((x,i)=>lines.push(`${i+1}. ${x.team} | ${x.matches} | ${x.won} | ${x.lost} | ${x.tie} | ${x.points} | ${formatNrr(x.nrr)}`));}
  lines.push('Top 4 from each group qualify. Win 2 · Tie/Rain 1 each · NRR includes −5 per wicket.');shareText(lines.join('\n'));
}
function scoreShareText(match){
  const lines=[`${app.state.tournamentName}`,`${match.label} · ${match.stage}`,`${teamName(match.teamAId)} vs ${teamName(match.teamBId)}`];
  for(const inn of match.innings||[])lines.push(`${teamName(inn.battingTeamId)}: ${inn.runs}/${inn.wickets} (${oversText(inn)} overs) · CRR ${runRate(inn).toFixed(2)}`);
  if(match.superOvers?.length){lines.push('Super Overs:');match.superOvers.forEach((r,i)=>lines.push(`SO ${i+1}: ${r.innings.map(x=>`${teamName(x.battingTeamId)} ${x.runs}/${x.wickets}`).join(' | ')}`));}
  lines.push(`Result: ${resultText(match)}`);
  if(match.result?.manOfMatch)lines.push(`Man of the Match: ${match.result.manOfMatch.name} (${match.result.manOfMatch.contribution} contribution)`);
  lines.push('Double Wicket Tournament');
  return lines.join('\n');
}
async function shareText(text){
  try{
    if(navigator.share){await navigator.share({title:app.state.tournamentName,text});return;}
  }catch(err){if(err?.name==='AbortError')return;}
  const url=`https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(url,'_blank','noopener,noreferrer');
}
function downloadBackup(){
  const payload={...app.state,backupCreatedAt:new Date().toISOString()};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`double-wicket-backup-${new Date().toISOString().slice(0,10)}.json`;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);toast('Backup file downloaded.');
}
function restoreBackup(file){
  if(!file)return;const reader=new FileReader();reader.onload=()=>{try{const data=JSON.parse(reader.result);if(data.version!==1||!Array.isArray(data.teams)||!Array.isArray(data.matches))throw new Error('Invalid backup');if(!confirm('Restore this backup? Current tournament data will be replaced.'))return;app.state={version:1,tournamentName:data.tournamentName||'Double Wicket Tournament',groups:Array.isArray(data.groups)&&data.groups.length?data.groups:[{id:'group-a',name:'Group A'}],teams:data.teams,matches:data.matches,scheduleGenerated:!!data.scheduleGenerated,createdAt:data.createdAt||null};app.state.teams.forEach(t=>{if(!t.groupId)t.groupId=app.state.groups[0].id;});app.state.matches.forEach(m=>{if(m.stage==='League'&&!m.groupId)m.groupId=app.state.teams.find(t=>t.id===m.teamAId)?.groupId||app.state.groups[0].id;});saveState();toast('Backup restored.');go('home');}catch(e){toast('Backup file valid nahi hai.');}};reader.readAsText(file);
}
function resetTournament(){
  if(!confirm('Reset schedule, all scores and results? Team list will remain.'))return;
  app.state.matches=[];app.state.scheduleGenerated=false;app.state.createdAt=null;app.selectedMatchId=null;saveState();toast('Tournament reset.');go('teams');
}

// Click and form routing is delegated so the UI can be re-rendered safely.
document.addEventListener('click',event=>{
  const pageBtn=event.target.closest('[data-page]');
  if(pageBtn){go(pageBtn.dataset.page);return;}
  const nav=event.target.closest('.nav-item');if(nav){go(nav.dataset.page);return;}
  const btn=event.target.closest('[data-action]');if(!btn)return;
  const action=btn.dataset.action,id=btn.dataset.id;
  if(action==='close-modal'){closeModal();return;}
  if(action==='backdrop-close'&&event.target===btn){closeModal();return;}
  if(action==='go-teams'){go('teams');return;}
  if(action==='go-schedule'){go('schedule');return;}
  if(action==='go-history'){go('history');return;}
  if(action==='rules'){openRules();return;}
  if(action==='edit-team'){showTeamModal(id);return;}
  if(action==='rename-group'){const g=groupById(id);if(!g)return;const name=prompt('New group name:',g.name);if(name&&name.trim()){g.name=name.trim();saveState();render();}return;}
  if(action==='delete-group'){const g=groupById(id);if(!g)return;if(teamsInGroup(id).length){toast('Pehle is group ki teams doosre group mein move karein.');return;}if(app.state.groups.length<=1){toast('At least one group zaroori hai.');return;}if(confirm(`Delete ${g.name}?`)){app.state.groups=app.state.groups.filter(x=>x.id!==id);saveState();render();}return;}
  if(action==='delete-team'){
    const t=teamById(id);if(t&&confirm(`Delete team "${t.name}"?`)){app.state.teams=app.state.teams.filter(x=>x.id!==id);render();toast('Team deleted.');}return;
  }
  if(action==='generate-schedule'){if(confirm(`Generate round-robin schedule for ${app.state.teams.length} teams?`))generateRoundRobin();return;}
  if(action==='reset-tournament'){resetTournament();return;}
  if(action==='open-match'||action==='view-result'){
    app.selectedMatchId=id;go('score');if(app.state.matches.find(m=>m.id===id)?.status==='scheduled')openStartSetup(id);return;
  }
  if(action==='start-setup'){openStartSetup(id);return;}
  if(action==='ball'){const m=app.state.matches.find(x=>x.id===id);if(m)scoreDelivery(m,btn.dataset.value);return;}
  if(action==='undo'){const m=app.state.matches.find(x=>x.id===id);if(m)undoLast(m);return;}
  if(action==='next-innings'){const m=app.state.matches.find(x=>x.id===id);if(m)startNextInnings(m);return;}
  if(action==='tie-super-yes'){const m=app.state.matches.find(x=>x.id===id);if(m){beginSuperOver(m,m.innings[0].battingTeamId);render();}return;}
  if(action==='tie-super-no'){const m=app.state.matches.find(x=>x.id===id);if(m){finalizeTie(m);render();}return;}
  if(action==='abandon-match'){const m=app.state.matches.find(x=>x.id===id);if(m&&confirm('Mark this league match as rain-cancelled? Both teams receive 1 point; NRR is unchanged.')){abandonMatch(m);render();}return;}
  if(action==='share-points'){sharePointsTable();return;}
  if(action==='share-score'){const m=app.state.matches.find(x=>x.id===id);if(m)shareText(scoreShareText(m));return;}
  if(action==='backup'){downloadBackup();return;}
  if(action==='restore'){ $('#restoreFile').click();return;}
});

document.addEventListener('change',event=>{if(event.target.id==='leaderGroupSelect'){app.selectedGroupId=event.target.value||null;render();}});

document.addEventListener('submit',event=>{
  const form=event.target;
  if(form.id==='groupForm'){
    event.preventDefault();const data=new FormData(form),name=String(data.get('name')||'').trim();if(!name)return;
    if(app.state.scheduleGenerated){toast('Reset schedule first.');return;}
    if(app.state.groups.some(g=>g.name.toLowerCase()===name.toLowerCase())){toast('Group name already exists.');return;}
    app.state.groups.push({id:uid(),name});saveState();render();toast('Group created.');return;
  }
  if(form.id==='teamForm'){
    event.preventDefault();const data=new FormData(form);const name=String(data.get('name')||'').trim(),captain=String(data.get('captain')||'').trim(),partner=String(data.get('partner')||'').trim(),groupId=String(data.get('groupId')||app.state.groups[0]?.id||'');
    if(!name||!captain||!partner){toast('Please fill all team fields.');return;}
    if(captain.toLowerCase()===partner.toLowerCase()){toast('Captain and partner names must be different.');return;}
    if(app.state.teams.length>=32){toast('Maximum 32 teams allowed.');return;}
    app.state.teams.push({id:uid(),name,captain,partner,groupId});form.reset();render();toast('Team added successfully.');return;
  }
  if(form.id==='modalTeamForm'){event.preventDefault();teamFormSubmit(form);return;}
  if(form.id==='startMatchForm'){
    event.preventDefault();const data=new FormData(form);startMatch(form.dataset.id,data.get('batting'),data.get('striker'),data.get('bowler'));return;
  }
  if(form.id==='nextInningsForm'){event.preventDefault();submitNextInnings(form);return;}
});
$('#restoreFile').addEventListener('change',event=>{restoreBackup(event.target.files?.[0]);event.target.value='';});
$('#backupBtn').addEventListener('click',()=>{
  openModal('Backup / Restore',`<p class="help">Your tournament is saved on this device's browser. Download a backup before changing phones or clearing browser data.</p><div class="modal-actions"><button class="btn" data-action="backup">Download Backup</button><button class="btn secondary" data-action="restore">Restore Backup</button></div><p class="small-note">Restore replaces the current tournament on this device. Keep your backup file private.</p>`);
});

// PWA install prompt (Android Chrome / supported browsers).
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();app.deferredInstall=event;$('#installBtn').hidden=false;});
$('#installBtn').addEventListener('click',async()=>{
  if(app.deferredInstall){app.deferredInstall.prompt();await app.deferredInstall.userChoice;app.deferredInstall=null;$('#installBtn').hidden=true;}
  else{toast('Chrome menu ⋮ → Add to Home screen / Install app.');}
});
if('serviceWorker' in navigator && location.protocol.startsWith('http')){
  window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(err=>console.warn('Service worker registration failed',err)));
}

// Keep the current mobile screen in sync with local storage after a reload.
render();
