<; cat tmpl/header.html >

<title>jpco.io | Guidelines for a website</title>
<meta name=description content="Fallible thoughts on making a good website from somebody who really doesn't know how to make a good website.">

<; build-nav /guidelines.html >

<main>
<h1>Guidelines for a website</h1>
<div class=time><time datetime="2025-08-29">2025-08-29</time></div>

<p>
A website is a complicated thing.

<p>
If you don't have a clear idea of what you want to do, there are a lot of different ways to end up with something that, plainly, stinks.

<p>
Impressively, it seems that some of the world's premiere institutions of the written word struggle with this just as soon as that word needs to be wrapped in an <code>&lt;html&gt;</code>.
Have you ever clicked a link, hoping to read something insightful from a great writer, just to become locked in battle with the page it's on, which is desperately trying to get you to do anything except read what you came there for?

<p>
Sure you have.
That's like 40% of what the web is these days.

<p>
Now, admittedly, I can't exactly claim to be a great designer myself.
I've got what you might call &ldquo;basic&rdquo; visual aesthetic tastes.
I also don't spend a great deal of time working in the browser, so it's easy for me to forget about some of the various things I care about in a website.

<p>
So, this page is primarily for myself, to remember my own design goals, inspirations, and practices.
I'm putting it on this site so that it's definitely available when I want to use it, but maybe it'll be useful to somebody else, too.

<h2>Websites that work well</h2>

<p>
First, hello, future me and anyone else reading.
Let's talk about what actually makes a website <em>good</em>.
This is useful not only because people have different opinions, but also because the web is versatile, and different uses of web technology imply different behaviors.

<p>
For example, web <em>art</em>, the kind that <a href="https://everest-pipkin.com">Everest Pipkin</a> makes, shouldn't be judged the same way as a blog post or a web app.
Some of the stuff that Steven Wittens does on <a href="https://acko.net">his site acko.net</a> is similar; while his site is visually great and technically impressive, all the heavily animated whizzing-about going on on the site would be kind of miserable if it were happening on essentially any website that wasn't essentially a tech demo for 3D graphics in the browser.

<p>
Complex web apps are yet another thing altogether.
I have very little to say about, say, Google Maps as a &ldquo;website&rdquo;, except that it seems good at being a big interactive map.
As far as I'm concerned, websites like that are more or less magic.

<p> That said, though, sophisticated web apps like that&mdash;web apps that really <em>need</em> that degree of sophistication&mdash;are pretty rare.
There aren't that many websites where &ldquo;what if we used wasm?&rdquo; is a reasonable question.

<p>
So, for everything else, all those sites that are essentially fancy text-and-image delivery systems, what makes a site good?

<p>
Well, some universally good things are compactness and accessibility.

<p>
By compactness I mean the amount of data your browser downloads shouldn't be much bigger than it has to.
Plenty of people have written about this before; Maciej Cegłowski did <a href="https://idlewords.com/talks/website_obesity.htm">the canonical talk on the &ldquo;website obesity crisis&rdquo;</a> (sadly, apparently, half-broken at this time).
Dan Luu has done some great writing on this as well, focusing on the impacts of bloated sites on both <a href="http://danluu.com/web-bloat/">slow and intermittent internet</a> and <a href="http://danluu.com/slow-device/">slow devices</a>.
Incidentally, <a href="http://danluu.com">danluu.com</a> itself is a very good, if extreme, example of a compact website.

<p>
There is also <a href="https://motherfuckingwebsite.com">this motherfucking website</a>, which uses nearly as many bytes on obscenity as it does on markup (I counted).

<p>
I also mentioned accessibility.
Accessibility is a very good thing if you want people to use your thing.

<p>
Accessibility includes the typical topics of screen-readers and semantic HTML, but it's broader than that.
I would define accessibility on the web as something like &ldquo;usable, according to many different preferences and needs.&rdquo;
Because there are many ways people use the web, and many levers of control available to a user.

<p>
An accessible site should use responsive design, so that people can read a site easily on whatever screen they want, and at whatever font size or zoom level they want.
Dark mode is another ubiquitous user setting, which a lot of people get very bothered about if they can't manage, and respecting it in this site (as of this writing) costs just 229 bytes of CSS.  (Even Dan Luu's site respects dark mode!)

