---
title: "on monty hall"
description: "Building an intution for the Monty Hall problem"
date: 2019-10-25T23:40:25-07:00
url: blog/on-monty-hall.html
draft: true
---
<figure class="hero">
![A grayscale goat](/img/a-goat.png)
<figcaption>A goat.  Considered undesirable.</figcaption>
</figure>
<!-- KaTeX-related includes -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.11.1/dist/katex.min.css" integrity="sha384-zB1R0rpPzHqg7Kpt0Aljp8JPLqbXI3bhnPWROx27a9N0Ll6ZP/+DiW/UqRcLbRjq" crossorigin="anonymous">
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.11.1/dist/katex.min.js" integrity="sha384-y23I5Q6l+B6vatafAwxRu/0oK/79VlbSz7Q9aiSZUvyWYIYsd+qj+o24G5ZU2zJz" crossorigin="anonymous"></script>
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.11.1/dist/contrib/auto-render.min.js" integrity="sha384-kWPLUVMOks5AQFrykwIup5lo0m3iMkkHrD0uJ4H5cjeGihAutqP0yW0J6dpFiVkI" crossorigin="anonymous" onload="renderMathInElement(document.body);"></script>
<noscript><em>Note: This post relies on \\(\KaTeX\\) loaded via javascript.  It will look weird without javascript support.</em>
</noscript>
The Monty Hall problem is a famous counterintuitive result in probability.  The scenario is this, to quote [the Wikipedia article](https://en.wikipedia.org/wiki/Monty_Hall_problem) on the subject:

> Suppose you're on a game show, and you're given the choice of three doors: Behind one door is a car; behind the others, goats[^1]. You pick a door, say No. 1, and the host, who knows what's behind the doors, opens another door, say No. 3, which has a goat. He then says to you, "Do you want to pick door No. 2?" Is it to your advantage to switch your choice?

The intuitive answer to the problem is "no".  Once there are two doors left, the thinking goes, there is now a car behind one of two doors, so the chances of the car being behind door No. 2 is \\(\frac{1}{2}\\).

The correct answer, however, is "yes".  Choosing not to switch, your chance of getting the car is \\(\frac{1}{3}\\); switching, it's \\(\frac{2}{3}\\).  Why is this?  The trick to understanding the problem is exploring what exactly makes probabilities change.  Let's start by talking about coin flips.


## Flipping coins in secret

Take three scenarios.

1. I have a normal, fair coin, and I am about to flip it.  What is the probability the coin will show heads?

2. I have a normal, fair coin, and I flip it.  The coin, now flipped, is concealed behind a curtain, so that you can't see it, and you don't know which side is up.  What is the probability the coin is showing heads?

3. I have a normal, fair coin, which I have very recently flipped behind a curtain.  I pull back the curtain and show you the coin.  The coin stops, and it is showing heads.  What is the probability it is showing heads?

Over the course of these scenarios, something changed: In scenario 1, the probability of heads was (hopefully obviously) \\(\frac{1}{2}\\), since, well, it's a coin flip and most everyone knows the odds of a coin flip.  In scenario 3, the probability of heads is now (hopefully obviously) 1.  You can see the coin, and it is showing heads.  Tricks aside, the probability of something currently happening, happening is 1.

But where did the probability of heads change from \\(\frac{1}{2}\\) to 1?  I think a lot of people would naïvely say that it happens when the coin is flipped.  But that's not true --- in scenario 2, it should be fairly clear the probability is still 50-50 of heads vs. tails.  This is the important fact to take away from this post: Probabilities don't change due to *things happening*.  Probabilities change when *new information is learned*.


## Spooking Monty

Back to Monty and his goats.  Let's talk about a scenario similar to the given one, but crucially different:

> Suppose you're on a game show, and you're given the choice of three doors: Behind one door is a car; behind the others, goats[^1]. You pick a door, say No. 1.  The host moves to open another door, but hesitates.  "Oh dear," he murmurs to himself.  "I don't remember..."  After taking a pause, he steels himself, and opens the other door, say No. 3.  To his great relief, he is faced with a goat.  He then takes a sigh of relief, turns to you, and says, "Do you want to pick door No. 2?" Is it to your advantage to switch your choice?

This scenario is *fundamentally different*, in terms of probability, from that given in the real Monty Hall problem: Monty doesn't know where the car is.  At the beginning of this scenario, there are three possible outcomes, each with equal chances:

1. Monty's door has a goat, because your door is the one with the car behind it.
2. Monty screws up royally and reveals the car behind his door.  You would have had a goat, but now you have a car!
3. Monty's door has a goat, but your door also has a goat.  Oh well.

The chances of each of these happening are \\(\frac{1}{3}\\), and moreover, the chances that Monty doesn't screw up and gets to keep his job are \\(\frac{1}{3} + \frac{1}{3} = \frac{2}{3}\\).  This means that, when you see Monty's face relax with relief and gratitude at his good fortune that his family will eat another day, you've learned something --- something happened that you didn't already know would happen.

Now you have prior knowledge!  And, when you have prior knowledge, it means


### Now you get to pull out Bayes' Theorem

Bayes' Theorem states:
$$
P(A|B) = \frac{P(B|A) P(A)}{P(B)}
$$
where \\(A\\) and \\(B\\) are events, \\(P(A)\\) and \\(P(B)\\) are the probabilities of \\(A\\) and \\(B\\) happening, respectively, and \\(P(A|B)\\) and \\(P(B|A)\\) are each "the probability of \\(A\\), assuming \\(B\\) happens", and "the probability of \\(B\\), assuming \\(A\\) happens".

Let \\(A\\) be "the car is behind door No. 2" and \\(B\\) be "Monty keeps his job".  In our Spooking Monty scenario, when Monty sighs his sigh of relief and asks you if you want to switch, \\(P(A|B)\\) is the probability you care about --- if it's greater than \\(\frac{1}{2}\\), you should switch, and if it's less, you shouldn't.

So, our source values are:

\\(P(A)\\) is the probability the car isn't behind door No. 1 in the first place and switching is the right call --- by the terms of the scenario, there's equal chances for each door, so this is \\(\frac{2}{3}\\).

\\(P(B)\\) is the probability Monty keeps his job, which we already figured is \\(\frac{2}{3}\\), being outcomes 1 and 3 listed earlier.

\\(P(B|A)\\) is the probability Monty keeps his job, *assuming* the car is behind door No. 2 (and therefore that you didn't already pick it when you picked door No. 1).  If you didn't pick the right door initially, then we're in either outcome 2 or 3; in one of those two outcomes, Monty keeps his job.  So this is \\(\frac{1}{2}\\).

This means the probability that switching will get you a car, given that Monty isn't crying, is:
$$
P(A|B) = \frac{P(B|A) P(A)}{P(B)} = \frac{\frac{1}{2} \times \frac{2}{3}}{\frac{2}{3}} = \frac{1}{2}
$$
So, in the Spooking Monty scenario, the chances of getting the car if you switch after Monty lucks out is even --- you may as well not switch, it doesn't matter.

This is the intuitive result!  And it's entirely because Monty might have lost his job, home, and family that the math worked out.  Okay.  Now that that's sorted out and okay, let's go back to our original setup, where Monty knows the whole time where the car is.


## Monty knows what Monty's doing

In the real Monty Hall problem, when you pick your door at the beginning, you know two things:

- Your door has a \\(\frac{1}{3}\\) chance of having the car, and
- Monty is about to open a door that you didn't pick, and which has a goat.

In the real Monty Hall problem, there is no question that Monty will reveal a goat.  When he actually does so, you've learned nothing.  The chances that your door has a car behind it are still \\(\frac{1}{3}\\), and the chances that your door doesn't have a car are still \\(\frac{2}{3}\\).  The only thing that you've learned is how cute the goat behind Monty's door is, which isn't relevant for the statistics of the doors.

To make this a little more rigorous, let's attach numbers to this scenario.  Pulling the Bayes theorem out again, we can use the same numbers, but we have to make one change: \\(P(B)\\), the probability that Monty picks a door with a goat and keeps his job, is now 1, and as a corollary, \\(P(B|A)\\) is also now 1.

So we go back to Bayes' theorem, again asking the question --- after Monty shows me his door, what are my chances of getting a car if I switch doors?  This time, we get
$$
P(A|B) = \frac{P(B|A) P(A)}{P(B)} = \frac{1 \times \frac{2}{3}}{1} = \frac{2}{3}
$$
So then, reasonably, if you want the car, you should switch doors.

Visualized in this equation, it's clear that when \\(P(B)\\) is 1 (and therefore \\(P(B|A) = 1\\)), then \\(P(A|B) = P(A)\\).  This is the same thing that happens in the second coin scenario: No matter how the coin flip goes, the other events in the scenario (the curtain, etc.) are certain and uncorrelated with the flip, so they just don't change the chances that the coin landed heads.  When you don't get any new information, your probabilities stay constant.



[^1]: Nobody actually clarifies in the problem whether you'd get to keep the goat if that's what you ended up with, so I have to assume you would.  For the purposes of this scenario, assume that you would prefer to have the car than either of the goats.