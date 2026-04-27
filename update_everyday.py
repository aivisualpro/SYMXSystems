import re

fpath = "app/(protected)/everyday/page.tsx"
with open(fpath, "r") as f:
    content = f.read()

# 1. Add state for attachments
state_addition = """    const [attachments, setAttachments] = useState<string[]>([]);
    const [isAttachmentsModalOpen, setIsAttachmentsModalOpen] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
"""
content = re.sub(r'const \[notes, setNotes\] = useState\(""\);', r'const [notes, setNotes] = useState("");\n' + state_addition, content)

# 2. Update fetchData
fetch_search = r'const fetchedNotes = notesData\.notes \|\| "";\s*setNotes\(fetchedNotes\);\s*setDebounceNotes\(fetchedNotes\); // prevent instant auto-save on load'
fetch_replace = """const fetchedNotes = notesData.notes || "";
                setNotes(fetchedNotes);
                setDebounceNotes(fetchedNotes); // prevent instant auto-save on load
                setAttachments(notesData.attachments || []);"""
content = re.sub(fetch_search, fetch_replace, content)

# 3. Update saveNotesToDB
save_search = r'const saveNotesToDB = useCallback\(async \(notesToSave: string\) => \{\s*if \(\!date\) return;\s*setSavingNotes\(true\);\s*try \{\s*const res = await fetch\("/api/everyday", \{\s*method: "POST",\s*headers: \{ "Content-Type": "application/json" \},\s*body: JSON\.stringify\(\{ date, notes: notesToSave \}\)\s*\}\);'
save_replace = """const saveNotesToDB = useCallback(async (notesToSave: string, attsToSave: string[] = attachments) => {
        if (!date) return;
        setSavingNotes(true);
        try {
            const res = await fetch("/api/everyday", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ date, notes: notesToSave, attachments: attsToSave })
            });"""
content = re.sub(save_search, save_replace, content)

# 4. Fix dependencies of saveNotesToDB
content = re.sub(r'\} catch \(error\) \{\s*toast\.error\("Error auto-saving notes"\);\s*\} finally \{\s*setSavingNotes\(false\);\s*\}\s*\}, \[date\]\);',
                 r"""} catch (error) {
            toast.error("Error auto-saving notes");
        } finally {
            setSavingNotes(false);
        }
    }, [date, attachments]);""", content)

# 5. Fix UI layout for Notes
ui_search = r'<div className="relative flex-1 min-w-0 h-10 flex items-center">'
ui_replace = '<div className="relative w-full max-w-2xl h-10 flex items-center">'
content = re.sub(ui_search, ui_replace, content)

# 6. Add Attachments button inside Notes input
btn_search = r'<div className="absolute right-1 flex items-center gap-1\.5 pointer-events-auto">\s*<Button\s*onClick=\{handleSaveNotes\}\s*disabled=\{savingNotes\}'
btn_replace = """<div className="absolute right-1 flex items-center gap-1.5 pointer-events-auto">
                            <Button 
                                onClick={() => setIsAttachmentsModalOpen(true)}
                                variant="outline" 
                                size="sm" 
                                className="h-8 relative border-border/50 hover:bg-muted bg-background"
                            >
                                <Paperclip className="h-4 w-4 mr-1.5 text-muted-foreground" />
                                Attachments
                                {attachments.length > 0 && (
                                    <span className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-primary text-[10px] font-bold text-primary-foreground flex items-center justify-center ring-2 ring-background">
                                        {attachments.length}
                                    </span>
                                )}
                            </Button>
                            <Button
                                onClick={handleSaveNotes}
                                disabled={savingNotes}"""
content = re.sub(btn_search, btn_replace, content)

# 7. Add Dialog component
modal_code = """
            {/* Attachments Modal */}
            <Dialog open={isAttachmentsModalOpen} onOpenChange={setIsAttachmentsModalOpen}>
                <DialogContent className="sm:max-w-[700px] bg-card/95 backdrop-blur-xl border-border shadow-2xl p-0 overflow-hidden">
                    <DialogHeader className="px-6 py-4 border-b border-border bg-muted/20">
                        <DialogTitle className="text-lg font-bold flex items-center gap-2">
                            <Paperclip className="h-5 w-5 text-primary" />
                            Attachments ({attachments.length})
                        </DialogTitle>
                    </DialogHeader>
                    <div className="p-6">
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-6">
                            {attachments.map((url, i) => (
                                <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-border group bg-muted/30">
                                    <img src={url} alt={`Attachment ${i}`} className="object-cover w-full h-full hover:scale-105 transition-transform" />
                                    <button 
                                        className="absolute top-2 right-2 h-6 w-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                                        onClick={async () => {
                                            const newAtts = attachments.filter((_, idx) => idx !== i);
                                            setAttachments(newAtts);
                                            await saveNotesToDB(notes, newAtts);
                                        }}
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                </div>
                            ))}
                            {attachments.length === 0 && (
                                <div className="col-span-full py-12 flex flex-col items-center justify-center text-muted-foreground/60 border-2 border-dashed border-border rounded-xl bg-muted/10">
                                    <ImagePlus className="h-8 w-8 mb-2 opacity-50" />
                                    <p className="text-sm font-medium">No attachments yet</p>
                                </div>
                            )}
                        </div>
                        <div className="flex justify-end">
                            <input 
                                type="file" 
                                multiple 
                                accept="image/*" 
                                className="hidden" 
                                ref={fileInputRef}
                                onChange={async (e) => {
                                    if (!e.target.files?.length) return;
                                    setUploadingImage(true);
                                    try {
                                        const newUrls: string[] = [];
                                        for (let i = 0; i < e.target.files.length; i++) {
                                            const file = e.target.files[i];
                                            const formData = new FormData();
                                            formData.append("file", file);
                                            const res = await fetch("/api/admin/upload?folder=symx-systems/everyday", {
                                                method: "POST",
                                                body: formData
                                            });
                                            if (!res.ok) throw new Error("Failed to upload image");
                                            const data = await res.json();
                                            newUrls.push(data.secure_url);
                                        }
                                        const updatedAtts = [...attachments, ...newUrls];
                                        setAttachments(updatedAtts);
                                        await saveNotesToDB(notes, updatedAtts);
                                        toast.success("Attachments uploaded successfully");
                                    } catch (err: any) {
                                        toast.error(err.message || "Failed to upload");
                                    } finally {
                                        setUploadingImage(false);
                                        if (fileInputRef.current) fileInputRef.current.value = '';
                                    }
                                }}
                            />
                            <Button 
                                onClick={() => fileInputRef.current?.click()} 
                                disabled={uploadingImage}
                            >
                                {uploadingImage ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                                {uploadingImage ? "Uploading..." : "Upload Images"}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
"""

content = content.replace("        </div>\n    );\n}", modal_code + "\n        </div>\n    );\n}")

# 8. Add imports if needed: Paperclip, ImagePlus
if "Paperclip" not in content:
    content = content.replace("import {", "import { Paperclip, ImagePlus, ")

with open(fpath, "w") as f:
    f.write(content)

print("Updated everyday page for attachments")
