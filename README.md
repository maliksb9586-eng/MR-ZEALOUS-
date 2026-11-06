# Double Wicket Tournament — PC + Mobile

The same tournament app now has two ways to run:

- **Windows PC app:** Electron desktop project. Build a Windows installer (`.exe`) by following `BUILD_PC_WINDOWS_ROMAN_URDU.txt` on a Windows 10/11 PC.
- **Android/iPhone app:** installable PWA hosted on GitHub Pages (HTTPS). Android Chrome supports Install app; iPhone Safari supports Add to Home Screen.

## Groups and qualification

- Unlimited groups can be created.
- Maximum **32 teams total** across the tournament.
- Every active group must have at least **4 teams** to generate fixtures.
- Each group has its own round-robin schedule and points table.
- The top 4 teams from each group qualify for cross-group knockout rounds.
- Knockout rounds and byes are generated automatically when needed.
- Batting and bowling leaderboards can be filtered by group.
- Old saved v1 tournament data is migrated into Group A without changing the scoring storage key.

## Windows PC installer

On Windows 10/11 with Node.js LTS installed, open this project folder in Command Prompt and run:

```bash
npm install
npm run dist:win
```

The installer is created in `dist/`. Install it and launch Double Wicket Tournament from the desktop shortcut or Start Menu.

To run the desktop app during development:

```bash
npm install
npm start
```

## Mobile install (GitHub Pages)

1. Upload all project files and folders to the ROOT of a GitHub repository. Keep `index.html` at the root.
2. Open GitHub **Settings → Pages**.
3. Choose **Deploy from a branch**, branch `main`, folder `/(root)`, then Save.
4. Open the published HTTPS URL in Android Chrome.
5. Select **⋮ → Install app** or **Add to Home screen**.

For iPhone, open the HTTPS URL in Safari, tap Share, then Add to Home Screen.

## Existing cricket scoring system

The existing live scoring engine and its rules are retained: 3-over innings, two players per team, A-B-A/B-A-B bowling plan, 0/1/2/3/4/6/W/Wd/Nb scoring, −5 wicket penalty, strike rules, Free Hit, undo, scorecards, CRR, economy, Man of the Match, Super Overs, NRR, sharing, match history and backup/restore.

## Data and backups

The existing browser storage key is retained so old tournament data can be migrated. PC desktop and mobile browser store data separately on their own devices. Automatic cloud sync is **not** included; use Backup / Restore JSON to transfer a tournament between devices. Back up before clearing browser data or reinstalling.
