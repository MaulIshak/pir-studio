---
name: ui-copy-conventions
description: Strict guidelines for UI language, microcopy brevity, and clean labeling in GameDev Project Manager. All UI text must be in English, ultra-concise, and free of parenthetical annotations.
---

# UI Copy & Labeling Conventions

## 1. Language Requirement
- **All UI text must be in English**: Headings, navigation links, table headers, form labels, buttons, tooltips, placeholders, empty states, and toast/alert messages must strictly use clear, standard English.
- All technical documentation, code comments, and sprint markdown files must also be written in English.

## 2. Ultra-Brief Labels (Clean Microcopy)
- Keep all UI labels and action triggers as brief and direct as possible.
- Avoid verbose phrases, obvious instructions, or redundant explanations.
- Prefer single words or 2-word labels whenever possible:
  - Use `New Project` instead of `Create a New Project for the Team`
  - Use `Status` instead of `Current Project Status`
  - Use `Export` instead of `Export Credits List to Document`
  - Use `Upload` instead of `Upload New Asset File to Storage`
  - Use `Save` instead of `Save Changes to Database`

## 3. Strict Elimination of Parentheticals
- **Never include parenthetical clarifications in labels or names**:
  - ❌ `Design (Figma/FigJam)` ->  `Design`
  - ❌ `Type (Jam / Competition / Internal)` ->  `Type`
  - ❌ `Status (Active / Completed / Archived)` ->  `Status`
  - ❌ `Needs Credit? (External License)` ->  `Needs Credit`
  - ❌ `Artifact Links (External URLs)` ->  `Artifacts`
- Subfolder naming in Google Drive must also be clean and free of parentheticals:
  - ❌ `/GameDev Team/[Project]/Design (Figma-FigJam)/` ->  `/GameDev Team/[Project]/Design/`

## 4. Minimalist State Messages
- **Empty States**: Keep them to one brief title and an action button.
  - ❌ "You currently do not have any tasks assigned under this milestone yet. Please click below to add one."
  -  Title: `No tasks`, Action: `New Task`
- **Error States**: Direct and informative without technical jargon.
  -  `Unable to load project. Please retry.`
