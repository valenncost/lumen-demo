# Lumen Odontología (demo)

Demo website for a fictional dental clinic: services, team, FAQ and an online booking flow that ends in a ready-to-send WhatsApp message, plus a small admin panel (`panel.html`) to change hours, durations and messages.

Everything runs in **demo mode** (`modoDemo: true` in `config.js`): no real WhatsApp is opened and data lives only in the browser (`localStorage`).

**Live:** https://cono-agency.costanzovalentino09.workers.dev/demos/consultorio/

## Stack
Static HTML, CSS and vanilla JS. All editable content (name, hours, treatments, prices, team, FAQ) lives in `config.js`.

## Deploy
Vercel (project `lumenodontologia` → https://lumenodontologia.vercel.app), deploys on every push to `main`.
