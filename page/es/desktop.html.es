<; cat tmpl/header.html >

<title>jpco.io | A shell-forward desktop</title>
<meta name=description content="Description of my desktop setup, through the lens of how it emphasizes the role of the extensible shell, es.">

<; build-nav /es/desktop.html >

<main>
<h1>A shell-forward desktop</h1>
<div class=time><time datetime=2026-01-23>2026-01-23</time></div>

<p>
This is just a short description of the desktop (technically, laptop) setup that I've converged onto over the years.
Because of my long-abiding interest in <a href=/es><i>es</i></a>, I have tended to make choices that lean into using it as much as I can.

<p>
You might notice I also have slightly strange preferences&mdash;in general, I prefer my computer to do as little as possible, because I don't mind adding behavior to a too-minimal system, but dialing back annoying behaviors from a feature-rich one annoys the hell out of me.

<p>
For example, for logging in, I just use a getty (on Archlinux, <code>agetty(8)</code>) and <code>login(1)</code>.
I don't even have a lock screen; I prefer to just make the logging-in process quick and easy in the first place.
Moreover, <code>login</code> doesn't try to do anything funny; it just starts a login <i>es</i> shell.

<p>
As users of <i>es</i> know, the <code>.esrc</code> script run by login shells is especially important, as <i>es</i> (like <i>rc</i> before it) only has that single script for customization and does everything else by passing strings down through the environment.
(Another reason I try to have a convenient logout/login process&mdash;I have to do it fairly often anyway!)

<h2>river</h2>

<p>
So when <code>login</code> starts a login shell, after <code>.esrc</code> does the usual environment customization, it has the following right at the end:

