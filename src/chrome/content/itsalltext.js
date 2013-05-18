"use strict";
// vim: ts=4 sw=4 sts=4
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

// @todo [9] IDEA: dropdown list for charsets (utf-8, western-iso, default)?
// @todo [wish] Have a menu/context menu item for turning on monitoring/watch.
// @todo [9] Menu item to pick the file to load into a textarea.
// @todo [9] IDEA: Hot-keys opening the context menu.

var ItsAllText = function () {
    /**
     * This data is all private, which prevents security problems and it
     * prevents clutter and collection.
     * @type Object
     */
    var that = this,
    loadthings;

    /**
     * A factory method to make an nsIFile object.
     * @param {String} path A path to initialize the object with (optional).
     * @returns {nsIFile}
     */
    that.factoryFile = function (path) {
        var file = Components.
            classes["@mozilla.org/file/local;1"].
            createInstance(Components.interfaces.nsIFile);
        file.followLinks = false;
        if (typeof(path) == 'string' && path !== '') {
            file.initWithPath(path);
        }
        return file;
    };

    /**
     * Returns the directory where we put files to edit.
     * @returns {String} The location where we should write editable files.
     */
    that.getDefaultWorkingDir = function () {
        /* Where is the directory that we use. */
        var fobj = Components.classes["@mozilla.org/file/directory_service;1"].
            getService(Components.interfaces.nsIProperties).
            get("ProfD", Components.interfaces.nsIFile);
        fobj.append(that.MYSTRING);
        return fobj.path;
    };

    /**
     * Dictionary for storing the preferences in.
     * @type Hash
     */
    that.preferences = {
        debug: false,

        /**
         * Fetches the current value of the preference.
         * @private
         * @param {String} aData The name of the pref to fetch.
         * @returns {Object} The value of the preference.
         */
        private_get: function (aData) {
            var po = that.preference_observer,
            real_type = po.types[aData],
            type = real_type === 'Float' ? 'Char' : real_type,
            retval = '';
            retval = po.private_branch['get' + type + 'Pref'](aData);
            return real_type === 'Float' ? parseFloat(retval) : retval;
        },

        /**
         * Sets the current preference.
         * @param {String} aData The name of the pref to change.
         * @param {Object} value The value to set.
         */
        private_set: function (aData, value) {
            var po = that.preference_observer,
            real_type = po.types[aData],
            type = real_type === 'Float' ? 'Char' : real_type;
            if (real_type === 'Float') {
                value = '' + parseFloat(value);
            }
            po.private_branch['set' + type + 'Pref'](aData, value);
        }
    };

    /**
     * A Preference Observer.
     */
    that.preference_observer = {
        /**
         * Dictionary of types (well, really the method needed to get/set the
         * type.
         * @type Hash
         */
        types: {
            charset:            'Char',
            editor:             'Char',
            workingdir:         'Char',
            refresh:            'Int',
            debug:              'Bool',
            gumdrop_position:   'Char',
            fade_time:          'Float',
            extensions:         'Char',
            hotkey:             'Char',
            tracker_id:         'Char',
        },

        /**
         * Register the observer.
         */
        register: function () {
            var prefService = Components.
                classes["@mozilla.org/preferences-service;1"].
                getService(Components.interfaces.nsIPrefService),
            type;
            this.private_branch = prefService.getBranch("extensions." + that.MYSTRING + ".");
            this.private_branch.QueryInterface(Components.interfaces.nsIPrefBranch);
            this.private_branch.addObserver("", this, false);
            /* setup the preferences */
            for (type in this.types) {
                if (this.types.hasOwnProperty(type)) {
                    that.preferences[type] = that.preferences.private_get(type);
                }
            }
        },

        /**
         * Unregister the observer. Not currently used, but may be
         * useful in the future.
         */
        unregister: function () {
            if (!this.private_branch) {
                return;
            }
            this.private_branch.removeObserver("", this);
        },

        /**
         * Observation callback.
         * @param {String} aSubject The nsIPrefBranch we're observing (after appropriate QI)e
         * @param {String} aData The name of the pref that's been changed (relative to the aSubject).
         * @param {String} aTopic The string defined by NS_PREFBRANCH_PREFCHANGE_TOPIC_ID
         */
        observe: function (aSubject, aTopic, aData) {
            if (aTopic != "nsPref:changed") {
                return;
            }
            if (that.preferences) {
                that.preferences[aData] = that.preferences.private_get(aData);
                if (aData == 'refresh') {
                    that.monitor.restart();
                }
            }
        }

    };

    /**
     * A Preference Option: What character set should the file use?
     * @returns {String} the charset to be used.
     */
    that.getCharset = function () {
        return that.preferences.charset;
    };

    /**
     * A Preference Option: How often should we search for new content?
     * @returns {int} The number of seconds between checking for new content.
     */
    that.getRefresh = function () {
        var refresh = that.preferences.refresh;
        if (!refresh || refresh < 1) {
            //disabled-debug -- that.debug('Invalid refresh:', refresh);
            refresh = 1;
        }
        return 1000 * refresh;

    };

    that.getTrackerId = function () {
        var id = that.preferences.tracker_id;
        if (!id) {
            id = [that.MYSTRING,
                Math.floor(Math.random()*999999).toString(),
                Math.round(new Date().getTime()),
            ].join(':')
            id = that.hashString(id);
            that.preferences.private_set('tracker_id', id);
        }
        return id;
    }


    /**
     * Returns true if the system is running Mac OS X.
     * @returns {boolean} Is this a Mac OS X system?
     */
    that.isDarwin = function () {
        /* more help:
http://developer.mozilla.org/en/docs/Code_snippets:Miscellaneous#Operating_system_detection
*/

        var is_darwin = that.private_is_darwin;
        if (typeof(is_darwin) == 'undefined') {
            is_darwin = /^Darwin/i.test(Components.classes["@mozilla.org/xre/app-info;1"].getService(Components.interfaces.nsIXULRuntime).OS);
            that.private_is_darwin = is_darwin;
        }
        return is_darwin;
    };

    /**
     * A Preference Option: What editor should we use?
     *
     * Note: On some platforms, this can return an
     * NS_ERROR_FILE_INVALID_PATH exception and possibly others.
     *
     * For a complete list of exceptions, see:
     * http://lxr.mozilla.org/seamonkey/source/xpcom/base/nsError.h#262
     * @returns {nsIFile} A file object of the editor.
     */
    that.getEditor = function () {
        var editor = that.preferences.editor,
        retval = null;

        if (editor === '' && that.isDarwin()) {
            editor = '/Applications/TextEdit.app';
            that.preferences.private_set('editor', editor);
        }

        if (editor !== '') {
            retval = that.factoryFile(editor);
        }
        return retval;
    };

    /**
     * A Preference Option: Where should we store the working files?
     * @returns {String} The directory path as a string.
     */
    that.getWorkingDir = function () {
        var workingdir = that.preferences.workingdir,
        default_workingdir,
        fobj;

        if (!workingdir) {
            default_workingdir = that.getDefaultWorkingDir();
            that.preferences.private_set('workingdir', default_workingdir);
            workingdir = default_workingdir;
        }

        // Verify the directory exists.
        fobj = that.factoryFile(workingdir);
        if (!fobj.exists()) {
            fobj.create(Components.interfaces.nsIFile.DIRECTORY_TYPE,
                        parseInt('0700', 8));
        }
        if (!fobj.isDirectory()) {
            that.error(that.localeFormat('problem_making_directory', [workingdir]));
        }

        return workingdir;
    };

    /**
     * A Preference Option: should we display debugging info?
     * @returns {bool}
     */
    that.getDebug = function () {
        return that.preferences.debug;
    };

    /**
     * A Preference Option: Are the edit gumdrops disabled?
     * @returns {bool}
     */
    that.getDisableGumdrops = function () {
        return that.preferences.gumdrop_position === 'none';
    };

    /**
     * A Preference Option: The list of extensions
     * @returns Array
     */
    that.getExtensions = function () {
        var string = that.preferences.extensions.replace(/[\n\t ]+/g, ''),
        extensions = string.split(',');
        if (extensions.length === 0) {
            return ['.txt'];
        } else {
            return extensions;
        }
    };

    /**
     * Open the preferences dialog box.
     * @param{boolean} wait The function won't return until the preference is set.
     * @private
     * Borrowed from http://wiki.mozilla.org/XUL:Windows
     * and utilityOverlay.js's openPreferences()
     */
    that.openPreferences = function (wait) {
        wait = typeof(wait) == 'boolean' ? wait : false;
        var paneID = that.MYSTRING + '_preferences',
        psvc = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch),
        instantApply = psvc.getBoolPref("browser.preferences.instantApply", false) && !wait,
        features = "chrome,titlebar,toolbar,centerscreen" + (instantApply ? ",dialog" : ",modal"),
        xpcom_wm = Components.classes["@mozilla.org/appshell/window-mediator;1"],
        wm = xpcom_wm.getService(Components.interfaces.nsIWindowMediator),
        win = wm.getMostRecentWindow("Browser:Preferences"),
        pane;

        if (win) {
            win.focus();
            if (paneID) {
                pane = win.document.getElementById(paneID);
                win.document.documentElement.showPane(pane);
            }
        } else {
            openDialog('chrome://itsalltext/content/preferences.xul',
                       "preferences", features, paneID, wait);
        }
    };

    /**
     * A Preference Option: Append an extension
     * @returns Array
     */
    that.appendExtensions = function (ext) {
        var current = that.getExtensions(),
        value,
        i;
        ext = ext.replace(/[\n\t ]+/g, '');
        for (i = 0; i < current.length; i++) {
            if (ext == current[i]) {
                return; // Don't add a duplicate.
            }
        }

        value = that.preferences.extensions;
        if (value.replace(/[\t\n ]+/g) === '') {
            value = ext;
        } else {
            value = [value, ',', ext].join('');
        }
        that.preferences.private_set('extensions', value);
    };

    // @todo [wish] Profiling and optimization.

    that.getFromTracker = function (id) {
        var tracker, doc;
        if (typeof gBrowser !== 'undefined') {
            doc = gBrowser.contentDocument;
        } else {
            // We must be in a XUL window, fall back to simpler method.
            doc = window.document;
        }
        tracker = doc.getUserData(that.getTrackerId());
        if (!tracker) {
            tracker = {};
            doc.setUserData(that.getTrackerId(), tracker, null);
        }
        return tracker[id];
    }

    that.addToTracker = function (id, cobj) {
        var tracker, doc;
        if (typeof gBrowser !== 'undefined') {
            doc = gBrowser.contentDocument;
        } else {
            // We must be in a XUL window, fall back to simpler method.
            doc = window.document;
        }
        tracker = doc.getUserData(that.getTrackerId());
        if (!tracker) {
            tracker = {};
        }
        tracker[id] = cobj;
        doc.setUserData(that.getTrackerId(), tracker, null);
        that.debug("addToTracker:", id, cobj, tracker);
    }

    // @todo [wish] Refresh textarea on editor quit.
    // @todo [9] IDEA: support for input elements as well?
    // @todo [5] Minimum size for textareas.
    // @todo [5] Mark textareas somehow as 'in editor'.

    /**
     * Returns the offset from the containing block.
     * @param {Object} node A DOM element.
     * @param {Object} container If unset, then this will use the offsetParent of node. Pass in null to go all the way to the root.
     * @return {Array} The X & Y page offsets
     */
    that.getContainingBlockOffset = function (node, container) {
        if (typeof(container) == 'undefined') {
            container = node.offsetParent;
        }
        var pos = [node.offsetLeft, node.offsetTop],
        pnode = node.offsetParent;
        while (pnode && (container === null || pnode != container)) {
            pos[0] += pnode.offsetLeft || 0;
            pos[1] += pnode.offsetTop  || 0;
            pos[0] -= pnode.scrollLeft || 0;
            pos[1] -= pnode.scrollTop  || 0;
            pnode = pnode.offsetParent;
        }
        return pos;
    };


    /**
     * marshals a keypress event.
     */
    that.marshalKeyEvent = function (event) {
        var marshal = [event.altKey  ? 1 : 0,
            event.ctrlKey ? 1 : 0,
            event.metaKey ? 1 : 0,
            event.shiftKey ? 1 : 0,
            event.charCode,
            event.keyCode];
            marshal = marshal.join(':');
            return marshal;
    };

    that.keyMap = {
        8   : 'Backspace',
        9   : 'Tab',
        13  : 'Enter',
        19  : 'Break',
        27  : 'Escape',
        33  : 'PgUp',
        34  : 'PgDn',
        35  : 'End',
        36  : 'Home',
        37  : 'Left',
        38  : 'Up',
        39  : 'Right',
        40  : 'Down',
        45  : 'Insert',
        46  : 'Delete',
        112 : 'F1',
        113 : 'F2',
        114 : 'F3',
        115 : 'F4',
        116 : 'F5',
        117 : 'F6',
        118 : 'F7',
        119 : 'F8',
        120 : 'F9',
        121 : 'F10',
        122 : 'F11',
        144 : 'Num Lock',
        145 : 'Scroll Lock',
        ''  : '<none>'
    };

    /**
     * Converts a marshalled key event into a string.
     */
    that.keyMarshalToString = function (km) {
        var e = km.split(':'),
        out = [],
        c = parseInt(e[5], 10);
        if (e[0] === '1') {
            out.push('alt');
        }
        if (e[1] === '1') {
            out.push('ctrl');
        }
        if (e[2] === '1') {
            out.push('meta');
        }
        if (e[3] === '1') {
            out.push('shift');
        }
        if (e[4] === '0') {
            if (that.keyMap.hasOwnProperty(c)) {
                out.push(that.keyMap[c]);
            } else {
                out.push('code:' + c);
            }
        } else {
            out.push(String.fromCharCode(e[4]).toUpperCase());
        }
        return out.join(' ');
    };

    /**
     * Open the editor for a selected node.
     * This is used by the XUL.
     * @param {Object} node The textarea to get.
     */
    that.onEditNode = function (node) {
        var cobj = that.CacheObj.make(node);
        if (cobj) {
            cobj.edit();
        }
        return;
    };

    /**
     * Triggered when the context menu is shown.
     * @param {Object} event The event passed in by the event handler.
     */
    that.onContextMenu = function (event) {
        var tid, node, tag, is_disabled, cobj, menu, cstyle, doc;
        if (event.target) {
            tid = event.target.id;
            if (tid == "itsalltext-context-popup" ||
                tid == "contentAreaContextMenu") {
                node = document.popupNode;
            tag = node.nodeName.toLowerCase();
            doc = node.ownerDocument;
            cstyle = doc.defaultView.getComputedStyle(node, '');
            is_disabled = (
                !(tag == 'textarea' ||
                  tag == 'textbox') ||
                  node.style.display == 'none' ||
                  (cstyle && (cstyle.display == 'none' ||
                              cstyle.visibility == 'hidden')) ||
                              node.getAttribute('readonly') ||
                              node.getAttribute('disabled')
            );
            if (tid == "itsalltext-context-popup") {
                cobj = that.CacheObj.get(node);
                that.rebuildMenu(cobj.uid,
                                 'itsalltext-context-popup',
                                 is_disabled);
            } else {
                // tid == "contentAreaContextMenu"
                menu = document.getElementById("itsalltext-contextmenu");
                menu.setAttribute('hidden', is_disabled);
            }

            }
        }
        return true;
    };

    that.openReadme = function () {
        try {
            var browser = getBrowser();
            browser.selectedTab = browser.addTab(that.README);
        } catch (e) {
            //disabled-debug -- that.debug("failed to openReadme:", e);
        }
    };


    // Do the startup when things are loaded.
    // TODONOW: move to separate function
    that.listen(window, 'load', function (event) {
        //disabled-debug -- that.debug('!!load', event);

        if (typeof(gBrowser) === 'undefined') {
            that.monitor.registerPage(event);
        } else {
            // Add a callback to be run every time a document loads.
            // note that this includes frames/iframes within the document
            that.listen(gBrowser, "load",
                        that.monitor.registerPage, true);
        }

        // Setup the context menu whenever it is shown.
        var contentAreaContextMenu = document.getElementById("contentAreaContextMenu");
        if (contentAreaContextMenu) {
            that.listen(contentAreaContextMenu, 'popupshowing', that.hitch(that, 'onContextMenu'), false);
        }
    }, false);

    // TODONOW: move to separate function
    that.listen(window, 'unload', function (event) {
        if (typeof(gBrowser) === 'undefined') {
            that.monitor.stopPage(event);
        }
        var doc = event.originalTarget;
        //disabled-debug -- that.debug("pageunload(): A page has been unloaded", doc && doc.location);
        that.preference_observer.unregister();
        that.monitor.destroy();
    }, false);


    /* Start your engines! */
    this.init();
};

