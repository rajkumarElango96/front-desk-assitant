import { AmaraAvatar, PatientAvatar } from "@/components/shared/Avatars";
import { SlotPicker } from "@/components/shared/SlotPicker";

export function MessageBubble({ msg, patient, selectedSlot, onSlotSelect }) {
  const isAI = msg.role === "ai";

  return (
    <div
      style={{ display:"flex",flexDirection:isAI?"row":"row-reverse",alignItems:"flex-start",gap:10,maxWidth:"82%",marginLeft:isAI?0:"auto" }}
    >
      {isAI ? <AmaraAvatar /> : <PatientAvatar initials={patient.initials} />}

      <div style={{ flex:1,minWidth:0 }}>
        {/* Text bubble */}
        {msg.text && (
          <div style={{
            background:   isAI ? "#ffffff" : "#1e3a8a",
            color:        isAI ? "#1e293b" : "#ffffff",
            borderRadius: isAI ? "16px 16px 16px 4px" : "16px 16px 4px 16px",
            padding:      "10px 14px",
            fontSize:     13,
            lineHeight:   1.6,
          }}>
            {msg.text}
          </div>
        )}

        {/* Slot cards — one SlotPicker per provider, rendered from real API data */}
        {msg.type === "slots" && msg.doctors?.length > 0 && (
          <div style={{ display:"flex",flexDirection:"column",gap:12,marginTop:msg.text ? 10 : 0 }}>
            {msg.doctors.map((doctor) => (
              <SlotPicker
                key={doctor.providerId}
                doctor={doctor}
                selected={selectedSlot}
                onSelect={onSlotSelect}
              />
            ))}
          </div>
        )}

        {/* Timestamp */}
        <div style={{ fontSize:10,color:"rgba(255,255,255,.6)",marginTop:4,textAlign:isAI?"left":"right" }}>
          {msg.time}
        </div>
      </div>
    </div>
  );
}
