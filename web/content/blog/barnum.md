---
title: "barnum"
description: "My status bar is a synecdoche for the strengths and weaknesses of the Unix environment"
date: 2018-05-11T19:57:15-07:00
url: /blog/barnum.html
draft: true
---

# outline

 - motivation
    - UNIXing the GUI
    - intro to bspwm && lemonbar
    - lemonbar just reads from stdin, oof
    - set up our examples:
        - `echo`: notifications, must appear immediately, disappear after a bit
        - `sys`: things like volume up/down, brightness up/down
        - `time`: doesn't need to do much but update occasionally
        - `battery`: must update occasionally, *and* when we plug/unplug
 - `$PT_FIFO`
    - motivation for
    - fifos are just pipes but with multiple writers
    - what happens with multiple readers?
    - what happens when the fifo isn't there?
    - final product: `sideshow.sh` and usage
 - `barnum`
    - how do the layout? (this one's actually pretty easy)
    - the `BARNUM_^(LEFT CENTER RIGHT)` config
    - final product: `barnum` and usage
 - `pt-run`, `pt-loop`, and `pt/*`
    - we can now write things simply
    - but there's some catches: what if the FIFO isn't there? what if `$PT_FIFO` isn't set?
    - also it's a pain to muddy our writer scripts with all those redirections
    - `pt-run` takes care of it!
        - introduce the `pt/$foo` conceit here
        - we have a basic `pt/echo` now!
    - what about loops? `pt-loop`!
        - what about plugging power in? -- signals, etc.
 - what about expiration?
    - there's concurrency here that shells just can't handle
    - Go does concurrency good though
    - you have to wire it up with a second fifo ... i know this sucks
 - what about real notifications?

---

# notes

 - Style: first-person, present-tense, colloquial ("I can do this, but that would suck.", "Okay, then now I've got this.", "This works... okay.  Can I do better?")
    - (This is an illustrative narrative, not a thesis)
 - Use consistent examples throughout! "Bar, with `echo`, `sys`, `time`, and `battery`"
    - Explicitly introduce the use cases somewhere early on, call back to them
    - Describe, early on, the full desired behavior of each one (incl. charging status, notifications, expiration, etc.)
 - Throughout, show the final scripts *and* how they get called in `bspwmrc`
    - This means we'll want to introduce `bspwmrc` somewhere early
    - This also means we'll want to clarify the difference between the "final" scripts from their "draft" counterparts
 - Do we want to graph the processes/files/pipes?
 - GLOSSARY -- use common terms!
    - what is barnum? what is `sideshow.sh`? what are the `pt`s?
    - "expiration"?