ItsAllText.prototype.init = function () {
    /**
     * A serial for tracking ids
     * @type Integer
     */
    this.serial_id = 0;

    /**
     * A constant, a string used for things like the preferences.
     * @type String
     */
    this.MYSTRING = 'itsalltext';

    /**
     * A constant, the version number.  Set by the Makefile.
     * @type String
     */
    this.VERSION = '999.@@VERSION@@';

    /**
     * A constant, the url to the readme.
     * @type String
     */
    this.README = 'https://github.com/docwhat/itsalltext/tree/release-' + this.VERSION + '#readme';

    /* The XHTML Namespace */
    this.XHTMLNS = "http://www.w3.org/1999/xhtml";

    /* The XUL Namespace */
    this.XULNS   = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";

    /* The monitor */
    this.monitor = null;

    /* For debugging */
    this.thread_id = Math.round(new Date().getTime() * Math.random());

    // Start watching the preferences.
    this.preference_observer.register();

    /* Load the various bits needed to make this work. */
    this.initScripts();

    /* Start the monitor */
    var itsalltext = this;
    setTimeout(function () {
        itsalltext.monitor = new itsalltext.Monitor();
        itsalltext.cleanWorkingDir();
    }, 1);
}

/* Load the various bits needed to make this work. */
ItsAllText.prototype.initScripts = function() {
    var loader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"].getService(Components.interfaces.mozIJSSubScriptLoader);
    loader.loadSubScript('chrome://itsalltext/content/Color.js', this);
    loader.loadSubScript('chrome://itsalltext/content/monitor.js', this);
    loader.loadSubScript('chrome://itsalltext/content/cacheobj.js', this);
}

