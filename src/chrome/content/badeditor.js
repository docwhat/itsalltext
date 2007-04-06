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
    var reason = document.getElementById('reason');
    var textnode = '**error**';
    if(params.path === null) {
        textnode = locale.getFormattedString('bad.noset',[]);
    } else {
        if(params.exists) {
            textnode = locale.getFormattedString('bad.noexec', []);
        } else {
            textnode = locale.getFormattedString('bad.noent', [params.path]);
        }
    }
    reason.appendChild(document.createTextNode(textnode));
}
