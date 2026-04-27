import re

fpath = "lib/models/SymxEveryday.ts"
with open(fpath, "r") as f:
    content = f.read()

# Add attachments to ISymxEveryday
content = content.replace("notes: string;", "notes: string;\n  attachments: string[];")

# Add attachments to Schema
schema_addition = """    notes: {
      type: String,
      default: '',
    },
    attachments: {
      type: [String],
      default: [],
    },"""

content = content.replace("""    notes: {
      type: String,
      default: '',
    },""", schema_addition)

with open(fpath, "w") as f:
    f.write(content)

print("Updated SymxEveryday model")
