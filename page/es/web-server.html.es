<; cat tmpl/header.html >

<title>jpco.io | Serving a web site from a shell script is fun and easy</title>
<meta name=description content="This page describes how the web server behind jpco.io works.  It is a shell script written in the extensible shell es.">

<; build-nav /es/web-server.html >

<main>

<h1>Serving a web site from a shell script is fun and easy</h1>
<div class=time><time datetime=2026-01-10>2026-01-10</time></div>

<p>
This web site is served from an <i><a href=/es>es</a></i> script.
That's a pretty unique choice among websites, so it might be worth a little explanation as to why I did that, and why I haven't gotten annoyed about the choice.
We'll also go over some of the details of the script itself, at least in the form it takes as of this time of writing.  The <a href=/server.html>server code is here</a>, and the <a href="https://github.com/jpco/jws">git repository, including all the page sources and other content, is hosted here</a>.

<h2>A tour of the server</h2>

<h3>The server loop</h3>

<p>
Right at the beginning of the server is the most important part.
It's what makes the whole thing go.
After a bit of messing about to get a <code>$server-port</code> depending on if the shell was started in a Docker container, we have:

<figure>
<pre>
<code>if {~ $NCAT_SUBSHELL_MODE ()} {
	local (NCAT_SUBSHELL_MODE = yes)
	forever {ncat -k -l -p $server-port -e $0 || exit 3}
}</code>
</pre>
</figure>

