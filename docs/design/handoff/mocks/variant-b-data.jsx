// Variant B — Daten (Schlaf + Mental) + Activity Detail + Wochen-Review

const Bx2 = window.B_THEME;

function VariantB_Data({ data, accent }) {
  const c = accent || Bx2.cyan;
  return (
    <BBase style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <BTopbar accent={c}/>
      <div style={{ display:'flex', flex:1, minHeight:0 }}>
        <BSide active="data" accent={c}/>
        <div style={{ flex:1, overflowY:'auto', padding:18, display:'flex', flexDirection:'column', gap:12 }}>
          <div>
            <div style={{ fontFamily:Bx2.mono, fontSize:10, color:Bx2.text3, letterSpacing:'.18em' }}>DATA</div>
            <div style={{ fontSize:18, fontWeight:500, marginTop:2 }}>Schlaf & Mental</div>
          </div>

          {/* Sleep stats row */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:12 }}>
            <BStatCard label="Avg sleep 7d" value="7.5" unit="h" sub="goal 8h" delta="+0.3" deltaColor={Bx2.green} spark={[6.9,7.2,7.8,7.6,8.1,7.6,7.5]} sparkColor={c} accent={c}/>
            <BStatCard label="Sleep score" value="81" unit="/100" sub="ø 7d" delta="+4" deltaColor={Bx2.green} spark={[72,78,84,82,88,84,81]} sparkColor={Bx2.blue}/>
            <BStatCard label="Deep sleep ø" value="1.4" unit="h" sub="19% total" delta="—" deltaColor={Bx2.text3} spark={[1.1,1.3,1.5,1.4,1.6,1.4,1.4]} sparkColor={Bx2.amber}/>
            <BStatCard label="REM ø" value="1.6" unit="h" sub="22% total" delta="+0.1" deltaColor={Bx2.green} spark={[1.3,1.5,1.7,1.5,1.9,1.7,1.6]} sparkColor={Bx2.rose}/>
          </div>

          {/* Sleep history bars */}
          <div style={{ padding:'14px 16px', background:Bx2.surface, border:`1px solid ${Bx2.border}`, borderRadius:6 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:14 }}>
              <span style={{ fontFamily:Bx2.mono, fontSize:10, color:Bx2.text3, letterSpacing:'.14em' }}>SLEEP STAGES · 14D</span>
              <div style={{ display:'flex', gap:14, fontFamily:Bx2.mono, fontSize:10 }}>
                <span><span style={{ color:'#5A4FCF' }}>■</span> <span style={{ color:Bx2.text2 }}>Tief</span></span>
                <span><span style={{ color:'#9B7DFF' }}>■</span> <span style={{ color:Bx2.text2 }}>REM</span></span>
                <span><span style={{ color:Bx2.blue }}>■</span> <span style={{ color:Bx2.text2 }}>Leicht</span></span>
                <span><span style={{ color:Bx2.text3 }}>■</span> <span style={{ color:Bx2.text2 }}>Wach</span></span>
              </div>
            </div>
            <BSleepBars/>
          </div>

          {/* Mental check-in */}
          <div style={{ display:'grid', gridTemplateColumns:'1.2fr 1fr', gap:12 }}>
            <BCheckinPanel accent={c}/>
            <BMentalTrend accent={c}/>
          </div>
        </div>
      </div>
    </BBase>
  );
}

