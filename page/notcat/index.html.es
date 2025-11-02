<; cat tmpl/header.html >

<title>jpco.io | The notcat notification server</title>
<meta name=description content="notcat is a D-Bus notification server which prints or executes subcommands when a notification is received.">

<; build-nav /notcat >

<main>
<h1>The <code>notcat</code> notification server</h1>
<div class=time><time datetime="2025-09-13">2025-09-13</time></div>

<p>
Notcat is a <a href="https://wiki.archlinux.org/title/Desktop_notifications">D-Bus notification server</a>, similar in spirit to <a href="https://dunst-project.org/">dunst</a> or (in particular) <a href="https://github.com/halhen/statnot ">statnot</a>, but with output more akin to a netcat.
It is small, fast, low-dependency, and tries hard to do just one thing well.

<p>
Notcat can do one of two things when it receives a notification.
By default, it will print the notification to standard output.
This can be controlled by a number of <em>format arguments</em>, which are filled with particular details of the notification.
For example, when a notification is received, the following notcat invocation prints the notification's summary (<code>%s</code>), a space, and then the notification's body (<code>%B</code>):

<figure>
<pre>
<code>notcat %s %B</code>
</pre>
</figure>

<p>
Notcat can also run subcommands, with notification details passed to those commands as arguments, or as environment variables when notcat is given the <code>-e</code> flag.
Subcommands can be run when a notification is received, when a notification is closed, or when all notifications have closed and the notification queue is &ldquo;empty&rdquo;.

<figure>
<pre>
<code>notcat -e --on-notify=notcat-notify.es --on-empty=notcat-empty.es</code>
</pre>
</figure>

<p>
Notcat is built on its own notification server library called notlib.
Both are written in C99 and depend on GLib's D-Bus bindings.
The <a href="https://github.com/jpco/notcat">notcat repository</a> and <a href="https://github.com/jpco/notlib">notlib repository</a> are both hosted on GitHub and are licensed under the GPLv3 and LGPLv3, respectively.

<h2>Format arguments</h2>

<p>
The format arguments available for notcat are as follows.

<dl>
<dt><code>%%</code></dt>
<dd>A literal &ldquo;%&rdquo;</dd>

<dt><code>%i</code></dt>
<dd>Notification ID</dd>

<dt><code>%a</code></dt>
<dd>App name</dd>

<dt><code>%s</code></dt>
<dd>Summary</dd>

<dt><code>%b</code></dt>
<dd>Body text</dd>

<dt><code>%B</code></dt>
<dd>Body text, &ldquo;cooked&rdquo; to remove markup and convert newlines to spaces</dd>

<dt><code>%t</code></dt>
<dd>Expiration timeout in milliseconds; 0 indicates no timeout, and -1 indicates timeout is up to the notification server</dd>

<dt><code>%u</code></dt>
<dd>Urgency; either <code>LOW</code>, <code>NORMAL</code>, or <code>CRITICAL</code></dd>

<dt><code>%n</code></dt>
<dd>Type of notcat event; either <code>notify</code>, <code>close</code>, or <code>empty</code></dd>

<dt><code>%c</code></dt>
<dd>Category; often of the form <code><var>class</var>.<var>specific</var></code>, but may be simply <code><var>class</var></code></dd>

<dt><code>%(h:<var>NAME</var>)</code></dt>
<dd>Hint value with the given <var>NAME</var></dd>

<dt><code>%(A:<var>KEY</var>)</code></dt>
<dd>Action name with the given <var>KEY</var></dd>
</dl>

<p>
Notcat also supports simple conditionals of the form <code>%(?<var>K</var>:<var>expr</var>)</code>, which evaluates and prints <var>expr</var> if and only if the key <var>K</var> is set and is not its default value.

<p>
An example of using a few of these features together:

<figure>
<pre>
<code>notcat '%(?u:Urgency %u: )%s%(?B: - %B)'</code>
</pre>
</figure>

<p>
On certain notifications, this would print

<figure>
<pre>
<code>Urgency CRITICAL: Hi - It's time for lunch</code>
</pre>
</figure>

