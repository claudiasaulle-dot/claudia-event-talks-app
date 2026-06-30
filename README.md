# BigQuery Release Pulse

A modern, responsive, and visually rich web dashboard that fetches Google BigQuery release notes and enables users to easily draft and share updates to X (Twitter).

The application is built using a **Python Flask** backend and a plain, vanilla **HTML/CSS/JavaScript** frontend, designed with sleek aesthetics (dark mode, glassmorphism, dynamic transitions, and progress loaders).

---

## Features

- **Real-Time Synchronization**: Pulls directly from the official [Google BigQuery Release Notes RSS/Atom Feed](https://docs.cloud.google.com/feeds/bigquery-release-notes.xml).
- **Smart Caching**: Implements server-side caching (5 minutes lifetime) to reduce overhead and improve responsiveness.
- **Advanced Filtering & Search**: Filter updates by category (*Features, Changes, Deprecations, General*) or perform real-time text searches.
- **X (Twitter) Composer**: 
  - Click on any release card to load it into the compose side-panel.
  - Automatically drafts a curated post containing the release title, category emoji, and a link back to Google Cloud Docs.
  - Features a custom circular character-limit ring matching X's specific URL length counting rules (links count as exactly 23 characters).
  - Quick buttons for **Copying Text** or direct **Posting to X** via Web Intent.
- **Responsive Layout**: Designed for mobile and desktop screens using a CSS Grid layout with custom animations.

---

## Tech Stack

- **Backend**: Python 3, Flask, BeautifulSoup4 (HTML parsing/sanitizing), Urllib.
- **Frontend**: Vanilla HTML5, Vanilla CSS3 (custom properties, variables, keyframes), Vanilla JavaScript (ES6+).
- **Icons & Fonts**: Google Fonts (Outfit & Inter), FontAwesome 6.

---

## Project Structure

```text
├── app.py                 # Flask server & feed parsing logic
├── requirements.txt       # Python dependencies
├── .gitignore             # Standard git exclusions (venv, cache, OS files)
├── templates/
│   └── index.html         # Main dashboard template
└── static/
    ├── app.js             # Client-side state, filtering, & Twitter composer logic
    └── style.css          # Styling & responsive layout variables
```

---

## Installation & Setup

### Prerequisites

Ensure you have Python 3.x installed on your machine.

### 1. Clone & Navigate

Navigate to the project root directory:
```bash
cd /Users/claudia/agy-cli-projects
```

### 2. Install Dependencies

Install the required packages using `pip`:
```bash
pip install -r requirements.txt
```

### 3. Run the Flask Server

Start the application:
```bash
python3 app.py
```

By default, the server runs on **`http://127.0.0.1:5001`** (port 5001 was selected to avoid conflict with the default macOS AirPlay Receiver port 5000).

---

## How It Works (Request-Response Flow)

1. **User Action**: The user clicks the **Refresh Notes** button.
2. **API Call**: The frontend sends an HTTP GET request to `/api/releases?refresh=true`.
3. **Parsing**: The Flask backend fetches the Atom feed XML from Google Cloud, parses the sub-categories, sanitizes links to make them absolute and open in new tabs, updates the local cache, and returns a JSON payload.
4. **Render**: JavaScript dynamically injects the formatted release notes into the dashboard layout and updates the sync timer badge.
