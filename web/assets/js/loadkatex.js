function renderKaTeX() {
    var tags = document.querySelectorAll('.ktx-ns');
    for (var i = 0; i < tags.length; i++) {
        if ('katex' in tags[i].dataset) {
            tags[i].innerHTML = tags[i].dataset.katex;
            /* katex.render(tags[i].dataset.katex, tags[i], {
                throwOnError: false,
                displayMode: (tags[i].tagName === 'BLOCKQUOTE')
            }); */
        }
    }

    renderMathInElement(document.body);
}