/**
 * Formats a locale string, replacing $N with the arguments in arr.
 * @param {String} name Locale property name
 * @param {Array} arr Array of strings to replace in the string.
 * @returns String
 */
ItsAllText.prototype.localeFormat = function (name, arr) {
    return this.getLocale().formatStringFromName(name, arr, arr.length);
};
/**
 * Returns the locale string matching name.
 * @param {String} name Locale property name
 * @returns String
 */
ItsAllText.prototype.localeString = function (name) {
    return this.getLocale().GetStringFromName(name);
};

/**
 * Create an error message from given arguments.
 * @param {Object} message One or more objects to be made into strings...
 */
ItsAllText.prototype.logString = function () {
    var args = Array.prototype.slice.apply(arguments, [0]),
    i;
    for (i = 0; i < args.length; i++) {
        try {
            args[i] = "" + args[i];
        } catch (e) {
            Components.utils.reportError(e);
            args[i] = 'toStringFailed';
        }
    }
    args.unshift(this.MYSTRING + ' [' + this.thread_id + ']:');
    return args.join(' ');
};

/**
 * This is a handy debug message.  I'll remove it or disable it when
 * I release this.
 * @param {Object} message One or more objects can be passed in to display.
 */
ItsAllText.prototype.log = function () {
    const consoleService = Components.classes["@mozilla.org/consoleservice;1"];
    var message = this.logString.apply(this, arguments),
    obj = consoleService.getService(Components.interfaces.nsIConsoleService);
    try {
        // idiom: Convert arguments to an array for easy handling.
        obj.logStringMessage(message);
    } catch (e) {
        Components.utils.reportError(message);
    }
};

