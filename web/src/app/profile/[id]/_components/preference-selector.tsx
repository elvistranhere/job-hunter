"use client";

import { useState } from "react";

interface PreferenceSelectorProps {
  selectedLocations: string[];
  selectedRoles: string[];
  suggestedLocations: string[];
  suggestedRoles: string[];
  onLocationsChange: (locations: string[]) => void;
  onRolesChange: (roles: string[]) => void;
}

function PillGroup({
  label,
  hint,
  suggestions,
  selected,
  onChange,
  placeholder,
}: {
  label: string;
  hint: string;
  suggestions: string[];
  selected: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
}) {
  const [inputValue, setInputValue] = useState("");

  const toggle = (item: string) => {
    onChange(
      selected.includes(item)
        ? selected.filter((s) => s !== item)
        : [...selected, item],
    );
  };

  const addCustom = () => {
    const trimmed = inputValue.trim();
    if (trimmed && !selected.includes(trimmed)) {
      onChange([...selected, trimmed]);
    }
    setInputValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addCustom();
    }
  };

  // All unique items: suggestions first, then any custom entries
  const allItems = [
    ...suggestions,
    ...selected.filter((s) => !suggestions.includes(s)),
  ];

  return (
    <div>
      <p className="font-sans text-sm font-medium text-navy-300 mb-1 tracking-wide uppercase">
        {label}
      </p>
      <p className="font-sans text-xs text-navy-500 mb-3">{hint}</p>

      <div className="flex flex-wrap gap-2 mb-3">
        {allItems.map((item) => {
          const isSelected = selected.includes(item);
          const isSuggested = suggestions.includes(item);
          return (
            <button
              key={item}
              type="button"
              onClick={() => toggle(item)}
              className={`
                px-4 py-2 rounded-full font-sans text-sm font-medium
                border transition-all duration-200
                ${
                  isSelected
                    ? "border-amber-500/60 bg-amber-500/15 text-amber-300"
                    : "border-navy-600 bg-navy-800/60 text-navy-300 hover:border-navy-400 hover:text-navy-100"
                }
              `}
            >
              {isSuggested && !isSelected && (
                <span className="text-navy-500 mr-1.5 text-xs">AI</span>
              )}
              {item}
              {isSelected && !isSuggested && (
                <span className="ml-1.5 text-navy-400 text-xs">&times;</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-1 px-3 py-2 rounded-lg bg-navy-800/80 border border-navy-600 text-sm text-white placeholder-navy-500 font-sans focus:outline-none focus:border-amber-500/50 transition-colors"
        />
        <button
          type="button"
          onClick={addCustom}
          disabled={!inputValue.trim()}
          className="px-3 py-2 rounded-lg border border-navy-600 bg-navy-800/60 text-sm text-navy-300 font-sans hover:border-navy-400 hover:text-navy-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          Add
        </button>
      </div>
    </div>
  );
}

export function PreferenceSelector({
  selectedLocations,
  selectedRoles,
  suggestedLocations,
  suggestedRoles,
  onLocationsChange,
  onRolesChange,
}: PreferenceSelectorProps) {
  return (
    <div className="space-y-6">
      <PillGroup
        label="Preferred locations"
        hint="AI-suggested from your resume. Click to toggle, or add your own."
        suggestions={suggestedLocations}
        selected={selectedLocations}
        onChange={onLocationsChange}
        placeholder="Add a city, e.g. Brisbane"
      />

      <PillGroup
        label="Preferred roles"
        hint="AI-suggested from your experience. Click to toggle, or add your own."
        suggestions={suggestedRoles}
        selected={selectedRoles}
        onChange={onRolesChange}
        placeholder="Add a role, e.g. DevOps Engineer"
      />
    </div>
  );
}
