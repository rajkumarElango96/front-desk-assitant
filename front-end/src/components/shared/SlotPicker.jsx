export function SlotPicker({ doctor, selected, onSelect }) {
  return (
    <div className="fade-up" style={{ marginTop:12 }}>
      <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:10 }}>
        <div style={{ width:6,height:6,borderRadius:"50%",background:doctor.color }}/>
        <span style={{ fontSize:11,color:"rgba(255,255,255,.75)",fontWeight:600,textTransform:"uppercase",letterSpacing:".05em" }}>
          {doctor.name} · {doctor.specialty}
        </span>
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8 }}>
        {doctor.slots.map(slot => {
          const picked = selected?.id === slot.id;
          return (
            <div
              key={slot.id}
              className={`slot-card ${picked ? "picked" : ""}`}
              style={{ padding:"11px 14px" }}
              onClick={() => onSelect(slot, doctor)}
            >
              <div style={{ fontSize:12,fontWeight:700,color:picked?"#ffffff":"#1e293b" }}>{slot.date}</div>
              <div style={{ fontSize:13,color:picked?"rgba(255,255,255,.8)":"#64748b",marginTop:3 }}>{slot.time}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
