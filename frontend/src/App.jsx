import { useState, useRef } from "react";

const BACKEND = "http://localhost:5000";

const INITIAL_CANDIDATES = [
  { id: 1, name: "Rahul Sharma", email: "rahul@gmail.com", skills: ["React", "Node.js", "MongoDB"], experience: 2, bio: "Full-stack developer with 2 years building scalable web apps.", createdAt: new Date().toISOString() },
  { id: 2, name: "Priya Singh", email: "priya@gmail.com", skills: ["React", "Node.js", "AWS", "TypeScript"], experience: 3, bio: "Senior dev with cloud expertise and strong frontend skills.", createdAt: new Date().toISOString() },
  { id: 3, name: "Ankit Verma", email: "ankit@gmail.com", skills: ["HTML", "CSS", "JavaScript"], experience: 1, bio: "Junior frontend developer focused on UI/UX.", createdAt: new Date().toISOString() },
  { id: 4, name: "Neha Gupta", email: "neha@gmail.com", skills: ["Python", "Django", "PostgreSQL", "React"], experience: 4, bio: "Backend specialist with full-stack experience.", createdAt: new Date().toISOString() },
  { id: 5, name: "Arjun Mehta", email: "arjun@gmail.com", skills: ["Node.js", "Express", "MongoDB", "Docker"], experience: 3, bio: "Backend engineer passionate about DevOps and microservices.", createdAt: new Date().toISOString() },
];

const SKILL_SUGGESTIONS = ["React", "Node.js", "MongoDB", "AWS", "TypeScript", "Python", "Django", "PostgreSQL", "Docker", "Express", "HTML", "CSS", "JavaScript", "GraphQL", "Redis", "Kubernetes"];

const TABS = ["Dashboard", "Add Candidate", "Candidates", "Shortlist", "AI Analysis", "Saved"];

