---
title: "qdo"
description: "Ideas around to-do list design"
date: 2020-08-26T14:42:00-07:00
url: /blog/qdo.html
draft: true
---

I have created exactly one web app.  This post serves as a memorial for it, since I'm tearing it down.

The reasons I'm tearing it down aren't really interesting, or related to the app itself; mostly, I'm just not willing to put in the continuing maintenance work to "run a web app", even one which is as simple as I've made it, when I'm really the only user (though I *am* willing to write blog posts when I'm their only reader, I suppose!).  In the future, I'd probably just use a git repo or something to track a text file todo list, or write a little python/shell thing.

But!  I really do like the basic design of it, and I'd like to remember the experience (and hopefully motivate myself to build something similar down the line) in a way that's a little more "tangible" than just a rotting repo on Github.  So here are a few words on the life and times of Qdo.

---

The basic idea of Qdo is a reflection of how I naturally model tasks in my head.  Typically task-tracking applications will have "items" or "tasks" or whatever, which may be part of "categories" or "lists" or "boards" or "lanes".  The hierarchy of nouns in these systems is pretty clearly spelled out --- one or two or three static levels, each level having special semantics and special patterns of use (none of which I really know or find valuable, when I'm working in an individual setting).

What I do, instead, has a much looser structure.  It's probably best understood from an example; this is what it'll look like when I'm just hand-writing it, or using a text file:

```
respond to Leanne
order birthday gift for R
check in on mysterious mail
fill out calibration notes

====

 - work
    - perf
       - fill out calibration notes
       - do peer reviews
    - projects
       - write design doc
          - figure out the capacity story
          - talk to dev team
 - projects
    - site
       - finish blog post
 - camping trip prep
    - order birthday gift for R
    - write directions for D
 - money stuff
  - check in on mysterious mail
  - respond to Leanne
```

So what's going on here?  Well, this doesn't all get filled out linearly, and it isn't really meant to be read linearly.  I start with the bottom section: the "tree" (technically a forest) of things that generally need to be done, broken down into sub-items.  "I need to work today; what do I need to do at work?  Performance reviews (for which I need to do calibration notes and peer reviews) and project work: specifically that design doc, and the doc isn't done because I haven't figured out the capacity story or talked to that other team."

Once I've written the tree of grouped/related things, I copy a few of them above into a queue of "which things need to be done next?"  This queue is what I use in the short-term for picking what I do within a day, but it depends on the context of what's in the tree.  And, if I do this process again tomorrow, the idea is that most of the tree will carry over, since lots of what's in the tree wasn't in the queue, and I'll write a mostly-new queue based on what's most important to do tomorrow.

So, there are a couple of notable aspects about the structure of this setup:

1. The queue and the tree are two views of the same information --- though the tree has stuff that doesn't get necessarily copied over to the queue, the queue only has items that have already been organized within the tree.

1. The only real things that need to be done, and the only things which get copied over, are the *leaf nodes* of the tree.  Every non-leaf node is essentially just a grouping mechanism.

1. The levels within the tree are arbitrary.  In my actual list, there are items five levels deep, and there are some items that are only two.  The structure depends on the content.

This last aspect is what typically prevents me from finding to-do list apps or systems useful.  The structure established by the system creates enough mental friction that I'm dissuaded from using it, and I end up depending on my own (crappy) memory to try and navigate the world.  So, in the interest of having something I would find useful, I made my own!

---

In the interest of being as lazy as possible, I translated the to-do list structure into pretty straightforward HTML.  I also used Firebase (specifically Firestore) and React to handle all the fussy steps with updating backend state, echoing those changes to other active clients, and updating HTML in response to those changes.  Turns out those two things worked great together, and it took impressively little effort to get to the point where I could make a change on one device and see that change immediately appear on another.  (For the demos on this page, all the data is local to the browser, so you won't get that a-ha moment.  Sorry!  Oh well!)

I started with a simple `<ul>`-based tree of items:
