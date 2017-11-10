var parsed;
var chunks;

// =============
// helper functions

function termEq(a, b) {
    if (typeof a === 'object' && typeof b === 'object') {
        return (a.ct == b.ct && a.type == b.type);   
    } else {
        return a == b;
    }
}

function randInt(max) {
    return Math.floor(Math.random() * max);
}

function roll(d) {
    if (typeof d !== 'object') {
        return d;
    }

    let r = 0;
    for (var i = 0; i < d.ct; i++) {
        r += randInt(d.type) + 1;
    }
    return r;
}

function parseDie(val) {
    if (!(val[0] == 'd' || val[0] == 'D') || val[1] == '-') {
        return;
    }
    let type = parseInt(val.substr(1));
    if (isNaN(type)) {
        return;
    }
    val = val.substr(1 + type.toString().length);
    return [type, val];
}

function parseDice(val) {
    let ct = parseInt(val);
    let ctlen = 0;
    let type  = 0;

    if (isNaN(ct)) {
        ct = 1;
    } else {
        ctlen = ct.toString().length;
    }
    val = val.substr(ctlen);

    let res = parseDie(val);
    if (typeof res === 'undefined') {
        return;
    }
    [type, val] = res;

    return [{ct: ct, type: type}, val];
}

function chunk(val) {
    let p = [];

    let i = 0;
    while (i < val.length) {
        if (val[i] >= '0' && val[i] <= '9' || (val[i] == 'd' || val[i] == 'D')) {
            let res = parseDice(val.substr(i));
            if (typeof res === 'undefined') {
                i++;
                continue;
            }
            if (i > 0) {
                p = p.concat(val.substr(0, i));
            }
            p = p.concat(res[0]);
            i = 0;
            val = res[1];
        } else {
            i++;
        }
    }
    return p.concat(val);
}

function deparse(p) {
    i = 0;
    let out = '';
    chunks = [];

    for (i = 0; i < p.length; i++) {
        let r = roll(p[i]);
        chunks = chunks.concat(r);
        out += r;
    }
    return out;
}

// =============
// update functions

function update(val) {
    np = chunk(val);
    let res = '';
    for (var i = 0; i < np.length; i++) {
        if (!termEq(parsed[i], np[i])) {
            parsed[i] = np[i];
            chunks[i] = roll(np[i]);
        }
        res += chunks[i];
    }
    if (np.length < parsed.length) {
        parsed = parsed.slice(0, np.length);
        chunks = chunks.slice(0, np.length);
    }
    return res;
}

function reset(val) {
    parsed = chunk(val);
    return deparse(parsed);
}

// =============
// listeners + setup

function inputEvent(r, w) {
    return function() {
        window.location.hash = '#' + encodeURIComponent(r.value);
        w.innerHTML = update(r.value);
    };
}

function rerollEvent(r, w) {
    return function(e) {
        if (e.which == 13 || e.keyCode == 13) {
            w.innerHTML = reset(r.value);
        }
    };
}

window.onload = function() {
    let r = document.getElementById('r');
    let w = document.getElementById('w');

    r.addEventListener('input', inputEvent(r, w));
    document.body.addEventListener('keydown', rerollEvent(r, w));
    r.value = decodeURIComponent(window.location.hash.substr(1));
    w.innerHTML = reset(r.value);
}
