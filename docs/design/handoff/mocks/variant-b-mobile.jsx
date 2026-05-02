// Variant B — Mobile (Performance Cockpit auf 390x844)
// Adapts the dense desktop layout to a touch-first phone screen.

const Bm = window.B_THEME;

function VariantB_Mobile({ data, screen='home', accent }) {
  const c = accent || Bm.cyan;
  return (
    <div style={{
      width:'100%', height:'100%',
      background:Bm.bg, color:Bm.text,
      fontFamily:Bm.sans, fontSize:13,
      display:'flex', flexDirection:'column',
      overflow:'hidden',
    }}>
      <BMStatusBar/>
      <BMHeader accent={c} screen={screen}/>
      <div style={{ flex:1, overflowY:'auto' }}>
        {screen==='home' && <BMHome data={data} accent={c}/>}
        {screen==='coach' && <BMCoach data={data} accent={c}/>}
        {screen==='data' && <BMData accent={c}/>}
      </div>
      <BMTabBar accent={c} active={screen}/>
    </div>
  );
}

function BMStatusBar() {
  return (
    <div style={{
      height:44, padding:'0 22px', display:'flex',
      alignItems:'center', justifyContent:'space-between',
      fontFamily:Bm.sans, fontSize:14, color:Bm.text, fontWeight:600,
      flexShrink:0,
    }}>
      <span>9:41</span>
      <div style={{ display:'flex', gap:5, alignItems:'center', fontFamily:Bm.mono, fontSize:11, color:Bm.text2 }}>
        <span>●●●</span>
        <span style={{ marginLeft:4 }}>5G</span>
        <span style={{ marginLeft:4 }}>▮▮▮</span>
      </div>
    </div>
  );
}

