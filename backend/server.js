const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const dns = require("dns").promises;
require("dotenv").config();

// ── DNS fix (resolves network block issues) ──────────
dns.setServers(["8.8.8.8", "1.1.1.1"]);

const app = express();
app.use(cors({
  origin: [
    "http://localhost:5173",
    "https://candidate-shortlisting-frontend.onrender.com" // apna frontend URL yahan
  ]
}));
app.use(express.json());

// ── MongoDB Connect ──────────────────────────────────
mongoose
  .connect(process.env.MONGO_URI || "mongodb://localhost:27017/talentmatch")
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB error:", err));

// ── Candidate Schema ─────────────────────────────────
const CandidateSchema = new mongoose.Schema({
  name:       { type: String, required: true },
  email:      { type: String, required: true },
  skills:     [String],
  experience: { type: Number, default: 0 },
  bio:        { type: String, default: "" },
  createdAt:  { type: Date, default: Date.now },
});
const Candidate = mongoose.model("Candidate", CandidateSchema);

// ── Helper: call OpenRouter ──────────────────────────
async function callOpenRouter(prompt, maxTokens = 2000) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not set in .env");

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://talentmatch.app",
      "X-Title": "TalentMatch",
    },
    body: JSON.stringify({
      model: "openai/gpt-4o-mini",
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error.message || "OpenRouter error");
  return data.choices[0].message.content.replace(/```json|```/g, "").trim();
}

// ════════════════════════════════════════════════════
//  CANDIDATE ROUTES
// ════════════════════════════════════════════════════

// 1. Add Candidate
app.post("/api/candidates", async (req, res) => {
  try {
    const { name, email, skills, experience, bio } = req.body;
    if (!name || !email) {
      return res.status(400).json({ error: "Name and email are required" });
    }
    const candidate = await Candidate.create({ name, email, skills, experience, bio });
    res.status(201).json(candidate);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Get All Candidates
app.get("/api/candidates", async (req, res) => {
  try {
    const all = await Candidate.find().sort({ createdAt: -1 });
    res.json(all);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Delete Candidate
app.delete("/api/candidates/:id", async (req, res) => {
  try {
    await Candidate.findByIdAndDelete(req.params.id);
    res.json({ message: "Candidate deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════
//  MATCHING ROUTES
// ════════════════════════════════════════════════════

// 4. Basic Match (no AI)
app.post("/api/match", async (req, res) => {
  try {
    const { requiredSkills, minExperience } = req.body;
    if (!requiredSkills || requiredSkills.length === 0) {
      return res.status(400).json({ error: "requiredSkills is required" });
    }

    const all = await Candidate.find();
    const results = all
      .map((c) => {
        const matched = c.skills.filter((s) =>
          requiredSkills.map((r) => r.toLowerCase()).includes(s.toLowerCase())
        );
        const score = Math.round((matched.length / requiredSkills.length) * 100);
        const expOk = c.experience >= (minExperience || 0);
        const finalScore = expOk ? score : Math.round(score * 0.7);
        const tier = finalScore >= 70 ? "High" : finalScore >= 40 ? "Partial" : "Low";
        return {
          ...c.toObject(),
          matchScore: finalScore,
          matchedSkills: matched,
          expOk,
          tier,
        };
      })
      .sort((a, b) => b.matchScore - a.matchScore);

    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════
//  AI ROUTES (API key stays in .env — never sent from frontend)
// ════════════════════════════════════════════════════

// 5. AI Shortlist
app.post("/api/ai/shortlist", async (req, res) => {
  try {
    const { requiredSkills, preferredSkills = [], minExperience = 0 } = req.body;
    if (!requiredSkills || requiredSkills.length === 0) {
      return res.status(400).json({ error: "requiredSkills is required" });
    }

    const all = await Candidate.find();
    if (all.length === 0) {
      return res.status(400).json({ error: "No candidates found in database" });
    }

    const prompt = `You are an expert technical recruiter. Analyze and rank these candidates for a job.

JOB REQUIREMENTS:
- Required Skills: ${requiredSkills.join(", ")}
- Preferred Skills: ${preferredSkills.join(", ") || "None"}
- Minimum Experience: ${minExperience} years

CANDIDATES:
${all.map((c, i) => `${i + 1}. ${c.name} | Skills: ${c.skills.join(", ")} | Exp: ${c.experience}yr | Bio: ${c.bio}`).join("\n")}

Respond ONLY with a valid JSON object (no markdown, no backticks):
{
  "rankings": [
    {
      "name": "Candidate Name",
      "rank": 1,
      "score": 92,
      "tier": "High",
      "reason": "Why this candidate fits",
      "strengths": ["strength1", "strength2"],
      "gaps": ["gap1"]
    }
  ],
  "summary": "Overall analysis in 2-3 sentences"
}`;

    const text = await callOpenRouter(prompt, 2000);
    res.json(JSON.parse(text));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. AI Interview Questions
app.post("/api/ai/interview-questions", async (req, res) => {
  try {
    const { candidateName, skills, experience, requiredSkills } = req.body;
    if (!candidateName || !requiredSkills) {
      return res.status(400).json({ error: "candidateName and requiredSkills are required" });
    }

    const prompt = `Generate 5 technical interview questions for ${candidateName} who has skills in ${skills.join(", ")} and ${experience} years of experience. The job requires ${requiredSkills.join(", ")}. Return ONLY a JSON object (no markdown): { "questions": ["question1", "question2", "question3", "question4", "question5"] }`;

    const text = await callOpenRouter(prompt, 800);
    res.json(JSON.parse(text));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Start Server ─────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});