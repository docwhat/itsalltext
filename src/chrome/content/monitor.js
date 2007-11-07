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

/*jslint nomen: true, evil: false, browser: true */

function new_monitor(iat) {
    this.iat = iat;
    this.iat.debug('new_monitor');

    var hitch_re = /^hitched_/;
    for (method in this) {
        if (hitch_re.test(method)) {

            this.iat.debug('hitching ', method ,' -> ', method.replace(hitch_re, ''));
            this[method.replace(hitch_re, '')] = this.iat.hitch(this, method);
        }
    }

}

new_monitor.prototype.hitched_restart = function () {
    var rate = this.iat.getRefresh();
    var id   = this.id;
    if (id) {
        clearInterval(id);
    }
    this.id = setInterval(this.watcher, rate);
};

new_monitor.prototype.registerPage = function (event) {
    if (event.originalTarget instanceof HTMLDocument) {
        var doc = event.originalTarget;
        if (event.originalTarget.defaultView.frameElement) {
            // Frame within a tab was loaded. doc should be the root document of
            // the frameset. If you don't want do anything when frames/iframes
            // are loaded in this web page, uncomment the following line:
            // return;
            // Find the root document:
            while (doc.defaultView.frameElement) {
                doc=doc.defaultView.frameElement.ownerDocument;
            }
        }

        this.iat.debug('registerPage: ', doc && doc.location);

        /* appContent is the browser chrome. */
        var appContent = document.getElementById("appcontent");
        this.iat.listen(appContent, 'DOMContentLoaded', this.startPage, true);
    }
};

new_monitor.prototype.unregisterPage = function (event) {
    var doc = event.originalTarget;
    this.iat.debug('unregisterPage', doc && doc.location);

    // Stop any monitoring.
    this.stopPage(event);

    // Remove any other handlers.
    var appContent = document.getElementById("appcontent");
    this.iat.unlisten(appContent, 'DOMContentLoaded', this.startPage, true);
};

new_monitor.prototype.hitched_watcher = function (init) {
    var doc = gBrowser.selectedBrowser.contentDocument;
    this.iat.debug('watcher: ', init, doc);
    var nodes = [];
    var i, cobj;
    var is_html = this.isHTML(doc);
    var is_xul  = this.isXUL(doc);
    if (is_html) {
        /* HTML */
        nodes = doc.getElementsByTagName('textarea');
    } else if (is_xul) {
        /* XUL */
        nodes = doc.getElementsByTagName('textbox');
    } else {
        this.unregisterPage(doc);
    }
    for(i=0; i < nodes.length; i++) {
        if (init) {
            cobj = ItsAllText.makeCacheObj(node);
        } else {
            cobj = ItsAllText.getCacheObj(node);
        }
        if (cobj) {
            cobj.update();
            if (init && is_html) {
                cobj.addGumDrop();
            }
        }
    }
};

new_monitor.prototype.hitched_startPage = function (event, force) {
    this.iat.debug('narf');
    
    var doc = event.originalTarget;
    this.iat.debug('startPage', doc && doc.location, force);
    if (!(force || this.isHTML(doc))) {
        this.unregisterPage(event);
        return;
    }

    var unsafeWin = doc.defaultView.wrappedJSObject;
    this.iat.listen(unsafeWin, 'pagehide', this.iat.hitch(this, 'stopPage'));

    // Kick off a watcher now...
    this.watcher();
    // Set up the future ones
    this.restart();
};

new_monitor.prototype.hitched_stopPage = function (event) {
    var doc = event.originalTarget;
    this.iat.debug('stopPage', doc && doc.location);
};

new_monitor.prototype.isXUL = function (doc) {
    var is_xul=(contentType=='application/vnd.mozilla.xul+xml');
    var is_my_readme;
    try {
        is_my_readme = location && location.href == this.iat.README;
    } catch(e) {
        is_my_readme = false;
    }
    return is_xul && !is_my_readme;
};

new_monitor.prototype.isHTML = function (doc) {
    var contentType, location, is_html, is_usable, is_my_readme;
    /* Check that this is a document we want to play with. */
    contentType = doc.contentType;
    location = doc.location;
    is_html = (contentType=='text/html' ||
               contentType=='text/xhtml' ||
               contentType=='application/xhtml+xml');
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
    } catch(e) {
        is_my_readme = false;
        is_usable = false;
    }
    return is_usable && !is_my_readme;
};


