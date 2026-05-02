// Variant B — additional screens: Plan, Daten, Activity Detail, Wochen-Review
// Reuses constants from variant-b.jsx (window.B_THEME) — exposed there.

const Bx = window.B_THEME;
const Bicons = window.Icons;

// ──────────────────────────────────────────────────────────────
// PLAN — Training / Ziele / Review als Tab-Layout
// ──────────────────────────────────────────────────────────────
function VariantB_Plan({ data, tab='training', accent }) {
  const c = accent || Bx.cyan;
  return (
    <BBase style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <BTopbar accent={c}/>
      <div style={{ display:'flex', flex:1, minHeight:0 }}>
        <BSide active="plan" accent={c}/>
        <div style={{ flex:1, overflowY:'auto' }}>
          <div style={{ padding:'16px 18px 8px', borderBottom:`1px solid ${Bx.border}`, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div>
              <div style={{ fontFamily:Bx.mono, fontSize:10, color:Bx.text3, letterSpacing:'.18em' }}>PLAN</div>
              <div style={{ fontSize:18, fontWeight:500, marginTop:2 }}>Training, Ziele & Review</div>
            </div>
            <div style={{ display:'flex', gap:1, padding:2, background:Bx.surface, border:`1px solid ${Bx.border}`, borderRadius:5 }}>
              {['training','ziele','review'].map(t => (
                <div key={t} style={{
                  padding:'6px 14px', fontFamily:Bx.mono, fontSize:11, letterSpacing:'.1em',
                  background: t===tab ? Bx.surface2 : 'transparent',
                  color: t===tab ? c : Bx.text2,
                  borderRadius:3, textTransform:'uppercase'
                }}>{t}</div>
              ))}
            </div>
          </div>

          <div style={{ padding:18, display:'flex', flexDirection:'column', gap:12 }}>
            {/* Wochenplanung als Kalenderstreifen */}
            <BWeekStrip accent={c}/>

            {/* Geplante Workouts liste */}
            <div style={{ padding:'14px 16px', background:Bx.surface, border:`1px solid ${Bx.border}`, borderRadius:6 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                <span style={{ fontFamily:Bx.mono, fontSize:10, color:Bx.text3, letterSpacing:'.14em' }}>SCHEDULED · 7D</span>
                <button style={{ fontFamily:Bx.mono, fontSize:10, padding:'5px 10px', border:`1px solid ${Bx.border}`, color:Bx.text2, background:'transparent', borderRadius:3, letterSpacing:'.1em' }}>+ ADD WORKOUT</button>
              </div>
              <BWorkoutTable accent={c}/>
            </div>

            {/* Ziele + Review nebeneinander */}
            <div style={{ display:'grid', gridTemplateColumns:'1.2fr 1fr', gap:12 }}>
              <BGoalsPanel goals={data.goals} accent={c}/>
              <BReviewMini accent={c}/>
            </div>
          </div>
        </div>
      </div>
    </BBase>
  );
}

function BWeekStrip({ accent }) {
  const days = [
    { day:'Mo', date:26, type:'Schwelle', zone:4, dur:70, planned:true,  active:true },
    { day:'Di', date:27, type:'Recovery', zone:1, dur:40, planned:true },
    { day:'Mi', date:28, type:'Intervalle', zone:5, dur:60, planned:true },
    { day:'Do', date:29, type:'Z2 Lauf',  zone:2, dur:50, planned:true },
    { day:'Fr', date:30, type:'Rest',     zone:0, dur:0,  planned:true },
    { day:'Sa', date:31, type:'Long Run', zone:2, dur:120, planned:true },
    { day:'So', date:1,  type:'Krafttraining', zone:1, dur:45, planned:true },
  ];
  const zoneColor = { 0:Bx.text3, 1:'#3F4854', 2:Bx.blue, 3:Bx.green, 4:accent, 5:Bx.rose };
  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:8 }}>
      {days.map(d => (
        <div key={d.day} style={{
          padding:'12px 12px 14px',
          background: d.active ? Bx.surface2 : Bx.surface,
          border:`1px solid ${d.active ? accent : Bx.border}`,
          borderRadius:5,
        }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
            <span style={{ fontFamily:Bx.mono, fontSize:10, color:Bx.text3, letterSpacing:'.1em' }}>{d.day.toUpperCase()}</span>
            <span style={{ fontFamily:Bx.mono, fontSize:14, color:d.active?accent:Bx.text }}>{d.date}</span>
          </div>
          <div style={{ marginTop:10, height:3, background: d.dur>0 ? zoneColor[d.zone] : 'transparent', borderRadius:1 }}/>
          <div style={{ marginTop:8, fontSize:11, color:d.zone===0?Bx.text3:Bx.text }}>{d.type}</div>
          {d.dur>0 && <div style={{ fontFamily:Bx.mono, fontSize:9.5, color:Bx.text3, marginTop:2 }}>Z{d.zone} · {d.dur}'</div>}
        </div>
      ))}
    </div>
  );
}

function BWorkoutTable({ accent }) {
  const items = [
    { date:'Mo · 17:30', type:'Laufen · Schwelle', zone:4, dur:70, dist:14, status:'today' },
    { date:'Di · 07:00', type:'Laufen · Recovery', zone:1, dur:40, dist:7,  status:'planned' },
    { date:'Mi · 18:00', type:'Laufen · Intervalle', zone:5, dur:60, dist:11, status:'planned' },
    { date:'Do · 07:00', type:'Laufen · Z2',       zone:2, dur:50, dist:9,  status:'planned' },
    { date:'Sa · 09:00', type:'Laufen · Long Run', zone:2, dur:120, dist:22, status:'planned' },
    { date:'So · 10:00', type:'Krafttraining',     zone:1, dur:45, dist:null,  status:'planned' },
  ];
  const zoneColor = { 1:'#3F4854', 2:Bx.blue, 3:Bx.green, 4:accent, 5:Bx.rose };
  return (
    <div style={{ display:'grid', gridTemplateColumns:'130px 1fr 60px 70px 70px 90px', fontFamily:Bx.mono, fontSize:11 }}>
      {['Date','Workout','Zone','Dur','Dist','Status'].map(h => (
        <div key={h} style={{ padding:'6px 6px', color:Bx.text3, fontSize:9, letterSpacing:'.14em', borderBottom:`1px solid ${Bx.border}`, textAlign: h==='Workout'?'left':'left' }}>{h.toUpperCase()}</div>
      ))}
      {items.map((it,i) => (
        <React.Fragment key={i}>
          <div style={{ padding:'10px 6px', borderBottom:`1px solid ${Bx.border}`, color:it.status==='today'?accent:Bx.text2 }}>{it.date}</div>
          <div style={{ padding:'10px 6px', borderBottom:`1px solid ${Bx.border}`, color:Bx.text, fontFamily:Bx.sans, fontSize:12 }}>{it.type}</div>
          <div style={{ padding:'10px 6px', borderBottom:`1px solid ${Bx.border}` }}>
            <span style={{ display:'inline-block', padding:'2px 7px', background:`${zoneColor[it.zone]}25`, color:zoneColor[it.zone], borderRadius:3, fontSize:10 }}>Z{it.zone}</span>
          </div>
          <div style={{ padding:'10px 6px', borderBottom:`1px solid ${Bx.border}`, color:Bx.text2 }}>{it.dur}'</div>
          <div style={{ padding:'10px 6px', borderBottom:`1px solid ${Bx.border}`, color:Bx.text2 }}>{it.dist!=null?`${it.dist}km`:'—'}</div>
          <div style={{ padding:'10px 6px', borderBottom:`1px solid ${Bx.border}`, color: it.status==='today' ? accent : Bx.text3 }}>{it.status}</div>
        </React.Fragment>
      ))}
    </div>
  );
}

function BGoalsPanel({ goals, accent }) {
  const statusColor = { active:Bx.green, paused:Bx.amber, completed:Bx.blue };
  return (
    <div style={{ padding:'14px 16px', background:Bx.surface, border:`1px solid ${Bx.border}`, borderRadius:6 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:12 }}>
        <span style={{ fontFamily:Bx.mono, fontSize:10, color:Bx.text3, letterSpacing:'.14em' }}>GOALS</span>
        <button style={{ fontFamily:Bx.mono, fontSize:10, padding:'3px 8px', border:`1px solid ${accent}`, color:accent, background:'transparent', borderRadius:3 }}>+ NEW</button>
      </div>
      {goals.map((g,i) => (
        <div key={g.id} style={{ padding:'12px 0', borderTop: i>0?`1px solid ${Bx.border}`:'none' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
            <span style={{ fontSize:13, color:Bx.text }}>{g.title}</span>
            <span style={{ fontFamily:Bx.mono, fontSize:10, color:statusColor[g.status]||Bx.text3 }}>● {g.status}</span>
          </div>
          {g.description && <div style={{ fontSize:11, color:Bx.text3, marginBottom:6 }}>{g.description}</div>}
          <div style={{ height:4, background:Bx.bg, borderRadius:99, overflow:'hidden' }}>
            <div style={{ width:`${g.progress*100}%`, height:'100%', background:accent }}/>
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', marginTop:5, fontFamily:Bx.mono, fontSize:9.5, color:Bx.text3 }}>
            <span>{Math.round(g.progress*100)}% complete</span>
            <span>{g.targetDate}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function BReviewMini({ accent }) {
  return (
    <div style={{ padding:'14px 16px', background:Bx.surface, border:`1px solid ${Bx.border}`, borderRadius:6 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:10 }}>
        <span style={{ fontFamily:Bx.mono, fontSize:10, color:Bx.text3, letterSpacing:'.14em' }}>WEEKLY REVIEW</span>
        <span style={{ fontFamily:Bx.mono, fontSize:10, color:Bx.text2 }}>KW17</span>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:1, background:Bx.border, marginBottom:10 }}>
        {[{l:'Workouts',v:'4/5'},{l:'TSS',v:'268'},{l:'Δ CTL',v:'+1.4'}].map(s => (
          <div key={s.l} style={{ background:Bx.surface, padding:'10px 10px' }}>
            <div style={{ fontFamily:Bx.mono, fontSize:9, color:Bx.text3, letterSpacing:'.14em' }}>{s.l.toUpperCase()}</div>
            <div style={{ fontFamily:Bx.mono, fontSize:18, color:Bx.text, marginTop:4 }}>{s.v}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize:11.5, color:Bx.text2, lineHeight:1.55 }}>
        Solide Aufbauwoche. CTL stabil im Plus, HRV-Trend +. Engste Phase Fr (TSB −9). Heute frisch genug für Quality.
      </div>
      <button style={{ marginTop:10, fontFamily:Bx.mono, fontSize:10, padding:'6px 10px', border:`1px solid ${accent}`, color:accent, background:'transparent', borderRadius:3, letterSpacing:'.1em', width:'100%' }}>
        OPEN FULL REVIEW →
      </button>
    </div>
  );
}

window.VariantB_Plan = VariantB_Plan;
