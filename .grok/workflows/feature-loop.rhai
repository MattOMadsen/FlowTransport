// Token-sparende feature-loop (master-workflow-light).
// Max ~4 agent-kald: implement → review → [fix → review].
// Args: { goal: string, criteria?: string, base?: string }
// Kør: /workflow feature-loop  eller workflow tool med name "feature-loop"

let meta = #{
    name: "feature-loop",
    description: "Implementer EN feature, review git-diff, max 1 fix-runde (token-cap)",
    when_to_use: "Når du vil have en lille feature bygget + scoret uden endeløse loops",
    phases: [
        #{ title: "Implement", detail: "worker bygger kun det aftalte" },
        #{ title: "Review", detail: "read-only score på rigtig diff" },
        #{ title: "Fix", detail: "højst én fix-runde hvis score < 8" },
        #{ title: "Re-review", detail: "afsluttende score" },
    ],
};

let done_schema = #{
    "type": "object",
    "required": ["summary", "files_touched", "dod_met"],
    "properties": #{
        "summary": #{ "type": "string" },
        "files_touched": #{ "type": "array", "items": #{ "type": "string" }, "maxItems": 20 },
        "dod_met": #{ "type": "boolean" },
        "notes": #{ "type": "string" },
    },
};

let review_schema = #{
    "type": "object",
    "required": ["score", "verdict", "blockers"],
    "properties": #{
        "score": #{ "type": "number", "minimum": 0, "maximum": 10 },
        "verdict": #{ "type": "string" },
        "blockers": #{
            "type": "array",
            "maxItems": 6,
            "items": #{
                "type": "object",
                "required": ["file", "issue"],
                "properties": #{
                    "file": #{ "type": "string" },
                    "issue": #{ "type": "string" },
                },
            },
        },
        "nits": #{
            "type": "array",
            "maxItems": 4,
            "items": #{ "type": "string" },
        },
    },
};

// --- args ---
let goal = if args == () { () } else { args.goal };
if goal == () {
    pause("verification", "Angiv args.goal — én konkret feature (dansk eller engelsk). Valgfrit: args.criteria, args.base (git ref).");
}

let criteria = "";
if args != () && args.criteria != () {
    criteria = args.criteria;
}
if criteria == "" {
    criteria = "Opfylder målet. Ingen stuck-hacks. Pinch bygger ikke vej. Små filer. node --check på berørte js. Ingen nye features uden for goal.";
}

let base = "HEAD";
if args != () && args.base != () {
    base = args.base;
}

let goal_j = json_encode(goal);
let criteria_j = json_encode(criteria);
let base_j = json_encode(base);

// Threshold: 8/10 is "good enough" for cozy MVP (9 burns tokens)
let THRESHOLD = 8.0;

// ========== IMPLEMENT ==========
phase("Implement");
log("Feature-loop: implement (1/4 agent slots typical)");

let impl_prompt = "";
impl_prompt += "Du er worker på FlowTransport (2.5D cozy transport-spil, vanilla JS).\n";
impl_prompt += "Læs først AGENTS.md og docs/KERNE.md (og docs/ARV.md hvis relevant).\n";
impl_prompt += "GOAL (én feature, intet mere): ";
impl_prompt += goal_j;
impl_prompt += "\n\nACCEPTANCE / DoD:\n";
impl_prompt += criteria_j;
impl_prompt += "\n\nRegler:\n";
impl_prompt += "- Implementér KUN goal. Ingen bots, rush hour, PWA, refactors uden for scope.\n";
impl_prompt += "- Trafik: faste ruter + RoadGraph/A*; ingen soft-arrive/stuck-straf-hacks.\n";
impl_prompt += "- Input: pinch commmitter aldrig vej.\n";
impl_prompt += "- Skriv/ret filer med tools. Kør node --check på berørte js-filer.\n";
impl_prompt += "- Commit IKKE medmindre brugeren eksplicit bad om det i goal.\n";
impl_prompt += "- Svar til sidst med schema: summary, files_touched, dod_met, notes.\n";
impl_prompt += "- dod_met=true kun hvis du faktisk opfyldte criteria.\n";

let impl = agent(impl_prompt, #{
    label: "implement",
    capability_mode: "read-write",
    output_schema: done_schema,
});

if impl == () || !impl.success {
    complete(#{
        status: "failed",
        phase: "implement",
        summary: "Worker fejlede eller returnerede intet.",
        score: 0,
    });
}

// ========== REVIEW ==========
phase("Review");
log("Review af rigtig git-diff (ikke worker-summary alene)");

let diff1 = git_diff_since(base);
let diff1_j = json_encode(diff1);
let impl_sum = "";
if impl.output.summary != () {
    impl_sum = impl.output.summary;
}
let impl_sum_j = json_encode(impl_sum);

let rev_prompt = "";
rev_prompt += "Du er UAFHÆNGIG reviewer (read-only). Du er IKKE worker.\n";
rev_prompt += "Læs den faktiske git-diff og relevante filer med read_file/grep. Stol ikke kun på summary.\n";
rev_prompt += "GOAL: ";
rev_prompt += goal_j;
rev_prompt += "\nCRITERIA: ";
rev_prompt += criteria_j;
rev_prompt += "\nWORKER SUMMARY: ";
rev_prompt += impl_sum_j;
rev_prompt += "\nGIT DIFF (base=";
rev_prompt += base_j;
rev_prompt += "):\n";
rev_prompt += diff1_j;
rev_prompt += "\n\nScore 0-10 (vær hård):\n";
rev_prompt += "0-3 broken/ude af scope · 4-6 delvist · 7 næsten · 8 DoD opfyldt · 9+ elegant.\n";
rev_prompt += "Bloker hvis: stuck-hacks, pinch-kan bygge vej, monolit-bloat, features uden for goal, manglende path/graf ved vej-ændring.\n";
rev_prompt += "Max 6 blockers {file,issue}. Nits er valgfrie. Returnér schema.\n";

