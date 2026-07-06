export function AmaraAvatar() {
  return (
    <div style={{ width:32,height:32,borderRadius:"50%",flexShrink:0,background:"#1e3a8a",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:"#fff" }}>
      A
    </div>
  );
}

export function PatientAvatar({ initials = "?" }) {
  return (
    <div style={{ width:32,height:32,borderRadius:"50%",flexShrink:0,background:"rgba(255,255,255,.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:"#ffffff" }}>
      {initials}
    </div>
  );
}
