#!/usr/local/bin/es

# Ersatz line-oriented templating engine for .html.es files.
# Template syntax is the following, taking up a whole line:
#
#   <; es command >
#
# This should generally be improved or replaced with a real templating engine.
# I expect to be bit reasonably soon by the fact the following doesn't work:
#
#   <; for (i = one two three) { >
#     this is some text!
#   <; } >

let (line = (); cmdbuf = ()) {
	while {!~ <={line = <=%read} ()} {
		if {~ $line '<;'*'>'} {
			cmdbuf = $cmdbuf <={~~ $line '<;'*'>'}
		} {
			if {!~ $#cmdbuf 0} {
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