/**
 * Uses log iff debugging is turned on.  Used for messages that need to
 * globally logged (firebug only logs locally).
 * @param {Object} message One or more objects can be passed in to display.
 */
ItsAllText.prototype.debuglog = function () {
    if (this.preferences.debug) {
        this.log.apply(this, arguments);
    }
};

/**
 * Displays debug information, if debugging is turned on.
 * Requires Firebug.
 * @param {Object} message One or more objects can be passed in to display.
 */
ItsAllText.prototype.debug = function () {
    if (this.preferences && this.preferences.debug) {
        var message = this.logString.apply(this, arguments);
        window.dump(message + '\n');
        try {
            Firebug.Console.logFormatted(arguments);
        } catch (e) {
        }
    }
};

/**
 * This wraps the call to object.method to ensure that 'this' is correct.
 * This is borrowed from GreaseMonkey (though the concept has been around)
 * @method hitch
 * @param {Object} object
 * @param {String} method The method on object to call
 * @returns {Function} A wrapped call to object.method() which passes the arguments.
 */
ItsAllText.prototype.hitch = function (object, method) {
    if (!object[method]) {
        throw "method '" + method + "' does not exist on object '" + object + "'";
    }

    var staticArgs = Array.prototype.splice.call(arguments, 2, arguments.length);

    return function () {
        // make a copy of staticArgs (don't modify it because it gets reused for
        // every invocation).
        var args = staticArgs.concat(),
        i;

        // add all the new arguments
        for (i = 0; i < arguments.length; i++) {
            args.push(arguments[i]);
        }

        // invoke the original function with the correct this object and
        // the combined list of static and dynamic arguments.
        return object[method].apply(object, args);
    };
};

