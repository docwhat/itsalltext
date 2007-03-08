/**
 * Pass back the values that that the user selected.
 */
function onOK() {
    window['arguments'][0].out = {
        do_preferences: true
    };
    return true;
}
function doOnload() {
    var locale = document.getElementById("strings");
    var params = window['arguments'][0];
    var r=document.getElementById('reason');
    if(params.exists) {
        r.appendChild(document.createTextNode(params.exception));
    } else {
        var textnode = document.createTextNode(locale.getFormattedString('enoent', [params.path]));

        r.appendChild(textnode);
    }
}
