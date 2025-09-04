<; cat tmpl/header.html >

<title>jpco.io | Automatic</title>
<meta name=description content=experiment />

<canvas width=800 height=500 id=automatic></canvas>

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
</style>

<script>
/* I think this is the worst javascript anybody ever wrote lol */

const canvas = document.getElementById("automatic");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const defaultGame = "B3/S23";
const defaultInitial = "30,30;30,31;29,31;30,32;31,32";

let params = new URL(document.location.toString()).searchParams;
let game = params.get("game");
let initial = params.get("i");
let newQuery = ["game=" + defaultGame, "i=" + defaultInitial];
let updateQuery = false;
if (game != null) {
	newQuery[0] = "game=" + game;
} else {
	game = defaultGame;
	updateQuery = true;
}
if (initial != null) {
	newQuery[1] = "i=" + initial;
} else {
	initial = defaultInitial;
	updateQuery = true;
}
if (updateQuery) {
	window.location.search = newQuery[0] + "&" + newQuery[1];
}

const c = canvas.getContext("2d");

const scale = 5;
const border = 0;
const nx = Math.floor(canvas.width / scale);
const ny = Math.floor(canvas.height / scale);

function newGrid() {
	grid = new Array(nx);
	for (var x = 0; x < nx; x++) {
		grid[x] = new Array(ny);
	}
	return grid;
}

function ud20(n) {
	return n === undefined ? 0 : n;
}

function step(rule, state, neighbors) {
	const pat = /B(\d*)\/S(\d*)/;
	matches = rule.match(pat);
	born = [0, 0, 0, 0, 0, 0, 0, 0, 0];
	survive = [0, 0, 0, 0, 0, 0, 0, 0, 0];
	if (matches.length == 0) {
		console.log("I die");
	}
	for (let i = 0; i < matches[1].length; i++) {
		born[matches[1].charAt(i) - '0'] = 1;
	}
	for (let i = 0; i < matches[2].length; i++) {
		survive[matches[2].charAt(i) - '0'] = 1;
	}
	return (state ? survive[neighbors] : born[neighbors]);
}

function update(state) {
	newstate = newGrid();
	for (var x = 0; x < nx; x++) {
		var left = (x == 0 ? nx - 1 : x - 1);
		var right = (x == nx - 1 ? 0 : x + 1);
		for (var y = 0; y < ny; y++) {
			var up = (y == 0 ? ny - 1 : y - 1);
			var down = (y == ny - 1 ? 0 : y + 1);

			var neighbors = (
				ud20(state[left][up]) +
				ud20(state[x][up]) +
				ud20(state[right][up]) +
				ud20(state[left][y]) +
				ud20(state[right][y]) +
				ud20(state[left][down]) +
				ud20(state[x][down]) +
				ud20(state[right][down])
			);

			newstate[x][y] = step(game, state[x][y], neighbors);
		}
	}
	return newstate;
}

var been = newGrid();

function redraw(state) {
	for (var x = 0; x < nx; x++) {
		for (var y = 0; y < ny; y++) {
			if (state[x][y]) {
				been[x][y] = 140;
				c.fillStyle = "white";
			} else if (been[x][y]) {
				if (been[x][y] > 20) {
					been[x][y] -= 1;
				}
				c.fillStyle = "rgb("+been[x][y]+","+been[x][y]+","+been[x][y]+")";
			} else {
				c.fillStyle = "black";
			}
			c.fillRect(x*scale, y*scale, scale-border, scale-border);
		}
	}
}

var state = newGrid();

let il = initial.split(";");
for (let i = 0; i < il.length; i++) {
	let ils = il[i].split(",");
	let x = Number(ils[0]);
	let y = Number(ils[1]);
	state[x][y] = 1;
}

redraw(state);

setInterval(function() {
	state = update(state);
	redraw(state);
}, 15)

</script>
