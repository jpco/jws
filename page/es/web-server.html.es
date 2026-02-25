<; cat tmpl/header.html >

<title>jpco.io | Serving a web site from a shell script is fun and easy</title>
<meta name=description content="This page describes how the web server behind jpco.io works.  It is a shell script written in the extensible shell es.">

<; build-nav /es/web-server.html >

<main>

<h1>Serving a web site from a shell script is fun and easy</h1>
<div class=time><time datetime=2026-01-10>2026-01-10</time></div>

<p>
This web site is served from an <i><a href=/es>es</a></i> script.
That&rsquo;s a pretty unique choice among websites, so it might be worth a little explanation as to why I did that, and why I haven&rsquo;t gotten annoyed about the choice.
We&rsquo;ll also go over some of the details of the script itself, at least in the form it takes as of this time of writing.  The <a href=/server.html>server code is here</a>, and the <a href="https://github.com/jpco/jws">git repository, including all the page sources and other content, is hosted here</a>.

<h2>A tour of the server</h2>

<h3>The server loop</h3>

<p>
Right at the beginning of the server is the most important part.
It&rsquo;s what makes the whole thing go.
After a bit of messing about to get a <code>$server-port</code> depending on if the shell was started in a Docker container, we have:

<figure>
<pre>
<code>if {~ $NCAT_LOCAL_PORT ()} {
	forever {ncat -k -l -p $server-port -e $0 || exit 3}
}</code>
</pre>
</figure>

<p>
This bit of code is controlled by the <code>$NCAT_LOCAL_PORT</code> variable, which is unset when the script is originally invoked, but set later by <code>ncat</code>.
Because of this, the top-level script just runs an infinite loop of <code>ncat</code> calls.

<p>
This <code>ncat</code> is the part that handles the actual TCP networking.
Sorry if you thought the shell would natively handle that&mdash;<i>es</i> isn&rsquo;t quite capable of something like that yet.
In particular, this command is written for <a href=https://nmap.org/ncat>the <code>ncat</code> distributed as part of the nmap project</a>; certain other versions of netcat lack the <code>-e</code> argument this server depends on.

<p>
The exact invocation looks like this:

<figure>
<pre>
<code>ncat -k -l -p $server-port -e $0</code>
</pre>
</figure>

<p>
The <code>-k</code> and <code>-l</code> flags are what make <code>ncat</code> run as a TCP server.
The <code>-p $server-port</code> configures the port on which to listen.
This is set to 8080 when running within Docker, since that&rsquo;s the standard, and 8181 when running outside a Docker container, since that&rsquo;s more likely to be free on an arbitrary host.

<p>
The last flag, <code>-e</code>, configures <code>ncat</code> to execute a command when a request is received.  The command can read its standard input to look at the request, and can write to standard output to specify the response.
<code>ncat</code> is actually pretty clever about this&mdash;instead of buffering the response in memory, it sends it as the child process writes to stdout; this helps pages start rendering in browsers even if the server gets hung up while producing them.

<p>
The argument we give to <code>-e</code> is the script itself, stored in <code>$0</code>.
When we invoke the subcommand, because <code>ncat</code> has set <code>$NCAT_LOCAL_PORT</code>, we skip running the server loop and instead move on to the rest of the script which handles the individual requests.

<h3>Request handling</h3>

<p>
While <code>ncat</code> does all the hard work of handling TCP networking, it doesn&rsquo;t actually do anything about HTTP, so that has to be implemented in the script.
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
The templates, such as they are, are the most obviously deficient part of this whole setup, but are good enough to serve what this site actually needs, which isn&rsquo;t much.

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
Fortunately, for responses, <code>ncat</code> inserts <code>\r</code>s as necessary so we don&rsquo;t have to think about them in our <code>echo</code> calls.
After the first line, and a bit of handling for query strings, we move on to reading the headers.

<figure>
<pre>
<code># this whole bit is structured to try to minimize the number of fork/execs
let (header-names = (); header-values = ()) {
	# read in headers
	while {!~ &lt;={header = &lt;=%read} \r} {
		let ((n v) = &lt;={~~ $header *': '*\r})
		if {!~ $#n 0} {
			header-names = $header-names $^n
			header-values = $header-values $^v
		}
	}
	# convert to lowercase, if necessary
	if {~ $header-names *[A-Z]*} {
		local (lhns = $header-names) {
			eval `` '' {var lhns | awk '{print tolower($0)}'}
			header-names = $lhns
		}
	}
	# set the header variables
	for (n = $header-names; v = $header-values)
		head-$n = $v
}
</code>
</pre>
</figure>

