import { useState, useEffect } from "react";
import { Loader2, X, FileText, MessageSquare, UserCheck, Save, Edit2, Trash2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function EmployeeNotesPanel({
  open,
  onClose,
  employee,
  onNoteAdded
}: {
  open: boolean;
  onClose: () => void;
  employee: { employeeId: string; transporterId: string; name: string } | null;
  onNoteAdded: (transporterId: string) => void;
}) {
  const [notesList, setNotesList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [newNoteText, setNewNoteText] = useState("");
  const [submittingNote, setSubmittingNote] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState("");
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);

  useEffect(() => {
    if (open && employee) {
      setLoading(true);
      fetch(`/api/schedules/notes?transporterId=${encodeURIComponent(employee.transporterId)}`)
        .then(res => res.json())
        .then(data => {
          setNotesList(data.notes || []);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      setNotesList([]);
      setNewNoteText("");
    }
  }, [open, employee]);

  if (!open) return null;

  const handleCreateNote = async () => {
    if (!newNoteText.trim() || submittingNote || !employee) return;
    setSubmittingNote(true);
    try {
      const res = await fetch("/api/schedules/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: employee.employeeId,
          transporterId: employee.transporterId,
          note: newNoteText.trim(),
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error();
      
      setNotesList(prev => [data.note, ...prev]);
      setNewNoteText("");
      onNoteAdded(employee.transporterId);
    } catch (err) {}
    setSubmittingNote(false);
  };

  const handleUpdateNote = async (id: string) => {
    if (!editingNoteText.trim() || !id) {
      setEditingNoteId(null);
      return;
    }
    
    try {
      const res = await fetch(`/api/schedules/notes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: editingNoteText.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error();
      
      setNotesList(prev => prev.map(n => n._id === id ? data.note : n));
    } catch (err) {}
    setEditingNoteId(null);
  };

  const handleDeleteNote = async (id: string) => {
    if (!id || !employee) return;
    setDeletingNoteId(id);
    try {
      const res = await fetch(`/api/schedules/notes/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      
      setNotesList(prev => prev.filter(n => n._id !== id));
      // Optionally decrement the note counter if needed, or leave it optimistic 
      // depends if we passed an onNoteRemoved callback. We can just keep it simple.
    } catch (err) {}
    setDeletingNoteId(null);
  };

  return (
    <div className="fixed inset-0 z-[100] flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      {/* Panel */}
      <div className="relative w-full max-w-[100vw] sm:max-w-md bg-card border-l border-border shadow-2xl flex flex-col animate-in slide-in-from-right-full duration-300">
        {/* Panel Header */}
        <div className="shrink-0 px-5 py-4 border-b border-border bg-gradient-to-r from-blue-500/10 to-cyan-500/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-500/20 flex items-center justify-center ring-1 ring-blue-500/30">
                <FileText className="h-4.5 w-4.5 text-blue-400" />
              </div>
              <div>
                <h2 className="text-sm font-bold">Employee Notes</h2>
                <p className="text-[10px] text-muted-foreground">
                  {employee?.name || ""} · {notesList.length} note{notesList.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Panel Content (Notes Table) */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
            </div>
          ) : notesList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-14 h-14 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                <MessageSquare className="h-7 w-7 text-muted-foreground/50" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">No notes found</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Add a note below to get started.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {notesList.map((noteItem, i) => (
                <div key={noteItem._id || i} className="group bg-muted/30 rounded-xl p-3.5 border border-border/50 hover:border-border transition-colors">
                  {editingNoteId === noteItem._id ? (
                    <div className="flex items-center gap-2 mb-3">
                      <Input
                        value={editingNoteText}
                        onChange={e => setEditingNoteText(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter") handleUpdateNote(noteItem._id);
                          if (e.key === "Escape") setEditingNoteId(null);
                        }}
                        className="h-8 text-sm placeholder:text-muted-foreground/50 border-primary/30 focus-visible:ring-primary/20"
                        autoFocus
                      />
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10" onClick={() => handleUpdateNote(noteItem._id)}>
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => setEditingNoteId(null)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <p className="text-sm text-foreground break-words">{noteItem.note}</p>
                  )}
                  
                  <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
                    <div className="flex items-center gap-1.5 bg-background px-2 py-1 rounded text-[10px] font-medium text-muted-foreground font-mono truncate max-w-[150px]">
                      <UserCheck className="h-3 w-3 text-blue-400 shrink-0" />
                      <span className="truncate">{noteItem.createdBy}</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {/* Action Buttons */}
                      {!editingNoteId && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            title="Edit Note"
                            onClick={() => {
                              setEditingNoteId(noteItem._id);
                              setEditingNoteText(noteItem.note);
                            }}
                            className="p-1 text-muted-foreground hover:text-blue-400 rounded transition-colors"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            title="Delete Note"
                            onClick={() => handleDeleteNote(noteItem._id)}
                            disabled={deletingNoteId === noteItem._id}
                            className="p-1 text-muted-foreground hover:text-red-400 rounded transition-colors"
                          >
                            {deletingNoteId === noteItem._id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      )}
                      
                      <div className="text-[10px] text-muted-foreground/60 bg-muted/50 px-2 py-1 rounded whitespace-nowrap">
                        {new Date(noteItem.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add Note Form */}
        <div className="shrink-0 p-4 border-t border-border bg-muted/10">
          <div className="flex gap-2">
            <Input
              placeholder="Type a note..."
              value={newNoteText}
              onChange={e => setNewNoteText(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && newNoteText.trim() && !submittingNote && employee) {
                  e.preventDefault();
                  handleCreateNote();
                }
              }}
              className="flex-1 text-sm bg-background border-primary/20 focus-visible:ring-primary/30"
              disabled={submittingNote}
            />
            <Button 
              onClick={handleCreateNote} 
              disabled={!newNoteText.trim() || submittingNote}
              className="bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-900/20"
            >
              {submittingNote ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
