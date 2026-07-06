import { useEffect, useRef, useState } from "react";
import { sendChatMessage } from "@/api/index";
import { MessageBubble }   from "./MessageBubble";
import { TypingIndicator } from "./TypingIndicator";
import { PatientAvatar }   from "@/components/shared/Avatars";

// Colour per specialty — used as the dot accent in SlotPicker
const SPECIALTY_COLORS = {
  CARDIOLOGY:   "#ef4444",
  ORTHOPEDICS:  "#f97316",
  DERMATOLOGY:  "#a855f7",
  NEUROLOGY:    "#06b6d4",
  GENERAL:      "#22c55e",
};

/**
 * groupSlotsByProvider
 * Transforms raw slotsData from the API into the shape SlotPicker expects.
 * Groups by providerId so each provider gets their own card grid.
 */
function groupSlotsByProvider(slotsData) {
  if (!slotsData?.slots?.length) return [];

  const grouped = {};

  for (const slot of slotsData.slots) {
    const pid = slot.provider.providerId;
    if (!grouped[pid]) {
      grouped[pid] = {
        providerId: pid,
        name:       `Dr. ${slot.provider.providerFirstName} ${slot.provider.providerLastName}`,
        specialty:  slot.provider.specialty,
        color:      SPECIALTY_COLORS[slot.provider.specialty] ?? "#2563eb",
        slots:      [],
      };
    }

    // Format date: "Mon Apr 20" — use UTC to avoid timezone shift on date-only fields
    const date = new Date(slot.slotDate).toLocaleDateString("en-US", {
      weekday: "short", month: "short", day: "numeric", timeZone: "UTC",
    });

    // Format time: "9:00 AM" — slotStartTime is stored as a Time type (1970 epoch)
    const time = new Date(slot.slotStartTime).toLocaleTimeString("en-US", {
      hour: "numeric", minute: "2-digit", timeZone: "UTC",
    });

    grouped[pid].slots.push({
      id:         slot.slotId,
      slotId:     slot.slotId,
      providerId: pid,
      date,
      time,
      rawDate:    slot.slotDate,
    });
  }

  return Object.values(grouped);
}

