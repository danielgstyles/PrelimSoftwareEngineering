# PrelimSoftwareEngineering

Interactive lessons for the NSW Software Engineering Preliminary course

Published from GitHub Pages: **https://danielgstyles.github.io/PrelimSoftwareEngineering/**

Static HTML/CSS/JS. No build step, no dependencies, no tracking. Each lesson is a
self-contained folder that also runs by opening its `index.html` directly from disk.

## Do not edit these files here

This repo is **generated**. The source of truth for every page lives in the private
teaching wiki, and this copy is overwritten on every publish:

    python3 tools/publish-lesson-sites/build.py

Edit the lesson there, re-run that script, and commit what it produces.

## Student privacy

Answers are stored with `localStorage` in the student's own browser and are never
transmitted. Clearing site data, or using a different browser or computer, starts
the lesson fresh. Nothing on these pages collects a name, an email or an IP beyond
GitHub's own server logs.