<p>
This bit of code is controlled by the <code>$NCAT_SUBSHELL_MODE</code> variable, which is unset when the script is originally invoked.
When this is the case, then the script sets <code>$NCAT_SUBSHELL_MODE</code> to <code>yes</code> (really the value doesn't matter, since the shell only ever checks whether there is any value), and runs an infinite loop of <code>ncat</code> commands.

<p>
This <code>ncat</code> is the part that handles the actual TCP networking.
Sorry if you thought the shell would natively handle that&mdash;<i>es</i> isn't quite capable of something like that yet.
In particular, this command is written for <a href=https://nmap.org/ncat>the <code>ncat</code> distributed as part of the nmap project</a>; certain other versions of netcat lack the <code>-e</code> argument this server depends on.

<p>
The exact <code>ncat</code> invocation looks like this.

<figure>
<pre>
<code>ncat -k -l -p $server-port -e $0</code>
</pre>
</figure>

<p>
The <code>-k</code> and <code>-l</code> flags are what make <code>ncat</code> run as a TCP server.
The <code>-p $server-port</code> configures the port on which to listen.
This is set to 8080 when running within Docker, since that's the standard, and 8181 when running outside a Docker container, since that's more likely to be free on an arbitrary host.

<p>
The last flag, <code>-e</code>, configures <code>ncat</code> to execute a command when a request is received.  The command can read its standard input to look at the request, and can write to standard output to specify the response.
<code>ncat</code> is actually pretty clever about this&mdash;it configures everything ahead of time so that instead of needing to buffer the response in memory, it sends it as the child process writes to stdout.

<p>
The argument we give to <code>-e</code> is the script itself, stored in <code>$0</code>.
When we invoke the subcommand, because we've set <code>$NCAT_SUBSHELL_MODE</code>, we skip running the server loop and instead move on to the rest of the script which handles the individual requests.

<h3>Request handling</h3>

<p>
While <code>ncat</code> does all the hard work of handling TCP networking, it doesn't actually do anything about HTTP, so that has to be implemented in the script.
So the first thing we do is define a <code>respond</code> function which takes a <a href="https://en.wikipedia.org/wiki/List_of_HTTP_status_codes">numeric status code</a> <code>code</code>, a <a href="https://en.wikipedia.org/wiki/Media_type">MIME type</a> <code>type</code>, and optional <code>flags</code> to control things like caching or compression, and uses those arguments to print the headers of the reply.

<p>
Then we define a couple helper functions to serve a &ldquo;page&rdquo;, which is what we call our custom templated HTML files with smatterings of <i>es</i> code thrown in.
As an example, we can look at the actual source of the <a href=/server.html>server source code</a> page:

<figure>
<pre>
<code>&lt;; cat tmpl/header.html &gt;

&lt;title&gt;jpco.io | The script that served this title&lt;/title&gt;
&lt;meta name=description content="The script that served this description"&gt;

&lt;; build-nav /server.html &gt;

&lt;main&gt;
&lt;p&gt;
This is the script that served this request, written in &lt;a href=/es&gt;&lt;i&gt;es&lt;/i&gt;&lt;/a&gt;.

&lt;pre id=main-block&gt;
&lt;; sed -e 's/&amp;/\&amp;amp;/g' -e 's/&lt;/\&amp;lt;/g' &lt; serve.es &gt;
&lt;/pre&gt;
&lt;/main&gt;</code>
</pre>
</figure>

<p>
Using this extremely basic templating system we give ourselves access to the shell within the page, and we use that to add the page header, the navigation bar, and print the server script.
The templates, such as they are, are the most obviously deficient part of this whole setup, but are good enough to serve what this site actually needs, which isn't much.

<p>
The <code>build-page</code> function reads these templatized files line by line and prints the output or runs the command for each line as appropriate.
The function <code>build-nav</code>, which is called from the page, is defined in the server script as it is nearly universal, and simply prints some HTML which formats the path argument given to it.
Then the <code>serve-page</code> function simply wraps up <code>respond</code> and <code>build-page</code> into a single convenient function call.

<p>
After these helper functions are defined, we get to the business of handling the request.
We read the method, the path (which we call <code>reqpath</code> to avoid colliding with the normal <code>$path</code>), and the HTTP version:

<figure>
<pre>
<code>(method reqpath version) = &lt;={%split ' ' &lt;={~~ &lt;=%read *\r}}</code>
</pre>
</figure>

<p>
We have to handle the <code>\r\n</code>s in the request explicitly, which is annoying, but not too much of a problem.
Fortunately, <code>ncat</code> inserts <code>\r</code>s as necessary so we don't have to think about them when writing the responses.
After the first line, and a bit of handling for query strings, we move on to reading the headers.

<figure>
<pre>
<code># TODO: it would be nice if we made all the header names lowercase
let (header = ())
while {!~ &lt;={header = &lt;=%read} \r} {
	let ((n v) = &lt;={~~ $header *': '*\r})
	if {!~ $#n 0} {
		head-$n = $v
	}
}</code>
</pre>
</figure>

<p>
Here we read in headers and save the header values within variables of the form <code>head-$name</code>, so that <code>$head-Host</code> contains something like <code>jpco.io</code>.
The TODO here refers to the fact that HTTP headers are case-insensitive, so the headers <code>Host</code> or <code>host</code> (or, technically validly, <code>hOsT</code>) should be handled uniformly, but <i>es</i> is all case-sensitive.
So right now we don't handle that well.

<h3>Routing</h3>

<p>
After reading in the request, we have everything we need to serve the response.
The whole router is just one big <code>if</code> statement.

<figure>
<pre>
<code>if (
	# redirect www.jpco.io to jpco.io
	{~ $head-host www.jpco.io || ~ $head-Host www.jpco.io} {
		destination = https://jpco.io$reqpath
		respond 301 text/plain
		echo Redirecting to $destination ...
	}

	# draft built pages; only serve these locally
	# before "real" pages so we can draft changes too
	{!$IN_DOCKER &amp;&amp; access -f draft/$reqpath^.es} {
		serve-page draft/$reqpath^.es
	}
	{!$IN_DOCKER &amp;&amp; access -f draft/$reqpath/index.html.es} {
		serve-page draft/$reqpath/index.html.es
	}

	# built pages. don't cache these
	{access -f page/$reqpath^.es} {
		serve-page page/$reqpath^.es
	}
	{access -f page/$reqpath/index.html.es} {
		serve-page page/$reqpath/index.html.es
	}

	# static files
	{access -f static/$reqpath} {
		serve static/$reqpath cache
	}

	# 404
	{
		respond 404 text/html
		build-page &amp;lt; page/404.html.es $reqpath
	}
)</code>
</pre>
</figure>

<p>
Here's where it all comes together.

<ul>
<li>If the request is coming to <code>www.jpco.io</code>, redirect it to <code>jpco.io</code>.
<li>If we're in &ldquo;dev mode&rdquo; and not in a Docker container, serve the request as a page if it matches a file in the draft directory.
<li>If the request matches a file in the page directory, serve it as a page.
<li>If the request matches a static resource, serve it verbatim.
<li>Otherwise, serve the 404 page with a 404 code, since we didn't find anything.
</ul>

<h2>How it's run</h2>

<p>
When I'm working on changes to the site, I can run this script as

<figure>
<pre>
<samp>; </samp><kbd>./serve.es</kbd>
</pre>
</figure>

<p>
and it works great.
Pages are always served live, so all I have to do is save the page I'm working on and reload.
The server is also always served live thanks to <code>ncat -e $0</code>, so unless I'm making a change to that little loop, I don't even need to re-run the server script when I make a change.

<p>
In &ldquo;prod&rdquo;, I package up the contents of the repo from HEAD as well as a fresh <i>es</i> built from HEAD and the couple of binary dependencies (<code>ncat</code>, <code>man</code>, <code>file</code>) into a Docker container and serve it from Google Cloud Run.
Cloud Run takes care of details around HTTPS for me, which is nice.
Building and deploying a new version is done with a command like the following:

<figure>
<pre>
<code>@ image {gcloud builds submit --tag $image . &amp;&amp; gcloud run deploy --platform managed --image=$image} gcr.io/jpco-cloud/web:0.76</code>
</pre>
</figure>

<p>
I won't go into the Dockerfile here since it's pretty extremely basic, but <a href="https://github.com/jpco/jws/blob/master/Dockerfile">it's in the repository for this site</a> if anybody really wants to take a look.

<h2>Okay&hellip; but why?</h2>

<p>
This is obviously not a very good general web server.
It's relatively slow in the first place compared to something in a so-called blazingly-fast language, and I imagine it scales pretty poorly.

<p>
But none of that actually matters.
I didn't write this server to serve <em>any</em> web site, I wrote it to serve <em>this</em> web site, and this web site is really pretty dead simple, and it doesn't get very much traffic at all, so I don't care about complicated server-side logic, templating, or the degree to which the fast is blazing.

<p>
What I really want is exactly what this server gives me.
I want a really convenient environment to write new pages in without bothering with any sort of recompilation flow.
I want a router that is extremely simple but more flexible than files in directories.
And I want all of it without some kind of goofy toolchain, framework, or runtime dependencies that do more to get in my way than help me serve this extremely simple site.
I'm not a web developer so whenever I'm not actively working on this site, I'm not really thinking about any web technologies, so using fancy special-purpose tools is a net increase to my cognitive load, not the other way around.

<p>
Admittedly, there's also some aesthetic joy to it.
I prefer <a href=/guidelines.html>a website that's pretty bare</a>, and I like to stay &ldquo;close to the metal&rdquo; of HTTP.
I like to have that little bit of extra control, since I'm not doing anything particularly fancy or high-stakes.
And I also just like to be able to say that I'm serving my personal web site from a shell script.

</main>
