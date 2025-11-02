<; cat tmpl/header.html >

<title>jpco.io | Web notifications tests</title>
<meta name=description content="Web notifications API tests">

<style>
.hidden {
	display: none;
}
script {
	display: block;
}
</style>

<; build-nav /notcat/web-test.html >

<main>
<p>
This page is for testing various aspects of the Web Notifications API.

<p>
First you'll have to give permission for notifications.

<p>
<button id=permission>Permission please!</button>

<figure>
<pre>
<script>document.getElementById("permission").addEventListener("click", () => {
    if (!("Notification" in window)) {
        alert("Your browser doesn't support notifications, so this page might not be very useful.");
        return;
    }
    Notification.requestPermission();
});</script></pre>
</figure>

<hr>

<p>
Now you can create a basic notification.

<p>
<button id=basic>Basic notification!</button>

<figure>
<pre>
<script>document.getElementById("basic").addEventListener("click", () => {
    new Notification("This is a notification!");
});</script></pre>
</figure>

<hr>

<p>
Notifications can track when things happen to them.

<p>
<button id=tracker>Another notification!</button>
<span class=hidden id=tracker-message></span>

<figure>
<pre>
<script>document.getElementById("tracker").addEventListener("click", () => {
    const ul = document.getElementById("tracker-message");
    const n = new Notification("Another notification!", {
        body: "This one has event listeners attached! (and a body!)"
    });
    n.onshow = () => {
        ul.classList.remove("hidden");
        ul.innerHTML = "The notification has been shown!";
    };
    n.onclick = () => {
        ul.classList.remove("hidden");
        ul.innerHTML = "The notification has been clicked!";
    };
    n.onclose = () => {
        ul.classList.remove("hidden");
        ul.innerHTML = "The notification has been closed!";
    };
});</script></pre>
</figure>

<hr>

<p>
They can also be closed from the page.

<p>
<button id=toggler>Yet another notification!</button>

<span id=toggle-bucket></span>

<figure>
<pre>
<script>document.getElementById("toggler").addEventListener("click", () => {
    const toggle_n = new Notification("Opening me was a mistake!", {
        body: "Undo it quick!"
    });
    const toggler = document.createElement("button");
    toggler.textContent = "Close it!";
    toggler.addEventListener("click", () => {
        toggle_n.close();
    });

    const bucket = document.getElementById("toggle-bucket");
    bucket.appendChild(toggler);
    toggle_n.onclose = () => {
        bucket.removeChild(toggler);
    };
});</script></pre>
</figure>

<hr>

<p>
Notifications can have "tags", which means they replace other notifications with the same tag.

<p>
<button id=incrementer>Notification bonanza!</button>

<figure>
<pre>
<script>var incr = 0;
document.getElementById("incrementer").addEventListener("click", () => {
    incr++;
    const n = new Notification("Notification incrementer!", {
        body: `Number ${incr}!`,
        tag: "incrementer"
    });
    n.onclick = () => {
        incr = 0;
    };
});</script></pre>
</figure>
</main>