<p>
Speaking of fonts: in my opinion, an accessible site should, preferably, allow users to control the font they use to read it.
I'm not a typeface designer or a design firm, and my page isn't about type, so what business is it of mine what fonts are used by people reading my site?
I'm going to deliver half a megabyte of font data just to make sure people <em>aren't</em> able to read text the way they want to?

<p>
Some folks want that nice dyslexia-friendly font with the fat bottom.
Some people want a classy, newspaper-like serif.
Some people want Comic Sans.
No joke, my manager uses Comic Sans as his default browser font.
And more power to him!

<p>
Moving on to other ways a person would access a website.
Have you ever tried printing a web page?
How did it go?

<p>
I think sites do better at this these days than they used to, but it still feels like a treat these days to print out a web page and get something fully functional.
Apparently, image layout is the hardest part.
The <a href="https://hcn.org">High Country News</a> site, for example, does an okay job with print styling, but slices images in half across page breaks.
<a href="https://solar.lowtechmagazine.com">Low-tech Magazine</a> deserves a special shout-out for formatting their newer articles in a nice looking multi-column format, and <em>especially</em> for taking into account the fact that you can't, you know, click on links on a piece of paper, but it still tends to leave huge ugly blank spaces around large images.

<p>
Okay, just a couple more kinds of usability to note.
Not everybody who uses the web is good at English, and nor should they be.
Doing some basic things to help machine translation work well is a Good Thing, and not particularly difficult (so long as you don't have to write the translation engine yourself!)

<p>
Lastly, there's usability for people with slow and intermittent networking.

<p>
The first clear way to achieve this kind of accessibility is compactness, which I already described, but there's some more beyond that.
There's raw speed, which can be achieved with nice things like minification and compression, though with a sufficiently compact site those don't actually save a whole ton of bits (you'll note this site doesn't use either).

<p>
On top of speed, though, there's also networking <em>predictability</em> and <em>control</em>.
When your access to the internet is more complicated than just &ldquo;yes&rdquo; or &ldquo;no&rdquo;, being able to predict and manage network access has real value.

<p>
Alexander Petros describes this well in <a href="https://unplannedobsolescence.com/blog/hard-page-load/">Who's Afraid of a Hard Page Load?</a>:

<blockquote>
<p>
Every day I ride the New York City Subway.
For my carrier, most of the stops have cell service, and most of the tunnels between stops do not.
When I read web pages while riding, I am keenly aware that if I click a link while I don’t have service, not only will the page fail to load, I will probably also lose access to the one I’m currently reading.
Everyone who uses a web browser understands this behavior on some level.
So I avoid clicking links until I’m at a stop.
</blockquote>

<p>
This might seem like something advanced, but it's really the most basic and predictable behavior of the web.
If I'm looking at a page, I should be able to keep looking at it.
If I click a link, it makes sense I wouldn't be able to load it if I don't have internet.
Once that linked page loads, though, I should be able to keep looking at it.
This is Just Works stuff that really sucks when it stops, and having it is worth a lot.

<p>
So, okay.
Those are some qualities that make a site good and usable.

<p>
It should be predictable, printable, translatable, accessible, responsive, configurable, and compact.

<p>
But what about other kinds of &ldquo;good&rdquo;?
What kind of sites are actually <em>doing</em> something interesting or inspirational?
What sites are <em>cool</em>?

<h2>Websites that are cool</h2>

<p>
Okay, first of all, let me admit what's already extremely predictable: I have a different idea of what's <em>cool</em> than most other people do.

<p>
I like tools that are small and high-leverage, objects that expose their component parts, and systems that are complex and <a href="https://malleable.systems">malleable</a>.

<p>
I like sites that use or expose HTML in interesting ways. This self-described <a href="https://secretgeek.github.io/html_wysiwyg/html.html">HTML quine</a> is essentially as far as you can go in this direction, but other projects like <a href="https://thehtml.review">the html review</a> are also troves of creativity.

<p>
I'm also fond of sites that interact with the real world in ways that most sites usually don't &mdash; sites which respond to their own energy use and display their own server's physical reality.

<p>
The <a href="https://solar.lowtechmagazine.com/about/the-solar-website">Low-tech Magazine</a> seems to be cited by most as the original on this, but the <a href="https://solarprotocol.net">Solar Protocol</a> project adds some cleverness to that, grouping several geographically-distributed solar servers together to direct traffic around the planet as solar availability changes.

<p>
Other such projects exist, too.  <a href="https://compost.party">compost.party</a> is a tiny shared server modeled heavily on the Low-tech Magazine solar server, including the image dithering.

<p>
There are a lot of good ideas on the <a href="https://damaged.bleu255.com/">Damaged Earth Catalog</a>, and organizations like <a href="https://computingwithinlimits.org/">LIMITS</a>.

<p>
Lots of these pages don't do very much of what I describe as &ldquo;working well&rdquo;.
Like I mentioned, many of them are effectively interactive art, and it doesn't make much more sense to print interactive art than it does to print a sculpture.

<p>
Sadly, I also can't very easily follow the lead of a lot of these sites right now, since my own internet situation at home is difficult.
I don't have a public IP address to speak of, and doing a small-site-hosted-on-the-farm doesn't seem particularly useful if you can't see it without going through some kind of Cloudflare tunnel to do so.
So, there's some disconnect between the sites I think are good (work well) and those I think are good (are cool).
When the opportunity comes, though, I plan on integrating the two ideals in this site.

<p>
As a side note: the LIMITS page looks pretty dang good when printed.

<h2>Making a good website</h2>

<p>
Okay, so we have an idea of what we want a website to be like.
How do we actually make that?

<p>
Well, in terms of the actual site serving, that's coming from a shell script (specifically a script written in <a href=/es>es</a>.
That has some benefits, but it's a story for a different page.
The site is currently dead simple, but for pages that are a bit more dynamic, something like <a href="https://htmx.org/">htmx</a> seems fairly ideal.

<p>
As far as the stuff that runs in the browser goes:

<p>
The overall HTML structure is inspired by <a href="http://lofi.limo/blog/write-html-right">these tips from Aaron Parks</a>.
Doing markup in this way is nice for the server, too, since it can just smash files together pretty blindly without being markup-aware.

<p>
This <a href="https://www.patrickweaver.net/blog/a-blog-post-with-every-html-element/">page from Patrick Weaver</a> is a nice high-level view on more or less all the HTML elements.
For screen readers and mouse-based navigation, using the fancy semantic elements is a Good Thing.
Also, try to make the text context of links contain meaningful text content, instead of &ldquo;click here&rdquo; or whatever.

<p>
The MDN is a great source for documentation on <a href="https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/CSS_layout/Responsive_Design">responsive design</a>, and as far as strategies go, mobile-first is the right one.

<p>
Print CSS (for which the <a href="https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_media_queries/Printing">&ldquo;Printing&rdquo; MDN documentation</a> is valuable) is mostly a matter of setting <code>display: none;</code> on the appropriate elements, but for dealing with link unclickability, this is a good trick:

<figure class=centered>
<pre>
<code>@media print {
	a[href]::after {
		content: " (" attr(href) ")"
	}
}</code>
</pre>
<figcaption>CSS for displaying link targets in printed pages</figcaption>
</figure>

<p>
Good translation support is mostly a matter of declaring what language content is in.
That's done via the <code>lang</code> attribute on tags.
Since this site is generally in English, <code>&lt;html lang=en-US&gt;</code> is set on every page.
But, since this site has some content that <a href=/toki>isn't in English</a>, declaring the right languages for the right text is good.

<p>
Note this also improves text rendering: hyphenation is based on language, so declaring the language being used helps avoid weirdness.

<p>
Declaring the encoding with <code>&lt;meta charset=UTF-8 /&gt;</code> is good too.
UTF-8 is the only encoding to use on the web these days.

<p>
One last note about languages!
We generally don't want code translated at all, even if we're translating text from English to something else.

<p>
For general text, that can be hinted at with a <code>translate=no</code> attribute on an element, but for code, that isn't necessary, as long as everything is wrapped in one of the following elements: <code>kbd</code>, for input to a computer; <code>samp</code>, for output from a computer; or <code>code</code>, for other code.
Note that <code>pre</code> doesn't prevent translation by itself.

<p>
Okay, that's all for now.
This is a living page so expect it to change over time as I slowly get less wrong.
</main>