/**
 * @method listen
 * @param source {HTMLElement} The element to listen for events on.
 * @param event {String} The name of the event to listen for.
 * @param listener {Function} The function to run when the event is triggered.
 * @param opt_capture {Boolean} Should the event be captured?
 */
ItsAllText.prototype.listen = function (source, event, listener, opt_capture) {
    opt_capture = !!opt_capture;
    this.unlisten(source, event, listener, opt_capture);
    // this.debug("listen(%o, %o, -, %o)", source, event, opt_capture);
    if (source) {
        source.addEventListener(event, listener, opt_capture);
    }
};

/**
 * Creates a mostly unique hash of a string
 * Most of this code is from:
 *    http://developer.mozilla.org/en/docs/nsICryptoHash
 * @param {String} some_string The string to hash.
 * @returns {String} a hashed string.
 */
ItsAllText.prototype.hashString = function (some_string) {
    var converter = Components.classes["@mozilla.org/intl/scriptableunicodeconverter"].createInstance(Components.interfaces.nsIScriptableUnicodeConverter),
    result = {},
    data,
    ch,
    hash,
    toHexString,
    retval = [],
    i;
    converter.charset = "UTF-8";

    /* result is the result of the hashing.  It's not yet a string,
     * that'll be in retval.
     * result.value will contain the array length
     */
    result = {};

    /* data is an array of bytes */
    data = converter.convertToByteArray(some_string, result);
    ch   = Components.classes["@mozilla.org/security/hash;1"].createInstance(Components.interfaces.nsICryptoHash);

    ch.init(ch.MD5);
    ch.update(data, data.length);
    hash = ch.finish(true);

    // return the two-digit hexadecimal code for a byte
    toHexString = function (charCode) {
        return ("0" + charCode.toString(36)).slice(-2);
    };

    // convert the binary hash data to a hex string.
    for (i in hash) {
        if (hash.hasOwnProperty(i)) {
            retval[i] = toHexString(hash.charCodeAt(i));
        }
    }

    return (retval.join(""));
};