export function ChatScreen({ patient }) {
  const [messages,            setMessages]            = useState([]);
  const [input,               setInput]               = useState("");
  const [typing,              setTyping]              = useState(false);
  const [conversationHistory, setConversationHistory] = useState([]);
  const [selectedSlot,        setSelectedSlot]        = useState(null);

  const msgsRef    = useRef(null);
  const inputRef   = useRef(null);
  const greetedRef = useRef(false); // guards against React StrictMode double-invoke

  const now = () => new Date().toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" });

  const addMsg = (msg) =>
    setMessages(ms => [...ms, { id: Math.random().toString(36).substring(2) + Date.now().toString(36), time: now(), ...msg }]);

  /* ── Greeting on mount — ref guard prevents StrictMode double-fire ── */
  useEffect(() => {
    if (greetedRef.current) return;
    greetedRef.current = true;
    setTimeout(() => {
      addMsg({
        role: "ai",
        type: "text",
        text: `Hi ${patient.firstName}! I'm Amara, your assistant. I can help you schedule an appointment, check on a prescription, or find our office info. What can I help you with today?`,
      });
    }, 600);
  }, []);

  useEffect(() => {
    if (msgsRef.current) {
      msgsRef.current.scrollTop = msgsRef.current.scrollHeight;
    }
  }, [messages, typing]);

  /* ── Send message to AI backend ── */
  const handleSend = async (override) => {
    const msg = (override ?? input).trim();
    if (!msg) return;
    setInput("");
    addMsg({ role:"user", type:"text", text: msg });
    setTyping(true);

    try {
      const res = await sendChatMessage({
        patientId:           patient.patientId,
        message:             msg,
        conversationHistory,
      });

      setConversationHistory(res.conversationHistory);
      setTyping(false);

      // If the AI called find_available_slots, render slot cards alongside the text reply
      if (res.slotsData?.available) {
        const doctors = groupSlotsByProvider(res.slotsData);
        addMsg({ role:"ai", type:"slots", text: res.reply, doctors });
      } else {
        addMsg({ role:"ai", type:"text", text: res.reply });
      }
    } catch (err) {
      setTyping(false);
      addMsg({ role:"ai", type:"text", text:"Sorry, I'm having trouble connecting right now. Please try again in a moment." });
    }
  };

  /* ── Slot selected — auto-send booking intent to Amara ── */
  const handleSlotSelect = (slot, doctor) => {
    setSelectedSlot(slot);
    handleSend(`Book the ${slot.date} at ${slot.time} slot with Dr. ${doctor.name.replace("Dr. ", "")}`);
  };

  return (
    <div style={{ height:"100vh",display:"flex",flexDirection:"column",overflow:"hidden",background:"#2563eb" }}>

      {/* ── Header ── */}
      <div style={{ padding:"12px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0,borderBottom:"1px solid rgba(255,255,255,.15)" }}>
        <div style={{ display:"flex",alignItems:"center",gap:12 }}>
          <div style={{ width:36,height:36,borderRadius:"50%",background:"#ffffff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:800,color:"#1e3a8a" }}>A</div>
          <div>
            <div style={{ fontSize:15,fontWeight:800,color:"#ffffff",letterSpacing:"-.2px" }}>Amara</div>
            <div style={{ fontSize:11,color:"rgba(255,255,255,.75)",display:"flex",alignItems:"center",gap:5 }}>
              <span style={{ width:6,height:6,borderRadius:"50%",background:"#34d399",display:"inline-block" }}/>
              AI Front Desk Assistant
            </div>
          </div>
        </div>
        {/* Patient pill */}
        <div style={{ padding:"7px 14px",borderRadius:40,background:"rgba(255,255,255,.15)",display:"flex",alignItems:"center",gap:10 }}>
          <PatientAvatar initials={patient.initials}/>
          <div>
            <div style={{ fontSize:13,fontWeight:700,color:"#ffffff" }}>{patient.name}</div>
            <div style={{ fontSize:10,color:"rgba(255,255,255,.7)" }}>DOB: {patient.dob}</div>
          </div>
        </div>
      </div>

      {/* ── Action buttons — visible until the user sends their first message ── */}
      {messages.length <= 1 && !typing && (
        <div className="fade-in" style={{ padding:"10px 24px 6px",display:"flex",gap:8,flexWrap:"wrap",flexShrink:0 }}>
          {[
            { label:"Schedule Appointment", msg:"I'd like to schedule an appointment" },
            { label:"My Prescriptions",     msg:"Show me my prescriptions"            },
            { label:"My Appointments",      msg:"Show me my upcoming appointments"    },
            { label:"Office Info",          msg:"What are your office hours and location?" },
          ].map(({ label, msg }) => (
            <button key={label} className="chip" onClick={() => handleSend(msg)} style={{ padding:"8px 16px",fontSize:12,fontWeight:600 }}>
              {label}
            </button>
          ))}
        </div>
      )}

      {/* ── Messages ── */}
      <div ref={msgsRef} className="msgs" style={{ flex:1,minHeight:0,overflowY:"auto",padding:"12px 24px 0",display:"flex",flexDirection:"column",gap:16 }}>
        {messages.map(msg => (
          <MessageBubble
            key={msg.id} msg={msg} patient={patient}
            selectedSlot={selectedSlot}
            onSlotSelect={handleSlotSelect}
          />
        ))}
        {typing && <TypingIndicator />}
        <div style={{ height:24 }}/>
      </div>

      {/* ── Input bar ── */}
      <div style={{ padding:"14px 20px",display:"flex",gap:10,alignItems:"center",flexShrink:0,borderTop:"1px solid rgba(255,255,255,.15)" }}>
        <input
          ref={inputRef}
          className="app-input"
          style={{ flex:1,borderRadius:22,padding:"12px 18px",fontSize:13 }}
          placeholder="Ask about appointments, prescriptions, office hours…"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !typing && handleSend()}
        />
        <button className="btn-primary" onClick={() => handleSend()} disabled={!input.trim() || typing} style={{ width:44,height:44,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:18 }}>
          ↑
        </button>
      </div>

    </div>
  );
}
