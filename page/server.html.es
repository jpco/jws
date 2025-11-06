<; cat tmpl/header.html >

<title>jpco.io | The script that served this title</title>
<meta name=description content="The script that served this description">

<; build-nav /server.html >

<main>
<p>
This is the script that served this request, written in <a href=/es><i>es</i></a>.

<pre id=main-block>
<; sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' < serve.es >
</main>
