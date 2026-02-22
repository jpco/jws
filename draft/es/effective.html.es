<; cat tmpl/header.html >

<title>jpco.io | Effective es</title>
<meta name=description content="Recommendations for well-functioning, good-looking scripts written in the extensible shell.">

<; build-nav /es/effective.html >

<main>
<h1>Effective <i>es</i></h1>
<div class=time><time datetime=TODO>TODO</time></div>

<p>
There aren&rsquo;t any style guides on the internet for the shell <i>es</i>, despite the fact that the shell works and looks better when certain choices are made than others.
This page intends to change that.
Some of these seem pretty universally agreed upon by people experienced with the shell; others are just my own personal opinion.

<h2>Code style</h2>

<p>
Please, just put your <code>{</code>s on the same line as your <code>if</code>s.

<h2>Variable scope</h2>

<p>
Use global variables if you know you need them; otherwise, use <code>let</code> and then, if that doesn&rsquo;t work how you want, switch to <code>local</code>.

<p>
There is no <code>let*</code> or <code>letrec</code> and there doesn&rsquo;t need to be.

<h2>The environment</h2>

<p>
Functions are going to be passed through the environment.
Be cool with that.

<h2>Exceptions</h2>

<p>
Always be prepared for exceptions to interrupt things.

<h2>Things to avoid</h2>

<p>
<code>fork</code>

<p>
<code>eval</code>
