<; cat tmpl/header.html >

<title>jpco.io | Guidelines for a website</title>

<; . script/build-nav.es /guidelines.html >

<main>
<h1>Guidelines for a website</h1>
<div class=time><time datetime="2025-08-29">2025-08-29</time></div>

<p>
A website is a complicated thing.

<p>
If you don't have a clear idea of what you want to do, there are a lot of different ways to end up with a website that, plainly, stinks.

<p>
Impressively, it seems that some of the world's premiere institutions of the written word struggle as soon as that word needs to be wrapped in an <code>&lt;html&gt;</code>.
Have you ever clicked a link, hoping to read some article or opinion piece from a great writer, just to become locked in battle with that page, which is desperately trying to get you to do anything except read their work?

<p>
Sure you have.

<p>
Now, I can't exactly claim to be a great designer; I consider myself fairly visually clueless.
I also don't spend a great deal of time working in the browser, so it's fairly easy for me to forget about some of the various things I care about in a website.
So this page is to help me remember exactly what guidelines I'd like myself to follow when working on this site.

<p>
I'm publishing it on the site so that it's definitely available when I want to work on the site, but maybe it'll be useful to somebody else too.

<p>
From what I've seen, I think I have different design goals than many others who make websites.
Some people seem to want a website that serves the fastest devices, best internet, and largest screens.
I'd rather have a website that might be goofy and crufty, but actually works, for a lot of folks.

<h2>Making a website that's good</h2>

<p>
The first thing to make sure of is that your site is compact.
Maciej Cegłowski did <a href="https://idlewords.com/talks/website_obesity.htm">the canonical talk on the website obesity crisis</a> (sadly, apparently, half-broken at this time).
Dan Luu has done some great writing on this as well, focusing on both <a href="https://danluu.com/web-bloat/">slow and intermittent internet</a> and <a href="https://danluu.com/slow-device/">slow devices</a>.
His site is quite a bit more spartan than this one, even.

<p>
As it turns out, reducing page size is, mostly, a matter of reducing the presence of javascript.
HTML is basically the stuff you see, so it's difficult to write excessively-huge HTML for a certain amount of actual content unless you're being actively malicious.
CSS is also relatively blameless, possibly because nobody wants to write more CSS than they strictly have to.
But people go just <em>crazy</em> for Javascript.
The style with a lot of sites these days seems to be to stop the browser from doing anything that it does for you, and rewrite all that behavior yourself.

<p>
In theory, there are lots of good reasons to do this.
In real life, it makes your product page a Russian novel that unloads itself at random and doesn't let you control-click on anything.

<p>
So, we can do better than this by simplifying the site.
Pre-&ldquo;render&rdquo; static content so that neither the server nor the browser have to assemble an identical page every single time it's loaded.
Rely as much as we can on the browser to know when to load which links, when and how to render which content (maybe with some CSS to help), and how to actually implement a page history.
The browser is going to be better at that stuff than we are.

<p>
Some good pages in this space:

<ul>
<li><a href="http://lofi.limo/blog/write-html-right">Aaron Parks has helpful tips for hand-writing HTML.</a>
<li><a href="https://unplannedobsolescence.com/blog/hard-page-load/">&ldquo;Who's afraid of a hard page load?&rdquo; from Alex Petros, on the virtues of letting links work like links.</a>
<li><a href="https://motherfuckingwebsite.com/">The classic &ldquo;motherfucking website&rdquo;, which puts my point better than I could.</a>
</ul>

<p>
After simplifying, we can get back to making things complicated, but for other purposes.
An inherent complexity of the web is how many ways it can be accessed.
Consider these things computers, tablets, mobile phones.
Old browsers, javascript-less browsers.
Screen readers.
Translation apps.
Dark mode, light mode.
Printers.

<p>
<a href="https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/CSS_layout/Responsive_Design">The MDN is a good resource for responsive design.</a>
(They're a good resource for lots of stuff.)  Mobile-first is a great principle, like other forms of progressive enhancement.

<p>
Screen readers and non-mouse-based navigation add a whole set of constraints on design.
Some tips related to these include:
<ul>
<li>Use semantic HTML, not just a pile of <code>&lt;div&gt;</code>s.
<li>Put a useful amount of text in links for someone tabbing around, not just one or two words. (Admission: I don't follow this one reliably.)
<li>Use the <code>&lt;abbr&gt;</code> tag for abbreviations. (have I ever done this?)
</ul>

<p>
Lots of people have opinions on dark mode.
It's probably nice to include, and pretty dang simple with a media query in CSS.

<p>
Printing is also a use-case that's worth some active effort to support, in my opinion.
Maybe I'm the only one who thinks this, but it's not for no reason.
I like to print articles to my e-ink device to read later, and it's very nice when the page doesn't more or less explode when I try it.
Supporting this well involves <a href="https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_media_queries/Printing">using media queries for printing</a>.
One straightforward choice is to display link targets for printed content, since you can't exactly click a link on the web.

<figure>
<pre class=scrollable>
@media print {
	a[href]::after {
		content: " (" attr(href) ")"
	}
}
</pre>
<figcaption>CSS for displaying link targets in printed pages</figcaption>
</figure>

<p>
Language and encoding are also considerations, since the web is a global platform and &ldquo;English is the implicit default&rdquo; isn't a very nice way for the world to work.
As part of that, it's good to declare which language you're writing in, so that the browser and OS don't have to guess, and that you're using UTF-8, since that's basically what you have to use.

<ul>
<li><a href="https://www.w3.org/International/tutorials/language-decl/">On the <code>lang</code> attribute, both for a whole page and just a part.</a>
<li>Note that good use of the <code>lang</code> attribute helps the browser render text better!
<li><a href="https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/meta#charset">On the <code>&lt;meta charset&gt;</code> tag. Basically, declare UTF-8 because that's what you're gonna be using.</a>
</ul>

<!--
<h2>Going even further, and some good sites for inspiration</h2>

<p>
Everything so far is, I think, fairly universal and not too limiting as far as design goes.
(Of course, you're not going to make a Google Maps without a lot of javascript, but be honest: you're not going to make a Google Maps at all.)

<p>
There's somewhat of a theme here, though, with the repeated direction to let the browser do the work for you, the limited amount of styling, and the.

<p>
We're doing <em>brutalism</em>.

<p>
There's some stuff online about &ldquo;web brutalism&rdquo;, but a lot of it entirely misunderstands what brutalism ever was.
From Wikipedia, emphasis mine:

<blockquote>
<p>Brutalist buildings are characterised by minimalist construction showcasing <em>the bare building materials and structural elements</em> over decorative design.
</blockquote>

<p>
Showing off the bare building materials and structural elements, of the web, is exactly what I'm advocating for.

<p>
I get especially excited when people go further, too.
The web isn't just made of HTML and CSS &mdash; it's something that happens when your computer contacts another computer far away.  Neither of those computers run on magic &mdash; they're pieces of metal spinning electricity.

<p>
That's why I particularly enjoy websites like <a href="https://solar.lowtechmagazine.com">Low←tech Magazine</a> and <a href="https://solarprotocol.net/">the Solar Protocol</a> project.
These sites expose the physicality of the internet.
-->
