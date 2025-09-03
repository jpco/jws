#!/usr/local/bin/es -p

# This is a messy http server written in the extensible shell.
# Its main benefit is that, other than the "server loop" section, it requires
# no reloading at all to update content.  It also brings the benefits of shell
# scripting, where you can just run whatever commands you have.
#
# Requires ncat (from nmap) to run.  Other netcats should work too with tweaks.

# We use a :8080 if $IN_DOCKER, :8181 otherwise.
if {~ $IN_DOCKER true} {
	server-port = 8080
} {
	IN_DOCKER = false
	server-port = 8181
}

# binary-wide gzip support.
# can also be toggled either by the specific calls to generate responses,
# or client-side by a 'gzip=false' query string.  also respects Accept-Encoding.
gzip = true


#
# The server loop.  Tells ncat to run this script again when a request is
# received, but when that happens, $NCAT_SUBSHELL_MODE is set, so we know we
# don't need to run another server.
#

if {~ $NCAT_SUBSHELL_MODE ()} {
	local (NCAT_SUBSHELL_MODE = yes)
	forever {ncat -k -l -p $server-port -e $0 || exit 2}
}


#
# Setup for reply logic.  Populate $method, $reqpath, $version, and variables
# for any request headers.
#

(method reqpath version) = <={%split ' ' <={~~ <=%read *\r}}
let (q = <={~~ $reqpath *'?'*})
if {!~ $q ()} {
	(reqpath query) = $q
	query = <={%split '&' $query}
}

let (header = ())
while {!~ <={header = <=%read} \r} {
	let (h = <={~~ $header *': '*\r})
		head-$h(1) = $h(2)
}


#
# Helper functions.  Easier than doing all this catting manually every time.
#

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
fn reply code type flags {
	if {~ $#(code-$code) 0} {
		echo >[1=2] WARNING: Unknown HTTP status code: $code
	}
	echo >[1=2] $method $reqpath '->' $version $code $(code-$code)
	echo $version $code $(code-$code)
	echo Content-Type: $type
	if {~ $flags cache && $IN_DOCKER} {
		echo Cache-Control: public, max-age=86400
	}
	if {~ $flags gzip && accepts-gzip} {
		echo Content-Encoding: gzip
	}
	echo
}

# Serve a static file, including the headers
fn serve file flags {
	let (mime-type = text/plain) {
		# manually match the main file types, since file(1) doesn't
		# always get it right in the way we need.
		match $file (
		*.html	{mime-type = text/html}
		*.css	{mime-type = text/css}
		*.js	{mime-type = text/javascript}
		*	{mime-type = `` \n {file -b --mime-type $file}}
		)
		reply 200 $mime-type $flags
	}
	if {~ $flags gzip && accepts-gzip} {
		gzip - < $file
	} {
		cat $file
	}
}

fn serve-page file flags {
	reply 200 text/html $flags
	if {~ $flags *gzip* && accepts-gzip} {
		. script/build-page.es < $file | gzip -
	} {
		. script/build-page.es < $file
	}
}


#
# Core routing/service logic.
#

catch @ exception {
	# TODO: this is messy, especially when an exception is generated mid-stream
	reply 500 text/html
	echo >[1=2] 'Internal server error:' $exception
	. script/500.es $exception
} {
	if (
		# debug page
		{~ $reqpath /http-debug} {
			reply 200 text/plain gzip
			for (i = <=$&vars) if {~ $i head-*} {
				echo <={~~ $i head-*}^: $$i
			}
			echo
			reply 200 text/plain
			var gzip IN_DOCKER server-port
		}

		# built pages
		{access -f page/$reqpath^.es} {
			serve-page page/$reqpath^.es cache
		}
		{access -f page/$reqpath/index.html.es} {
			serve-page page/$reqpath/index.html.es cache
		}

		# static files
		{access -f static/$reqpath} {
			serve static/$reqpath cache gzip
		}

		# 404
		{
			reply 404 text/html
			. script/404.es $reqpath
		}
	)
}
