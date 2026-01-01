import { useEffect, useMemo, useState } from "react";
import { FiSave, FiTrash2, FiRefreshCw } from "react-icons/fi";

const STORAGE_KEY = "historyBookmarks";

const normalizeMap = (raw) =>
  raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};

const readBookmarks = () =>
  new Promise((resolve) => {
    if (!chrome?.storage?.sync) {
      resolve({});
      return;
    }
    chrome.storage.sync.get([STORAGE_KEY], (res) => {
      const err = chrome.runtime.lastError;
      if (err) {
        console.warn("Failed to load bookmarks", err);
        resolve({});
        return;
      }
      resolve(normalizeMap(res?.[STORAGE_KEY]));
    });
  });

const writeBookmarks = (bookmarks) =>
  new Promise((resolve, reject) => {
    if (!chrome?.storage?.sync) {
      reject(new Error("Chrome storage unavailable"));
      return;
    }
    chrome.storage.sync.set({ [STORAGE_KEY]: bookmarks }, () => {
      const err = chrome.runtime.lastError;
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });

export default function BookmarksTab({ sendMessageToActiveTab }) {
  const [bookmarks, setBookmarks] = useState({});
  const [input, setInput] = useState("");
  const [status, setStatus] = useState("");
  const [currentChat, setCurrentChat] = useState(null);
  const [loadingChat, setLoadingChat] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const bookmarkList = useMemo(
    () =>
      Object.entries(bookmarks).map(([id, data]) => ({
        id,
        label: data?.label || "",
        url: data?.url || "",
        savedAt: data?.savedAt || null,
      })),
    [bookmarks]
  );

  const refreshCurrentChat = async () => {
    setLoadingChat(true);
    setStatus("Detecting current chat...");
    const res = await sendMessageToActiveTab({ type: "GET_CURRENT_CHAT" });
    setLoadingChat(false);

    if (res?.error) {
      setStatus(res.error);
      setCurrentChat(null);
      return;
    }

    const payload = res?.data ?? res;
    if (!payload?.success) {
      setStatus(payload?.error || "Not on a chat page.");
      setCurrentChat(null);
      return;
    }

    setCurrentChat({
      id: payload.chatId,
      url: payload.url,
      title: payload.title || "Current chat",
    });
    setStatus("");
  };

  useEffect(() => {
    let active = true;
    readBookmarks().then((saved) => {
      if (!active) return;
      setBookmarks(saved);
    });
    refreshCurrentChat();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!currentChat?.id) return;
    const existingLabel = bookmarks[currentChat.id]?.label || "";
    setInput(existingLabel);
  }, [currentChat?.id, bookmarks]);

  const handleSave = async () => {
    if (!currentChat?.id) {
      setStatus("Open a chat to bookmark it.");
      return;
    }

    const label = input.trim();
    if (!label) {
      setStatus("Enter a name for this chat.");
      return;
    }

    const next = {
      ...bookmarks,
      [currentChat.id]: {
        label,
        url: currentChat.url,
        savedAt: Date.now(),
      },
    };

    setIsSaving(true);
    try {
      await writeBookmarks(next);
      setBookmarks(next);
      setStatus("Saved bookmark for this chat.");
    } catch (err) {
      console.error("Failed to save bookmark", err);
      setStatus(err?.message || "Could not save bookmark.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id) => {
    const next = { ...bookmarks };
    delete next[id];

    setIsSaving(true);
    try {
      await writeBookmarks(next);
      setBookmarks(next);
      setStatus("Bookmark removed.");
    } catch (err) {
      console.error("Failed to delete bookmark", err);
      setStatus(err?.message || "Could not delete bookmark.");
    } finally {
      setIsSaving(false);
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
    padding: 10,
    border: "1px solid #e5e7eb",
    boxShadow: "0 4px 15px rgba(0, 0, 0, 0.04)",
  };

  const headingStyle = { margin: 0, fontSize: 16, letterSpacing: 0.2, color: "#111827", display: "flex", alignItems: "center", gap: 8 };
  const subTextStyle = { margin: "4px 0 0", fontSize: 13, color: "#475569" };
  const pill = { fontSize: 11, padding: "4px 8px", borderRadius: 8, background: "#eef2ff", color: "#312e81" };

  const inputStyle = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #e5e7eb",
    background: "#f8fafc",
    fontSize: 13,
    color: "#0f172a",
    outline: "none",
    boxShadow: "inset 0 1px 1px rgba(0,0,0,0.03)",
  };

  const buttonStyle = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #d1d5db",
    background: "#f8fafc",
    color: "#0f172a",
    fontWeight: 700,
    fontSize: 13,
    cursor: isSaving ? "not-allowed" : "pointer",
    opacity: isSaving ? 0.7 : 1,
    pointerEvents: isSaving ? "none" : "auto",
  };

  return (
    <div style={surfaceStyle}>
      <div style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 style={headingStyle}>Bookmark current chat</h2>
          </div>
          <button type="button" style={buttonStyle} onClick={refreshCurrentChat} disabled={loadingChat}>
            <FiRefreshCw size={14} />
            {loadingChat ? "Checking..." : "Reload"}
          </button>
        </div>

        <div style={{ marginTop: 10 }}>
          <p style={{ ...subTextStyle, marginBottom: 6 }}>
            {currentChat?.id ? (
              <span style={{ fontWeight: 700, color: "#0f172a" }}>{currentChat.title}</span>
            ) : (
              "Open a chat to enable bookmarking."
            )}
          </p>
          <input
            type="text"
            style={inputStyle}
            placeholder="Enter a name for this chat"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isSaving || !currentChat?.id}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
            }}
          />
          <div style={{ marginTop: 10 }}>
            <button type="button" style={{ ...buttonStyle, background: "#111827", color: "#f8fafc", borderColor: "#0f172a" }} onClick={handleSave} disabled={isSaving || !currentChat?.id}>
              <FiSave size={14} />
              Save bookmark
            </button>
          </div>
        </div>
      </div>

      <div style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={headingStyle}>Saved chats</h3>
          <span style={{ ...pill, background: "#f1f5f9", color: "#475569" }}>{bookmarkList.length} total</span>
        </div>
        {bookmarkList.length === 0 ? (
          <p style={{ ...subTextStyle, fontStyle: "italic" }}>No saved chats yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8, maxHeight: 220, overflowY: "auto" }}>
            {bookmarkList.map((entry) => (
              <div key={entry.id} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 10, background: "#f8fafc" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4, minWidth: 0 }}>
                      <span style={{ fontWeight: 700, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.label}</span>
                    </div>
                    {entry.url && (
                      <a href={entry.url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "#2563eb", textDecoration: "underline" }}>
                        Open chat
                      </a>
                    )}
                  </div>
                  <button
                    type="button"
                    style={{ ...buttonStyle, borderColor: "#fecdd3", color: "#b91c1c", background: "#fff7ed" }}
                    onClick={() => handleDelete(entry.id)}
                    disabled={isSaving}
                  >
                    <FiTrash2 size={14} />
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {status && (
        <div style={{ ...cardStyle, background: "#f8fafc" }}>
          <p style={{ margin: 0, fontSize: 13, color: "#475569" }}>{status}</p>
        </div>
      )}
    </div>
  );
}
