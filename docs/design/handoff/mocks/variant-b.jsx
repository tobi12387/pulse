// Variant B — "Performance Cockpit"
// Datendichtes Bloomberg/Strava-Pro Layout. Mono fonts, scharfe Linien,
// micro-charts, klare Hierarchie. Keine Emoji, kein Glow — pure Information.

const B = {
  bg:        '#0A0B0D',
  surface:   '#101216',
  surface2:  '#171A1F',
  border:    '#1F232A',
  borderHi:  '#2A3038',
  text:      '#E6E8EB',
  text2:     '#9098A3',
  text3:     '#5C636E',
  cyan:      '#5EE6CF',  // primärer akzent — performance
  cyanDim:   'rgba(94,230,207,0.16)',
  blue:      '#5B9DFF',
  amber:     '#FFB454',
  rose:      '#F47174',
  green:     '#5ECF8B',
  sans:      "'Geist', 'Inter', system-ui, sans-serif",
  mono:      "'JetBrains Mono', ui-monospace, monospace",
};

function BBase({ children, style }) {
  return <div style={{ background:B.bg, color:B.text, fontFamily:B.sans, fontSize:13, ...style }}>{children}</div>;
}

function BTopbar({ accent }) {
  const c = accent || B.cyan;
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 18px', borderBottom:`1px solid ${B.border}`, background:B.surface }}>
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <div style={{ width:18, height:18, position:'relative' }}>
          <div style={{ position:'absolute', inset:0, border:`1.5px solid ${c}`, borderRadius:9 }}/>
          <div style={{ position:'absolute', left:'50%', top:'50%', transform:'translate(-50%,-50%)', width:6, height:6, background:c, borderRadius:3 }}/>
        </div>
        <div style={{ fontFamily:B.mono, fontSize:12, letterSpacing:'.18em', fontWeight:600 }}>PULSE.OS</div>
        <div style={{ fontFamily:B.mono, fontSize:10, color:B.text3, marginLeft:4 }}>v2.1</div>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:18, fontFamily:B.mono, fontSize:11, color:B.text2 }}>
        <span><span style={{ color:B.green }}>●</span> sync 2m ago</span>
        <span>26.04.2026</span>
        <span style={{ color:B.text }}>tobi</span>
      </div>
    </div>
  );
}

function BSide({ active='home', accent }) {
  const c = accent || B.cyan;
  const items = [
    { id:'home', label:'Dashboard', kbd:'1' },
    { id:'coach', label:'Coach', kbd:'2' },
    { id:'data', label:'Data', kbd:'3' },
    { id:'plan', label:'Plan', kbd:'4' },
    { id:'settings', label:'Settings', kbd:'⌘,' },
  ];
  return (
    <div style={{ width:172, borderRight:`1px solid ${B.border}`, padding:'14px 8px', display:'flex', flexDirection:'column', gap:1, background:B.bg }}>
      <div style={{ fontFamily:B.mono, fontSize:9, color:B.text3, letterSpacing:'.18em', padding:'4px 10px 8px' }}>NAVIGATION</div>
      {items.map(it => (
        <div key={it.id} style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'8px 10px', borderRadius:4, fontSize:12.5,
          background: it.id===active ? B.surface2 : 'transparent',
          color: it.id===active ? B.text : B.text2,
          borderLeft: it.id===active ? `2px solid ${c}` : `2px solid transparent`,
        }}>
          <span>{it.label}</span>
          <span style={{ fontFamily:B.mono, fontSize:10, color:B.text3 }}>{it.kbd}</span>
        </div>
      ))}
      <div style={{ flex:1 }}/>
      <div style={{ padding:'10px', border:`1px solid ${B.border}`, borderRadius:4, fontFamily:B.mono, fontSize:10, color:B.text2, lineHeight:1.6 }}>
        <div style={{ color:B.text3, marginBottom:4 }}>SYSTEM</div>
        <div>garmin <span style={{ color:B.green }}>online</span></div>
        <div>last sync 14:23</div>
        <div>checkin <span style={{ color:B.amber }}>pending</span></div>
      </div>
    </div>
  );
}