<figure>
<pre>
<code>let (x-wayland = true)
if {!pgrep river &gt; /dev/null} {
  fortune | cowsay -f `{echo &lt;={%flatten \n /usr/share/cowsay/cows/*} | shuf -n 1}
  mv -f /var/log/river/session /var/log/river/session.old
  exec {river &lt;={
    if {!$x-wayland} {
      result -no-xwayland
    } {
      result ()
    }
  }} &gt; /var/log/river/session &gt;[2=1]
}</code>
</pre>
</figure>

<p>
This prints a cute little creature-uttered <code>fortune(1)</code>, and then starts the <a href="https://github.com/riverwm/river">river</a> Wayland compositor.
River is an interesting compositor in a few ways, but I initially chose to use it primarily because it looked to me like &ldquo;the Wayland <a href="https://github.com/baskerville/bspwm">bspwm</a>&rdquo;, especially because the two share a critical design choice: configuration happens via a script.

<blockquote>
<em>TODO:</em> Add an obligatory screenshot here to (1) fix how annoying it is that a page about a desktop setup doesn't have any screenshots, and (2) prove that, visually, the setup isn't very interesting at all.
</blockquote>

<p>
When river starts up, it runs the executable file <code>~/.config/river/init</code> if it exists.
On my laptop, of course, this executable file is an <i>es</i> script.
This script does a few things; many of them are <code>riverctl(1)</code> commands, used to control and configure river from the outside.
The following is an excerpted version of my river config, skipping the not-very-interesting parts which set colors and basic keybindings.

<figure>
<pre>
<code># start the terminal server.  This prevents the junk below from impacting the environment
foot -Ss &amp;

# core utilities
riverctl map normal Super Return spawn footclient
riverctl map normal Super Space spawn 'rofi -show combi'

for ((media-key bin args notif) = (
  XF86AudioRaiseVolume	pamixer		'--unmute --increase 5'	'"Set volume" "$(pamixer --get-volume-human)"'
  XF86AudioLowerVolume	pamixer		'--decrease 5'		'"Set volume" "$(pamixer --get-volume-human)"'
  XF86AudioMute		pamixer		'--mute --set-volume 0'	'"Audio muted"'
  XF86MonBrightnessDown	brightnessctl	'-e set 5%-'		'"Set brightness" "$(brightnessctl get)"'
  XF86MonBrightnessUp	brightnessctl	'-e set 5%+'		'"Set brightness" "$(brightnessctl get)"'
)) {
  riverctl map normal None $media-key spawn &lt;={
    %flatten ' ' $bin $args '&amp;&amp;' \
    notcat send -a $bin -h canonical:^$bin -u low $notif
  }
}

waybar &amp;

get-online &amp;&amp; {
  forever { sync-mail.es; sleep 60 }
} &amp;

# layout settings
riverctl default-layout rivertile
rivertile -view-padding 0 -outer-padding 0 -main-ratio 0.52 &amp;</code>
</pre>
</figure>

<p>
For my terminal I use <code>foot(1)</code>, particularly using the client-server model via <code>foot -s</code> and <code>footclient(1)</code>.
This speeds up terminal startup and reduces resource use.
After the <code>foot</code> server, this script adds keybindings to spawn <code>footclient</code>, <code>rofi(1)</code>, and media keys including <code>notcat send</code> commands for them (more on notcat below).
Then, we spawn a <code>waybar(5)</code>, and finally <code>rivertile(1)</code>.

<p>
<code>rivertile</code> is part of what makes river interesting; it's a separate program which communicates over a custom Wayland protocol to control the window management of the graphical session.
Other programs can be used in place of <code>rivertile</code>, as long as they implement the same protocol.
In theory a shell script could do it, if there were a helper program to translate between plain text and the Wayland protocol (like <code>ncat(1)</code> does for <a href=/es/web-server.html>this site's web server</a>, or notcat does for notifications, which I describe below) or, someday, if there were a module that could be loaded into <i>es</i>.

<h2>waybar and notcat</h2>

<p>
Waybar, which I use for my status bar, is one of the few graphical programs I use other than the terminal and firefox.
My configuration is extremely basic; it just displays a battery percentage and clock on the right side and my notification server on the left.

<p>
My entire waybar config looks like this:

<figure>
<pre>
<code>{
  "margin": "0 10",
  "modules-left": ["custom/notcat"],
  "modules-right": ["battery", "clock"],
  "clock": { "timezone": "America/Los_Angeles" },

  "custom/notcat": {
    "exec": "echo; notcat --capabilities=body-markup,body-hyperlinks --on-notify=tee-note.es --on-empty=tee-note.es '%i' '%s%(?B: - %b)'",
    "on-click": "act-note.es"
  }
}</code>
</pre>
</figure>

<p>
The only interesting part of this is the notcat module.

<p>
<a href=/notcat>The notcat notification server</a>, which I wrote, is meant to be somewhat like a netcat in its function; it allows a user to write scripts on top of a binary which can function either as a notification server or client.
Like a netcat, at its most simple, it prints received notifications to its standard output, but it is also able to run subcommands when notifications are received or closed.
Notcat also implements an extension to the normal D-Bus notification protocol so that external programs can invoke actions on notifications&mdash;that ability is used in this config in the <code>"on-click"</code> script.

<p>
<a href=/notcat#usage>The notcat page itself goes deeper in detail</a> on what this line in waybar's config does, and what the scripts it invokes contain.
However, other references to notcat are littered throughout my desktop config, because I use it for all sorts of information.
Every time I change the volume or brightness, <code>notcat send</code> is used to send a notification about it.
I also get notifications for online status on login; the <code>get-online</code> script in my river init file is a simple wrapper around <code>ping</code> in a loop, sending notifications if pings initially fail, and on the first time pings succeed after failing.
Then, the <code>sync-mail.es</code> script checks for mail and runs a <code>notcat send</code> each time my local mail directory has changed.
What a lot of people use a lot of graphical widgets, windows, and modules for, I narrowed into a single scriptable and non-disruptive mechanism.

<h2>rofi</h2>

<p>
In addition to waybar, I also rely heavily on <a href="https://github.com/davatorium/rofi">rofi</a> in my desktop config.
When <code>rofi(1)</code> is run, it pops up a menu of items (and a text field to filter them), and selecting one of the items invokes some action.
Typically, rofi is used as an application launcher or window switcher.
I use the default application launcher logic, both the simple <code>run</code> mode which simply runs a binary in <code>$PATH</code> as well as the <code>drun</code> mode which looks up .desktop files for binaries which fancy themselves &ldquo;applications&rdquo;.

<p>
On top of <code>run</code> and <code>drun</code>, I also use rofi to get passwords from <a href="https://www.passwordstore.org/">the password manager <code>pass</code></a>, using the <code>rofi-pass.es</code> script that I wrote.
I'll describe the setup, though it is a bit of a mess.

<p>
When rofi uses a script (see <code>rofi-script(5)</code>), it calls it twice.
The first time, when it wants to print the menu, it executes the script with no arguments, and makes an option from each line that script prints to standard output.
Then, if an option is selected, rofi will call the script again with that option as its first argument.
We see the <code>rofi-pass.es</code> script here:

<figure>
<pre>
<code># prints gpg files in the 'base' directory, recursing down directories
fn rec-ls base prefix {
  for (ff = $base/*)
  let (f = &lt;={~~ $ff $base/*}) {
    if {!access $ff} {  # probably a globbing problem
      return
    }
    if {access -d $ff} {
      rec-ls $ff $^prefix/$f
    } {
      echo &lt;={~~ $^prefix/$f /*.gpg}
    }
  }
}

fn get-pass path {
  while {pgrep -x rofi &lt; /dev/null &lt;[2] /dev/null} {
    sleep 0.1
  }

  local (PINENTRY_USER_DATA = rofi)
    pass -c $path
}

if {!~ $* ()} {
  get-pass $* &gt; /dev/null &gt;[2=1] &amp;
} {
  rec-ls ~/.password-store
}</code>
</pre>
</figure>

<p>
The first call to this script leads to the <code>rec-ls</code> function being called, which prints each of the entries in <code>~/.password-store</code> so that rofi can use them as options.
Then, if an entry is selected, this script is called with that, at which point it calls <code>get-pass</code> to get the password from that file.

<p>
When <code>pass</code> (which is, by the way, just a bash script) tries to retrieve the password from the given file, it will use <code>gpg(1)</code> to decrypt the file, and gpg will likely need a password from the user to do so.
This is what the <code>PINENTRY_USER_DATA</code> variable is for.
In <code>~/.gnupg/gpg-agent.conf</code> is the line

<figure>
<pre>
<code>pinentry-program /home/jpco/.local/bin/pinentry-switch.es</code>
</pre>
</figure>

<p>
This configures gpg to use the <code>pinentry-switch.es</code> script for pinentry, which reads:

<figure>
<pre>
<code>if {~ $PINENTRY_USER_DATA 'rofi'} {
  /home/jpco/.local/bin/pinentry-rofi.es
} {
  /usr/bin/pinentry-tty
}</code>
</pre>
</figure>

<p>
This makes it so that, when invoked from rofi, gpg uses rofi to prompt the user for a password, but when invoked any other time, it just uses the basic tty prompt.
This is more convenient, in terms of keeping the user (me) from having to jump between windows unnecessarily.

<p>
Then there's the the <code>pinentry-rofi.es</code> script.
This script is an extremely rough-and-ready implementation against <a href="https://www.gnupg.org/documentation/manuals/assuan/index.html">the Assuan protocol</a> that was in part (especially the <code>sed</code> invocation) ripped from somewhere I can't remember now (whoops!)

<figure>
<pre>
<code>command- = {throw continue}
command-BYE = {exit}

prompt = ()
command-SETPROMPT = @ {prompt = &lt;={~~ $* *:}}

desc = ()
command-SETDESC = @ {desc = $*}

error = ()
command-SETERROR = @ {error = $*^\n}

command-GETINFO = @ info {
  match $info (
    flavor  {echo D rofi}
    version  {echo D 0.1}
    ttyinfo  {echo D - - -}
    pid  {echo D $pid}
  )
}

command-GETPIN = {
  let (message = `` \n {sed (
    -e 's|%0A|\n|g'
    -e 's|%22||g'
    -e 's|key:|key:\n|g'
    -e 's|&gt;|&gt;\n|g'
    -e 's|&lt;|\&amp;lt;|g'
    -e 's|&gt;|\&amp;gt;|g'
    -e 's|,created|,\ncreated|g'
    -e 's|_ERO_|&lt;span fgcolor=''#ab4642''&gt;|g'
    -e 's|_ERC_|&lt;/span&gt;\n|g'
  ) &lt;&lt;&lt; $^error^$^desc^\n})
  let (password = `` \n {
    rofi -dmenu -input /dev/null -password -lines 0 \
      -p $^prompt -mesg &lt;={%flatten \n $message}
  }) {
    if {!~ $^password ''} {
      echo D $password
    }
  }
}

echo OK get to it

let ((line cmd rest) = ())
while {!~ &lt;={line = &lt;=%read} ()} {
  if {~ $line *^$ifs^*} {
    (cmd rest) = &lt;={~~ $line *^$ifs^*}
  } {
    cmd = $line
  }
  catch @ e rest {
    if {~ $e exit} {
      echo OK bye now
    } {~ $e continue} {
      throw retry
    }
    throw $e $rest
  } {
    if {!~ $#(command-^$cmd) 0} {
      $(command-^$cmd) $rest
    }
    echo OK
  }
}</code>
</pre>
</figure>

<p>
There are, on the internet, quite a few similar &ldquo;rofi+<code>pass</code>&rdquo; implementations that look a lot like this one, implemented in quite a few different languages.
I suppose this is just my entry to that family using <i>es</i>.

</main>
