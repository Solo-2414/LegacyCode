# Game sounds

All files are loaded by `components/game-audio-provider.tsx`. The mp3s here are generated placeholders:
replace any of them with your own file using the SAME file name and nothing else needs to change.

| File | When it plays | Who hears it |
|---|---|---|
| lobby-bgm.mp3 | Looping while the room is in LOBBY | Host |
| player-join.mp3 | A new player joins | Host |
| game-start.mp3 | Lobby -> first question | Host |
| timer-tick.mp3 | Each second until 5s remain | Host |
| timer-urgent.mp3 | Each second for the last 5s | Host |
| time-up.mp3 | Timer hits 0 | Host |
| answer-select.mp3 | Player taps an option / locks in answer | Player |
| reveal.mp3 | Correct answer is revealed | Host + Player |
| correct.mp3 / wrong.mp3 | Result of the player's answer | Player |
| points-tally.mp3 | Player earned points | Player |
| podium-fanfare.mp3 | Room becomes COMPLETED | Host + Player + Podium page |
