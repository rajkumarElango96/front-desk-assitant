import { useState } from "react";
import { createPatient } from "@/api/index";

function toE164(raw) {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10)                           return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length > 0)                              return `+${digits}`;
  return "";
}

function formatPhoneDisplay(raw) {
  const d = raw.replace(/\D/g, "").slice(0, 10);
  if (d.length === 0) return "";
  if (d.length <= 3)  return `(${d}`;
  if (d.length <= 6)  return `(${d.slice(0,3)}) ${d.slice(3)}`;
  return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`;
}

export function IntakeCard({ onSubmit }) {
  const [mode,    setMode]    = useState("new");       // "new" | "returning"
  const [form,    setForm]    = useState({ name:"", dob:"", email:"", phone:"", smsOptIn:false });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const set = (key) => (e) =>
    setForm(f => ({ ...f, [key]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const handlePhoneChange = (e) => {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
    setForm(f => ({ ...f, phone: digits }));
  };

  const phoneE164  = toE164(form.phone);
  const phoneValid = phoneE164.length >= 10;

  const validNew       = !!form.name.trim() && !!form.dob && !!form.email.trim() && phoneValid;
  const validReturning = !!form.email.trim();
  const valid          = mode === "new" ? validNew : validReturning;

  const handleSubmit = async () => {
    if (!valid) return;
    setLoading(true);
    setError(null);
    try {
      const [firstName, ...rest] = form.name.trim().split(" ");
      const lastName = rest.join(" ") || firstName;

      const payload = mode === "returning"
        ? { email: form.email }
        : { firstName, lastName, dob: form.dob, email: form.email, phone: phoneE164 };

      const patient = await createPatient(payload);

      onSubmit({
        ...form,
        patientId: patient.patientId,
        firstName:  patient.firstName,
        lastName:   patient.lastName,
        phone:      patient.phone || phoneE164,
        returning:  patient.returning,
      });
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const Label = ({ children }) => (
    <label style={{ fontSize:10,color:"#94a3b8",fontWeight:700,letterSpacing:".06em",display:"block",marginBottom:6 }}>
      {children}
    </label>
  );

  return (
    <div className="slide-down" style={{ background:"#ffffff",borderRadius:20,padding:"28px 26px" }}>

      {/* Header */}
      <div style={{ display:"flex",alignItems:"center",gap:14,marginBottom:22 }}>
        <div style={{ width:46,height:46,borderRadius:"50%",background:"#1e3a8a",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:800,color:"#fff",flexShrink:0 }}>
          A
        </div>
        <div>
          <div style={{ fontSize:17,fontWeight:800,color:"#1e293b",letterSpacing:"-.2px" }}>Welcome to Amara</div>
          <div style={{ fontSize:12,color:"#64748b",marginTop:3 }}>Please share a few details so we can assist you</div>
        </div>
      </div>

      {/* Mode toggle */}
      <div style={{ display:"flex",gap:8,marginBottom:20,background:"#f1f5f9",borderRadius:12,padding:4 }}>
        {["new", "returning"].map((m) => (
          <button
            key={m}
            onClick={() => { setMode(m); setError(null); }}
            style={{
              flex:1,
              padding:"8px",
              borderRadius:9,
              border:"none",
              fontSize:12,
              fontWeight:600,
              cursor:"pointer",
              background: mode === m ? "#1e3a8a" : "transparent",
              color:      mode === m ? "#fff" : "#64748b",
            }}
          >
            {m === "new" ? "New Patient" : "Returning Patient"}
          </button>
        ))}
      </div>

      <div style={{ display:"flex",flexDirection:"column",gap:14 }}>

        {/* New patient fields */}
        {mode === "new" && (
          <>
            <div>
              <Label>FULL NAME</Label>
              <input className="app-input" style={{ borderRadius:12,padding:"10px 14px",fontSize:13 }} placeholder="Raj Kumar" value={form.name} onChange={set("name")} />
            </div>

            <div style={{ display:"flex",gap:12 }}>
              <div style={{ flex:1 }}>
                <Label>DATE OF BIRTH</Label>
                <input type="date" className="app-input" style={{ borderRadius:12,padding:"10px 14px",fontSize:13 }} value={form.dob} onChange={set("dob")} />
              </div>
              <div style={{ flex:1 }}>
                <Label>EMAIL</Label>
                <input type="email" className="app-input" style={{ borderRadius:12,padding:"10px 14px",fontSize:13 }} placeholder="you@email.com" value={form.email} onChange={set("email")} />
              </div>
            </div>

            <div>
              <Label>PHONE NUMBER</Label>
              <input
                type="tel"
                className="app-input"
                style={{ borderRadius:12,padding:"10px 14px",fontSize:13 }}
                placeholder="(415) 555-0192"
                value={formatPhoneDisplay(form.phone)}
                onChange={handlePhoneChange}
              />
              {form.phone.length > 0 && (
                <div style={{ fontSize:10,color:phoneValid?"#059669":"#94a3b8",marginTop:4,paddingLeft:2 }}>
                  {phoneValid ? `✓ ${phoneE164}` : "Enter a 10-digit US number"}
                </div>
              )}
            </div>

            <div style={{ border:"1px solid #e2e8f0",borderRadius:14,padding:"13px 14px" }}>
              <label style={{ display:"flex",alignItems:"flex-start",gap:12,cursor:"pointer" }}>
                <input type="checkbox" className="custom-check" style={{ marginTop:1 }} checked={form.smsOptIn} onChange={set("smsOptIn")} />
                <div>
                  <div style={{ fontSize:13,color:"#1e293b",fontWeight:600 }}>Receive SMS notifications</div>
                  <div style={{ fontSize:11,color:"#64748b",marginTop:3,lineHeight:1.5 }}>
                    Get appointment reminders and updates via text.
                  </div>
                </div>
              </label>
            </div>
          </>
        )}

        {/* Returning patient — email only */}
        {mode === "returning" && (
          <div>
            <Label>EMAIL ADDRESS</Label>
            <input
              type="email"
              className="app-input"
              style={{ borderRadius:12,padding:"10px 14px",fontSize:13 }}
              placeholder="you@email.com"
              value={form.email}
              onChange={set("email")}
              autoFocus
            />
            <div style={{ fontSize:11,color:"#94a3b8",marginTop:6,paddingLeft:2 }}>
              We'll look up your account by email.
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ fontSize:12,color:"#dc2626",padding:"8px 12px",borderRadius:8,background:"#fef2f2",border:"1px solid #fecaca" }}>
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          className="btn-primary"
          disabled={!valid || loading}
          onClick={handleSubmit}
          style={{ width:"100%",padding:"13px",borderRadius:14,fontSize:14 }}
        >
          {loading
            ? "Loading…"
            : mode === "returning" ? "Find My Account →" : "Start Chat →"
          }
        </button>

        <div style={{ fontSize:10,color:"#94a3b8",textAlign:"center" }}>
          🔒 HIPAA-compliant · Your data is encrypted and never sold
        </div>
      </div>
    </div>
  );
}
