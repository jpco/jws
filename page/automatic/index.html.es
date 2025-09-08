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

<script src="/script/automatic.js"></script>