<p>
and on others, it might only print <code>Lunch time</code>.

<h2>Running subcommands</h2>

<p>
It is not hard to end up needing more sophisticated behavior than just printing to standard output.
To support that, notcat provides the arguments <code>--on-notify</code>, <code>--on-close</code>, and <code>--on-empty</code>.

<p>
<code>--on-notify</code> is triggered whenever a notification is sent to notcat.
<code>--on-close</code> is triggered whenever a notification is closed, either manually or because it expired.
<code>--on-empty</code> is triggered after <code>--on-close</code> if there are no more open notifications left.

<p>
The default values for these are

<figure>
<pre>
<code>notcat --on-notify=echo --on-close= --on-empty=</code>
</pre>
</figure>

<p>
A value of exactly <code>echo</code> refers to notcat's internal notification-printing logic.
Any other value is understood to be an external command, which is invoked using <code>posix_spawnp(3)</code> with the format arguments filled in and passed as arguments to the command.
For example,

<figure>
<pre>
<code>notcat --on-notify=my-script.es %s</code>
</pre>
</figure>

<p>
will search for <code>my-script.es</code> in <code>$PATH</code>, and run the resulting binary with a single argument set to the notification's summary.

<p>
If the <code>-s</code> argument is passed to notcat, then the command is invoked using <code>$SHELL -c</code>.
For example, one could just count the characters in the formatted notification with the following:

<figure>
<pre>
<code>notcat -s --on-notify='echo -n $* | wc -c' %s</code>
</pre>
</figure>

<p>
As an alternative to positional arguments, notcat also provides an <code>-e</code> flag which instead provides notification details to subcommands using named environment variables.
Using this, the equivalent to the previous command would be:

<figure>
<pre>
<code>notcat -se --on-notify='echo -n $NOTE_SUMMARY | wc -c'</code>
</pre>
</figure>

<p>
This can be an easy way to add legibility to larger subcommands like shell scripts.

<h2>Client commands</h2>

<p>
The notcat binary can act as a notification client, capable of sending notifications, invoking actions (on notification servers which support it, essentially only notcat itself right now), or invoking any of the other methods that exist on a standard-compliant notification server.

<p>
Initially this was written as a way to manually test the notcat server, and <code>notcat send</code> in particular was fleshed out because the standard <code>notify-send</code> command at the time lacked support for configuring notifications in a number of ways.
<code>notify-send</code> has since closed those gaps, but notcat still works well as a client within a &ldquo;scriptable&rdquo; notification server system.

<dl>
<dt><code>close <var>ID</var></code></dt>
<dd>
Closes the notification with ID <var>ID</var>.
</dd>

<dt><code>getcapabilities</code></dt>
<dd>
Prints the capabilities advertised by the notification server.
</dd>

<dt><code>getserverinfo</code></dt>
<dd>
Prints the server information advertised by the notification server.
</dd>

<dt><code>invoke <var>ID</var> [<var>key</var>]</code></dt>
<dd>
Invokes an action with the key <var>key</var> on the notification <var>ID</var>.
</dd>

<dt><code>listen</code></dt>
<dd>
Listens for <a href="https://specifications.freedesktop.org/notification-spec/1.2/protocol.html#signals">signals</a> from the notification server and prints them to standard output as they arrive.
</dd>

<dt><code>send [-aAchiItU <var>value</var>]... [-p] [--sync] [--] [<var>summary</var>] [<var>body</var>]</code></dt>
<dd>
Sends a notification to the notification server.

<p>
The <var>summary</var> and <var>body</var> arguments, as well as the <code>aAchiItU</code> flags, configure the notification (the man page describes the meaning of each of these flags).
<code>-p</code> configures notcat to print the ID of the created notification to standard output.
<code>--sync</code> configures notcat to wait until the notification is closed before exiting.  Notcat will also print the key of any actions invoked on the notification waiting for it to be closed.
</dd>
</dl>

<h2>Remote actions</h2>

<p>
A particular feature of notcat, on both the client and server side, is support for <em>remote actions</em>, advertised as the <code>x-notlib-remote-actions</code> capability.

