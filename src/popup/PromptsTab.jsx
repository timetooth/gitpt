import { useEffect, useMemo, useState } from "react";
import { FiCheck, FiTrash2, FiPlus } from "react-icons/fi";
import { LuNotebookTabs } from "react-icons/lu";

const STORAGE_KEY = "prompts";
const MAX_PROMPTS = 50;

const readPrompts = () =>
  new Promise((resolve) => {
    if (!chrome?.storage?.sync) {
      resolve([]);
      return;
    }
    chrome.storage.sync.get([STORAGE_KEY], (res) => {
      const stored = res?.[STORAGE_KEY];
      resolve(Array.isArray(stored) ? stored : []);
    });
  });

const writePrompts = (items) =>
  new Promise((resolve, reject) => {
    if (!chrome?.storage?.sync) {
      reject(new Error("Chrome storage unavailable"));
      return;
    }
    chrome.storage.sync.set({ [STORAGE_KEY]: items }, () => {
      const err = chrome.runtime.lastError;
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });

export default function PromptsTab() {
  const [prompts, setPrompts] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [status, setStatus] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [isAddPressed, setIsAddPressed] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const inputHeight = useMemo(() => {
    const base = 40;
    const lineHeight = 20;
    const lines = Math.max(1, inputValue.split("\n").length);
    return Math.min(200, base + (lines - 1) * lineHeight);
  }, [inputValue]);

  useEffect(() => {
    let active = true;
    readPrompts()
      .then((items) => {
        if (active) setPrompts(items);
      })
      .catch((err) => {
        console.error("Failed to load prompts", err);
        if (active) setStatus("Could not load saved prompts.");
      });
    return () => {
      active = false;
    };
  }, []);

  const handleAddPrompt = async () => {
    const value = inputValue.trim();
    if (!value) {
      setStatus("Enter a prompt first.");
      return;
    }

    const next = [value, ...prompts].slice(0, MAX_PROMPTS);
    setIsSaving(true);
    setStatus("Saving...");
    try {
      await writePrompts(next);
      setPrompts(next);
      setInputValue("");
      setStatus("Saved...");
    } catch (err) {
      console.error("Failed to save prompt", err);
      setStatus("Could not save prompt.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePrompt = async (index) => {
    if (isSaving) return;

    const next = prompts.filter((_, i) => i !== index);
    setIsSaving(true);
    setStatus("Removing...");
    try {
      await writePrompts(next);
      setPrompts(next);
      setStatus("Prompt removed.");
    } catch (err) {
      console.error("Failed to delete prompt", err);
      setStatus("Could not delete prompt.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUsePrompt = async (prompt) => {
    if (isSending) return;

    setIsSending(true);
    setStatus("Sending to page...");
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) {
        throw new Error("No active tab to send prompt to.");
      }

      const response = await new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tab.id, { type: "ADD_PROMPT", prompt }, (res) => {
          const err = chrome.runtime.lastError;
          if (err) {
            reject(err);
            return;
          }
          resolve(res);
        });
      });

      if (!response?.ok) {
        throw new Error(response?.error || "Could not insert prompt on page.");
      }

      setStatus("Prompt inserted on page.");
    } catch (err) {
      console.error("Failed to send prompt to page", err);
      setStatus("Could not send prompt to page.");
    } finally {
      setIsSending(false);
    }
  };

  const surfaceStyle = {
    padding: 2,
    width: 380,
    maxWidth: 440,
    background: "linear-gradient(180deg, #fdfdff 0%, #f4f6fb 100%)",
    borderRadius: 14,
    boxShadow: "0 10px 35px rgba(15, 23, 42, 0.08)",
    color: "#1f2937",
    fontFamily: "Poppins, 'Helvetica Neue', Helvetica, Arial, sans-serif",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  };

  const cardStyle = {
    background: "#ffffff",
    borderRadius: 12,
    padding: 8,
    border: "1px solid #e5e7eb",
    boxShadow: "0 4px 15px rgba(0, 0, 0, 0.04)",
  };

  const headingStyle = { margin: 0, fontSize: 18, letterSpacing: 0.2, color: "#111827", display: "flex", alignItems: "center", gap: 8 };
  const bodyStyle = { margin: "6px 0 0", fontSize: 13, color: "#475569", lineHeight: 1.5 };

  const inputRow = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
  };

  const inputStyle = {
    flex: 1,
    padding: "9px 12px",
    borderRadius: 10,
    border: "1px solid #e5e7eb",
    background: "#f8fafc",
    fontSize: 13,
    color: "#0f172a",
    fontFamily: "inherit",
    lineHeight: 1.4,
    minHeight: 40,
    resize: "none",
    transition: "all 120ms ease",
    outline: "none",
  };

  const addButton = {
    width: 38,
    height: 38,
    borderRadius: "50%",
    border: "1px solid #111827",
    background: isAddPressed ? "linear-gradient(135deg, #111827, #1f2937)" : "transparent",
    color: isAddPressed ? "#f9fafb" : "#111827",
    fontWeight: 700,
    fontSize: 18,
    cursor: isSaving ? "not-allowed" : "pointer",
    opacity: isSaving ? 0.6 : 1,
    boxShadow: isAddPressed ? "0 4px 12px rgba(15, 23, 42, 0.18)" : "0 4px 10px rgba(15, 23, 42, 0.12)",
    transition: "all 120ms ease",
  };

  const listStyle = {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    marginTop: 12,
  };

  const promptRow = {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
  };

  const promptCard = {
    flex: 1,
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    padding: "10px 12px",
    background: "#f8fafc",
    fontSize: 13,
    color: "#0f172a",
    lineHeight: 1.5,
  };

  const actions = {
    display: "flex",
    alignItems: "center",
    gap: 6,
  };

  const actionButton = {
    width: 32,
    height: 32,
    borderRadius: "50%",
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    color: "#1f2937",
    display: "grid",
    placeItems: "center",
    cursor: isSaving || isSending ? "not-allowed" : "pointer",
    boxShadow: "0 2px 6px rgba(15, 23, 42, 0.08)",
    opacity: isSaving || isSending ? 0.6 : 1,
  };

  const useButton = {
    border: "1px solid #16a34a",
    color: "#16a34a",
  };

  const deleteButton = {
    border: "1px solid #ef4444",
    color: "#b91c1c",
  };

  const statusStyle = { margin: "10px 0 0", fontSize: 12, color: "#475569" };

  return (
    <div style={surfaceStyle}>
      <div style={cardStyle}>
        <h1 style={headingStyle}>
          <LuNotebookTabs size={18} />
          Prompts
        </h1>
        <p style={bodyStyle}>Add quick prompts to reuse later.</p>
        <div style={inputRow}>
          <textarea
            style={{
              ...inputStyle,
              borderColor: isInputFocused ? "#111827" : "#e5e7eb",
              boxShadow: isInputFocused ? "0 0 0 3px rgba(17, 24, 39, 0.08)" : "none",
              height: inputHeight,
            }}
            placeholder="Write a concise summary of this page"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onFocus={() => setIsInputFocused(true)}
            onBlur={() => setIsInputFocused(false)}
            disabled={isSaving}
          />
          <button
            type="button"
            style={addButton}
            onClick={handleAddPrompt}
            aria-label="Add prompt"
            disabled={isSaving}
            onMouseDown={() => setIsAddPressed(true)}
            onMouseUp={() => setIsAddPressed(false)}
            onMouseLeave={() => setIsAddPressed(false)}
            onBlur={() => setIsAddPressed(false)}
          >
            <FiPlus size={18} />
          </button>
        </div>
        <div style={listStyle}>
          {prompts.length === 0 ? (
            <div style={{ ...promptCard, color: "#6b7280", fontStyle: "italic" }}>No prompts yet. Add your first one.</div>
          ) : (
            prompts.map((text, idx) => (
              <div style={promptRow} key={`${text}-${idx}`}>
                <div style={promptCard}>{text}</div>
                <div style={actions}>
                  <button
                    type="button"
                    style={{ ...actionButton, ...useButton }}
                    aria-label="Use prompt"
                    onClick={() => handleUsePrompt(text)}
                    disabled={isSaving || isSending}
                  >
                    <FiCheck size={16} />
                  </button>
                  <button
                    type="button"
                    style={{ ...actionButton, ...deleteButton }}
                    aria-label="Delete prompt"
                    onClick={() => handleDeletePrompt(idx)}
                    disabled={isSaving}
                  >
                    <FiTrash2 size={16} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
        {status && <p style={statusStyle}>{status}</p>}
      </div>
    </div>
  );
}
