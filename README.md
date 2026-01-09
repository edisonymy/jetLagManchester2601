# Manchester B4B - Game Tracker

An interactive web-based game tracker for the Manchester B4B (Battle 4 Britain) tag game.

## Files

- `index.html` - Main app UI with map and controls
- `app.js` - Game logic (claiming, locking, scoring)
- `doc.kml` - Manchester postcode boundary data
- `server.js` - Node.js development server
- `start_server.py` - Python development server

## Quick Start

### Option 1: Using Python (Python 3 required)
```bash
cd "/Users/edisonyi/Documents/Code/JetLag Map"
python3 -m http.server 8000
```
Then open http://localhost:8000

### Option 2: Using Node.js
```bash
cd "/Users/edisonyi/Documents/Code/JetLag Map"
node server.js
```
Then open http://localhost:8000

### Option 3: Using VS Code Live Server
1. Open folder in VS Code
2. Install "Live Server" extension
3. Right-click `index.html` → "Open with Live Server"

### Option 4: Using npx (no installation needed)
```bash
cd "/Users/edisonyi/Documents/Code/JetLag Map"
npx serve .
```

## Features

- **Interactive Map**: Dark-themed map with all Manchester postcode polygons
- **3 Teams**: Graphene, Vimto, and Program with distinct colors
- **Claiming**: Select team + postcode → Claim to capture territory
- **Locking**: Claim same territory 3 times to lock it permanently
- **Scoring**: 2 points per claim, 5 bonus for locks
- **Undo**: Reverse the last action
- **Event Log**: Full history of all game actions
- **Reset**: Clear all claims and start fresh

## Game Rules

1. Each team can claim any unclaimed or contested postcode
2. A team must claim a postcode 3 times to lock it
3. Once locked, a postcode cannot be claimed by other teams
4. Points: 2 per claim, +5 bonus when locking
