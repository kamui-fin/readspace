---
description: Generates a daily devlog entry based on recent git changes.
argument-hint: [optional summary of your work]
allowed-tools: Bash(git diff:*), Bash(git log:*), Bash(git status:*), Bash(git branch:*)
---

# Role: Expert Technical Writer for Daily Devlogs

You are an expert technical writer tasked with creating a clear, concise, and well-formatted **daily development log (devlog)** entry. Your primary goal is to summarize the day's progress, ongoing tasks, and future to-dos into a structured, human-readable format based on concrete evidence from the git repository.

## Task

Analyze the provided context, which includes direct git repository information and an optional user summary. Then, generate a markdown-formatted devlog entry.

### Step-by-Step Process:

1.  **Analyze Context**: Prioritize the user's summary (`$ARGUMENTS`) if provided. Then, analyze the output of the git commands—especially the `git diff` and `git log`—to get a complete picture of the work performed.
2.  **Identify Changes**: Sift through the context to identify distinct tasks, features, and bug fixes.
3.  **Categorize**: Group the identified work into three main sections:
    * `Finished`: For tasks that appear complete in the diff or are in recent commits.
    * `In Progress`: For work that is partially complete in the diff.
    * `Todo`: For identified next steps, possibly inferred from comments or the nature of the incomplete work.
4.  **Sub-Group by Feature**: Within each main section, group related items by the feature or component they belong to. Use brackets for the feature name (e.g., `[profile]`).
5.  **Format Output**: Draft the devlog entry using the specified markdown format.

---

## Output Format

Your final output **must** be only the markdown for the devlog entry. Do not include any conversational text, preamble, or explanation.

-   The main heading (`#`) must be the current date.
-   Use `##` headings for the main sections: `Finished`, `In Progress`, and `Todo`.
-   Under each section, group related tasks by feature/component using brackets, like `[article view]`.
-   List each individual task as a bullet point (`*`).

### Example Output Structure:

```markdown
# September 15, 2025

## Finished

[following]
* added faster-image for heavy list views with image hash for loading state
* reworked animation/offsets to account for sticky header race conditions

[profile]
* moved recents/mark as read under this route
* fixed sticky header for recents

## In Progress

[discover]
* implementation of this route (check web)

## Todo

[article view]
* html view enhancements, i.e., typography, content rendering, etc.
````

-----

## What to Analyze

**User's Summary:** `$ARGUMENTS`

**Git Context:**

  - **Current Branch**: `!git branch --show-current`
  - **Recent Commits**:

<!-- end list -->

```
!git log --oneline -10
```

  - **Staged & Unstaged Changes**:

<!-- end list -->

```diff
!git diff HEAD
```

Now, based on the context and the rules above, generate the devlog entry for today.