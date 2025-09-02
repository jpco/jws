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
	IN_DOCKER = false
	server-port = 8181
}

if {~ $NCAT_SUBSHELL_MODE ()} {
	local (NCAT_SUBSHELL_MODE = yes)
	forever {ncat -k -l -p $server-port -e $0 || exit 2}
}


#
# Setup for reply logic.  Populate $method, $reqpath, $version, and variables
# for any request headers.
#

(method reqpath version) = <={%split ' ' <={~~ <=%read *\r}}

let (header = ())
while {!~ <={header = <=%read} \r} {
	let (h = <={~~ $header *': '*\r})
		$h(1) = $h(2)
}


#
# Helper functions.  Easier than doing all this catting manually every time.
#

# Prints basic http response headers to stdout.
# This code-* stuff is gross lol.
let (
	code-100 = 'Continue'
	code-101 = 'Switching Protocols'
	code-102 = 'Processing'
	code-103 = 'Early Hints'

	code-200 = 'OK'
	code-201 = 'Created'
	code-202 = 'Accepted'
	code-203 = 'Non-Authoritative Information'
	code-204 = 'No Content'
	code-205 = 'Reset Content'
	code-206 = 'Partial Content'
	code-207 = 'Multi-Status'
	code-208 = 'Already Reported'
	code-226 = 'IM Used'

	code-300 = 'Multiple Choices'
	code-301 = 'Moved Permanently'
	code-302 = 'Found'
	code-303 = 'See Other'
	code-304 = 'Not Modified'
	code-305 = 'Use Proxy'
	code-306 = 'Switch Proxy'
	code-307 = 'Temporary Redirect'
	code-308 = 'Permanent Redirect'

	code-400 = 'Bad Request'
	code-401 = 'Unauthorized'
	code-402 = 'Payment Required'
	code-403 = 'Forbidden'
	code-404 = 'Not Found'
	code-405 = 'Method Not Allowed'
	code-406 = 'Not Acceptable'
	code-407 = 'Proxy Authentication Required'
	code-408 = 'Request Timeout'
	code-409 = 'Conflict'
	code-410 = 'Gone'
	code-411 = 'Length Required'
	code-412 = 'Precondition Failed'
	code-413 = 'Payload Too Large'
	code-414 = 'URI Too Long'
	code-415 = 'Unsupported Media Type'
	code-416 = 'Range Not Satisfiable'
	code-417 = 'Expectation Failed'
	code-418 = 'I''m a teapot'
	code-421 = 'Misdirected Request'
	code-422 = 'Unprocessable Content'
	code-423 = 'Locked'
	code-424 = 'Failed Dependency'
	code-425 = 'Too Early'
	code-426 = 'Upgrade Required'
	code-428 = 'Precondition Required'
	code-429 = 'Too Many Requests'
	code-431 = 'Request Header Fields Too Large'
	code-451 = 'Unavailable For Legal Reasons'

	code-500 = 'Internal Server Error'
	code-501 = 'Not Implemented'
	code-502 = 'Bad Gateway'
	code-503 = 'Service Unavailable'
	code-504 = 'Gateway Timeout'
	code-505 = 'HTTP Version Not Supported'
	code-506 = 'Variant Also Negotiates'
	code-507 = 'Insufficient Storage'
	code-508 = 'Loop Detected'
	code-510 = 'Not Extended'
	code-511 = 'Network Authentication Required'
)
fn reply code type flags {
	echo >[1=2] $method $reqpath '->' $version $code $(code-$code)
	echo $version $code $(code-$code)
	echo Content-Type: $type
	if {$IN_DOCKER && ~ $flags cache} {
		echo Cache-Control: public, max-age=3600
	}
	echo
}

# Serve a static file, including the headers
fn serve file {
	let (mime-type = text/plain) {
		# manually match the main file types, since file(1) doesn't
		# always get it right in the way we need.
		match $file (
		*.html	{mime-type = text/html}
		*.css	{mime-type = text/css}
		*.js	{mime-type = text/javascript}
		*	{mime-type = `` \n {file -b --mime-type $file}}
		)
		reply 200 $mime-type cache
	}
	cat $file
}


#
# Core routing/service logic.
#

catch @ exception {
	reply 500 text/html
	echo >[1=2] 'Internal server error:' $exception
	. script/500.es $exception
} {
	if (
		# "pages": es scripts wrapped in html templates.
		{access -f page/$reqpath^.es} {
			reply 200 text/html cache
			. script/read-page.es < page/$reqpath^.es
		}
		{access -f page/$reqpath/index.html.es} {
			reply 200 text/html cache
			. script/read-page.es < page/$reqpath/index.html.es
		}

		# static files
		{access -f static/$reqpath} {
			serve static/$reqpath
		}

		# 404
		{
			reply 404 text/html
			. script/404.es $reqpath
		}
	)
}