export default function App() {
  const [tab, setTab] = useState("Dashboard");
  const [candidates, setCandidates] = useState(INITIAL_CANDIDATES);
  const [saved, setSaved] = useState([]);
  const [shortlisted, setShortlisted] = useState([]);
  const [aiResults, setAiResults] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const [interviewQs, setInterviewQs] = useState({});
  const [search, setSearch] = useState("");
  const [jobReq, setJobReq] = useState({ requiredSkills: [], preferredSkills: [], minExperience: 1 });
  const [reqSkillInput, setReqSkillInput] = useState("");
  const [prefSkillInput, setPrefSkillInput] = useState("");
  const [candidateForm, setCandidateForm] = useState({ name: "", email: "", skills: [], experience: "", bio: "" });
  const [formSkillInput, setFormSkillInput] = useState("");
  const nextId = useRef(INITIAL_CANDIDATES.length + 1);

  // ── Notification ────────────────────────────────────
  const notify = (msg, type = "success") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // ── Candidate: Add via backend ───────────────────────
  const addCandidate = async () => {
    if (!candidateForm.name || !candidateForm.email || candidateForm.skills.length === 0) {
      notify("Please fill all required fields", "error"); return;
    }
    try {
      const res = await fetch(`${BACKEND}/api/candidates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...candidateForm, experience: Number(candidateForm.experience) || 0 })
      });
      const data = await res.json();
      setCandidates(prev => [{ ...data, id: data._id || nextId.current++ }, ...prev]);
      setCandidateForm({ name: "", email: "", skills: [], experience: "", bio: "" });
      notify("Candidate added successfully!");
      setTab("Candidates");
    } catch (e) {
      notify("Error adding candidate: " + e.message, "error");
    }
  };

  // ── Candidate: Delete ────────────────────────────────
  const deleteCandidate = async (id) => {
    try {
      await fetch(`${BACKEND}/api/candidates/${id}`, { method: "DELETE" });
    } catch (_) {}
    setCandidates(prev => prev.filter(c => c.id !== id && c._id !== id));
    notify("Candidate removed");
  };

  // ── Skill tag helper ─────────────────────────────────
  const addSkillToForm = (skill, field, setField, formKey) => {
    const s = skill.trim();
    if (!s) return;
    if (formKey === "job") {
      if (field === "req" && !jobReq.requiredSkills.includes(s))
        setJobReq(p => ({ ...p, requiredSkills: [...p.requiredSkills, s] }));
      if (field === "pref" && !jobReq.preferredSkills.includes(s))
        setJobReq(p => ({ ...p, preferredSkills: [...p.preferredSkills, s] }));
    } else {
      if (!candidateForm.skills.includes(s))
        setCandidateForm(p => ({ ...p, skills: [...p.skills, s] }));
    }
    setField("");
  };

  // ── Basic Match via backend ──────────────────────────
  const basicMatch = async () => {
    if (jobReq.requiredSkills.length === 0) { notify("Add required skills first", "error"); return; }
    try {
      const res = await fetch(`${BACKEND}/api/match`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requiredSkills: jobReq.requiredSkills, minExperience: jobReq.minExperience })
      });
      const data = await res.json();
      setShortlisted(data);
      setTab("Shortlist");
      notify(`Shortlisted ${data.length} candidates`);
    } catch (e) {
      notify("Match error: " + e.message, "error");
    }
  };

  // ── AI Shortlist via backend (API key stays in .env) ─
  const aiShortlist = async () => {
    if (jobReq.requiredSkills.length === 0) { notify("Add required skills first", "error"); return; }
    setAiLoading(true);
    setTab("AI Analysis");
    try {
      const res = await fetch(`${BACKEND}/api/ai/shortlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requiredSkills: jobReq.requiredSkills,
          preferredSkills: jobReq.preferredSkills,
          minExperience: jobReq.minExperience
          // ✅ No API key sent — backend reads it from .env
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setAiResults(data);
      notify("AI analysis complete!");
    } catch (e) {
      notify("AI error: " + e.message, "error");
    }
    setAiLoading(false);
  };

  // ── Interview Questions via backend ──────────────────
  const generateInterviewQs = async (candidate) => {
    setInterviewQs(p => ({ ...p, [candidate.id]: "loading" }));
    try {
      const res = await fetch(`${BACKEND}/api/ai/interview-questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateName: candidate.name,
          skills: candidate.skills,
          experience: candidate.experience,
          requiredSkills: jobReq.requiredSkills
          // ✅ No API key sent
        })
      });
      const data = await res.json();
      setInterviewQs(p => ({ ...p, [candidate.id]: data.questions || ["Error generating questions"] }));
    } catch (e) {
      setInterviewQs(p => ({ ...p, [candidate.id]: ["Error: " + e.message] }));
    }
  };

  // ── Save / Unsave ────────────────────────────────────
  const saveCandidate = (c) => {
    if (!saved.find(s => s.id === c.id)) { setSaved(p => [...p, c]); notify("Candidate saved!"); }
    else { setSaved(p => p.filter(s => s.id !== c.id)); notify("Removed from saved"); }
  };

  // ── Helpers ──────────────────────────────────────────
  const filtered = candidates.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase()) ||
    c.skills.some(s => s.toLowerCase().includes(search.toLowerCase()))
  );

  const tierColor = (tier) => ({
    High:    { bg: "#eaf3de", text: "#3b6d11", border: "#97c459" },
    Partial: { bg: "#faeeda", text: "#854f0b", border: "#ef9f27" },
    Low:     { bg: "#fcebeb", text: "#a32d2d", border: "#f09595" }
  }[tier] || {});

  // ── Sub-components ───────────────────────────────────
  const ScoreBar = ({ score }) => (
    <div style={{ background: "var(--color-background-secondary)", borderRadius: 4, height: 8, overflow: "hidden", margin: "6px 0" }}>
      <div style={{ height: "100%", width: `${score}%`, background: score >= 70 ? "#639922" : score >= 40 ? "#ba7517" : "#e24b4a", borderRadius: 4, transition: "width 0.6s ease" }} />
    </div>
  );

  const SkillTag = ({ skill, color = "blue" }) => {
    const colors = { blue: { bg: "#e6f1fb", text: "#185fa5" }, green: { bg: "#eaf3de", text: "#3b6d11" }, gray: { bg: "#f1efe8", text: "#5f5e5a" } };
    const c = colors[color];
    return <span style={{ background: c.bg, color: c.text, padding: "2px 10px", borderRadius: 20, fontSize: 12, fontWeight: 500 }}>{skill}</span>;
  };

  const CandidateCard = ({ c, showMatch = false, matchData = null }) => {
    const isSaved = saved.find(s => s.id === c.id);
    const qs = interviewQs[c.id];
    const cardId = c._id || c.id;
    return (
      <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "1rem 1.25rem", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#e6f1fb", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 500, fontSize: 14, color: "#185fa5", flexShrink: 0 }}>
              {c.name.split(" ").map(n => n[0]).join("").toUpperCase()}
            </div>
            <div>
              <p style={{ fontWeight: 500, fontSize: 15, margin: 0 }}>{c.name}</p>
              <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: 0 }}>{c.email}</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {showMatch && matchData && (
              <span style={{ background: tierColor(matchData.tier).bg, color: tierColor(matchData.tier).text, border: `1px solid ${tierColor(matchData.tier).border}`, padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 500 }}>
                {matchData.tier} Match
              </span>
            )}
            <button onClick={() => saveCandidate(c)} style={{ background: "none", border: "none", cursor: "pointer", color: isSaved ? "#d4537e" : "var(--color-text-secondary)", padding: 4, fontSize: 18 }} title={isSaved ? "Unsave" : "Save"}>
              <i className={`ti ti-heart${isSaved ? "-filled" : ""}`} aria-hidden="true" />
            </button>
            <button onClick={() => deleteCandidate(cardId)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-secondary)", padding: 4, fontSize: 16 }}>
              <i className="ti ti-trash" aria-hidden="true" />
            </button>
          </div>
        </div>

        {showMatch && matchData && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>Match score</span>
              <span style={{ fontWeight: 500, fontSize: 14 }}>{matchData.matchScore}%</span>
            </div>
            <ScoreBar score={matchData.matchScore} />
            {!matchData.expOk && <p style={{ fontSize: 11, color: "#a32d2d", margin: "2px 0 0" }}>⚠ Below minimum experience ({matchData.experience} yr / {jobReq.minExperience} yr required)</p>}
          </div>
        )}

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {c.skills.map(s => {
            const isMatched = matchData?.matchedSkills?.some(m => m.toLowerCase() === s.toLowerCase());
            const isPref = matchData?.preferredMatched?.some(m => m.toLowerCase() === s.toLowerCase());
            return <SkillTag key={s} skill={s} color={isMatched ? "green" : isPref ? "blue" : "gray"} />;
          })}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
            <i className="ti ti-briefcase" aria-hidden="true" style={{ fontSize: 13, verticalAlign: -1 }} /> {c.experience} yr exp
          </span>
          {jobReq.requiredSkills.length > 0 && (
            <button onClick={() => generateInterviewQs(c)} style={{ fontSize: 12, padding: "4px 10px", borderRadius: 6, cursor: "pointer", border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-secondary)", color: "var(--color-text-primary)" }}>
              {qs === "loading" ? "Generating..." : "Interview Qs ↗"}
            </button>
          )}
        </div>

        {c.bio && <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: 0, fontStyle: "italic" }}>{c.bio}</p>}

        {qs && qs !== "loading" && (
          <div style={{ borderTop: "0.5px solid var(--color-border-tertiary)", paddingTop: 10 }}>
            <p style={{ fontSize: 12, fontWeight: 500, margin: "0 0 6px" }}>Interview Questions</p>
            {qs.map((q, i) => <p key={i} style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "0 0 4px" }}>{i + 1}. {q}</p>)}
          </div>
        )}
      </div>
    );
  };

  const BarChart = ({ data }) => {
    const max = Math.max(...data.map(d => d.score), 1);
    return (
      <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 120, padding: "0 0 24px" }}>
        {data.slice(0, 8).map((d, i) => (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: 10, color: "var(--color-text-secondary)", fontWeight: 500 }}>{d.score}%</span>
            <div style={{ width: "100%", height: `${(d.score / max) * 80}px`, background: d.score >= 70 ? "#639922" : d.score >= 40 ? "#ba7517" : "#e24b4a", borderRadius: "4px 4px 0 0", minHeight: 4, transition: "height 0.5s ease" }} />
            <span style={{ fontSize: 9, color: "var(--color-text-secondary)", textAlign: "center", lineHeight: 1.2, maxWidth: 60 }}>{d.name.split(" ")[0]}</span>
          </div>
        ))}
      </div>
    );
  };

  // ── Render ───────────────────────────────────────────
  return (
    <div style={{ fontFamily: "var(--font-sans)", minHeight: "100vh", background: "var(--color-background-tertiary)" }}>

      {/* Notification toast */}
      {notification && (
        <div style={{ position: "fixed", top: 16, right: 16, zIndex: 999, background: notification.type === "error" ? "#fcebeb" : "#eaf3de", color: notification.type === "error" ? "#a32d2d" : "#3b6d11", border: `1px solid ${notification.type === "error" ? "#f09595" : "#97c459"}`, borderRadius: 8, padding: "10px 18px", fontWeight: 500, fontSize: 13 }}>
          {notification.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ borderBottom: "0.5px solid var(--color-border-tertiary)", background: "var(--color-background-primary)", padding: "0 1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, paddingTop: 16 }}>
          <div style={{ background: "#e6f1fb", borderRadius: 8, padding: "6px 10px", color: "#185fa5" }}>
            <i className="ti ti-users" aria-hidden="true" style={{ fontSize: 18 }} />
          </div>
          <div>
            <p style={{ fontWeight: 500, margin: 0, fontSize: 15 }}>TalentMatch</p>
            <p style={{ fontSize: 11, color: "var(--color-text-secondary)", margin: 0 }}>AI-powered candidate shortlisting</p>
          </div>
          {/* ✅ No API key button — AI is always ready via backend */}
          <span style={{ marginLeft: "auto", fontSize: 11, background: "#eaf3de", color: "#3b6d11", padding: "3px 10px", borderRadius: 20 }}>
            <i className="ti ti-check" /> AI Ready
          </span>
        </div>
        <div style={{ display: "flex", gap: 0, marginTop: 12, overflowX: "auto" }}>
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ padding: "10px 16px", fontSize: 13, background: "none", border: "none", cursor: "pointer", borderBottom: tab === t ? "2px solid #185fa5" : "2px solid transparent", color: tab === t ? "#185fa5" : "var(--color-text-secondary)", fontWeight: tab === t ? 500 : 400, whiteSpace: "nowrap", fontFamily: "var(--font-sans)" }}>
              {t === "Saved" ? `Saved (${saved.length})` : t}
            </button>
          ))}
        </div>
      </div>

      {/* Page content */}
      <div style={{ padding: "1.5rem", maxWidth: 900, margin: "0 auto" }}>

        {/* ── Dashboard ── */}
        {tab === "Dashboard" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
              {[
                { label: "Total Candidates", value: candidates.length, icon: "ti-users" },
                { label: "Shortlisted",       value: shortlisted.length, icon: "ti-list-check" },
                { label: "High Match",         value: shortlisted.filter(c => c.tier === "High").length, icon: "ti-star" },
                { label: "Saved",              value: saved.length, icon: "ti-heart" }
              ].map(m => (
                <div key={m.label} style={{ background: "var(--color-background-secondary)", borderRadius: "var(--border-radius-md)", padding: "1rem", textAlign: "center" }}>
                  <i className={`ti ${m.icon}`} aria-hidden="true" style={{ fontSize: 22, color: "#185fa5" }} />
                  <p style={{ fontSize: 28, fontWeight: 500, margin: "4px 0 2px" }}>{m.value}</p>
                  <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: 0 }}>{m.label}</p>
                </div>
              ))}
            </div>

            {/* Job requirement card */}
            <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "1.25rem" }}>
              <p style={{ fontWeight: 500, margin: "0 0 6px", fontSize: 14 }}>Job Requirement Setup</p>
              <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "0 0 14px" }}>Configure the job requirements to shortlist candidates</p>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>

                {/* Required skills */}
                <div style={{ flex: 1, minWidth: 200 }}>
                  <label style={{ fontSize: 12, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>Required Skills</label>
                  <div style={{ display: "flex", gap: 6 }}>
                    <input value={reqSkillInput} onChange={e => setReqSkillInput(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") addSkillToForm(reqSkillInput, "req", setReqSkillInput, "job"); }}
                      placeholder="Type skill + Enter" style={{ flex: 1, fontSize: 13 }} list="skill-list" />
                    <button onClick={() => addSkillToForm(reqSkillInput, "req", setReqSkillInput, "job")} style={{ padding: "0 12px", cursor: "pointer", borderRadius: 6, border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-secondary)" }}>+</button>
                  </div>
                  <datalist id="skill-list">{SKILL_SUGGESTIONS.map(s => <option key={s} value={s} />)}</datalist>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                    {jobReq.requiredSkills.map(s => (
                      <span key={s} style={{ background: "#e6f1fb", color: "#185fa5", padding: "3px 10px", borderRadius: 20, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                        onClick={() => setJobReq(p => ({ ...p, requiredSkills: p.requiredSkills.filter(r => r !== s) }))}>
                        {s} <i className="ti ti-x" style={{ fontSize: 10 }} />
                      </span>
                    ))}
                  </div>
                </div>

                {/* Preferred skills */}
                <div style={{ flex: 1, minWidth: 200 }}>
                  <label style={{ fontSize: 12, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>Preferred Skills</label>
                  <div style={{ display: "flex", gap: 6 }}>
                    <input value={prefSkillInput} onChange={e => setPrefSkillInput(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") addSkillToForm(prefSkillInput, "pref", setPrefSkillInput, "job"); }}
                      placeholder="Optional skills" style={{ flex: 1, fontSize: 13 }} list="skill-list" />
                    <button onClick={() => addSkillToForm(prefSkillInput, "pref", setPrefSkillInput, "job")} style={{ padding: "0 12px", cursor: "pointer", borderRadius: 6, border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-secondary)" }}>+</button>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                    {jobReq.preferredSkills.map(s => (
                      <span key={s} style={{ background: "#faeeda", color: "#854f0b", padding: "3px 10px", borderRadius: 20, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                        onClick={() => setJobReq(p => ({ ...p, preferredSkills: p.preferredSkills.filter(r => r !== s) }))}>
                        {s} <i className="ti ti-x" style={{ fontSize: 10 }} />
                      </span>
                    ))}
                  </div>
                </div>

                {/* Min experience */}
                <div style={{ minWidth: 140 }}>
                  <label style={{ fontSize: 12, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>Min Experience (years)</label>
                  <input type="number" min={0} value={jobReq.minExperience}
                    onChange={e => setJobReq(p => ({ ...p, minExperience: Number(e.target.value) }))}
                    style={{ width: "100%", fontSize: 13 }} />
                </div>
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={basicMatch} style={{ padding: "9px 20px", borderRadius: 8, border: "0.5px solid #185fa5", background: "#185fa5", color: "#fff", fontWeight: 500, cursor: "pointer", fontSize: 13 }}>
                  <i className="ti ti-list-check" aria-hidden="true" /> Run Basic Match
                </button>
                <button onClick={aiShortlist} style={{ padding: "9px 20px", borderRadius: 8, border: "0.5px solid #185fa5", background: "none", color: "#185fa5", fontWeight: 500, cursor: "pointer", fontSize: 13 }}>
                  <i className="ti ti-sparkles" aria-hidden="true" /> AI Shortlist ↗
                </button>
              </div>
            </div>

            {/* Bar chart */}
            {shortlisted.length > 0 && (
              <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "1.25rem" }}>
                <p style={{ fontWeight: 500, margin: "0 0 12px", fontSize: 14 }}>Match Score Chart</p>
                <BarChart data={shortlisted.map(c => ({ name: c.name, score: c.matchScore }))} />
              </div>
            )}
          </div>
        )}

        {/* ── Add Candidate ── */}
        {tab === "Add Candidate" && (
          <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "1.5rem", maxWidth: 560 }}>
            <p style={{ fontWeight: 500, margin: "0 0 16px", fontSize: 16 }}>Add New Candidate</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>Full Name *</label>
                <input value={candidateForm.name} onChange={e => setCandidateForm(p => ({ ...p, name: e.target.value }))} placeholder="Rahul Sharma" style={{ width: "100%", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>Email *</label>
                <input value={candidateForm.email} onChange={e => setCandidateForm(p => ({ ...p, email: e.target.value }))} placeholder="rahul@example.com" type="email" style={{ width: "100%", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>Skills *</label>
                <div style={{ display: "flex", gap: 6 }}>
                  <input value={formSkillInput} onChange={e => setFormSkillInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") addSkillToForm(formSkillInput, "", setFormSkillInput, "form"); }}
                    placeholder="React, Node.js..." style={{ flex: 1, fontSize: 13 }} list="skill-list" />
                  <button onClick={() => addSkillToForm(formSkillInput, "", setFormSkillInput, "form")} style={{ padding: "0 14px", cursor: "pointer", borderRadius: 6, border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-secondary)" }}>+</button>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                  {candidateForm.skills.map(s => (
                    <span key={s} style={{ background: "#e6f1fb", color: "#185fa5", padding: "3px 10px", borderRadius: 20, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                      onClick={() => setCandidateForm(p => ({ ...p, skills: p.skills.filter(r => r !== s) }))}>
                      {s} <i className="ti ti-x" style={{ fontSize: 10 }} />
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>Experience (years)</label>
                <input type="number" min={0} value={candidateForm.experience} onChange={e => setCandidateForm(p => ({ ...p, experience: e.target.value }))} placeholder="2" style={{ width: 100 }} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>Bio / Projects</label>
                <textarea value={candidateForm.bio} onChange={e => setCandidateForm(p => ({ ...p, bio: e.target.value }))}
                  placeholder="Brief description of experience and projects..." rows={3}
                  style={{ width: "100%", boxSizing: "border-box", resize: "vertical", padding: 8, fontSize: 13, border: "0.5px solid var(--color-border-tertiary)", borderRadius: 6, background: "var(--color-background-primary)", color: "var(--color-text-primary)", fontFamily: "var(--font-sans)" }} />
              </div>
              <button onClick={addCandidate} style={{ padding: "10px 0", borderRadius: 8, border: "none", background: "#185fa5", color: "#fff", fontWeight: 500, cursor: "pointer", fontSize: 14 }}>
                Add Candidate
              </button>
            </div>
          </div>
        )}

        {/* ── Candidates List ── */}
        {tab === "Candidates" && (
          <div>
            <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center" }}>
              <div style={{ position: "relative", flex: 1 }}>
                <i className="ti ti-search" aria-hidden="true" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--color-text-secondary)", fontSize: 15 }} />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, email, or skill..." style={{ width: "100%", paddingLeft: 32, boxSizing: "border-box" }} />
              </div>
              <span style={{ fontSize: 13, color: "var(--color-text-secondary)", whiteSpace: "nowrap" }}>{filtered.length} candidates</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
              {filtered.map(c => <CandidateCard key={c._id || c.id} c={c} />)}
            </div>
            {filtered.length === 0 && <p style={{ textAlign: "center", color: "var(--color-text-secondary)", padding: "3rem 0" }}>No candidates found.</p>}
          </div>
        )}

        {/* ── Shortlist ── */}
        {tab === "Shortlist" && (
          <div>
            {shortlisted.length === 0 ? (
              <div style={{ textAlign: "center", padding: "4rem 0" }}>
                <i className="ti ti-list-check" aria-hidden="true" style={{ fontSize: 40, color: "var(--color-text-secondary)" }} />
                <p style={{ color: "var(--color-text-secondary)", marginTop: 8 }}>No shortlist yet. Set job requirements and run match from Dashboard.</p>
                <button onClick={() => setTab("Dashboard")} style={{ marginTop: 12, padding: "8px 20px", borderRadius: 8, cursor: "pointer", border: "0.5px solid #185fa5", color: "#185fa5", background: "none", fontWeight: 500 }}>Go to Dashboard</button>
              </div>
            ) : (
              <div>
                <div style={{ display: "flex", gap: 10, marginBottom: 14, alignItems: "center", flexWrap: "wrap" }}>
                  <p style={{ margin: 0, fontWeight: 500 }}>{shortlisted.length} candidates ranked</p>
                  <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
                    {["High", "Partial", "Low"].map(t => {
                      const col = tierColor(t);
                      return <span key={t} style={{ background: col.bg, color: col.text, padding: "3px 10px", borderRadius: 20, fontSize: 12 }}>{shortlisted.filter(s => s.tier === t).length} {t}</span>;
                    })}
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
                  {shortlisted.map(c => <CandidateCard key={c._id || c.id} c={c} showMatch matchData={c} />)}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── AI Analysis ── */}
        {tab === "AI Analysis" && (
          <div>
            {!aiResults && !aiLoading && (
              <div style={{ textAlign: "center", padding: "4rem 0" }}>
                <i className="ti ti-sparkles" aria-hidden="true" style={{ fontSize: 40, color: "#185fa5" }} />
                <p style={{ color: "var(--color-text-secondary)", marginTop: 8 }}>Set job requirements on Dashboard and run AI Shortlist</p>
                <button onClick={aiShortlist} style={{ marginTop: 12, padding: "9px 22px", borderRadius: 8, cursor: "pointer", border: "none", background: "#185fa5", color: "#fff", fontWeight: 500 }}>Run AI Analysis ↗</button>
              </div>
            )}
            {aiLoading && (
              <div style={{ textAlign: "center", padding: "4rem 0" }}>
                <div style={{ width: 40, height: 40, border: "3px solid #e6f1fb", borderTop: "3px solid #185fa5", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto" }} />
                <p style={{ color: "var(--color-text-secondary)", marginTop: 12 }}>AI is analyzing candidates...</p>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            )}
            {aiResults && !aiLoading && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ background: "#e6f1fb", borderRadius: "var(--border-radius-lg)", padding: "1rem 1.25rem", border: "0.5px solid #b5d4f4" }}>
                  <p style={{ margin: "0 0 4px", fontWeight: 500, color: "#185fa5", fontSize: 13 }}>AI Summary</p>
                  <p style={{ margin: 0, fontSize: 13, color: "#0c447c", lineHeight: 1.6 }}>{aiResults.summary}</p>
                </div>
                {aiResults.rankings?.map((r, i) => (
                  <div key={i} style={{ background: "var(--color-background-primary)", border: i === 0 ? "2px solid #185fa5" : "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "1rem 1.25rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 28, height: 28, borderRadius: "50%", background: i === 0 ? "#185fa5" : "var(--color-background-secondary)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 500, fontSize: 13, color: i === 0 ? "#fff" : "var(--color-text-primary)" }}>#{r.rank}</div>
                        <p style={{ fontWeight: 500, margin: 0, fontSize: 15 }}>{r.name}</p>
                        {i === 0 && <span style={{ background: "#185fa5", color: "#fff", fontSize: 11, padding: "2px 8px", borderRadius: 20 }}>Top Pick</span>}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontWeight: 500, fontSize: 15 }}>{r.score}%</span>
                        <span style={{ background: tierColor(r.tier).bg, color: tierColor(r.tier).text, padding: "3px 10px", borderRadius: 20, fontSize: 12 }}>{r.tier}</span>
                      </div>
                    </div>
                    <ScoreBar score={r.score} />
                    <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: "8px 0 6px", lineHeight: 1.5 }}>{r.reason}</p>
                    {r.strengths?.length > 0 && (
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
                        {r.strengths.map(s => <span key={s} style={{ background: "#eaf3de", color: "#3b6d11", padding: "2px 9px", borderRadius: 20, fontSize: 11 }}>+ {s}</span>)}
                      </div>
                    )}
                    {r.gaps?.length > 0 && (
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {r.gaps.map(g => <span key={g} style={{ background: "#fcebeb", color: "#a32d2d", padding: "2px 9px", borderRadius: 20, fontSize: 11 }}>- {g}</span>)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Saved ── */}
        {tab === "Saved" && (
          <div>
            {saved.length === 0 ? (
              <div style={{ textAlign: "center", padding: "4rem 0" }}>
                <i className="ti ti-heart" aria-hidden="true" style={{ fontSize: 40, color: "var(--color-text-secondary)" }} />
                <p style={{ color: "var(--color-text-secondary)", marginTop: 8 }}>No saved candidates yet. Click the heart icon on any candidate.</p>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
                {saved.map(c => {
                  const matchData = shortlisted.find(s => s.id === c.id || s._id === c._id);
                  return <CandidateCard key={c._id || c.id} c={c} showMatch={!!matchData} matchData={matchData} />;
                })}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}