function BSleepBars() {
  const days = [
    { d:'13.04', deep:1.0, rem:1.3, light:4.1, awake:.5 },
    { d:'14.04', deep:1.2, rem:1.5, light:4.0, awake:.4 },
    { d:'15.04', deep:1.5, rem:1.6, light:4.2, awake:.3 },
    { d:'16.04', deep:.9,  rem:1.2, light:3.8, awake:.6 },
    { d:'17.04', deep:1.3, rem:1.5, light:4.1, awake:.4 },
    { d:'18.04', deep:1.5, rem:1.7, light:4.3, awake:.3 },
    { d:'19.04', deep:1.4, rem:1.6, light:4.0, awake:.4 },
    { d:'20.04', deep:1.1, rem:1.4, light:4.2, awake:.4 },
    { d:'21.04', deep:1.3, rem:1.5, light:4.0, awake:.4 },
    { d:'22.04', deep:1.5, rem:1.7, light:4.3, awake:.3 },
    { d:'23.04', deep:1.1, rem:1.3, light:4.1, awake:.4 },
    { d:'24.04', deep:1.6, rem:1.9, light:4.3, awake:.3 },
    { d:'25.04', deep:1.4, rem:1.7, light:4.2, awake:.3 },
    { d:'26.04', deep:1.4, rem:1.7, light:4.2, awake:.3 },
  ];
  const max = 9;
  const cols = { deep:'#5A4FCF', rem:'#9B7DFF', light:Bx2.blue, awake:Bx2.text3 };
  return (
    <div>
      <div style={{ display:'grid', gridTemplateColumns:`repeat(${days.length}, 1fr)`, gap:4, alignItems:'flex-end', height:140 }}>
        {days.map(day => {
          const total = day.deep+day.rem+day.light+day.awake;
          const h = (total/max)*100;
          return (
            <div key={day.d} style={{ display:'flex', flexDirection:'column-reverse', height:'100%' }}>
              <div style={{ height:`${h}%`, display:'flex', flexDirection:'column-reverse', borderRadius:'2px 2px 0 0', overflow:'hidden' }}>
                <div style={{ height:`${(day.deep/total)*100}%`, background:cols.deep }}/>
                <div style={{ height:`${(day.rem/total)*100}%`, background:cols.rem }}/>
                <div style={{ height:`${(day.light/total)*100}%`, background:cols.light }}/>
                <div style={{ height:`${(day.awake/total)*100}%`, background:cols.awake }}/>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:`repeat(${days.length}, 1fr)`, gap:4, marginTop:6, fontFamily:Bx2.mono, fontSize:8.5, color:Bx2.text3, textAlign:'center' }}>
        {days.map(d => <span key={d.d}>{d.d}</span>)}
      </div>
    </div>
  );
}

function BCheckinPanel({ accent }) {
  const items = [
    { l:'Stimmung',   v:7, max:10, color:accent },
    { l:'Energie',    v:8, max:10, color:Bx2.green },
    { l:'Stress',     v:3, max:10, color:Bx2.amber, inverse:true },
    { l:'Motivation', v:8, max:10, color:Bx2.blue },
  ];
  return (
    <div style={{ padding:'14px 16px', background:Bx2.surface, border:`1px solid ${Bx2.border}`, borderRadius:6 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
        <span style={{ fontFamily:Bx2.mono, fontSize:10, color:Bx2.text3, letterSpacing:'.14em' }}>TODAY · CHECK-IN</span>
        <span style={{ fontFamily:Bx2.mono, fontSize:10, color:Bx2.green }}>● submitted</span>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        {items.map(it => (
          <div key={it.l}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:5 }}>
              <span style={{ fontSize:12, color:Bx2.text }}>{it.l}</span>
              <span style={{ fontFamily:Bx2.mono, fontSize:11, color:it.color }}>{it.v}/{it.max}</span>
            </div>
            <div style={{ display:'flex', gap:2 }}>
              {[...Array(it.max)].map((_,i)=>(
                <div key={i} style={{ flex:1, height:6, borderRadius:1, background: i<it.v ? it.color : Bx2.bg, border:`1px solid ${Bx2.border}` }}/>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop:12, padding:'10px 12px', background:Bx2.bg, border:`1px solid ${Bx2.border}`, borderRadius:4, fontSize:11.5, color:Bx2.text2, lineHeight:1.55 }}>
        <span style={{ color:Bx2.text3, fontFamily:Bx2.mono, fontSize:9, letterSpacing:'.14em', display:'block', marginBottom:4 }}>NOTE</span>
        Fokussiert nach Schlaf, Lust auf Schwelle.
      </div>
    </div>
  );
}

function BMentalTrend({ accent }) {
  // 14 day mood/energy lines
  const w=300, h=160, pad=10;
  const mood   = [6,5,7,7,6,8,7,7,6,8,7,8,7,7];
  const energy = [7,6,7,8,7,8,8,8,7,9,8,8,8,8];
  const stress = [4,5,3,3,5,3,2,3,4,2,3,3,3,3];
  const all = [...mood,...energy,...stress];
  const yMax=10, yMin=0;
  const xs = i => pad + (i/(mood.length-1))*(w-pad*2);
  const ys = v => h-pad - ((v-yMin)/(yMax-yMin))*(h-pad*2);
  const path = arr => arr.map((v,i)=>`${i===0?'M':'L'} ${xs(i)} ${ys(v)}`).join(' ');
  return (
    <div style={{ padding:'14px 16px', background:Bx2.surface, border:`1px solid ${Bx2.border}`, borderRadius:6 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:10 }}>
        <span style={{ fontFamily:Bx2.mono, fontSize:10, color:Bx2.text3, letterSpacing:'.14em' }}>MENTAL TREND · 14D</span>
        <div style={{ display:'flex', gap:10, fontFamily:Bx2.mono, fontSize:10 }}>
          <span><span style={{ color:accent }}>━</span> <span style={{ color:Bx2.text2 }}>Mood</span></span>
          <span><span style={{ color:Bx2.green }}>━</span> <span style={{ color:Bx2.text2 }}>Energy</span></span>
          <span><span style={{ color:Bx2.amber }}>━</span> <span style={{ color:Bx2.text2 }}>Stress</span></span>
        </div>
      </div>
      <svg width={w} height={h} style={{ display:'block', maxWidth:'100%' }}>
        {[2,4,6,8].map(t => (
          <line key={t} x1={pad} x2={w-pad} y1={ys(t)} y2={ys(t)} stroke={Bx2.border} strokeWidth={.5}/>
        ))}
        <path d={path(mood)}   fill="none" stroke={accent}   strokeWidth={1.6}/>
        <path d={path(energy)} fill="none" stroke={Bx2.green} strokeWidth={1.6}/>
        <path d={path(stress)} fill="none" stroke={Bx2.amber} strokeWidth={1.4} opacity={.85}/>
      </svg>
    </div>
  );
}

// ───── Activity Detail ─────────────────────────────────────────
function VariantB_Activity({ accent }) {
  const c = accent || Bx2.cyan;
  return (
    <BBase style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <BTopbar accent={c}/>
      <div style={{ display:'flex', flex:1, minHeight:0 }}>
        <BSide active="data" accent={c}/>
        <div style={{ flex:1, overflowY:'auto', padding:18, display:'flex', flexDirection:'column', gap:12 }}>
          <div style={{ display:'flex', alignItems:'baseline', gap:14 }}>
            <span style={{ fontFamily:Bx2.mono, fontSize:11, color:Bx2.text3, letterSpacing:'.14em' }}>← BACK</span>
            <div>
              <div style={{ fontSize:20, fontWeight:500 }}>Sa Long Run</div>
              <div style={{ fontFamily:Bx2.mono, fontSize:11, color:Bx2.text2 }}>24.04.2026 · 09:14 — 10:44 · 16.8 km · Z2-Z3 mixed</div>
            </div>
            <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
              <button style={{ fontFamily:Bx2.mono, fontSize:10, padding:'6px 10px', border:`1px solid ${Bx2.border}`, color:Bx2.text2, background:'transparent', borderRadius:3 }}>EXPORT</button>
              <button style={{ fontFamily:Bx2.mono, fontSize:10, padding:'6px 10px', border:`1px solid ${c}`, color:c, background:'transparent', borderRadius:3 }}>ASK COACH</button>
            </div>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(6, 1fr)', gap:12 }}>
            <BStatCard label="Duration" value="1:30:23" sub="moving" accent={c}/>
            <BStatCard label="Distance" value="16.8" unit="km" sub="ø 5:23/km"/>
            <BStatCard label="Avg HR" value="142" unit="bpm" sub="Z2 73%" accent={Bx2.amber}/>
            <BStatCard label="Avg Power" value="248" unit="W" sub="NP 264"/>
            <BStatCard label="Elev gain" value="184" unit="m" sub="ø 11m/km"/>
            <BStatCard label="TSS" value="92" sub="IF 0.78" accent={c}/>
          </div>

          {/* HR + Power chart */}
          <div style={{ padding:'14px 16px', background:Bx2.surface, border:`1px solid ${Bx2.border}`, borderRadius:6 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:10 }}>
              <span style={{ fontFamily:Bx2.mono, fontSize:10, color:Bx2.text3, letterSpacing:'.14em' }}>HR / POWER · TIME</span>
              <div style={{ display:'flex', gap:14, fontFamily:Bx2.mono, fontSize:10 }}>
                <span><span style={{ color:Bx2.rose }}>━</span> <span style={{ color:Bx2.text2 }}>HR bpm</span></span>
                <span><span style={{ color:c }}>━</span> <span style={{ color:Bx2.text2 }}>Power W</span></span>
              </div>
            </div>
            <BActivityChart accent={c}/>
          </div>

          {/* Splits + Zones */}
          <div style={{ display:'grid', gridTemplateColumns:'1.4fr 1fr', gap:12 }}>
            <BSplitsTable accent={c}/>
            <BZoneDistribution accent={c}/>
          </div>
        </div>
      </div>
    </BBase>
  );
}

function BActivityChart({ accent }) {
  const w=720, h=180, pad=12;
  // synthesized hr / power series, 90 points
  const N=90;
  const hr = Array.from({length:N}, (_,i) => {
    const t = i/N;
    const base = 140 + Math.sin(t*Math.PI*2)*5;
    const intervals = (i>20 && i<28) || (i>40 && i<48) || (i>60 && i<68) ? 25 : 0;
    return base + intervals + (Math.random()-.5)*3;
  });
  const pw = Array.from({length:N}, (_,i) => {
    const intervals = (i>20 && i<28) || (i>40 && i<48) || (i>60 && i<68) ? 80 : 0;
    return 230 + intervals + (Math.random()-.5)*15;
  });
  const yMaxHr=180, yMinHr=120;
  const yMaxPw=350, yMinPw=180;
  const xs = i => pad + (i/(N-1))*(w-pad*2);
  const ysHr = v => h-pad - ((v-yMinHr)/(yMaxHr-yMinHr))*(h-pad*2);
  const ysPw = v => h-pad - ((v-yMinPw)/(yMaxPw-yMinPw))*(h-pad*2);
  const pathHr = hr.map((v,i)=>`${i===0?'M':'L'} ${xs(i)} ${ysHr(v)}`).join(' ');
  const pathPw = pw.map((v,i)=>`${i===0?'M':'L'} ${xs(i)} ${ysPw(v)}`).join(' ');
  return (
    <svg width={w} height={h} style={{ display:'block', maxWidth:'100%' }}>
      {[140,150,160,170].map(t => (
        <line key={t} x1={pad} x2={w-pad} y1={ysHr(t)} y2={ysHr(t)} stroke={Bx2.border} strokeWidth={.5}/>
      ))}
      {/* interval shading */}
      {[[20,28],[40,48],[60,68]].map(([a,b],i)=>(
        <rect key={i} x={xs(a)} y={pad} width={xs(b)-xs(a)} height={h-pad*2} fill={accent} opacity={.06}/>
      ))}
      <path d={pathPw} fill="none" stroke={accent} strokeWidth={1.4} opacity={.9}/>
      <path d={pathHr} fill="none" stroke={Bx2.rose} strokeWidth={1.4}/>
    </svg>
  );
}

function BSplitsTable({ accent }) {
  const splits = [
    { km:1, pace:'5:32', hr:128, pw:228, gain:8 },
    { km:2, pace:'5:24', hr:138, pw:240, gain:12 },
    { km:3, pace:'5:18', hr:142, pw:248, gain:10 },
    { km:4, pace:'5:08', hr:155, pw:282, gain:6 },
    { km:5, pace:'5:11', hr:158, pw:286, gain:9 },
    { km:6, pace:'5:23', hr:148, pw:252, gain:14 },
    { km:7, pace:'5:30', hr:144, pw:244, gain:8 },
    { km:8, pace:'5:21', hr:146, pw:250, gain:11 },
  ];
  return (
    <div style={{ padding:'14px 16px', background:Bx2.surface, border:`1px solid ${Bx2.border}`, borderRadius:6 }}>
      <div style={{ fontFamily:Bx2.mono, fontSize:10, color:Bx2.text3, letterSpacing:'.14em', marginBottom:10 }}>SPLITS</div>
      <div style={{ display:'grid', gridTemplateColumns:'40px 70px 60px 1fr 60px 60px', fontFamily:Bx2.mono, fontSize:11 }}>
        {['km','pace','hr','','pw','+m'].map((h,i) => (
          <div key={i} style={{ padding:'4px 4px', color:Bx2.text3, fontSize:9, letterSpacing:'.14em', borderBottom:`1px solid ${Bx2.border}` }}>{h.toUpperCase()}</div>
        ))}
        {splits.map(s => {
          const isBest = s.pace==='5:08';
          const paceFrac = (parseInt(s.pace.split(':')[0])*60+parseInt(s.pace.split(':')[1]))/360; // ~5:00-5:30
          return (
            <React.Fragment key={s.km}>
              <div style={{ padding:'8px 4px', borderBottom:`1px solid ${Bx2.border}`, color:Bx2.text2 }}>{s.km}</div>
              <div style={{ padding:'8px 4px', borderBottom:`1px solid ${Bx2.border}`, color: isBest?accent:Bx2.text }}>{s.pace}</div>
              <div style={{ padding:'8px 4px', borderBottom:`1px solid ${Bx2.border}`, color:Bx2.text2 }}>{s.hr}</div>
              <div style={{ padding:'8px 4px', borderBottom:`1px solid ${Bx2.border}` }}>
                <div style={{ width:`${(1-paceFrac)*100}%`, height:5, background:accent, opacity:.6, borderRadius:1 }}/>
              </div>
              <div style={{ padding:'8px 4px', borderBottom:`1px solid ${Bx2.border}`, color:Bx2.text2 }}>{s.pw}</div>
              <div style={{ padding:'8px 4px', borderBottom:`1px solid ${Bx2.border}`, color:Bx2.text3 }}>{s.gain}</div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

function BZoneDistribution({ accent }) {
  const zones = [
    { z:1, label:'Recovery', pct:8,  c:'#3F4854' },
    { z:2, label:'Endurance', pct:46, c:Bx2.blue },
    { z:3, label:'Tempo',    pct:28, c:Bx2.green },
    { z:4, label:'Threshold', pct:14, c:accent },
    { z:5, label:'VO2',       pct:4,  c:Bx2.rose },
  ];
  return (
    <div style={{ padding:'14px 16px', background:Bx2.surface, border:`1px solid ${Bx2.border}`, borderRadius:6 }}>
      <div style={{ fontFamily:Bx2.mono, fontSize:10, color:Bx2.text3, letterSpacing:'.14em', marginBottom:10 }}>HR ZONE DISTRIBUTION</div>
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {zones.map(z => (
          <div key={z.z} style={{ display:'grid', gridTemplateColumns:'24px 90px 1fr 40px', alignItems:'center', gap:8, fontFamily:Bx2.mono, fontSize:11 }}>
            <span style={{ color:z.c }}>Z{z.z}</span>
            <span style={{ color:Bx2.text2, fontFamily:Bx2.sans, fontSize:11.5 }}>{z.label}</span>
            <div style={{ height:8, background:Bx2.bg, border:`1px solid ${Bx2.border}` }}>
              <div style={{ width:`${z.pct}%`, height:'100%', background:z.c }}/>
            </div>
            <span style={{ textAlign:'right', color:Bx2.text }}>{z.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ───── Wochen-Review (full layout) ─────────────────────────────
function VariantB_Review({ accent }) {
  const c = accent || Bx2.cyan;
  return (
    <BBase style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <BTopbar accent={c}/>
      <div style={{ display:'flex', flex:1, minHeight:0 }}>
        <BSide active="plan" accent={c}/>
        <div style={{ flex:1, overflowY:'auto', padding:18, display:'flex', flexDirection:'column', gap:12 }}>
          <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between' }}>
            <div>
              <div style={{ fontFamily:Bx2.mono, fontSize:10, color:Bx2.text3, letterSpacing:'.18em' }}>WEEKLY REVIEW · KW17</div>
              <div style={{ fontSize:22, fontWeight:500, marginTop:4 }}>20.04 — 26.04.2026</div>
              <div style={{ fontFamily:Bx2.mono, fontSize:11, color:Bx2.text2, marginTop:2 }}>generated by coach · 14:42</div>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button style={{ fontFamily:Bx2.mono, fontSize:10, padding:'6px 10px', border:`1px solid ${Bx2.border}`, color:Bx2.text2, background:'transparent', borderRadius:3 }}>← KW16</button>
              <button style={{ fontFamily:Bx2.mono, fontSize:10, padding:'6px 10px', border:`1px solid ${c}`, color:c, background:'transparent', borderRadius:3 }}>REGENERATE</button>
            </div>
          </div>

          {/* Top KPI strip */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(6, 1fr)', gap:12 }}>
            <BStatCard label="Workouts" value="4" unit="/5" delta="planned" deltaColor={Bx2.text3} accent={c}/>
            <BStatCard label="Total TSS" value="268" delta="+22" deltaColor={Bx2.green} spark={[42,0,82,38,28,0,92]} sparkColor={c}/>
            <BStatCard label="Distance" value="48.6" unit="km" delta="+6km" deltaColor={Bx2.green}/>
            <BStatCard label="Δ CTL" value="+1.4" delta="building" deltaColor={Bx2.green} accent={Bx2.green}/>
            <BStatCard label="Avg HRV" value="56" unit="ms" delta="+3" deltaColor={Bx2.green}/>
            <BStatCard label="Avg sleep" value="7.5" unit="h" delta="+0.3" deltaColor={Bx2.green}/>
          </div>

          {/* Narrative + insights two-col */}
          <div style={{ display:'grid', gridTemplateColumns:'1.4fr 1fr', gap:12 }}>
            <div style={{ padding:'18px 20px', background:Bx2.surface, border:`1px solid ${Bx2.border}`, borderRadius:6 }}>
              <div style={{ fontFamily:Bx2.mono, fontSize:10, color:Bx2.text3, letterSpacing:'.14em', marginBottom:14 }}>NARRATIVE</div>
              <div style={{ fontSize:14, lineHeight:1.6, color:Bx2.text }}>
                Solide Aufbauwoche. Du hast 4 von 5 geplanten Einheiten absolviert, einen Long Run mit gutem Pacing und drei kürzere Z2-Läufe. CTL stieg um 1.4 Punkte — du baust Form auf, ohne zu überpacen.
                <br/><br/>
                <span style={{ color:Bx2.text2 }}>Engste Phase war Freitag (TSB −9), nach Donnerstag's Krafteinheit. Du hast korrekt reagiert und Samstag etwas zurückgehalten — gutes Bauchgefühl.</span>
                <br/><br/>
                HRV-Trend zeigt klare Erholung über die Woche (+3 ms). Schlafqualität war konsistent über 7.5h. Mental check-ins waren stabil, mit einem energiegeladenen Wochenende.
                <br/><br/>
                <span style={{ color:c }}>→ Empfehlung KW18:</span> Eine Quality-Einheit mehr (Schwelle), Mittwoch wieder Intervalle, Sonntag Rest.
              </div>
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div style={{ padding:'14px 16px', background:Bx2.surface, border:`1px solid ${Bx2.border}`, borderRadius:6 }}>
                <div style={{ fontFamily:Bx2.mono, fontSize:10, color:Bx2.text3, letterSpacing:'.14em', marginBottom:10 }}>WINS</div>
                <div style={{ display:'flex', flexDirection:'column', gap:8, fontSize:12 }}>
                  <div style={{ display:'flex', gap:8 }}><span style={{ color:Bx2.green }}>+</span><span>Long Run mit konstantem Pacing (kein drift &gt;3%)</span></div>
                  <div style={{ display:'flex', gap:8 }}><span style={{ color:Bx2.green }}>+</span><span>HRV stabil bei 56ms Ø, Trend positiv</span></div>
                  <div style={{ display:'flex', gap:8 }}><span style={{ color:Bx2.green }}>+</span><span>Schlafhygiene-Goal +12% Fortschritt</span></div>
                </div>
              </div>
              <div style={{ padding:'14px 16px', background:Bx2.surface, border:`1px solid ${Bx2.border}`, borderRadius:6 }}>
                <div style={{ fontFamily:Bx2.mono, fontSize:10, color:Bx2.text3, letterSpacing:'.14em', marginBottom:10 }}>WATCH</div>
                <div style={{ display:'flex', flexDirection:'column', gap:8, fontSize:12 }}>
                  <div style={{ display:'flex', gap:8 }}><span style={{ color:Bx2.amber }}>!</span><span>Hydration unter Soll am Donnerstag (53% target)</span></div>
                  <div style={{ display:'flex', gap:8 }}><span style={{ color:Bx2.amber }}>!</span><span>Stress-Score 5/10 am Mi — Trigger erkennen</span></div>
                </div>
              </div>
            </div>
          </div>

          {/* Daily log */}
          <div style={{ padding:'14px 16px', background:Bx2.surface, border:`1px solid ${Bx2.border}`, borderRadius:6 }}>
            <div style={{ fontFamily:Bx2.mono, fontSize:10, color:Bx2.text3, letterSpacing:'.14em', marginBottom:10 }}>DAILY LOG</div>
            <BDailyLog accent={c}/>
          </div>
        </div>
      </div>
    </BBase>
  );
}

function BDailyLog({ accent }) {
  const days = [
    { d:'Mo', date:'20.04', sleep:7.2, hrv:54, tss:42, mood:6,  workout:'Z2 50min' },
    { d:'Di', date:'21.04', sleep:7.6, hrv:55, tss:0,  mood:7,  workout:'Rest' },
    { d:'Mi', date:'22.04', sleep:7.8, hrv:56, tss:82, mood:7,  workout:'Intervalle' },
    { d:'Do', date:'23.04', sleep:6.9, hrv:51, tss:38, mood:5,  workout:'Krafttraining' },
    { d:'Fr', date:'24.04', sleep:7.2, hrv:53, tss:28, mood:6,  workout:'Recovery 30\'' },
    { d:'Sa', date:'25.04', sleep:8.1, hrv:58, tss:92, mood:8,  workout:'Long Run 17km' },
    { d:'So', date:'26.04', sleep:7.6, hrv:58, tss:0,  mood:7,  workout:'Rest' },
  ];
  return (
    <div style={{ display:'grid', gridTemplateColumns:'40px 70px 60px 50px 50px 50px 1fr', fontFamily:Bx2.mono, fontSize:11 }}>
      {['','date','sleep','hrv','tss','mood','workout'].map((h,i)=>(
        <div key={i} style={{ padding:'4px 4px', color:Bx2.text3, fontSize:9, letterSpacing:'.14em', borderBottom:`1px solid ${Bx2.border}` }}>{h.toUpperCase()}</div>
      ))}
      {days.map(d => (
        <React.Fragment key={d.d}>
          <div style={{ padding:'9px 4px', borderBottom:`1px solid ${Bx2.border}`, color:Bx2.text }}>{d.d}</div>
          <div style={{ padding:'9px 4px', borderBottom:`1px solid ${Bx2.border}`, color:Bx2.text2 }}>{d.date}</div>
          <div style={{ padding:'9px 4px', borderBottom:`1px solid ${Bx2.border}`, color:Bx2.text2 }}>{d.sleep}h</div>
          <div style={{ padding:'9px 4px', borderBottom:`1px solid ${Bx2.border}`, color:Bx2.text2 }}>{d.hrv}</div>
          <div style={{ padding:'9px 4px', borderBottom:`1px solid ${Bx2.border}`, color: d.tss>50?accent:Bx2.text2 }}>{d.tss||'—'}</div>
          <div style={{ padding:'9px 4px', borderBottom:`1px solid ${Bx2.border}`, color: d.mood>=7?Bx2.green:d.mood>=5?Bx2.amber:Bx2.rose }}>{d.mood}</div>
          <div style={{ padding:'9px 4px', borderBottom:`1px solid ${Bx2.border}`, color:Bx2.text, fontFamily:Bx2.sans, fontSize:11.5 }}>{d.workout}</div>
        </React.Fragment>
      ))}
    </div>
  );
}

window.VariantB_Data = VariantB_Data;
window.VariantB_Activity = VariantB_Activity;
window.VariantB_Review = VariantB_Review;
