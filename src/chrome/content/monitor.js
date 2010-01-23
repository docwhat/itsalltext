/*extern HTMLDocument, gBrowser, ItsAllText */
/*jslint undef: true, evil: false, browser: true, white: true */
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

function monitor(iat) {
    var hitch_re = /^hitched_/,
        method;
    this.iat = iat;
    //disabled-debug -- this.iat.debug('monitor');

    for (method in this) {
        if (hitch_re.test(method)) {

            //disabled-debug -- this.iat.debug('hitching ', method, ' -> ', method.replace(hitch_re, ''));
            this[method.replace(hitch_re, '')] = this.iat.hitch(this, method);
        }
    }

}

monitor.prototype.hitched_destroy = function () {
    delete this.iat;
};

monitor.prototype.hitched_restart = function () {
    var rate = this.iat.getRefresh(),
        id   = this.id;
    if (id) {
        clearInterval(id);
    }
    this.id = setInterval(this.watcher, rate);
};

/**
 * Gets a page ready to be used by IAT.
 * This is called as an event handler.
 */
monitor.prototype.hitched_registerPage = function (event) {
    var doc, appContent;
    if (event.originalTarget instanceof HTMLDocument) {
        doc = event.originalTarget;
        //disabled-debug -- this.iat.debug('registerPage: ', doc && doc.location);

        /* appContent is the browser chrome. */
        appContent = document.getElementById("appcontent");
        this.iat.listen(appContent, 'DOMContentLoaded', this.startPage, true);
        this.iat.listen(document, 'unload', this.stopPage, true);
        this.iat.listen(gBrowser.tabContainer, 'TabSelect', this.watcher, true);
        this.startPage({originalTarget: doc});
        //disabled-debug -- this.iat.debug('RegisterPage: END');
    }
};

/* Finds all nodes under a doc; includes iframes and frames. */
monitor.prototype.hitched_findnodes = function (doc) {
    if (!doc) {
        return [];
    }
    var is_html = this.isHTML(doc),
        is_xul  = this.isXUL(doc),
        i,
        tmp,
        nodes = [],
        iframes,
        frames;
    if (is_html) {
        /* HTML */
        tmp = doc.getElementsByTagName('textarea');
        for (i = 0; i < tmp.length; i++) {
            nodes.push(tmp[i]);
        }

        /* Now that we got the nodes in this document,
             * look for other documents. */
        iframes = doc.getElementsByTagName('iframe');
        for (i = 0; i < iframes.length; i++) {
            nodes.push.apply(nodes, (this.findnodes(iframes[i].contentDocument)));
        }

        frames = doc.getElementsByTagName('frame');
        for (i = 0; i < frames.length; i++) {
            nodes.push.apply(nodes, (this.findnodes(frames[i].contentDocument)));
        }
    } else if (is_xul) {
        /* XUL */
        tmp = doc.getElementsByTagName('textbox');
        for (i = 0; i < tmp.length; i++) {
            nodes.push(tmp[i]);
        }
    } else {
        this.stopPage({originalTarget: doc});
        return [];
    }
    return nodes;
};

/**
 * This is called repeatedly and regularly to trigger updates for the
 * cache objects in the page.
 */
monitor.prototype.hitched_watcher = function (offset, init) {
    // If it's a special number or it's an event, then we need to init.
    if (offset.type && offset.type === 'TabSelect') {
        init = true;
    }
    var rate = this.iat.getRefresh(),
        now = Date.now(),
        doc,
        nodes = [],
        i,
        cobj,
        node;

    if (!init && now - this.last_watcher_call < Math.round(rate * 0.9)) {
        //disabled-debug -- this.iat.debug('watcher(', offset, '/', (now - this.last_watcher_call), ') -- skipping catchup refresh');
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
    //disabled-debug -- this.iat.debug('watcher: ', offset, init, doc && doc.location);
    nodes = this.findnodes(doc);
    /* Now that we have the nodes, walk through and either make or
     * get the cache objects and update them. */
    for (i = 0; i < nodes.length; i++) {
        node = nodes[i];
        if (init) {
            cobj = ItsAllText.CacheObj.make(node, this.isHTML(doc));
        } else {
            cobj = ItsAllText.CacheObj.get(node);
        }
        if (cobj) {
            cobj.update();
        }
    }
};

monitor.prototype._lock_count = 0;

monitor.prototype.hitched_incrementLock = function () {
    this._lock_count ++;
};
monitor.prototype.hitched_decrementLock = function () {
    this._lock_count --;
};
monitor.prototype.hitched_isLocked = function () {
    return this._lock_count > 0;
};

monitor.prototype.hitched_handleSubtreeModified = function (event) {
    var has_textareas;
    if (this.isLocked()) {
        return;
    }
    has_textareas = event.originalTarget.getElementsByTagName('textarea').length > 0;
    if (has_textareas) {
        //disabled-debug -- ItsAllText.debug('handleSubtreeModified: %o', event.target);
        try {
            // Ignore events while adding the gumdrops.
            this.incrementLock();
            this.watcher(0, true);
        } catch (e) {
            this.decrementLock();
        }
        this.decrementLock();
    }
};

monitor.prototype.hitched_startPage = function (event, force) {
    var doc = event.originalTarget,
        unsafeWin;
    //disabled-debug -- this.iat.debug('startPage', doc && doc.location, force);
    if (!(force || this.isHTML(doc))) {
        this.stopPage(event);
        return;
    }

    unsafeWin = doc.defaultView.wrappedJSObject;
    if (unsafeWin) {
        this.iat.listen(unsafeWin, 'pagehide', this.stopPage);
    }

    // Listen for the subtree being modified.
    this.iat.listen(unsafeWin, 'DOMSubtreeModified', this.handleSubtreeModified);

    // Kick off a watcher now...
    this.incrementLock();
    this.watcher(0, true);
    this.decrementLock();

    // Set up the future ones
    this.restart();
};

monitor.prototype.hitched_stopPage = function (event) {
    var doc = event.originalTarget,
        unsafeWin;
    //disabled-debug -- this.iat.debug('stopPage', doc && doc.location);

    unsafeWin = doc.defaultView.wrappedJSObject;
    if (unsafeWin) {
        this.iat.unlisten(unsafeWin, 'pagehide', this.stopPage);
    }
};

monitor.prototype.isXUL = function (doc) {
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

monitor.prototype.isHTML = function (doc) {
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