<p>
Here we read in headers and save the header values within variables of the form <code>head-$name</code>, so that <code>$head-host</code> contains something like <code>jpco.io</code>.
There is some extra handling to enforce that case-insensitive headers (<code>host</code>, <code>Host</code>, <code>hOsT</code>) are all made into lower-case variables (<code>$head-host</code>); this uses <code>awk</code>, which incurs some overhead due to the extra fork/execs, but is structured to limit the number of necessary calls to either zero or one.

<h3>Routing</h3>

<p>
After reading in the request, we have everything we need to serve the response.
The whole router is just one big <code>if</code> statement.

<figure>
<pre>
<code>if (
	# redirect www.jpco.io to jpco.io
	{~ $head-host www.jpco.io} {
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
Here&rsquo;s where it all comes together.

<ul>
<li>If the request is coming to <code>www.jpco.io</code>, redirect it to <code>jpco.io</code>.
<li>If we&rsquo;re in &ldquo;dev mode&rdquo; and not in a Docker container, serve the request as a page if it matches a file in the draft directory.
<li>If the request matches a file in the <code>page/</code> directory, serve it as a dynamically-built page.
<li>If the request matches a static resource, serve it verbatim.
<li>Otherwise, serve the 404 page with a 404 code, since we didn&rsquo;t find anything.
</ul>

<h2>How it&rsquo;s run</h2>

<p>
When I&rsquo;m working on changes to the site, I can run this script as

<figure>
<pre>
<samp>; </samp><kbd>./serve.es</kbd>
</pre>
</figure>

<p>
and it works great.
Pages are always served live, so all I have to do is save the page I&rsquo;m working on and reload.
The server is also always served live thanks to <code>ncat -e $0</code>, so unless I&rsquo;m making a change to the small server-loop section at the very top, I don&rsquo;t even need to re-run the server script after making a change.

<p>
In &ldquo;prod&rdquo;, I package up the contents of the repo from HEAD as well as a fresh <i>es</i> built from HEAD and the couple of binary dependencies (<code>ncat</code>, <code>man</code>, <code>file</code>) into a Docker container and serve it from Google Cloud Run.
Cloud Run takes care of details around HTTPS for me, which is nice.
Building and deploying a new version is done with the <code>deploy.es</code> script, which runs something like:

<figure>
<pre>
<code>gcloud builds submit --tag gcr.io/jpco-cloud/web:0.76 .
gcloud run deploy --platform managed --image=gcr.io/jpco-cloud/web:0.76</code>
</pre>
</figure>

<p>
I won&rsquo;t go into the Dockerfile these commands use since it&rsquo;s pretty extremely basic, but <a href="https://github.com/jpco/jws/blob/master/Dockerfile">it&rsquo;s in the repository for this site</a> if anybody really wants to take a look.

<h2>Okay&hellip; but why?</h2>

<p>
This is obviously not a very good general web server.
It&rsquo;s relatively slow in the first place compared to something in a so-called blazingly-fast language, and I imagine it scales pretty poorly.

<p>
But none of that actually matters.
I didn&rsquo;t write this server to serve <em>any</em> web site, I wrote it to serve <em>this</em> web site, and this web site is really pretty dead simple, and it doesn&rsquo;t get very much traffic at all, so I don&rsquo;t care about complicated server-side logic, templating, or the degree to which the fast is blazing.

<p>
What I really want is exactly what this server gives me.
I want a really convenient environment to write new pages in without bothering with any sort of recompilation flow.
I want a router that is extremely simple but more flexible than a pure directory structure-based setup.
And I want all of it without some kind of goofy toolchain, framework, or runtime dependencies that do more to get in my way than help me serve this extremely simple site.
I&rsquo;m not a web developer so whenever I&rsquo;m not actively working on this site, I&rsquo;m not really thinking about any web technologies, so using fancy special-purpose tools is a net increase to my cognitive load, not the other way around.

<p>
Admittedly, there&rsquo;s also some aesthetic joy to it.
I prefer <a href=/guidelines.html>a website that&rsquo;s pretty bare</a>, and I like to stay &ldquo;close to the metal&rdquo; of HTTP.
I like to have that little bit of extra control, since I&rsquo;m not doing anything particularly fancy or high-stakes.
And, honestly, I also just like to be able to say that I&rsquo;m serving my personal web site from a shell script.

<h2>Related work</h2>

<p>
I am, of course, far from the first person to want to use a shell script to serve web pages.
Following are a few relevant example projects which try to be general web frameworks or servers written using different shells.
This site&rsquo;s server is slightly different than these general libraries, being intended as a special-purpose single-site server, but the other projects have interesting lessons to teach besides.

<h3>Bash on Balls</h3>

<p>
When I first mentioned this site to a buddy, he said &ldquo;oh, like balls?&rdquo; and then after a brief second of confusion linked to <a href="https://github.com/jneen/balls">balls</a>.

<p>
Balls (Bash on Balls) is a whole web &ldquo;framework&rdquo; written in Bash, including CGI and other support, but at its core, it has a similar loop as this script, using a (more traditional) <code>nc</code> pipeline to manage networking:

<figure class="bigfig centered">
<pre>
<code>http_sock=$BALLS_TMP/balls.http.$$.sock
[ -p $http_sock ] || mkfifo $http_sock

while true; do
	cat $http_sock | nc -l -p $BALLS_PORT | (
		http::parse_request
		balls::route &gt; $http_sock
	)
done</code>
</pre>
<figcaption>The core server loop in balls, using <code>nc</code>.</figcaption>
</figure>

<p>
Requests that <code>nc</code> receives it prints to its standard output, and anything it receives on standard input it sends as a reply.
This requres the <code>$http_sock</code> file exist so that the <code>balls::route</code> function can communicate with the <code>nc</code> command earlier in the pipeline.
I do think that this could be done in a more &ldquo;advanced bash&rdquo; way these days using a coprocess, but Bash&rsquo;s big fancy networking feature, its socket programming <code>/dev/tcp</code> paths, apparently can&rsquo;t be used to listen for connections.

<h3>ZWS</h3>

<p>
An even older project exists called <a href="http://www.chodorowski.com/projects/zws/">ZWS</a> which does something very similar in zsh.
This project is mostly notable because zsh&rsquo;s kitchen-sink nature means that it has a module, <code>zsh/net/tcp</code>, which contains a large number of functions related to TCP, including one, <code>tcp_proxy</code>, which performs logic like <code>ncat -e</code> entirely as a shell built-in.

<figure class="bigfig centered">
<pre>
<code>zmodload zsh/net/tcp
autoload -U tcp_proxy

tcp_proxy $opts[-p] serve</code>
</pre>
<figcaption>The core server loop in ZWS, using <code>tcp_proxy</code> and the <code>serve</code> function.</figcaption>
</figure>

<p>
If <i>es</i> were to add loadable primitives or a module system of some kind, networking would be an early use case to explore, and zsh&rsquo;s precedent seems especially relevant.
Notably, <a href="https://sourceforge.net/p/zsh/code/ci/master/tree/Src/Modules/tcp.c">the actual built-in part of zsh&rsquo;s TCP handling</a> only seems to define the <code>ztcp</code> command, and everything else is a function adding sugar on top.

<h3>werc and rc-httpd</h3>

<p>
The last, and most relevant, work in this space is <a href="http://werc.cat-v.org/">the werc web &ldquo;anti-framework&rdquo;</a> used heavily in the Plan 9 space these days.
Werc is not itself a web server, but it does come packaged with the rc-httpd server, which is very similar to the one used for this site.

<p>
A particular distinction of rc-httpd is that it does not do (or control) the networking or main loop at all, but instead simply expects to be called with files already managed for each request; typically, presumably, because this would be done with one of the <a href="https://man.aiju.de/8/listen"><code>listen(8)</code></a> utilities in Plan 9.
Like a lot of the design choices made in Plan 9, the outcome seems to be a net simplification of each program.

<p>
If there were a &ldquo;web framework&rdquo; written for <i>es</i>, then werc would be the obvious model to follow first.

</main>
