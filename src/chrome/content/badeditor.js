/*jslint undef: true, nomen: true, evil: false, browser: true, white: true */

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
    var locale = document.getElementById("strings"),
        params = window['arguments'][0],
        reason = document.getElementById('reason'),
        textnode = '**error**';
    /* Errors are from
     * http://lxr.mozilla.org/seamonkey/source/xpcom/base/nsError.h#262 */
    if (params.exception == 'NS_ERROR_FILE_INVALID_PATH' ||
       params.exception == 'NS_ERROR_FILE_UNRECOGNIZED_PATH' ||
       params.exception == 'NS_ERROR_FILE_TARGET_DOES_NOT_EXIST' ||
       params.exception == 'NS_ERROR_FILE_INVALID_PATH' ||
       params.exception == 'NS_ERROR_FILE_NOT_FOUND' ||
       params.exception == 'NS_ERROR_FILE_NAME_TOO_LONG') {
        textnode = locale.getFormattedString('bad.noent', [params.path]);
    } else if (params.exception == 'NS_ERROR_FILE_ACCESS_DENIED' ||
              params.exception == 'NS_ERROR_FILE_IS_DIRECTORY' ||
              params.exception == 'NS_ERROR_FILE_IS_LOCKED') {
        textnode = locale.getFormattedString('bad.noexec', []);

    /* At this point, we don't know exactly why it failed...
     * Try some heuristics. */
    } else if (!params.path) {
        textnode = locale.getFormattedString('bad.noset', []);
    } else if (params.exists) {
        textnode = locale.getFormattedString('bad.noexec', []);
    } else {
        textnode = locale.getFormattedString('bad.noent', [params.path]);
    }
    reason.appendChild(document.createTextNode(textnode));
}
