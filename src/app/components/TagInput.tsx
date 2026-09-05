import React, { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { searchTags, MAX_TAG_LENGTH, MAX_TAGS_PER_ARTWORK, type Tag } from "../../lib/tags";

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}

/**
 * Space-separated tag chip input with an autocomplete dropdown of existing
 * tags. Typing a space (or pressing Enter) commits the current word as a
 * chip; picking a suggestion commits that tag's name instead.
 */
export function TagInput({ value, onChange, placeholder }: TagInputProps) {
  const [draft, setDraft] = useState("");
  const [suggestions, setSuggestions] = useState<Tag[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  // Tracked as a ref, not state: onKeyDown needs the current value synchronously,
  // and state set inside onCompositionEnd may not have flushed by the time the
  // IME's confirm keystroke (Enter, on many CJK input methods) reaches onKeyDown.
  const isComposingRef = useRef(false);

  useEffect(() => {
    const query = draft.trim();
    if (!query || isComposingRef.current) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      if (isComposingRef.current) return;
      const results = await searchTags(query);
      setSuggestions(results.filter((tag) => !value.some((existing) => existing.toLowerCase() === tag.name.toLowerCase())));
      setHighlightedIndex(-1);
    }, 250);
    return () => clearTimeout(timer);
  }, [draft, value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function addTags(names: string[]) {
    if (value.length >= MAX_TAGS_PER_ARTWORK) return;
    const seen = new Set(value.map((tag) => tag.toLowerCase()));
    const additions: string[] = [];
    for (const name of names) {
      const trimmed = name.trim().slice(0, MAX_TAG_LENGTH);
      const key = trimmed.toLowerCase();
      if (!trimmed || seen.has(key)) continue;
      seen.add(key);
      additions.push(trimmed);
      if (value.length + additions.length >= MAX_TAGS_PER_ARTWORK) break;
    }
    if (additions.length) onChange([...value, ...additions]);
  }

  function removeTag(name: string) {
    onChange(value.filter((tag) => tag !== name));
  }

  function selectSuggestion(tag: Tag) {
    addTags([tag.name]);
    setDraft("");
    setSuggestions([]);
    setIsOpen(false);
    inputRef.current?.focus();
  }

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const raw = event.target.value;
    setIsOpen(true);
    // While an IME composition is in progress, the input's value is the
    // in-progress candidate text — don't parse it for a space delimiter yet.
    if (isComposingRef.current) {
      setDraft(raw);
      return;
    }
    if (raw.includes(" ")) {
      const parts = raw.split(" ");
      const trailing = parts.pop() ?? "";
      addTags(parts);
      setDraft(trailing);
    } else {
      setDraft(raw);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    // The Enter that confirms an IME composition (e.g. finalizing a Chinese
    // candidate) reaches onKeyDown too. Treating it as "commit tag" fires
    // before the composition actually finishes, adding the tag while
    // leaving the leftover text behind in the input. keyCode 229 is the
    // legacy signal some browsers still send for that same keystroke.
    if (event.key === "Enter" && (isComposingRef.current || event.keyCode === 229)) return;

    if (event.key === "ArrowDown" && suggestions.length) {
      event.preventDefault();
      setHighlightedIndex((index) => (index + 1) % suggestions.length);
    } else if (event.key === "ArrowUp" && suggestions.length) {
      event.preventDefault();
      setHighlightedIndex((index) => (index <= 0 ? suggestions.length - 1 : index - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (highlightedIndex >= 0 && suggestions[highlightedIndex]) {
        selectSuggestion(suggestions[highlightedIndex]);
      } else if (draft.trim()) {
        addTags([draft]);
        setDraft("");
        setSuggestions([]);
      }
    } else if (event.key === "Backspace" && !draft && value.length) {
      onChange(value.slice(0, -1));
    } else if (event.key === "Escape") {
      setIsOpen(false);
    }
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div
        onClick={() => inputRef.current?.focus()}
        className="flex min-h-[46px] flex-wrap items-center gap-1.5 rounded-xl border border-white/8 bg-white/5 px-3 py-2 transition-all focus-within:border-white/40 focus-within:bg-white/8"
      >
        {value.map((tag) => (
          <span key={tag} className="flex items-center gap-1 rounded-full bg-white/10 py-1 pl-2.5 pr-1.5 text-xs text-white">
            {tag}
            <button type="button" onClick={() => removeTag(tag)} aria-label={`移除標籤 ${tag}`} className="grid h-4 w-4 place-items-center rounded-full text-white/50 transition-colors hover:bg-white/15 hover:text-white">
              <X size={11} />
            </button>
          </span>
        ))}
        {value.length < MAX_TAGS_PER_ARTWORK && (
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onCompositionStart={() => { isComposingRef.current = true; }}
            onCompositionEnd={(event) => {
              isComposingRef.current = false;
              // Re-sync in case the confirmed text differs from the last onChange value.
              setDraft(event.currentTarget.value);
            }}
            onFocus={() => setIsOpen(true)}
            placeholder={value.length ? "" : placeholder}
            className="min-w-[80px] flex-1 bg-transparent text-sm text-white outline-none placeholder:text-gray-600"
          />
        )}
      </div>

      {isOpen && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-10 mt-1.5 overflow-hidden rounded-xl border border-white/10 bg-[#1a1a1a] shadow-xl shadow-black/40">
          {suggestions.map((tag, index) => (
            <button
              key={tag.id}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectSuggestion(tag)}
              className={`block w-full px-4 py-2.5 text-left text-sm transition-colors ${
                index === highlightedIndex ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/8 hover:text-white"
              }`}
            >
              {tag.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
