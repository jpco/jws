<; cat tmpl/header.html >

<title>jpco.io | Automatic</title>
<meta name=description content=experiment />

<canvas width=800 height=500 id=automatic></canvas>
<canvas width=800 height=500 id=automatic-debug></canvas>

<style>
html, body {
	margin: 0;
	padding: 0;
	overflow: clip;
}
#automatic {
	position: absolute;
	background-color: black;
}
#automatic-debug {
	position: absolute;
	z-index: 1;
}
</style>

<script>
/* this is not very good javascript. */

function newgrid(nx, ny) {
	grid = new Array(nx);
	for (var x = 0; x < nx; x++) {
		grid[x] = new Array(ny);
		for (var y = 0; y < ny; y++) {
			grid[x][y] = 0;
		}
	}
	return grid;
}

function newgame(rule) {
	const pat = /B(\d*)\/S(\d*)/;
	matches = rule.match(pat);
	var game = {
		born: [0, 0, 0, 0, 0, 0, 0, 0, 0],
		survive: [0, 0, 0, 0, 0, 0, 0, 0, 0]
	};
	if (matches.length == 0) {
		return game;
	}
	for (let i = 0; i < matches[1].length; i++) {
		game.born[matches[1].charAt(i) - '0'] = 1;
	}
	for (let i = 0; i < matches[2].length; i++) {
		game.survive[matches[2].charAt(i) - '0'] = 1;
	}
	return game;
}

function step(game, state, neighbors) {
	return (state ? game.survive[neighbors] : game.born[neighbors]);
}

function update(game, state, newstate) {
	var nx = newstate.length;
	var ny = newstate[0].length;
	for (var x = 0; x < nx; x++) {
		var left = (x == 0 ? nx - 1 : x - 1);
		var right = (x == nx - 1 ? 0 : x + 1);
		for (var y = 0; y < ny; y++) {
			var up = (y == 0 ? ny - 1 : y - 1);
			var down = (y == ny - 1 ? 0 : y + 1);

			var neighbors = (
				state[left][up] +
				state[x][up] +
				state[right][up] +
				state[left][y] +
				state[right][y] +
				state[left][down] +
				state[x][down] +
				state[right][down]
			);

			newstate[x][y] = step(game, state[x][y], neighbors);
		}
	}
}

const canvas = document.getElementById("automatic");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const debugcanvas = document.getElementById("automatic-debug");
debugcanvas.width = window.innerWidth;
debugcanvas.height = window.innerHeight;

const c = canvas.getContext("2d");
const d = debugcanvas.getContext("2d");
c.fillStyle = "black";
d.fillStyle = "red";
d.font = "18px serif";
d.strokeStyle = "red";
c.fillRect(0, 0, canvas.width, canvas.height);

function newdrawbox() {
	var c = document.createElement("canvas");
	return {
		n: 0,
		colors: new Array(256),
		canvas: c,
		c: c.getContext("2d"),

		clear: function() {
			this.n = 0;
			this.colors = new Array(256);
		},
		add: function(c, x, y) {
			this.n++;
			if (this.colors[c] === undefined) {
				this.colors[c] = [];
			}
			this.colors[c].push({x: x, y: y});
			if (this.n == 1) {
				this.minx = this.maxx = x;
				this.miny = this.maxy = y;
			} else {
				if (x < this.minx) {
					this.minx = x;
				}
				if (x > this.maxx) {
					this.maxx = x;
				}
				if (y < this.miny) {
					this.miny = y;
				}
				if (y > this.maxy) {
					this.maxy = y;
				}
			}
		},
		distance: function(x, y) {
			if (this.n == 0) {
				return 0;
			}
			var lx = this.minx - x;
			var hx = x - this.maxx;
			var ly = this.miny - y;
			var hy = y - this.maxy;
			return Math.max(0, lx, hx) + Math.max(0, ly, hy);
		},

		drawOn: function(c) {
			if (this.n == 0) {
				return;
			}
			this.canvas.width = (this.maxx - this.minx + 1) * scale;
			this.canvas.height = (this.maxy - this.miny + 1) * scale;
			for (var i = 0; i < this.colors.length; i++) {
				if (this.colors[i] === undefined || this.colors[i].length == 0) {
					continue;
				}
				this.c.fillStyle = `rgb(${i},${i},${i})`;
				for (const pixel of this.colors[i]) {
					let x = pixel.x - this.minx;
					let y = pixel.y - this.miny;
					this.c.fillRect(x*scale, y*scale, scale, scale);
				}
			}
			c.drawImage(this.canvas, this.minx * scale, this.miny * scale);
		},
		drawDebugOn: function(c) {
			if (this.n == 0) {
				return;
			}
			var boxpct = Math.round((this.canvas.width * this.canvas.height * 100) / (canvas.width * canvas.height));
			c.strokeRect(this.minx * scale, this.miny * scale, this.canvas.width, this.canvas.height);
			c.fillText(`${boxpct}%, ${this.n}`, this.minx*scale, this.miny*scale + 14);
		}
	};
}

