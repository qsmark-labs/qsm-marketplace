Approach: The palette is one violet hue from bandFill to info, so the accent is only a lighter
violet and cannot mark the current item. The neutrals also step in lightness by a few units only
(bandFill, background, surface), so adjacent surfaces read as fog. The status colours are the only
other hues, so they shout. I would keep the neutrals as a ladder and change the accents, after
measuring each role in OKLCH. Flow: 1. Rebuild the neutrals as a ladder of low chroma, with a
lightness step of at least about 1.3:1 between a container and its parent. 2. Give the accents
different hues at one shared lightness and chroma, for example OKLCH L 0.80, C 0.10. 3. Map the
semantic roles onto those accents: danger to red, warning to peach, success to green, info to sky.
4. Mark the one current thing with the accent and nothing else. 5. Pick one separation mechanism,
the lightness step: drop the hairlines and the shadows, so the shell speaks one separation language.
6. Check the pairs with the contrast measure and the hues with region stats on a screenshot. Next
step: Write the neutral ladder and the role map into the design source, then build the first panel
from it.
