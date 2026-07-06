import { AmaraAvatar } from "@/components/shared/Avatars";

export function TypingIndicator() {
  return (
    <div className="fade-up" style={{ display:"flex",alignItems:"flex-start",gap:10,maxWidth:"70%" }}>
      <AmaraAvatar />
      <div style={{ background:"#ffffff",borderRadius:"16px 16px 16px 4px",padding:"12px 16px",display:"flex",gap:6,alignItems:"center" }}>
        <div className="tdot" />
        <div className="tdot" />
        <div className="tdot" />
      </div>
    </div>
  );
}