const boxmargin = 10;
var drawboxes = [];
var maxboxpct = 0;

function redraw(state, newstate) {
	const nx = newstate.length;
	const ny = newstate[0].length;

	for (box of drawboxes) {
		box.clear();
	}

	for (var x = 0; x < nx; x++) {
		for (var y = 0; y < ny; y++) {
			var oldc = (state[x][y] ? 255 : trace[x][y]);
			if (newstate[x][y]) {
				trace[x][y] = 140;
			} else if (trace[x][y] > 20) {
				trace[x][y] -= 1;
			}
			var newc = (newstate[x][y] ? 255 : trace[x][y]);
			if (newc == oldc) {
				continue;
			}
			var boxed = false;
			for (box of drawboxes) {
				if (box.distance(x, y) < boxmargin) {
					box.add(newc, x, y);
					boxed = true;
					break;
				}
			}
			if (!boxed) {
				var box = newdrawbox();
				drawboxes.push(box);
				box.add(newc, x, y);
			}
		}
	}

	for (box of drawboxes) {
		box.drawOn(c);
	}

	if (debug) {
		var idleboxes = 0;
		var boxpix = 0;
		d.clearRect(0, 0, debugcanvas.width, debugcanvas.height);
		for (box of drawboxes) {
			if (box.n == 0) {
				idleboxes++;
			} else {
				boxpix += box.canvas.width * box.canvas.height;
				box.drawDebugOn(d);
			}
		}
		var boxpct = Math.round((boxpix * 100) / (canvas.width * canvas.height));
		if (boxpct > maxboxpct) {
			maxboxpct = boxpct;
		}
		d.fillText(`total: ${boxpct}% (max ${maxboxpct}%) - idle boxes: ${idleboxes}/${drawboxes.length}`, 0, debugcanvas.height);
	}
}

const defaultrule = "B3/S23";
const defaultinitial = "230,230;231,228;231,230;233,229;234,230;235,230;236,230";
const defaultscale = 5;

var params = new URL(document.location.toString()).searchParams;
var rule = params.get("game");
var initial = params.get("i");
var debug = params.get("debug");
var scale = params.get("scale");
var setquery = false;
if (rule == null) {
	rule = defaultrule;
	setquery = true;
}
if (initial == null) {
	initial = defaultinitial;
	setquery = true;
}
if (debug == null || debug == "0" || debug == "false") {
	debug = 0;
}
if (scale == null) {
	scale = defaultscale;
}
if (setquery) {
	var str = `game=${rule}&i=${initial}`;
	if (debug) {
		str += `&debug=${debug}`;
	}
	if (scale != defaultscale) {
		str += `&scale=${scale}`;
	}
	window.location.search = str;
}

const numx = Math.floor(canvas.width / scale);
const numy = Math.floor(canvas.height / scale);

var state = newgrid(numx, numy);
var newstate = newgrid(numx, numy);

var trace = newgrid(numx, numy);

var game = newgame(rule);
for (il of initial.split(";")) {
	var ils = il.split(",");
	state[Number(ils[0])%numx][Number(ils[1])%numy] = 1;
}

redraw(newstate, state);

function nextTick() {
	update(game, state, newstate);
	redraw(state, newstate);

	var tmp = state;
	state = newstate;
	newstate = tmp;

	requestAnimationFrame(nextTick);
}
nextTick();
</script>