let rev1 = agent(rev_prompt, #{
    label: "review-1",
    capability_mode: "read-only",
    output_schema: review_schema,
});

let score1 = 0.0;
let verdict1 = "ingen review";
let blockers1 = [];
if rev1 != () && rev1.success && rev1.output.score != () {
    score1 = rev1.output.score;
    if rev1.output.verdict != () {
        verdict1 = rev1.output.verdict;
    }
    if rev1.output.blockers != () {
        blockers1 = rev1.output.blockers;
    }
} else {
    // Unparsed review cannot pass the gate
    score1 = 0.0;
    verdict1 = "Review parse/fail — tæller som under threshold";
}

log("Review-1 score=" + score1.to_string() + " threshold=" + THRESHOLD.to_string());

if score1 >= THRESHOLD {
    let report_ok = "";
    report_ok += "# Feature-loop PASSED\n\n";
    report_ok += "**Score:** " + score1.to_string() + "/10\n\n";
    report_ok += "**Goal:** " + goal + "\n\n";
    report_ok += "**Verdict:** " + verdict1 + "\n\n";
    report_ok += "**Worker:** " + impl_sum + "\n";
    let path_ok = write_scratch_file("feature-loop-report.md", report_ok);
    complete(#{
        status: "passed",
        score: score1,
        iterations: 1,
        summary: verdict1,
        worker_summary: impl_sum,
        blockers: blockers1,
        path: path_ok,
    });
}

// ========== FIX (max 1) ==========
phase("Fix");
log("Score under threshold — én fix-runde (token-cap)");

let blockers_j = json_encode(blockers1);
let fix_prompt = "";
fix_prompt += "Du er fix-worker på FlowTransport. ÉN runde. Kun blockers fra review.\n";
fix_prompt += "GOAL: ";
fix_prompt += goal_j;
fix_prompt += "\nCRITERIA: ";
fix_prompt += criteria_j;
fix_prompt += "\nREVIEW SCORE: ";
fix_prompt += score1.to_string();
fix_prompt += "\nVERDICT: ";
fix_prompt += json_encode(verdict1);
fix_prompt += "\nBLOCKERS (fix disse, intet andet):\n";
fix_prompt += blockers_j;
fix_prompt += "\nLæs filer, ret kun det nødvendige, node --check. Ingen nye features.\n";
fix_prompt += "Returnér schema med dod_met.\n";

let fix = agent(fix_prompt, #{
    label: "fix",
    capability_mode: "read-write",
    output_schema: done_schema,
});

let fix_sum = "";
if fix != () && fix.success && fix.output.summary != () {
    fix_sum = fix.output.summary;
} else {
    fix_sum = "(fix fejlede)";
}

// ========== RE-REVIEW ==========
phase("Re-review");
let diff2 = git_diff_since(base);
let diff2_j = json_encode(diff2);
let fix_sum_j = json_encode(fix_sum);

let rev2_prompt = "";
rev2_prompt += "Uafhængig re-review (read-only) efter fix-runde. Læs git-diff + filer.\n";
rev2_prompt += "GOAL: ";
rev2_prompt += goal_j;
rev2_prompt += "\nCRITERIA: ";
rev2_prompt += criteria_j;
rev2_prompt += "\nFORRIGE SCORE: ";
rev2_prompt += score1.to_string();
rev2_prompt += "\nFIX SUMMARY: ";
rev2_prompt += fix_sum_j;
rev2_prompt += "\nDIFF:\n";
rev2_prompt += diff2_j;
rev2_prompt += "\nScore 0-10. Blockers max 6. Vær hård. Schema.\n";

let rev2 = agent(rev2_prompt, #{
    label: "review-2",
    capability_mode: "read-only",
    output_schema: review_schema,
});

let score2 = 0.0;
let verdict2 = "ingen re-review";
let blockers2 = [];
if rev2 != () && rev2.success && rev2.output.score != () {
    score2 = rev2.output.score;
    if rev2.output.verdict != () {
        verdict2 = rev2.output.verdict;
    }
    if rev2.output.blockers != () {
        blockers2 = rev2.output.blockers;
    }
}

log("Review-2 score=" + score2.to_string());

let final_score = score2;
let final_verdict = verdict2;
let final_blockers = blockers2;
let status = "needs_human";
if final_score >= THRESHOLD {
    status = "passed";
}

let report = "";
report += "# Feature-loop ";
report += status;
report += "\n\n";
report += "**Final score:** " + final_score.to_string() + "/10 (threshold " + THRESHOLD.to_string() + ")\n";
report += "**Iterations:** 2 (implement + fix)\n\n";
report += "**Goal:** " + goal + "\n\n";
report += "**Review 1:** " + score1.to_string() + " — " + verdict1 + "\n";
report += "**Review 2:** " + final_score.to_string() + " — " + final_verdict + "\n\n";
report += "**Worker:** " + impl_sum + "\n";
report += "**Fix:** " + fix_sum + "\n\n";
if final_blockers != () {
    report += "**Remaining blockers:** se run output JSON.\n";
}
if status != "passed" {
    report += "\n_Stop her — ingen flere auto-loops (token-cap). Menneske beslutter næste skridt._\n";
}

let path = write_scratch_file("feature-loop-report.md", report);

complete(#{
    status: status,
    score: final_score,
    score_round1: score1,
    iterations: 2,
    summary: final_verdict,
    worker_summary: impl_sum,
    fix_summary: fix_sum,
    blockers: final_blockers,
    path: path,
});