/**
 * @method unlisten
 * @param source {HTMLElement} The element with the event
 * @param event {String} The name of the event.
 * @param listener {Function} The function that was to be run when the event is triggered.
 * @param opt_capture {Boolean} Should the event be captured?
 */
ItsAllText.prototype.unlisten = function (source, event, listener, opt_capture) {
    opt_capture = !!opt_capture;
    //disabled-debug -- this.debug("unlisten(%o, %o, -, %o)", source, event, opt_capture);
    try {
        source && source.removeEventListener(event, listener, opt_capture);
    } catch (err) {
        //disabled-debug -- this.debug("didn't unlisten: %o", err);
    }
};

/**
 * Convert an event into a key fingerprint, aka keyprint.
 * @param {Event} event
 * @returns {String} keyprint
 */
ItsAllText.prototype.eventToKeyprint = function (event) {
    return [ event.ctrlKey,
        event.altKey,
        event.metaKey,
        event.shiftKey,
        event.keyCode,
        event.charCode ].join(':');
};

/**
 * Convert a keyprint to a string suitable for human display.
 * @param {String} keyprint
 * @return {String}
 */
ItsAllText.prototype.keyprintToString = function (keyprint) {
    var split = keyprint.split(':'),
    string = [];
    if (split[0] === 'true') {
        string.push('Ctrl');
    }
    if (split[1] === 'true') {
        string.push('Alt');
    }
    if (split[2] === 'true') {
        string.push('Meta');
    }
    if (split[3] === 'true') {
        string.push('Shift');
    }
    if (split[4] === '0') {
        string.push(String.fromCharCode(split[5]));
    } else {
        string.push('keyCode=', split[4]);
    }
    return string.join(' ');
};


