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
		survive: [0, 0, 0, 0, 0, 0, 0, 0, 0],
		step: function(state, neighbors) {
			return (state ? this.survive[neighbors] : this.born[neighbors]);
		}
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

			newstate[x][y] = game.step(state[x][y], neighbors);
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
d.font = "18px serif";
c.fillRect(0, 0, canvas.width, canvas.height);

function newcanvascache() {
	return {
		free: [],
		cache: {},
		agemax: 4,

		cached: function(box) {
			if (this.cache[box] !== undefined) {
				this.cache[box].age = 0;
				return this.cache[box].canvas;
			}
		},
		set: function(box, canvas) {
			this.cache[box] = {
				age: 0,
				canvas: canvas
			};
		},
		new: function(x, y) {
			var c = this.free.pop();
			if (c === undefined) {
				c = document.createElement("canvas");
			}
			c.width = x;
			c.height = y;
			return c;
		},
		collect: function() {
			for (const box in this.cache) {
				this.cache[box].age++;
				if (this.cache[box].age > this.agemax) {
					this.free.push(this.cache[box].canvas);
					delete this.cache[box];
				}
			}
		},
		debug: function() {
			var livecount = Object.keys(this.cache).length;
			return `live: ${livecount}, free: ${this.free.length}, total: ${livecount + this.free.length}`;
		}
	}
}

function newdrawbox() {
	return {
		n: 0,
		colors: new Array(256),
		cached: false,

		clear: function() {
			this.n = 0;
			this.cached = false;
			for (var i = 0; i < this.colors.length; i++) {
				if (this.colors[i] !== undefined) {
					this.colors[i].length = 0;
				}
			}
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
		toString: function() {
			var hash = "";
			for (var i = 0; i < this.colors.length; i++) {
				if (this.colors[i] === undefined || this.colors[i].length == 0) {
					continue;
				}
				hash += i + ":";
				for (var p of this.colors[i]) {
					hash += (p.x-this.minx) + "," + (p.y-this.miny);
				}
				hash += ";";
			}
			return hash;
		},

		render: function(canvas) {
			var c = canvas.getContext("2d");
			for (var i = 0; i < this.colors.length; i++) {
				if (this.colors[i] === undefined || this.colors[i].length == 0) {
					continue;
				}
				c.fillStyle = `rgb(${i},${i},${i})`;
				for (const pixel of this.colors[i]) {
					let x = pixel.x - this.minx;
					let y = pixel.y - this.miny;
					c.fillRect(x*scale, y*scale, scale, scale);
				}
			}
		},
		drawon: function(c) {
			if (this.n == 0) {
				return;
			}
			var canvas = cache.cached(this);
			this.cached = canvas !== undefined;
			if (canvas === undefined) {
				var x = (this.maxx - this.minx + 1) * scale;
				var y = (this.maxy - this.miny + 1) * scale;
				canvas = cache.new(x, y);
				this.render(canvas);
				cache.set(this, canvas);
			}
			this.canvaswidth = canvas.width;
			this.canvasheight = canvas.height;
			c.drawImage(canvas, this.minx * scale, this.miny * scale);
		},
		drawdebugon: function(c) {
			if (this.n == 0) {
				return;
			}
			c.strokeRect(this.minx * scale, this.miny * scale, this.canvaswidth, this.canvasheight);
		}
	};
}

const boxmargin = 20;
var drawboxes = [];
var maxboxpct = 0;
var maxcboxpct = 0;

function redraw(state, newstate) {
	const nx = newstate.length;
	const ny = newstate[0].length;

	for (box of drawboxes) {
		box.clear();
	}
	cache.collect();

	// this needs improvement, it's a bottleneck
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
			for (var i = 0; i < drawboxes.length; i++) {
				if (drawboxes[i].distance(x, y) < boxmargin) {
					drawboxes[i].add(newc, x, y);
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

	for (var i = 0; i < drawboxes.length; i++) {
		drawboxes[i].drawon(c);
	}
}

function drawdebug(timing) {
	var idleboxes = 0;
	var cachedboxes = 0;
	var boxpix = 0;
	var cboxpix = 0;
	d.clearRect(0, 0, debugcanvas.width, debugcanvas.height);
	d.fillStyle = "green";
	d.strokeStyle = "green";
	for (box of drawboxes) {
		if (box.n == 0) {
			idleboxes++;
		} else if (box.cached) {
			cachedboxes++;
			cboxpix += box.canvaswidth * box.canvasheight;
			box.drawdebugon(d);
		}
	}
	d.fillStyle = "red";
	d.strokeStyle = "red";
	for (box of drawboxes) {
		if (box.n != 0 && !box.cached) {
			boxpix += box.canvaswidth * box.canvasheight;
			box.drawdebugon(d);
		}
	}
	var cboxpct = Math.round((cboxpix * 100) / (canvas.width * canvas.height));
	if (cboxpct > maxcboxpct) {
		maxcboxpct = cboxpct;
	}
	var boxpct = Math.round((boxpix * 100) / (canvas.width * canvas.height));
	if (boxpct > maxboxpct) {
		maxboxpct = boxpct;
	}
	d.fillText(`rendered: ${boxpct}% (max ${maxboxpct}%), cached: ${cboxpct}% (max ${maxcboxpct}%)`, 0, debugcanvas.height - 42);
	d.fillText(`boxes: rendered: ${drawboxes.length - cachedboxes - idleboxes}, cached: ${cachedboxes}, idle: ${idleboxes}, total: ${drawboxes.length}`, 0, debugcanvas.height - 28);
	d.fillText(`cache: ${cache.debug()}`, 0, debugcanvas.height - 14);
	d.fillText(timing, 0, debugcanvas.height);
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

var cache = newcanvascache();

redraw(newstate, state);

var st = window.performance.now();

function nextdrawloop() {
	if (window.performance.now() - st >= 15) {
		drawloop();
	}
	requestAnimationFrame(nextdrawloop);
}

var frames = 0;
var updatetime = 0;
var rendertime = 0;
var timemsg = "";

var prevst;

function drawloop() {
	frames++;

	st = window.performance.now();
	update(game, state, newstate);
	var ut = debug ? window.performance.now() : 0;
	redraw(state, newstate);
	var rt = debug ? window.performance.now() : 0;

	if (debug) {
		updatetime += ut - st;
		rendertime += rt - ut;
		if (frames == 10) {
			var ft = st - prevst;
			timemsg = `${frames} frames: ${Math.round(updatetime*100 / ft)}% update, ${Math.round(rendertime*100/ft)}% render, ${Math.round((ft - updatetime - rendertime)*100/ft)}% free, ${Math.round(1000 * frames / (st - prevst))}fps`;
			frames = 0;
			rendertime = 0;
			updatetime = 0;
			prevst = st;
		}
		drawdebug(timemsg);
	}

	var tmp = state;
	state = newstate;
	newstate = tmp;

}
drawloop();
requestAnimationFrame(nextdrawloop);
