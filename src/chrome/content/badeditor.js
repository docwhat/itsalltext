"use strict";
// vim: ts=4 sw=4 sts=4

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
    var locale = document.getElementById("itsalltext-strings"),
    params = window['arguments'][0],
    reason = document.getElementById('reason'),
    textnode = '**error**';
    /* Errors are from
     * http://lxr.mozilla.org/seamonkey/source/xpcom/base/nsError.h#262 */
    var noent_errors = [
        'NS_ERROR_FILE_INVALID_PATH',
        'NS_ERROR_FILE_UNRECOGNIZED_PATH',
        'NS_ERROR_FILE_TARGET_DOES_NOT_EXIST',
        'NS_ERROR_FILE_INVALID_PATH',
        'NS_ERROR_FILE_NOT_FOUND',
        'NS_ERROR_FILE_NAME_TOO_LONG'
    ];
    var noexec_errors = [
        'NS_ERROR_FILE_ACCESS_DENIED',
        'NS_ERROR_FILE_IS_DIRECTORY',
        'NS_ERROR_FILE_IS_LOCKED'
    ];
    if (noent_errors.indexOf(params.exception) >= 0) {
        textnode = locale.getFormattedString('bad.noent', [params.path]);
    } else if (noexec_errors.indexOf(params.exception)) {
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