/**
 * Cleans out the edit directory, deleting all old files.
 */
ItsAllText.prototype.cleanWorkingDir = function (force) {
    force = typeof(force) === 'boolean'?force:false;
    var last_week, fobj, entries, entry, working_dir;
    last_week = Date.now() - (1000 * 60 * 60 * 24 * 7);
    working_dir = this.getWorkingDir();
    itsalltext.debug("Cleaning up ", working_dir);
    fobj = this.factoryFile(working_dir);
    if (fobj.exists() && fobj.isDirectory()) {
        entries = fobj.directoryEntries;

        while (entries.hasMoreElements()) {
            entry = entries.getNext();
            entry.QueryInterface(Components.interfaces.nsIFile);
            if (force || !entry.exists() || entry.lastModifiedTime < last_week) {
                try {
                    entry.remove(false);
                } catch (e) {
                    this.log('unable to remove', entry, 'because:', e);
                }
            }
        }
    }
};


/**
 * The command that is called when picking a new extension.
 * @param {Event} event
 */
ItsAllText.prototype.menuNewExtEdit = function (event) {
    var that = this,
    uid = this.private_current_uid,
    cobj = that.CacheObj.get(uid),
    params = {out: null},
    ext;
    window.openDialog(
        "chrome://itsalltext/content/newextension.xul", "",
        "chrome, dialog, modal, resizable=yes", params
    ).focus();
    if (params.out) {
        ext = params.out.extension.replace(/[\n\t ]+/g, '');
        if (params.out.do_save) {
            that.appendExtensions(ext);
        }
        cobj.edit(ext);
    }
};

