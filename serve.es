#!/usr/local/bin/es -p

# This is a messy http server written in the extensible shell.
# Its main benefit is that, other than the "server loop" section, it requires
# no reloading at all to update content.  It also brings the benefits of shell
# scripting, where you can just run whatever commands you have.
#
# Requires ncat (from nmap) to run.  Other netcats should work too with tweaks.

#
# The server loop.  Tells ncat to run this script again when a request is
# received, but when that happens, $NCAT_SUBSHELL_MODE is set, so we know we
# don't need to run another server.
#

if {~ $IN_DOCKER true} {
	server-port = 8080
} {
	server-port = 8181
	IN_DOCKER = false
}

if {!~ $PORT ()} {
	server-port = $PORT
}

if {~ $NCAT_SUBSHELL_MODE ()} {
	local (NCAT_SUBSHELL_MODE = yes)
	forever {ncat -k -l -p $server-port -e $0 || exit 3}
}


#
# This is where we start the per-request stuff!
#
# Parse the request.  Populate $method, $reqpath, $version, and variables
# for any request headers.
#

(method reqpath version) = <={%split ' ' <={~~ <=%read *\r}}
let (q = <={~~ $reqpath *'?'*})
if {!~ $q ()} {
	(reqpath query) = $q
	query = <={%split '&' $query}
}

# TODO: it would be nice if we made all the header names lowercase
let (header = ())
while {!~ <={header = <=%read} \r} {
	let (h = <={~~ $header *': '*\r})
		head-$h(1) = $h(2)
}


#
# Page-serving functions.
#

# If gzip can be served for this response.  Requires static enablement here, the
# right Accept-Encoding, and NOT 'gzip=false' in the request query.
let (gzip = false)
fn accepts-gzip {
	$gzip \
	 && {~ $head-accept-encoding *gzip* || ~ $head-Accept-Encoding *gzip*}
	 && {!~ $query 'gzip=false'}
}

# Prints basic http response headers to stdout.
# Let's just support the codes we actually need.
let (
	code-200 = 'OK'
	code-302 = 'Found'
	code-404 = 'Not Found'
	code-418 = 'I''m a teapot'
	code-500 = 'Internal Server Error'
)
fn respond code type flags {
	if {~ $#(code-$code) 0} {
		echo >[1=2] WARNING: Unknown HTTP status code: $code
	}
	echo >[1=2] $method $reqpath '->' $version $code $(code-$code)
	echo $version $code $(code-$code)
	echo Content-Type: $type
	# Only cache resources in "prod" mode in a Docker container
	if {~ $flags cache && ~ $IN_DOCKER true} {
		echo Cache-Control: public, max-age=86400
	}
	if {~ $flags gzip && accepts-gzip} {
		echo Content-Encoding: gzip
	}
	echo
}

# Serve a static file, including printing the headers
fn serve file flags {
	let (mime-type = text/plain) {
		# Manually match the main file types, since file(1) doesn't
		# always get it right in the way we need.
		match $file (
		*.html	{mime-type = text/html}
		*.css	{mime-type = text/css}
		*.js	{mime-type = text/javascript}
		*	{mime-type = `` \n {file -b --mime-type $file}}
		)
		respond 200 $mime-type $flags
	}
	if {~ $flags gzip && accepts-gzip} {
		gzip - < $file
	} {
		cat $file
	}
}

# Build an html page.
fn build-page args {
	let (line = (); cmdbuf = ()) {
		while {!~ <={line = <=%read} ()} {
			if {~ $line '<;'*'>'} {
				cmdbuf = $cmdbuf <={~~ $line '<;'*'>'}
			} {
				if {!~ $#cmdbuf 0} {
					local (* = $args)
						eval <={%flatten \n $cmdbuf}
					cmdbuf = ()
				}
				echo $line
			}
		}
		if {!~ $#cmdbuf 0} {
			eval <={%flatten \n $cmdbuf}
		}
	}
}

# Serve a "built" html page.
fn serve-page file flags {
	respond 200 text/html $flags
	if {~ $flags gzip && accepts-gzip} {
		build-page < $file | gzip -
	} {
		build-page < $file
	}
}


#
# Page-building functions, for use in the built pages themselves.
#

# Print the top nav bar on a page based on the path passed to it.
fn build-nav path {
	echo -n '<nav><pre><code>http://<a href=/>jpco.io</a>'
	let (accum = '')
	for (f = <={%split / $path}) {
		accum = $accum^/^$^f
		echo -n '/<a href="'^$accum^'">'^$^f^'</a>'
	}
	echo '</code></pre></nav>'
}


#
# Core routing/service logic.
#

catch @ exception {
	# FIXME: this is messy, especially when an exception is generated mid-response
	respond 500 text/html
	echo >[1=2] 'Internal server error:' $exception
	build-page < page/505.html.es $exception
} {
	if (
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
			build-page < page/404.html.es $reqpath
		}
	)
}