// Sparkline aus polyline
function BSpark({ values, color, h=28, w=96, fill }) {
  const max = Math.max(...values), min = Math.min(...values);
  const range = max - min || 1;
  const pts = values.map((v,i) => {
    const x = (i/(values.length-1)) * w;
    const y = h - ((v-min)/range) * (h-3) - 1.5;
    return `${x},${y}`;
  }).join(' ');
  const fillPath = fill ? `M0,${h} L${pts.split(' ').join(' L')} L${w},${h} Z` : null;
  return (
    <svg width={w} height={h} style={{ display:'block' }}>
      {fillPath && <path d={fillPath} fill={color} opacity={.12}/>}
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.4}/>
    </svg>
  );
}

function BStatCard({ label, value, unit, sub, delta, deltaColor, spark, sparkColor, accent }) {
  return (
    <div style={{ padding:'14px 16px', background:B.surface, border:`1px solid ${B.border}`, borderRadius:6, position:'relative' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
        <span style={{ fontFamily:B.mono, fontSize:10, color:B.text3, letterSpacing:'.14em' }}>{label.toUpperCase()}</span>
        {delta && <span style={{ fontFamily:B.mono, fontSize:10, color:deltaColor || B.text3 }}>{delta}</span>}
      </div>
      <div style={{ display:'flex', alignItems:'baseline', gap:4 }}>
        <span style={{ fontFamily:B.mono, fontSize:28, fontWeight:500, color: accent || B.text, letterSpacing:'-.01em' }}>{value}</span>
        {unit && <span style={{ fontFamily:B.mono, fontSize:11, color:B.text3 }}>{unit}</span>}
      </div>
      {sub && <div style={{ fontFamily:B.mono, fontSize:10, color:B.text2, marginTop:4 }}>{sub}</div>}
      {spark && <div style={{ marginTop:10 }}><BSpark values={spark} color={sparkColor || B.cyan} fill/></div>}
    </div>
  );
}

function BReadinessBar({ readiness, prognosis }) {
  const score = readiness.score;
  return (
    <div style={{ padding:'18px 20px', background:`linear-gradient(180deg, ${B.surface} 0%, ${B.bg} 100%)`, border:`1px solid ${B.border}`, borderRadius:6 }}>
      <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', gap:24 }}>
        <div>
          <div style={{ fontFamily:B.mono, fontSize:10, color:B.text3, letterSpacing:'.18em', marginBottom:6 }}>READINESS · TODAY</div>
          <div style={{ display:'flex', alignItems:'baseline', gap:10 }}>
            <span style={{ fontFamily:B.mono, fontSize:56, fontWeight:500, color:B.cyan, lineHeight:1, letterSpacing:'-.02em' }}>{score}</span>
            <span style={{ fontFamily:B.mono, fontSize:14, color:B.text3 }}>/100</span>
            <span style={{ marginLeft:14, fontFamily:B.mono, fontSize:11, padding:'3px 8px', background:B.cyanDim, color:B.cyan, borderRadius:3 }}>GOOD · TRAIN</span>
          </div>
        </div>
        <div style={{ flex:1, maxWidth:380, fontSize:12, color:B.text2, lineHeight:1.55, paddingBottom:4 }}>
          {prognosis.message}
        </div>
      </div>
      <div style={{ marginTop:16, display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:0, borderTop:`1px solid ${B.border}` }}>
        {prognosis.factors.map((f,i) => (
          <div key={i} style={{ padding:'10px 12px', borderRight: i<3?`1px solid ${B.border}`:'none', fontFamily:B.mono, fontSize:11, color:B.text2 }}>
            <span style={{ color:B.green, marginRight:6 }}>+</span>{f}
          </div>
        ))}
      </div>
    </div>
  );
}

// CTL/ATL/TSB chart
function BLoadChart({ history, current }) {
  const w = 480, h = 110, pad = 8;
  const ctls = history.map(d=>d.ctl), atls = history.map(d=>d.atl), tsbs = history.map(d=>d.tsb);
  const allY = [...ctls, ...atls];
  const yMax = Math.max(...allY)+4, yMin = Math.min(...allY,0)-4;
  const yRange = yMax-yMin;
  const x = i => pad + (i/(history.length-1))*(w-pad*2);
  const y = v => h-pad - ((v-yMin)/yRange)*(h-pad*2);
  const path = arr => arr.map((v,i)=>`${i===0?'M':'L'} ${x(i)} ${y(v)}`).join(' ');
  // tsb area
  const tsbZeroY = y(0);
  return (
    <div style={{ padding:'14px 16px', background:B.surface, border:`1px solid ${B.border}`, borderRadius:6 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
        <span style={{ fontFamily:B.mono, fontSize:10, color:B.text3, letterSpacing:'.14em' }}>TRAINING LOAD · 14D</span>
        <div style={{ display:'flex', gap:14, fontFamily:B.mono, fontSize:10 }}>
          <span><span style={{ color:B.cyan }}>━</span> <span style={{ color:B.text2 }}>CTL</span> <span style={{ color:B.text }}>{current.ctl}</span></span>
          <span><span style={{ color:B.amber }}>━</span> <span style={{ color:B.text2 }}>ATL</span> <span style={{ color:B.text }}>{current.atl}</span></span>
          <span><span style={{ color:B.green }}>━</span> <span style={{ color:B.text2 }}>TSB</span> <span style={{ color:B.text }}>{(current.tsb>0?'+':'')+current.tsb}</span></span>
        </div>
      </div>
      <svg width={w} height={h} style={{ display:'block', maxWidth:'100%' }}>
        {/* grid */}
        {[0.25,0.5,0.75].map(t => (
          <line key={t} x1={pad} x2={w-pad} y1={pad+t*(h-pad*2)} y2={pad+t*(h-pad*2)} stroke={B.border} strokeWidth={.5}/>
        ))}
        <line x1={pad} x2={w-pad} y1={tsbZeroY} y2={tsbZeroY} stroke={B.borderHi} strokeWidth={.5} strokeDasharray="2 3"/>
        <path d={path(ctls)} fill="none" stroke={B.cyan} strokeWidth={1.6}/>
        <path d={path(atls)} fill="none" stroke={B.amber} strokeWidth={1.6}/>
        {/* tsb subtle */}
        <path d={path(tsbs)} fill="none" stroke={B.green} strokeWidth={1.2} opacity={.7}/>
        {/* last point markers */}
        <circle cx={x(ctls.length-1)} cy={y(ctls.at(-1))} r={3} fill={B.cyan}/>
        <circle cx={x(atls.length-1)} cy={y(atls.at(-1))} r={3} fill={B.amber}/>
      </svg>
    </div>
  );
}

function BWorkoutPanel({ w }) {
  // Workout-Plan visualisiert als Zonen-Bars
  const segs = [
    { z:1, mins:15, label:'Warm' },
    { z:4, mins:8, label:'Int 1' },
    { z:1, mins:3, label:'Trab' },
    { z:4, mins:8, label:'Int 2' },
    { z:1, mins:3, label:'Trab' },
    { z:4, mins:8, label:'Int 3' },
    { z:1, mins:3, label:'Trab' },
    { z:1, mins:10, label:'Cool' },
  ];
  const total = segs.reduce((s,x)=>s+x.mins,0);
  const zoneCol = { 1:'#3F4854', 2:B.blue, 3:B.green, 4:B.amber, 5:B.rose };
  return (
    <div style={{ padding:'14px 16px', background:B.surface, border:`1px solid ${B.border}`, borderRadius:6 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:10 }}>
        <div>
          <div style={{ fontFamily:B.mono, fontSize:10, color:B.text3, letterSpacing:'.14em' }}>NEXT · {w.plannedDate.toUpperCase()}</div>
          <div style={{ fontSize:15, fontWeight:500, marginTop:4 }}>{w.activityType} · Zone {w.zone} · {w.durationMin} min</div>
        </div>
        <button style={{ fontFamily:B.mono, fontSize:10, padding:'5px 10px', border:`1px solid ${B.cyan}`, color:B.cyan, background:'transparent', borderRadius:3, letterSpacing:'.1em' }}>SEND TO WATCH →</button>
      </div>
      <div style={{ display:'flex', height:24, gap:1, marginTop:8 }}>
        {segs.map((s,i) => (
          <div key={i} style={{ flex:s.mins, background:zoneCol[s.z], position:'relative', display:'grid', placeItems:'center' }}>
            {s.mins>=8 && <span style={{ fontFamily:B.mono, fontSize:9, color: s.z===1?B.text2:'#0A0B0D' }}>{s.mins}'</span>}
          </div>
        ))}
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', marginTop:6, fontFamily:B.mono, fontSize:9.5, color:B.text3 }}>
        <span>0</span><span>{Math.round(total/2)}'</span><span>{total}'</span>
      </div>
      <div style={{ fontFamily:B.mono, fontSize:11, color:B.text2, marginTop:10, lineHeight:1.5 }}>{w.description}</div>
    </div>
  );
}

function BActivityTable({ list }) {
  return (
    <div style={{ padding:'12px 16px', background:B.surface, border:`1px solid ${B.border}`, borderRadius:6 }}>
      <div style={{ fontFamily:B.mono, fontSize:10, color:B.text3, letterSpacing:'.14em', marginBottom:10 }}>RECENT · 14D</div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 60px 60px 50px 50px', gap:0, fontFamily:B.mono, fontSize:11 }}>
        {['Activity','Dur','Dist','HR','TSS'].map(h => (
          <div key={h} style={{ padding:'6px 4px', color:B.text3, fontSize:9, letterSpacing:'.14em', borderBottom:`1px solid ${B.border}`, textAlign: h==='Activity'?'left':'right' }}>{h.toUpperCase()}</div>
        ))}
        {list.map(a => (
          <React.Fragment key={a.id}>
            <div style={{ padding:'9px 4px', color:B.text, borderBottom:`1px solid ${B.border}`, fontFamily:B.sans, fontSize:12 }}>{a.name}</div>
            <div style={{ padding:'9px 4px', textAlign:'right', color:B.text2, borderBottom:`1px solid ${B.border}` }}>{Math.round(a.durationSec/60)}'</div>
            <div style={{ padding:'9px 4px', textAlign:'right', color:B.text2, borderBottom:`1px solid ${B.border}` }}>{a.distanceM ? (a.distanceM/1000).toFixed(1) : '—'}</div>
            <div style={{ padding:'9px 4px', textAlign:'right', color:B.text2, borderBottom:`1px solid ${B.border}` }}>{a.avgHr || '—'}</div>
            <div style={{ padding:'9px 4px', textAlign:'right', color:B.cyan, borderBottom:`1px solid ${B.border}` }}>{a.tss}</div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

function VariantB_Home({ data }) {
  const m = data.todayMetrics;
  return (
    <BBase style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <BTopbar/>
      <div style={{ display:'flex', flex:1, minHeight:0 }}>
        <BSide active="home"/>
        <div style={{ flex:1, padding:18, display:'flex', flexDirection:'column', gap:12, overflowY:'auto' }}>
          <BReadinessBar readiness={data.readiness} prognosis={data.prognosis}/>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:12 }}>
            <BStatCard label="Sleep" value={m.sleepHours} unit="h" sub={`score ${m.sleepScore}`} delta="+0.4h" deltaColor={B.green} spark={[6.9,7.2,7.8,7.6,8.1,7.6]} sparkColor={B.blue}/>
            <BStatCard label="HRV" value={m.hrvRmssd} unit="ms" sub="balanced" delta="+3" deltaColor={B.green} spark={data.hrvHistory} sparkColor={B.cyan} accent={B.cyan}/>
            <BStatCard label="Body Battery" value={m.bodyBatteryMax} unit="%" sub={`min ${m.bodyBatteryMin}`} delta="+8" deltaColor={B.green} spark={[64,72,68,80,75,86]} sparkColor={B.green}/>
            <BStatCard label="Resting HR" value={m.restingHr} unit="bpm" sub="−2 vs 7d" delta="−2" deltaColor={B.green} spark={[52,51,50,49,48,48]} sparkColor={B.amber}/>
          </div>
          <BLoadChart history={data.loadHistory} current={data.fitnessLoad}/>
          <div style={{ display:'grid', gridTemplateColumns:'1.4fr 1fr', gap:12 }}>
            <BWorkoutPanel w={data.nextWorkout}/>
            <BActivityTable list={data.recentActivities}/>
          </div>
        </div>
      </div>
    </BBase>
  );
}

// ─── Coach (variant B) ────────────────────────────────────────────
function VariantB_Coach({ data }) {
  return (
    <BBase style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <BTopbar/>
      <div style={{ display:'flex', flex:1, minHeight:0 }}>
        <BSide active="coach"/>
        <div style={{ flex:1, display:'flex', flexDirection:'column' }}>
          <div style={{ padding:'14px 18px', borderBottom:`1px solid ${B.border}`, display:'flex', gap:18, fontFamily:B.mono, fontSize:11, color:B.text2 }}>
            <span>session #128</span>
            <span>context: today</span>
            <span style={{ color:B.text3 }}>·</span>
            <span>sleep <span style={{ color:B.text }}>{data.todayMetrics.sleepHours}h</span></span>
            <span>hrv <span style={{ color:B.text }}>{data.todayMetrics.hrvRmssd}</span></span>
            <span>batt <span style={{ color:B.text }}>{data.todayMetrics.bodyBatteryMax}%</span></span>
          </div>
          <div style={{ flex:1, padding:18, overflowY:'auto', display:'flex', flexDirection:'column', gap:12 }}>
            {data.chatHistory.map(m => (
              <div key={m.id} style={{ display:'flex', gap:10 }}>
                <div style={{ width:48, fontFamily:B.mono, fontSize:9, color: m.role==='user' ? B.text3 : B.cyan, paddingTop:2, letterSpacing:'.14em' }}>
                  {m.role==='user' ? 'YOU →' : 'COACH'}
                </div>
                <div style={{ flex:1, fontSize:13, color:B.text, lineHeight:1.55, padding: m.role==='assistant'?'10px 14px':0, background: m.role==='assistant'?B.surface:'transparent', border: m.role==='assistant'?`1px solid ${B.border}`:'none', borderRadius:4 }}>{m.content}</div>
              </div>
            ))}
          </div>
          <div style={{ padding:'14px 18px', borderTop:`1px solid ${B.border}`, display:'flex', gap:10, alignItems:'center', background:B.surface }}>
            <div style={{ width:36, height:36, border:`1px solid ${B.border}`, borderRadius:4, display:'grid', placeItems:'center', color:B.text2 }}>{Icons.mic}</div>
            <div style={{ flex:1, padding:'9px 12px', border:`1px solid ${B.border}`, borderRadius:4, fontSize:12.5, color:B.text3, fontFamily:B.mono }}>&gt; ask the coach…</div>
            <div style={{ width:36, height:36, background:B.cyan, color:'#0A0B0D', borderRadius:4, display:'grid', placeItems:'center' }}>{Icons.send}</div>
          </div>
        </div>
      </div>
    </BBase>
  );
}

window.VariantB_Home = VariantB_Home;
window.VariantB_Coach = VariantB_Coach;
window.B_THEME = B;
window.BBase = BBase;
window.BTopbar = BTopbar;
window.BSide = BSide;
window.BSpark = BSpark;
window.BStatCard = BStatCard;
