"use client";

type SkillTier = "core" | "strong" | "peripheral";

interface Skill {
  name: string;
  tier: string;
}

interface SkillTierEditorProps {
  skills: Skill[];
  onUpdateTier: (skillName: string, newTier: SkillTier) => void;
  onRemoveSkill?: (skillName: string) => void;
}

const TIER_CONFIG = {
  core: {
    label: "Core",
    points: 5,
    color: "border-emerald-500/50 bg-emerald-500/10 text-emerald-300",
    dot: "bg-emerald-400",
  },
  strong: {
    label: "Strong",
    points: 3,
    color: "border-sky-500/50 bg-sky-500/10 text-sky-300",
    dot: "bg-sky-400",
  },
  peripheral: {
    label: "Peripheral",
    points: 1,
    color: "border-navy-500/50 bg-navy-700/50 text-navy-300",
    dot: "bg-navy-400",
  },
} as const;

export function SkillTierEditor({ skills, onUpdateTier, onRemoveSkill }: SkillTierEditorProps) {
  const skillsByTier = {
    core: skills.filter((s) => s.tier === "core"),
    strong: skills.filter((s) => s.tier === "strong"),
    peripheral: skills.filter((s) => s.tier === "peripheral"),
  };

  return (
    <div className="space-y-5">
      {(["core", "strong", "peripheral"] as const).map((tier) => {
        const config = TIER_CONFIG[tier];
        const tierSkills = skillsByTier[tier];

        return (
          <div
            key={tier}
            className="rounded-xl border border-navy-700 bg-navy-800/40 p-5"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-2.5 h-2.5 rounded-full ${config.dot}`} />
              <h3 className="font-sans text-sm font-semibold text-white uppercase tracking-wide">
                {config.label}
              </h3>
              <span className="font-sans text-xs text-navy-500">
                +{config.points} points each
              </span>
              <span className="ml-auto font-sans text-xs text-navy-500">
                {tierSkills.length} skill{tierSkills.length !== 1 ? "s" : ""}
              </span>
            </div>

            {tierSkills.length === 0 ? (
              <p className="font-sans text-sm text-navy-500 italic">
                No skills in this tier. Drag skills here or change their tier.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {tierSkills.map((skill) => (
                  <SkillPill
                    key={skill.name}
                    skill={skill}
                    tierConfig={config}
                    onTierChange={(newTier) => onUpdateTier(skill.name, newTier)}
                    onRemove={onRemoveSkill ? () => onRemoveSkill(skill.name) : undefined}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SkillPill({
  skill,
  tierConfig,
  onTierChange,
  onRemove,
}: {
  skill: Skill;
  tierConfig: (typeof TIER_CONFIG)[keyof typeof TIER_CONFIG];
  onTierChange: (tier: SkillTier) => void;
  onRemove?: () => void;
}) {
  return (
    <div className="group relative flex items-center">
      <select
        value={skill.tier}
        onChange={(e) => onTierChange(e.target.value as SkillTier)}
        className={`
          appearance-none cursor-pointer
          px-3 py-1.5 ${onRemove ? "pr-7" : "pr-7"} rounded-full border text-sm font-medium
          transition-all duration-200
          hover:brightness-110 focus:outline-none focus:ring-1 focus:ring-amber-500/40
          ${tierConfig.color}
        `}
      >
        <option value="core">Core - {skill.name}</option>
        <option value="strong">Strong - {skill.name}</option>
        <option value="peripheral">Peripheral - {skill.name}</option>
      </select>
      <svg
        className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-current opacity-50 pointer-events-none"
        viewBox="0 0 16 16"
        style={onRemove ? { right: "1.75rem" } : undefined}
      >
        <path
          d="M4 6l4 4 4-4"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
        />
      </svg>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="ml-1 p-1 rounded-full hover:bg-rose-500/20 transition-colors"
          title="Remove skill"
        >
          <svg className="w-3.5 h-3.5 text-navy-400 hover:text-rose-400" viewBox="0 0 16 16">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  );
}
