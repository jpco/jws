function updater(token) {
    const src = document.createElement('input');
    src.setAttribute('type', 'text');
    src.setAttribute('id', 'src');

    const dest = document.createElement('input');
    dest.setAttribute('type', 'text');
    dest.setAttribute('id', 'dest');

    const set = document.createElement('button');
    set.onclick = function() {
        if (src.value == '') {
            return;
        }
        var xhr = new XMLHttpRequest();
        xhr.open('POST', '/_api/update');
        xhr.setRequestHeader('Content-Type', 'application/json; charset=utf-8');
        xhr.onload = function() {
            if (xhr.status < 400) {
                src.value = '';
                dest.value = '';
                display(JSON.parse(xhr.responseText));
            } else {
                console.log(xhr.responseText);
            }
        };
        xhr.send(JSON.stringify({src: src.value, dest: dest.value, token: token}));
    };
    set.append('Set');

    document.getElementById('update').append(src, ' to ', dest, set);
}

function display(data) {
    const list = document.createElement('ul');
    Object.keys(data).forEach(src => {
        const dest = document.createElement('a');
        dest.setAttribute('href', data[src]);
        dest.appendChild(document.createTextNode(data[src]));
        const line = document.createElement('li');
        line.append(src, ': ', dest);
        list.appendChild(line);
    });
    const main = document.getElementById('main');
    if (main.hasChildNodes()) {
        main.replaceChild(list, main.firstChild);
    } else {
        main.appendChild(list);
    }
}

function onSignIn(user) {
    var xhr = new XMLHttpRequest();
    xhr.open('POST', '/_api/links');
    xhr.setRequestHeader('Content-Type', 'application/json; charset=utf-8');
    xhr.onload = function() {
        if (xhr.status < 400) {
            display(JSON.parse(xhr.responseText));
        } else {
            console.log(xhr.responseText);
        }
    };
    xhr.send(JSON.stringify({token: user.getAuthResponse().id_token}));
    updater(user.getAuthResponse().id_token);
}
