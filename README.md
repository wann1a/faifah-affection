# FAIFAH Affection Bar (SillyTavern)

Install: copy this whole folder (faifah-affection) into
  SillyTavern/public/scripts/extensions/third-party/
(or data/<user>/extensions/ on newer versions), restart SillyTavern, then enable it in Extensions.

How it works: the extension injects a short instruction so the bot ends every reply with [LIKE:+N].
The tag is hidden in the chat, shown as a chip under the message, and added to the bar above the chat.
The total is recalculated from the chat itself, so swipes, edits and deleting messages stay consistent.
Settings (start value, max, per-message limits, character name) are in the Extensions panel.