<p>
This extension to the typical Desktop Notifications API allows action invocation to happen through the same API as other notification-related methods.
The following example includes the <code>notcat invoke</code> command, which relies on this capability.

<h2>Example usage</h2>

<p>
The following describes notcat as it can be used in practice.
This setup displays notifications within <a href="https://github.com/Alexays/Waybar">waybar</a>.
The waybar config which runs the notcat server is this:

<figure>
<pre>
<code>"custom/notcat": {
    "exec": "notcat --capabilities=body-hyperlinks --on-notify=tee-note.es --on-empty=tee-note.es '%i' '%s%(?B: - %b)'"
    "on-click": "act-note.es"
}</code>
</pre>
</figure>

<p>
Let's take this <code>"exec"</code> from right to left.

<p>
The <code>'%i' '%s%(?B: - %b)'</code> format arguments tell notcat that each notification should be formatted as two arguments.  The first argument is the notification's ID.  The second is the notification summary, followed&mdash;if the body is non-empty when &ldquo;cooked&rdquo;&mdash;with a hyphen and the raw text contents of the body.

<p>
These two arguments are passed to <code>tee-note.es</code> on notify and empty events.
This file is an <a href=/es><i>es</i></a> script which looks like:

<figure>
<pre>
<code>echo $1 &gt; /tmp/notcat.id
echo &lt;={%split \n $2}</code>
</pre>
</figure>

<p>
This script writes the first argument, the notification ID, to the file <code>/tmp/notcat.id</code>, and then writes the second argument, with <code>\n</code>s replaced with spaces, to standard output, where it is displayed by waybar.

<p>
Note that waybar interprets Pango markup, which includes all the basic markup elements required by the notifications standard.
This is why we use <code>%b</code> as the body format argument: so that notcat does not try to handle or strip markup, instead passing it straight through to waybar to render.

<p>
Because the format arguments include the markup-aware <code>%B</code> in a conditional, notcat advertises the <code>body-markup</code> capability automatically.  Because waybar also correctly handles links marked up with <code>&lt;a href=""&gt;</code>, we use <code>--capabilities=body-hyperlinks</code> to manually advertise the <code>body-hyperlinks</code> capability, since notcat cannot automatically detect that support.

<p>
And that's all the configuration we give the notcat server.
Moving on to the next line: what is the <code>"on-click": "act-note.es"</code>?

<p>
Recall that when notifications are received, <code>tee-note.es</code> writes the notification ID to <code>/tmp/notcat.id</code>.

<p>
<code>act-note.es</code>, which reads as follows,

<figure>
<pre>
<code>id = &lt;={%read &lt; /tmp/notcat.id}
if {!~ $id () &amp;&amp; !~ $id ''} {
	notcat invoke $id
}</code>
</pre>
</figure>

<p>
reads the ID from <code>/tmp/notcat.id</code>, and, if it's non-empty, calls <code>notcat invoke $id</code> in order to invoke the default action for the notification.

<h2>Limitations and TODOs</h2>

<p>
While notcat doesn't want or need libnotify, many other applications do, so sometimes notcat seems to be broken just because libnotify isn't installed on the system and clients are confused.
(This has bitten me in particular with web notifications from Firefox.)

<p>
Because notcat isn't a graphical application, certain things like icons and images are unlikely to ever be supported in a real way.
Sound is also unlikely.
However, there are other things which notcat could support and doesn't now.

<ul>

<li>
<p>
More format sequences and environment variables, especially around hints, actions, and conditionals

<li>
<p>
More robust behavior in conditionals, especially allowing character escaping and better control over argument-splitting

<li>
<p>
Better <code>body-markup</code> support, since notcat only currently handles stripping tags and un-escaping <code>&amp;amp;</code> codes

<li>
<p>
Support for other capabilities as well &mdash; and it might be nice to write up doing so, given much of this stuff is more or less completely undocumented.

	<ul>
	<li><code>body-hyperlinks</code> (&lt;a href&gt; markup)
	<li><code>persistence</code>
	</ul>

<li>
<p>
Better D-Bus error reporting

</ul>
</main>