function BMHeader({ accent, screen }) {
  const titles = { home:'Dashboard', coach:'Coach', data:'Data', plan:'Plan' };
  return (
    <div style={{
      padding:'4px 18px 14px', display:'flex',
      alignItems:'center', justifyContent:'space-between',
      borderBottom:`1px solid ${Bm.border}`, flexShrink:0,
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <div style={{ width:14, height:14, position:'relative' }}>
          <div style={{ position:'absolute', inset:0, border:`1.5px solid ${accent}`, borderRadius:7 }}/>
          <div style={{ position:'absolute', left:'50%', top:'50%', transform:'translate(-50%,-50%)', width:5, height:5, background:accent, borderRadius:2.5 }}/>
        </div>
        <span style={{ fontFamily:Bm.mono, fontSize:11, letterSpacing:'.18em', fontWeight:600 }}>PULSE.OS</span>
      </div>
      <div style={{ fontFamily:Bm.mono, fontSize:10, color:Bm.text3 }}>
        <span style={{ color:Bm.green }}>●</span> sync 2m
      </div>
    </div>
  );
}

function BMHome({ data, accent }) {
  return (
    <div style={{ padding:'14px 16px 80px', display:'flex', flexDirection:'column', gap:12 }}>
      {/* Date + greeting */}
      <div>
        <div style={{ fontFamily:Bm.mono, fontSize:9, color:Bm.text3, letterSpacing:'.18em' }}>26.04.2026 · MON</div>
        <div style={{ fontSize:20, fontWeight:500, marginTop:4 }}>Guten Morgen, Tobi</div>
      </div>

      {/* Hero: readiness */}
      <div style={{
        padding:'18px 18px',
        background:`linear-gradient(135deg, ${Bm.surface} 0%, ${Bm.surface2} 100%)`,
        border:`1px solid ${Bm.border}`, borderRadius:8,
      }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
          <span style={{ fontFamily:Bm.mono, fontSize:9.5, color:Bm.text3, letterSpacing:'.16em' }}>READINESS · TODAY</span>
          <span style={{ fontFamily:Bm.mono, fontSize:9.5, color:Bm.green }}>● optimal</span>
        </div>
        <div style={{ display:'flex', alignItems:'baseline', gap:6 }}>
          <span style={{ fontFamily:Bm.mono, fontSize:48, fontWeight:500, color:accent, letterSpacing:'-.02em' }}>{data?.readiness?.score ?? 84}</span>
          <span style={{ fontFamily:Bm.mono, fontSize:13, color:Bm.text3 }}>/ 100</span>
          <span style={{ marginLeft:'auto', fontFamily:Bm.mono, fontSize:11, color:Bm.green }}>+6 vs ø</span>
        </div>
        <BMSpark values={[68,72,74,78,72,80,84]} color={accent}/>

        <div style={{ marginTop:14, display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:1, background:Bm.border, borderRadius:4, overflow:'hidden' }}>
          {[
            { l:'HRV',   v:'58',  u:'ms', d:'+3', dc:Bm.green },
            { l:'RHR',   v:'48',  u:'bpm',d:'-2', dc:Bm.green },
            { l:'Sleep', v:'7.6', u:'h', d:'+0.4', dc:Bm.green },
          ].map(s => (
            <div key={s.l} style={{ padding:'10px 10px', background:Bm.surface }}>
              <div style={{ fontFamily:Bm.mono, fontSize:8.5, color:Bm.text3, letterSpacing:'.14em' }}>{s.l.toUpperCase()}</div>
              <div style={{ display:'flex', alignItems:'baseline', gap:3, marginTop:4 }}>
                <span style={{ fontFamily:Bm.mono, fontSize:18, color:Bm.text }}>{s.v}</span>
                <span style={{ fontFamily:Bm.mono, fontSize:9, color:Bm.text3 }}>{s.u}</span>
              </div>
              <div style={{ fontFamily:Bm.mono, fontSize:9, color:s.dc, marginTop:2 }}>{s.d}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Today's workout */}
      <div style={{ padding:'14px 16px', background:Bm.surface, border:`1px solid ${Bm.border}`, borderRadius:6 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
          <span style={{ fontFamily:Bm.mono, fontSize:9.5, color:Bm.text3, letterSpacing:'.14em' }}>TODAY'S WORKOUT</span>
          <span style={{ fontFamily:Bm.mono, fontSize:9.5, color:accent }}>17:30</span>
        </div>
        <div style={{ fontSize:15, fontWeight:500, color:Bm.text }}>Schwellen-Intervalle</div>
        <div style={{ fontFamily:Bm.mono, fontSize:11, color:Bm.text2, marginTop:3 }}>4 × 8' @ Z4 · 70 min total · TSS 84</div>

        {/* zone bar */}
        <div style={{ display:'flex', height:5, marginTop:12, gap:1, borderRadius:2, overflow:'hidden' }}>
          <div style={{ flex:'0 0 12%', background:'#3F4854' }}/>
          <div style={{ flex:'0 0 18%', background:Bm.blue }}/>
          <div style={{ flex:'0 0 8%',  background:Bm.green }}/>
          <div style={{ flex:'0 0 56%', background:accent }}/>
          <div style={{ flex:'0 0 6%',  background:Bm.rose }}/>
        </div>

        <button style={{
          width:'100%', marginTop:14, padding:'12px',
          background:accent, color:Bm.bg, border:'none', borderRadius:5,
          fontFamily:Bm.mono, fontSize:11, letterSpacing:'.16em', fontWeight:600,
        }}>
          START WORKOUT →
        </button>
      </div>

      {/* CTL/ATL/TSB row */}
      <div style={{ padding:'14px 16px', background:Bm.surface, border:`1px solid ${Bm.border}`, borderRadius:6 }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:10 }}>
          <span style={{ fontFamily:Bm.mono, fontSize:9.5, color:Bm.text3, letterSpacing:'.14em' }}>FORM · 7D</span>
          <span style={{ fontFamily:Bm.mono, fontSize:9.5, color:Bm.text2 }}>building</span>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:12 }}>
          {[
            { l:'CTL', v:'48.2', d:'+1.4', dc:Bm.green, color:accent },
            { l:'ATL', v:'52.6', d:'+3.8', dc:Bm.amber, color:Bm.amber },
            { l:'TSB', v:'-4.4', d:'fresh-1', dc:Bm.text3, color:Bm.text2 },
          ].map(s => (
            <div key={s.l}>
              <div style={{ fontFamily:Bm.mono, fontSize:9, color:Bm.text3, letterSpacing:'.14em' }}>{s.l}</div>
              <div style={{ fontFamily:Bm.mono, fontSize:20, color:s.color, marginTop:3 }}>{s.v}</div>
              <div style={{ fontFamily:Bm.mono, fontSize:9, color:s.dc, marginTop:2 }}>{s.d}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent activities */}
      <div style={{ padding:'14px 16px', background:Bm.surface, border:`1px solid ${Bm.border}`, borderRadius:6 }}>
        <div style={{ fontFamily:Bm.mono, fontSize:9.5, color:Bm.text3, letterSpacing:'.14em', marginBottom:10 }}>RECENT</div>
        {[
          { d:'Sa', name:'Long Run', stats:'17.0km · 1:32 · TSS 92', tss:92 },
          { d:'Mi', name:'Intervalle', stats:'11.2km · 56\' · TSS 82', tss:82 },
          { d:'Mo', name:'Z2 Recovery', stats:'7.4km · 42\' · TSS 38', tss:38 },
        ].map((it,i)=>(
          <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 0', borderTop: i>0?`1px solid ${Bm.border}`:'none' }}>
            <div style={{ width:28, fontFamily:Bm.mono, fontSize:10, color:Bm.text3, textAlign:'center' }}>{it.d}</div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, color:Bm.text }}>{it.name}</div>
              <div style={{ fontFamily:Bm.mono, fontSize:10, color:Bm.text3, marginTop:1 }}>{it.stats}</div>
            </div>
            <div style={{ width:34, height:18 }}>
              <BMSpark values={[1,3,2,5,4,6,5,4,3]} color={accent} h={18} w={34}/>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BMCoach({ data, accent }) {
  return (
    <div style={{ padding:'14px 16px 80px', display:'flex', flexDirection:'column', gap:12 }}>
      <div>
        <div style={{ fontFamily:Bm.mono, fontSize:9, color:Bm.text3, letterSpacing:'.18em' }}>COACH · LIVE</div>
        <div style={{ fontSize:18, fontWeight:500, marginTop:3 }}>Briefing</div>
      </div>

      {/* Daily brief */}
      <div style={{
        padding:'16px 16px',
        background:Bm.surface, border:`1px solid ${Bm.border}`,
        borderLeft:`3px solid ${accent}`, borderRadius:'4px 6px 6px 4px',
      }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
          <span style={{ fontFamily:Bm.mono, fontSize:9.5, color:accent, letterSpacing:'.14em' }}>GO · CONFIDENCE 87%</span>
          <span style={{ fontFamily:Bm.mono, fontSize:9, color:Bm.text3 }}>06:42</span>
        </div>
        <div style={{ fontSize:14, lineHeight:1.55, color:Bm.text }}>
          Du bist optimal regeneriert. HRV 58ms (+3), Schlaf 7.6h, RHR 48. Push the threshold session — 4×8' bei 4:32/km. Falls Wind &gt; 20 km/h, drop auf 3×10' Schwelle.
        </div>
        <div style={{ marginTop:12, display:'flex', gap:8 }}>
          <button style={{ flex:1, padding:'10px', background:accent, color:Bm.bg, border:'none', borderRadius:4, fontFamily:Bm.mono, fontSize:10, letterSpacing:'.14em', fontWeight:600 }}>ACCEPT</button>
          <button style={{ flex:1, padding:'10px', background:'transparent', color:Bm.text2, border:`1px solid ${Bm.border}`, borderRadius:4, fontFamily:Bm.mono, fontSize:10, letterSpacing:'.14em' }}>ADJUST</button>
        </div>
      </div>

      {/* Reasoning */}
      <div style={{ padding:'14px 16px', background:Bm.surface, border:`1px solid ${Bm.border}`, borderRadius:6 }}>
        <div style={{ fontFamily:Bm.mono, fontSize:9.5, color:Bm.text3, letterSpacing:'.14em', marginBottom:10 }}>REASONING</div>
        {[
          { l:'HRV', v:'58 ms', s:'+3 vs ø7d', positive:true },
          { l:'RHR', v:'48 bpm', s:'-2 vs ø7d', positive:true },
          { l:'Sleep eff', v:'92%', s:'8.0h target', positive:true },
          { l:'TSB', v:'-4.4', s:'fresh-1, primed', positive:true },
        ].map(r => (
          <div key={r.l} style={{ display:'grid', gridTemplateColumns:'80px 80px 1fr', padding:'7px 0', borderTop:`1px solid ${Bm.border}`, fontFamily:Bm.mono, fontSize:11 }}>
            <span style={{ color:Bm.text3 }}>{r.l}</span>
            <span style={{ color:Bm.text }}>{r.v}</span>
            <span style={{ color: r.positive ? Bm.green : Bm.amber }}>{r.s}</span>
          </div>
        ))}
      </div>

      {/* Chat input */}
      <div style={{ padding:'14px 16px', background:Bm.surface, border:`1px solid ${Bm.border}`, borderRadius:6 }}>
        <div style={{ fontFamily:Bm.mono, fontSize:9.5, color:Bm.text3, letterSpacing:'.14em', marginBottom:10 }}>ASK</div>
        <div style={{ display:'flex', gap:6, marginBottom:10 }}>
          {['Why threshold?','Weather impact','Adjust load'].map(q => (
            <div key={q} style={{ padding:'6px 10px', background:Bm.bg, border:`1px solid ${Bm.border}`, borderRadius:99, fontFamily:Bm.mono, fontSize:10, color:Bm.text2 }}>{q}</div>
          ))}
        </div>
        <div style={{ padding:'12px 12px', background:Bm.bg, border:`1px solid ${Bm.border}`, borderRadius:4, fontFamily:Bm.mono, fontSize:11, color:Bm.text3, display:'flex', justifyContent:'space-between' }}>
          <span>&gt; ask coach...</span>
          <span style={{ color:accent }}>↵</span>
        </div>
      </div>
    </div>
  );
}

function BMData({ accent }) {
  return (
    <div style={{ padding:'14px 16px 80px', display:'flex', flexDirection:'column', gap:12 }}>
      <div>
        <div style={{ fontFamily:Bm.mono, fontSize:9, color:Bm.text3, letterSpacing:'.18em' }}>DATA · 7D</div>
        <div style={{ fontSize:18, fontWeight:500, marginTop:3 }}>Schlaf & Mental</div>
      </div>

      {/* Sleep score */}
      <div style={{ padding:'14px 16px', background:Bm.surface, border:`1px solid ${Bm.border}`, borderRadius:6 }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
          <span style={{ fontFamily:Bm.mono, fontSize:9.5, color:Bm.text3, letterSpacing:'.14em' }}>AVG SLEEP · 7D</span>
          <span style={{ fontFamily:Bm.mono, fontSize:9.5, color:Bm.green }}>+0.3h</span>
        </div>
        <div style={{ display:'flex', alignItems:'baseline', gap:5 }}>
          <span style={{ fontFamily:Bm.mono, fontSize:32, color:accent }}>7.5</span>
          <span style={{ fontFamily:Bm.mono, fontSize:11, color:Bm.text3 }}>h · goal 8h</span>
        </div>
        <div style={{ marginTop:10 }}>
          <BMSpark values={[6.9,7.2,7.8,7.6,8.1,7.6,7.5]} color={accent} h={32} w={326}/>
        </div>
      </div>

      {/* Mental check-in */}
      <div style={{ padding:'14px 16px', background:Bm.surface, border:`1px solid ${Bm.border}`, borderRadius:6 }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:14 }}>
          <span style={{ fontFamily:Bm.mono, fontSize:9.5, color:Bm.text3, letterSpacing:'.14em' }}>CHECK-IN · TODAY</span>
          <span style={{ fontFamily:Bm.mono, fontSize:9.5, color:Bm.green }}>● submitted</span>
        </div>
        {[
          { l:'Stimmung', v:7, c:accent },
          { l:'Energie', v:8, c:Bm.green },
          { l:'Stress', v:3, c:Bm.amber },
          { l:'Motivation', v:8, c:Bm.blue },
        ].map(it => (
          <div key={it.l} style={{ marginBottom:12 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
              <span style={{ fontSize:12, color:Bm.text }}>{it.l}</span>
              <span style={{ fontFamily:Bm.mono, fontSize:11, color:it.c }}>{it.v}/10</span>
            </div>
            <div style={{ display:'flex', gap:2 }}>
              {[...Array(10)].map((_,i)=>(
                <div key={i} style={{ flex:1, height:5, borderRadius:1, background: i<it.v ? it.c : Bm.bg, border:`1px solid ${Bm.border}` }}/>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* HRV trend */}
      <div style={{ padding:'14px 16px', background:Bm.surface, border:`1px solid ${Bm.border}`, borderRadius:6 }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
          <span style={{ fontFamily:Bm.mono, fontSize:9.5, color:Bm.text3, letterSpacing:'.14em' }}>HRV TREND · 14D</span>
          <span style={{ fontFamily:Bm.mono, fontSize:9.5, color:Bm.green }}>+ stable</span>
        </div>
        <div>
          <BMSpark values={[51,52,53,55,53,56,58,57,55,58,57,58,58,58]} color={accent} h={48} w={326} fill/>
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', marginTop:6, fontFamily:Bm.mono, fontSize:9, color:Bm.text3 }}>
          <span>13.04</span><span>20.04</span><span>26.04</span>
        </div>
      </div>
    </div>
  );
}

function BMTabBar({ accent, active }) {
  const tabs = [
    { id:'home', label:'Home' },
    { id:'coach', label:'Coach' },
    { id:'data', label:'Data' },
    { id:'plan', label:'Plan' },
  ];
  return (
    <div style={{
      borderTop:`1px solid ${Bm.border}`, background:Bm.surface,
      padding:'10px 0 28px', display:'grid', gridTemplateColumns:'repeat(4,1fr)',
      flexShrink:0,
    }}>
      {tabs.map(t => (
        <div key={t.id} style={{
          textAlign:'center', fontFamily:Bm.mono, fontSize:10, letterSpacing:'.14em',
          color: t.id===active ? accent : Bm.text3,
          borderTop: t.id===active ? `1px solid ${accent}` : '1px solid transparent',
          marginTop:-11, paddingTop:10,
        }}>
          {t.label.toUpperCase()}
        </div>
      ))}
    </div>
  );
}

function BMSpark({ values, color, h=24, w=80, fill }) {
  const max = Math.max(...values), min = Math.min(...values);
  const range = max - min || 1;
  const pts = values.map((v,i) => {
    const x = (i/(values.length-1)) * w;
    const y = h - ((v-min)/range) * (h-3) - 1.5;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={w} height={h} style={{ display:'block', width:'100%', height:h }} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      {fill && <path d={`M0,${h} L${pts.split(' ').join(' L')} L${w},${h} Z`} fill={color} opacity={.15}/>}
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.4}/>
    </svg>
  );
}

window.VariantB_Mobile = VariantB_Mobile;
