# Historical assets

- `rockets-2003.svg`: Houston Rockets 2003 icon, retrieved from [Logos Download](https://logos-download.com/brands/houston-rockets), [source SVG](https://i.logos-download.com/4082/31655-2aedccbddfd3ffce53257949c4671df1.svg/Houston_Rockets_Logo_2003_icon.svg). Geometry and colors retained; unused gradient definitions and export metadata removed, viewBox added. The Houston Rockets own their team mark. This site is an independent fan tribute, not an official team site.
- The ending uses ESPN's official [SportsCenter archive upload](https://www.youtube.com/watch?v=s4QuUYG6kxI), embedded through the official YouTube IFrame API. No footage is downloaded or redistributed. Segment: 0:44–1:00, showing the steal, final shot, and replay. Verified playback in the local browser. NBA uploads DF0SdKpErXA and 9C6gDS9YGAU returned embed error 150, so they are not used for the ending.
- Reference player documentation: [parameters](https://developers.google.com/youtube/player_parameters), [IFrame API](https://developers.google.com/youtube/iframe_api_reference).

## Player portraits

Original transparent NBA profile images, served locally so gameplay does not depend on a third-party image request. Canvas crops show faces only; illustrated Houston/Spurs uniforms remain part of the game. These are archived profile portraits from different seasons, not claimed to be photographs taken on December 9, 2004. Players without an available portrait retain the illustrated head; image load failures use the same fallback.

| File | Player | Official source |
| --- | --- | --- |
| `players/mcgrady.png` | Tracy McGrady | https://cdn.nba.com/headshots/nba/latest/1040x760/1503.png |
| `players/yao.png` | Yao Ming | https://cdn.nba.com/headshots/nba/latest/1040x760/2397.png |
| `players/sura.png` | Bob Sura | https://cdn.nba.com/headshots/nba/latest/1040x760/682.png |
| `players/duncan.png` | Tim Duncan | https://cdn.nba.com/headshots/nba/latest/1040x760/1495.png |
| `players/bowen.png` | Bruce Bowen | https://cdn.nba.com/headshots/nba/latest/1040x760/1477.png |
| `players/parker.png` | Tony Parker | https://cdn.nba.com/headshots/nba/latest/1040x760/2225.png |
| `players/barry.png` | Brent Barry | https://cdn.nba.com/headshots/nba/latest/1040x760/699.png |

All portrait rights remain with their respective owners. The illustrated Houston #40 represents Ryan Bowen, who was on the [December 9 roster](https://www.nba.com/game/0020400273/box-score).

## One Touch / OG Anunoby arcade

`og-tip.html` uses original canvas court art, illustrated uniforms, procedural crowd animation and synthesized audio. The text callouts are original arcade copy, not transcriptions of the television broadcast. Gameplay spacing, reach, jump windows, opponent movement and the rebound trajectory are adaptations, not tracking-data measurements.

Historical reference: [NBA official Game 4 scorer's report and play-by-play](https://statsdmz.nba.com/pdfs/20260610/20260610_SASNYK_book.pdf), June 10, 2026, Madison Square Garden. The final possession lists Brunson's missed 31-foot three at 4.4, Anunoby's rebound at 2.3, tip layup at 2.1, and the Spurs timeout at 1.2. This game starts with 4.4 on its arcade clock; it stops on the successful tip, without simulating the Spurs' final inbound. [NBA's official highlight](https://www.youtube.com/watch?v=sOQKRjP3ZJk) is linked and optionally embedded, not downloaded. Exact floor coordinates are not asserted.

The ten local portraits are NBA profile assets; they are not represented as photographs taken on the game date. Canvas uses face crops over illustrated uniforms. All image rights remain with their respective owners.

| File | Player | Official source |
| --- | --- | --- |
| `players/anunoby.png` | OG Anunoby | https://cdn.nba.com/headshots/nba/latest/1040x760/1628384.png |
| `players/brunson.png` | Jalen Brunson | https://cdn.nba.com/headshots/nba/latest/1040x760/1628973.png |
| `players/towns.png` | Karl-Anthony Towns | https://cdn.nba.com/headshots/nba/latest/1040x760/1626157.png |
| `players/bridges.png` | Mikal Bridges | https://cdn.nba.com/headshots/nba/latest/1040x760/1628969.png |
| `players/shamet.png` | Landry Shamet | https://cdn.nba.com/headshots/nba/latest/1040x760/1629013.png |
| `players/wembanyama.png` | Victor Wembanyama | https://cdn.nba.com/headshots/nba/latest/1040x760/1641705.png |
| `players/fox.png` | De'Aaron Fox | https://cdn.nba.com/headshots/nba/latest/1040x760/1628368.png |
| `players/vassell.png` | Devin Vassell | https://cdn.nba.com/headshots/nba/latest/1040x760/1630170.png |
| `players/castle.png` | Stephon Castle | https://cdn.nba.com/headshots/nba/latest/1040x760/1642264.png |
| `players/harper.png` | Dylan Harper | https://cdn.nba.com/headshots/nba/latest/1040x760/1642844.png |

Implementation: HTML, CSS and both scripts are in `og-tip.html`. Deploy it together with these local portrait assets. No build step, framework, remote fonts, or analytics. Gameplay runs locally; the optional highlight uses YouTube’s IFrame API. Daily progress stays in browser local storage. Sound begins only after a user gesture and can be muted. Historical copy verified October 16, 2026.

### One Touch fixed-possession upgrade

The playable possession now always starts NYK 105–SAS 106 with 4.4 on the arcade clock. A constant seed (20260610) fixes Brunson's miss, the rebound, and all nine other players' routes. Only OG's user-controlled movement, jump, and contact affect the finish. Practice changes playback speed, not the possession. The optional five-finish/three-life streak run repeats that same simulation without increasing difficulty. This is a deterministic arcade adaptation of the historical play, not motion-capture or tracking-data reconstruction.

OG tips automatically when an airborne hand reaches the ball; no second button press is required. A brief approach slowdown and contact freeze, differentiated touch grades, net movement, and synthesized impact/crowd audio provide feedback. Reduced-motion mode omits the slowdown/freeze and camera motion. A missed attempt shows the closest recorded read and one coaching instruction; replay, detailed grades, sharing, and official footage are optional after a short celebration or immediate miss result.

The optional official NBA highlight uses YouTube's IFrame API and privacy-enhanced player. Playback of `sOQKRjP3ZJk` was verified in the local in-app browser on October 16, 2026. The clip remains on YouTube; no video or broadcast audio is redistributed. Autoplay blocking, loading failures, and skip/restart leave the saved result intact.

Replays store actual player and ball positions. Broadcast and overhead projections are available, along with a fixed camera. Vassell's lane commitment, Harper's pursuit, Wembanyama's recovery, and the celebrations are original gameplay adaptations. Best-attempt ghosts, moment results, and streak records are stored locally; earlier daily-mode records are retained under their original storage keys. PNG share cards use the attempt's actual score, grades, and route.

### Arena and team mark

`knicks-primary.svg` is the official Knicks primary logo served by the NBA CDN at https://cdn.nba.com/logos/nba/1610612752/primary/L/logo.svg and linked from https://www.nba.com/knicks/. Retrieved October 16, 2026. The original SVG is retained; it is displayed on the court and scoreboard. Team marks remain the property of their respective owners; this independent fan arcade does not claim affiliation.

The denser stands, individual spectator poses, towels, phones, signs, seating, rails and ribbon boards are original canvas artwork. Crowd motion is varied per spectator and responds to the shot, rebound, and make. Reduced-motion settings keep continuous fan motion still.

Gameplay uses only crowd and game sound effects. Synthetic voice commentary has been removed. The optional official NBA video remains remote.

### Inbound lead-in and courtside cameos

The full-play option adds a deterministic 3.6-second stylized sideline inbound, Brunson receiving/dribbling on the right, and Wembanyama closing on the jumper. It contains no screen action. Control passes to OG at release, joining the same playable state as Shot Only; the lead-in positions and clock are an arcade staging, not verified tracking data. Pause and skip preserve the handoff. Gameplay, ghost paths, and the existing rebound remain fixed.

Courtside cameos are fictional seating, not a claim of attendance. Original portrait files are retained, with crops/oval masks applied only when drawn:

- `crowd/spike.jpg`: **Spike Lee Headshot**, Tessa Bury, [source](https://commons.wikimedia.org/wiki/File:Spike_Lee_Headshot.jpg), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- `crowd/taylor.jpg`: **Taylor Swift 2019 by Glenn Francis (cropped)**, © Glenn Francis, www.PacificProDigital.com; existing crop by Damian Vo. [Source](https://commons.wikimedia.org/wiki/File:Taylor_Swift_2019_by_Glenn_Francis_(cropped).jpg), [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). The displayed portrait crop/mask adaptation retains CC BY-SA 4.0.
- `crowd/jerry.jpg`: **Jerry Seinfeld 2016 - 2**, slgckgc, [source](https://commons.wikimedia.org/wiki/File:Jerry_Seinfeld_2016_-_2.jpg), [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/).

The same attribution appears in the game's Photo Credits disclosure. Spike jumps, Taylor raises her arms, and Jerry claps after a make. Reduced motion suppresses continuous motion.

### Game link preview artwork

`og-tip-share.png` is the 1200 × 630 social preview for `https://vikramdimba.com/og-tip.html`. It combines the existing NBA Anunoby portrait with original typography, colors, and court linework. Its editable HTML/CSS source is `tools/og-share-card.html`; render that page at 1200 × 630 to export a replacement. The homepage selector reuses the existing McGrady and Anunoby portraits. No additional third-party images were introduced for this integration.

### Optional real call behavior

No Breen recording, synthesized voice, or extracted broadcast audio is bundled. The local Audio file control decodes a user-selected clip in memory, permits a start offset, and plays up to eight seconds exactly at the made-basket event. Nothing is uploaded or persisted; reloading removes the clip. Restart, mute, mode changes, backgrounding, and replay stop the call. Pending decodes are invalidated on removal/replacement. Clip failure does not block gameplay. For a published version, a supplied cleared recording can be packaged separately.

### OG movement usability

Full Play now freezes at Brunson's release until a movement input arrives. Held keyboard and direction-pad input carries across the inbound handoff. During the active possession, movement keys work from other focused controls (editable fields are excluded). Clicking/tapping the floor sets a destination using the current camera projection; dragging changes it, and keyboard/pad input overrides it. The ready-state orange button is dedicated to hold/release jump control. It does not start an automatic run. A labeled orange ring identifies OG, and a compact court guide explains the controls. Blur/pause clears inputs. Shot Only retains immediate starts for quick practice.


### Direction pad and mobile input correction

The direction pad uses 48-pixel mobile buttons alongside a separate jump button. Quick taps produce a short, bounded step even when pointerdown and pointerup occur between simulation frames; holds continue moving and stop receiving input on release. Each button also supports keyboard/screen-reader click activation. A direction input can start an idle game immediately or resume a paused possession. Editable fields remain excluded from game shortcuts. Two simultaneous pointer IDs are supported for steering with one thumb while charging/releasing a jump with the other; cancelling one pointer does not cancel the other control. The optional court destination input remains available, but the primary instructions use arrows and the jump button.

Verified with 80 automated tests, including all four pad directions, quick taps, keyboard movement without canvas focus, pause/resume, and simultaneous movement/jump pointers. Single arrow clicks and keyboard presses were also exercised in the browser at a 390-pixel viewport. This is a responsive browser check, not testing on a physical phone.