/**
 * The command that is called when selecting an existing extension.
 * @param {Event} event
 * @param {string} ext
 * @param {boolean} clobber
 */
ItsAllText.prototype.menuExtEdit = function (ext, clobber, event) {
    var uid = this.private_current_uid,
    cobj = this.CacheObj.get(uid);
    if (ext !== null) {
        ext = typeof(ext) === 'string'?ext:event.target.getAttribute('label');
    }
    //disabled-debug -- this.debug('menuExtEdit:', uid, ext, clobber);
    cobj.edit(ext, clobber);
};

/**
 * Rebuilds the option menu, to reflect the current list of extensions.
 * @private
 * @param {String} uid The UID to show in the option menu.
 */
ItsAllText.prototype.rebuildMenu = function (uid, menu_id, is_disabled) {
    menu_id = typeof(menu_id) == 'string'?menu_id:'itsalltext-optionmenu';
    is_disabled = (typeof(is_disabled) === 'undefined' || !is_disabled) ? false : (is_disabled && true);
    var i,
    that = this,
    exts = that.getExtensions(),
    menu = document.getElementById(menu_id),
    items = menu.childNodes,
    items_length = items.length - 1, /* We ignore the preferences item */
    node,
    magic_stop_node = null,
    magic_start = null,
    magic_stop = null,
    cobj = that.CacheObj.get(uid);
    that.private_current_uid = uid;

    // Find the beginning and end of the magic replacement parts.
    for (i = 0; i < items_length; i++) {
        node = items[i];
        if (node.nodeName.toLowerCase() == 'menuseparator') {
            if (magic_start === null) {
                magic_start = i;
            } else if (magic_stop === null) {
                magic_stop = i;
                magic_stop_node = node;
            }
        } else if (node.nodeName.toLowerCase() == 'menuitem') {
            node.setAttribute('disabled', is_disabled?'true':'false');
        }
    }

    // Remove old magic bits
    for (i = magic_stop - 1; i > magic_start; i--) {
        menu.removeChild(items[i]);
    }

    if (cobj.edit_count <= 0 && cobj.getFile() && cobj.getFile().exists()) {
        node = document.createElementNS(that.XULNS, 'menuitem');
        node.setAttribute('label', that.localeFormat('edit_existing', [cobj.extension]));
        that.listen(node, 'command', that.hitch(that, 'menuExtEdit', null, false), false);
        node.setAttribute('disabled', is_disabled?'true':'false');
        menu.insertBefore(node, magic_stop_node);
    }

    // Insert the new magic bits
    for (i = 0; i < exts.length; i++) {
        node = document.createElementNS(that.XULNS, 'menuitem');
        node.setAttribute('label', that.localeFormat('edit_ext', [exts[i]]));
        that.listen(node, 'command', that.hitch(that, 'menuExtEdit', exts[i], true), false);
        node.setAttribute('disabled', is_disabled?'true':'false');
        menu.insertBefore(node, magic_stop_node);
    }
    return menu;
};

/**
 * Returns the locale object for translation.
 */
ItsAllText.prototype.getLocale = function () {
    var string_bundle = Components.classes["@mozilla.org/intl/stringbundle;1"],
    obj = string_bundle.getService(Components.interfaces.nsIStringBundleService);
    /**
     * A localization bundle.  Use it like so:
     * itsalltext.locale.getStringFromName('blah');
     */
    return obj.createBundle("chrome://itsalltext/locale/itsalltext.properties");
};

var itsalltext = new ItsAllText();

