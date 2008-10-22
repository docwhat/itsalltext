/*extern HTMLDocument, gBrowser, ItsAllText */
/*jslint undef: true, nomen: true, evil: false, browser: true, white: true */
/*
 *  It's All Text! - Easy external editing of web forms.
 *
 *  Copyright (C) 2006-2007 Christian Höltje
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License.
 *
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

function new_monitor(iat) {
    var hitch_re = /^hitched_/,
        method;
    this.iat = iat;
    this.iat.debug('new_monitor');

    for (method in this) {
        if (hitch_re.test(method)) {

            this.iat.debug('hitching ', method, ' -> ', method.replace(hitch_re, ''));
            this[method.replace(hitch_re, '')] = this.iat.hitch(this, method);
        }
    }

}

new_monitor.destroy = function () {
    delete this.iat;
};

new_monitor.prototype.hitched_restart = function () {
    var rate = this.iat.getRefresh(),
        id   = this.id;
    if (id) {
        clearInterval(id);
    }
    this.id = setInterval(this.watcher, rate);
};

new_monitor.prototype.hitched_registerPage = function (event) {
    var doc, appContent;
    if (event.originalTarget instanceof HTMLDocument) {
        doc = event.originalTarget;
        if (doc.defaultView.frameElement) {
            // Frame within a tab was loaded. doc should be the root document of
            // the frameset. If you don't want do anything when frames/iframes
            // are loaded in this web page, uncomment the following line:
            // return;
            // Find the root document:
            while (doc.defaultView.frameElement) {
                doc = doc.defaultView.frameElement.ownerDocument;
            }
        }

        this.iat.debug('registerPage: ', doc && doc.location);

        /* appContent is the browser chrome. */
        appContent = document.getElementById("appcontent");
        this.iat.listen(appContent, 'DOMContentLoaded', this.startPage, true);
        this.iat.listen(document, 'unload', this.stopPage, true);
        this.iat.listen(gBrowser.tabContainer, 'TabSelect', this.watcher, true);
        this.startPage({originalTarget: doc});
        this.iat.debug('RegisterPage: END');
    }
};

new_monitor.prototype.hitched_watcher = function (offset, init) {
    if (typeof(offset) === 'number' &&
        offset.type === 'TabSelect') {
        init = true;
    }
    var rate = this.iat.getRefresh(),
        now = Date.now(),
        doc,
        nodes = [],
        i,
        cobj,
        node,
        is_html,
        is_xul;
    if (!init && now - this.last_watcher_call < Math.round(rate * 0.9)) {
        this.iat.debug('watcher(', offset, '/', (now - this.last_watcher_call), ') -- skipping catchup refresh');
        return;
    }
    this.last_watcher_call = now;

    if (typeof(gBrowser) === 'undefined') {
        /* If we're in chrome. */
        doc = document;
    } else {
        /* If we're in a tabbed browser. */
        doc = gBrowser.selectedBrowser.contentDocument;
    }
    this.iat.debug('watcher: ', offset, init, doc && doc.location);
    is_html = this.isHTML(doc);
    is_xul  = this.isXUL(doc);
    if (is_html) {
        /* HTML */
        nodes = doc.getElementsByTagName('textarea');
    } else if (is_xul) {
        /* XUL */
        nodes = doc.getElementsByTagName('textbox');
    } else {
        this.stopPage({originalTarget: doc});
        return;
    }
    for (i = 0; i < nodes.length; i++) {
        node = nodes[i];
        if (init) {
            cobj = ItsAllText.CacheObj.make(node, is_html);
        } else {
            cobj = ItsAllText.CacheObj.get(node);
        }
        if (cobj) {
            cobj.update();
        }
    }
};

new_monitor.prototype.hitched_startPage = function (event, force) {
    var doc = event.originalTarget,
        unsafeWin;
    this.iat.debug('startPage', doc && doc.location, force);
    if (!(force || this.isHTML(doc))) {
        this.stopPage(event);
        return;
    }

    unsafeWin = doc.defaultView.wrappedJSObject;
    if (unsafeWin) {
        this.iat.listen(unsafeWin, 'pagehide', this.stopPage);
    }

    // Kick off a watcher now...
    this.watcher(0, true);
    // Set up the future ones
    this.restart();
};

new_monitor.prototype.hitched_stopPage = function (event) {
    var doc = event.originalTarget,
        unsafeWin;
    this.iat.debug('stopPage', doc && doc.location);

    unsafeWin = doc.defaultView.wrappedJSObject;
    if (unsafeWin) {
        this.iat.unlisten(unsafeWin, 'pagehide', this.stopPage);
    }
};

new_monitor.prototype.isXUL = function (doc) {
    var contentType = doc && doc.contentType,
        is_xul = (contentType == 'application/vnd.mozilla.xul+xml'),
        is_my_readme;
    try {
        is_my_readme = location && location.href == this.iat.README;
    } catch (e) {
        is_my_readme = false;
    }
    return is_xul && !is_my_readme;
};

new_monitor.prototype.isHTML = function (doc) {
    var contentType,
        location,
        is_html,
        is_usable,
        is_my_readme;
    /* Check that this is a document we want to play with. */
    contentType = doc.contentType;
    location = doc.location;
    is_html = (contentType == 'text/html' ||
               contentType == 'text/xhtml' ||
               contentType == 'application/xhtml+xml');
    is_usable = is_html &&
                location &&
                location.protocol !== 'about:' &&
                location.protocol !== 'chrome:';
    try {
        is_my_readme = location && location.href == this.iat.README;
        /*
         * Avoiding this error.... I hope.
         * uncaught exception: [Exception... "Component returned failure code: 0x80004003 (NS_ERROR_INVALID_POINTER) [nsIDOMLocation.href]"  nsresult: "0x80004003 (NS_ERROR_INVALID_POINTER)"  location: "JS frame :: chrome://itsalltext/chrome/itsalltext.js :: anonymous :: line 634"  data: no]
         * Line 0
         */
    } catch (e) {
        is_my_readme = false;
        is_usable = false;
    }
    return is_usable && !is_my_readme;
};


