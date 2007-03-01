/*
 *  It's All Text - Easy external editing of web forms.
 *  Copyright 2006 Christian Höltje
 *
 *  This program is free software; you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation; either version 2 of the License or
 *  any later version.
 *
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License along
 *  with this program; if not, write to the Free Software Foundation, Inc.,
 *  51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA.
 */

// @todo [9] IDEA: dropdown list for charsets (utf-8, western-iso, default)?
// @todo [3] Have a menu/context menu item for turning on monitoring/watch.
// @todo [9] Menu item to pick the file to load into a textarea.

var ItsAllText = function() {
    /**
     * This data is all private, which prevents security problems and it
     * prevents clutter and collection.
     * @type Object
     */
    var that = this;

    /**
     * Used for tracking all the all the textareas that we are watching.
     * @type Hash
     */
    that.tracker = {};

    /**
     * Keeps track of all the refreshes we are running.
     * @type Array
     */
    var cron = [null]; // Eat the 0th position

    /**
     * A constant, a string used for things like the preferences.
     * @type String
     */
    that.MYSTRING = 'itsalltext';

    /* The XHTML Namespace */
    that.XHTMLNS = "http://www.w3.org/1999/xhtml";

    /* The XUL Namespace */
    that.XULNS   = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";


    var string_bundle = Components.classes["@mozilla.org/intl/stringbundle;1"].
        getService(Components.interfaces.nsIStringBundleService);
    /**
     * A localization bundle.  Use it like so:
     * ItsAllText.locale.getStringFromName('blah');
     */
    that.locale = string_bundle.createBundle("chrome://itsalltext/locale/itsalltext.properties");
    /**
     * Formats a locale string, replacing $N with the arguments in arr.
     * @param {String} name Locale property name
     * @param {Array} arr Array of strings to replace in the string.
     * @returns String
     */
    that.localeFormat = function(name, arr) {
        return this.locale.formatStringFromName(name, arr, arr.length);
    };
    /**
     * Returns the locale string matching name.
     * @param {String} name Locale property name
     * @returns String
     */
    that.localeString = function(name) {
        return this.locale.GetStringFromName(name);
    };

    /**
     * Create an error message from given arguments.
     * @param {Object} message One or more objects to be made into strings...
     */
    that.logString = function() {
        var args = Array.prototype.slice.apply(arguments,[0]);
        for (var i=0; i<args.length; i++) {
            try {
                args[i] = args[i].toString();
            } catch(e) {
                Components.utils.reportError(e);
                args[i] = 'toStringFailed';
            }
        }
        args.unshift(that.MYSTRING+':');
        return args.join(' ');
    };

    /**
     * This is a handy debug message.  I'll remove it or disable it when
     * I release this.
     * @param {Object} message One or more objects can be passed in to display.
     */
    that.log = function() {
        var message = that.logString.apply(that, arguments);
        try {
            // idiom: Convert arguments to an array for easy handling.
            var consoleService = Components.
                classes["@mozilla.org/consoleservice;1"].
                getService(Components.interfaces.nsIConsoleService);
            consoleService.logStringMessage(message);
        } catch(e) {
            Components.utils.reportError(message);
        }
    };

    /**
     * Uses log iff debugging is turned on.  Used for messages that need to
     * globally logged (firebug only logs locally).
     * @param {Object} message One or more objects can be passed in to display.
     */
    that.debuglog = function() {
        if (that.preferences.debug) {
            that.log.apply(that,arguments);
        }
    };

    /**
     * Displays debug information, if debugging is turned on.
     * Requires Firebug.
     * @param {Object} message One or more objects can be passed in to display.
     */
    that.debug = function() {
        if (that.preferences.debug) {
            try { Firebug.Console.logFormatted(arguments); } 
            catch(e) {
                that.log.apply(that,arguments);
            }
        }
    };

    /**
     * Returns the directory where we put files to edit.
     * @returns nsILocalFile The location where we should write editable files.
     */
    that.getEditDir = function() {
        /* Where is the directory that we use. */
        var fobj = Components.classes["@mozilla.org/file/directory_service;1"].
            getService(Components.interfaces.nsIProperties).
            get("ProfD", Components.interfaces.nsIFile);
        fobj.append(that.MYSTRING);
        if (!fobj.exists()) {
            fobj.create(Components.interfaces.nsIFile.DIRECTORY_TYPE,
                        parseInt('0700',8));
        }
        if (!fobj.isDirectory()) {
            that.error(that.localeFormat('problem_making_directory', [fobj.path]));
        }
        return fobj;
    };

    /**
     * Cleans out the edit directory, deleting all old files.
     */
    that.cleanEditDir = function(force) {
        force = (force && typeof(force) != 'undefined');
        var last_week = Date.now() - (1000*60*60*24*7);
        var fobj = that.getEditDir();
        var entries = fobj.directoryEntries;
        while (entries.hasMoreElements()) {
            var entry = entries.getNext();
            entry.QueryInterface(Components.interfaces.nsIFile);
            if(force || !entry.exists() || entry.lastModifiedTime < last_week){
                try{
                    entry.remove(false);
                } catch(e) {
                    that.debug('unable to remove',entry,'because:',e);
                }
            }
        }
    };

    /* Clean the edit directory whenever we create a new window. */
    that.cleanEditDir();

    /* Load the various bits needed to make this work. */
    var loader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"].getService(Components.interfaces.mozIJSSubScriptLoader);
    loader.loadSubScript('chrome://itsalltext/content/Color.js', that);
    loader.loadSubScript('chrome://itsalltext/content/cacheobj.js', that);

    /**
     * Dictionary for storing the preferences in.
     * @type Hash
     */
    that.preferences = {
        debug: true,

        /**
         * Fetches the current value of the preference.
         * @private
         * @param {String} aData The name of the pref to fetch.
         * @returns {Object} The value of the preference.
         */
        _get: function(aData) {
            var po = that.preference_observer;
            return po._branch['get'+(po.types[aData])+'Pref'](aData);
        },

        /**
         * Sets the current preference.
         * @param {String} aData The name of the pref to change.
         * @param {Object} value The value to set.
         */
        _set: function(aData, value) {
            var po = that.preference_observer;
            return po._branch['set'+(po.types[aData])+'Pref'](aData, value);
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
            'charset':            'Char',
            'editor':             'Char',
            'refresh':            'Int',
            'debug':              'Bool',
            'disable_gumdrops':   'Bool',
            'extensions':         'Char'
        },

        /**
         * Register the observer.
         */
        register: function() {
            var prefService = Components.
                classes["@mozilla.org/preferences-service;1"].
                getService(Components.interfaces.nsIPrefService);
            this._branch = prefService.getBranch("extensions."+that.MYSTRING+".");
            this._branch.QueryInterface(Components.interfaces.nsIPrefBranch2);
            this._branch.addObserver("", this, false);
            /* setup the preferences */
            for(var type in this.types) {
                that.preferences[type] = that.preferences._get(type);
            }
        },

        /**
         * Unregister the observer. Not currently used, but may be
         * useful in the future.
         */
        unregister: function() {
            if (!this._branch) {return;}
            this._branch.removeObserver("", this);
        },

        /**
         * Observation callback.
         * @param {String} aSubject The nsIPrefBranch we're observing (after appropriate QI)e
         * @param {String} aData The name of the pref that's been changed (relative to the aSubject).
         * @param {String} aTopic The string defined by NS_PREFBRANCH_PREFCHANGE_TOPIC_ID
         */
        observe: function(aSubject, aTopic, aData) {
            if (aTopic != "nsPref:changed") {return;}
            if (that.preferences) {
                that.preferences[aData] = that.preferences._get(aData);
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
    that.getCharset = function() {
        return that.preferences.charset;
    };

    /**
     * A Preference Option: How often should we search for new content?
     * @returns {int} The number of seconds between checking for new content.
     */
    that.getRefresh = function() {
        var refresh = that.preferences.refresh;
        if (!refresh || refresh < 1) {
            that.debug('Invalid refresh gotten:',refresh);
            refresh = 1;
        }
        var retval = 1000*refresh;
        return retval;

    };

    /**
     * A Preference Option: What editor should we use?
     * @returns {nsILocalFile} A file object of the editor.
     */
    that.getEditor = function() {
        var editor = that.preferences.editor;

        // create an nsILocalFile for the executable
        var file = Components.
            classes["@mozilla.org/file/local;1"].
            createInstance(Components.interfaces.nsILocalFile);

        file.initWithPath(editor);
        return file;
    };

    /**
     * A Preference Option: should we display debugging info?
     * @returns {bool}
     */
    that.getDebug = function() {
        return that.preferences.debug;
    };

    /**
     * A Preference Option: Are the edit gumdrops disabled?
     * @returns {bool}
     */
    that.getDisableGumdrops = function() {
        return that.preferences.disable_gumdrops;
    }

    /**
     * A Preference Option: The list of extensions
     * @returns Array
     */
    that.getExtensions = function() {
        var string = that.preferences.extensions.replace(/[\n\t ]+/g,'');
        var extensions = string.split(',');
        if (extensions.length === 0) {
            return ['.txt'];
        } else {
            return extensions;
        }
    };

    /**
     * A Preference Option: Append an extension
     * @returns Array
     */
    that.appendExtensions = function(ext) {
        ext = ext.replace(/[\n\t ]+/g,'');
        var current = that.getExtensions();
        for(var i=0; i<current.length; i++) {
            if(ext == current[i]) {
                return; // Don't add a duplicate.
            }
        }
        
        var value = that.preferences.extensions;
        if(value.replace(/[\t\n ]+/g) === '') {
            value = ext;
        } else {
            value = [value,',',ext].join('');
        }
        that.preferences._set('extensions', value);
    };

    // @todo [3] Profiling and optimization.
    
    /**
     * Returns a cache object
     * Note: These UIDs are only unique for Its All Text.
     * @param {Object} node A dom object node or ID to one.
     * @returns {String} the UID or null.
     */
    that.getCacheObj = function(node) {
        var cobj = null;
        var str = that.MYSTRING+"_UID";
        if (typeof(node) == 'string') {
            cobj = that.tracker[node];
        } else {
            if (node && node.hasAttribute(str)) {
                cobj = that.tracker[node.getAttribute(str)];
            }
            if (!cobj) {
                cobj = new ItsAllText.CacheObj(node);
            }
        }
        return cobj;
    };

    /**
     * Cleans out all old cache objects.
     */
    that.cleanCacheObjs = function() {
        var count = 0;
        for(var id in that.tracker) {
            var cobj = that.tracker[id];
            if (cobj.node.ownerDocument.location === null) {
                that.debug('cleaning %s', id);
                delete cobj.node;
                delete cobj.button;
                delete that.tracker[id];
            } else {
                count += 1;
            }
        }
        that.debuglog('tracker count:', count);
    };

    /**
     * Refresh Textarea.
     * @param {Object} node A specific textarea dom object to update.
     */
    that.refreshTextarea = function(node, is_chrome) {
        var cobj = ItsAllText.getCacheObj(node);
        if(!cobj) { return; }

        cobj.update();
        if (!is_chrome) { cobj.addGumDrop(); }
    };

    // @todo [5] Refresh textarea on editor quit.
    // @todo [9] IDEA: support for input elements as well?

    /**
     * Refresh Document.
     * @param {Object} doc The document to refresh.
     */
    that.refreshDocument = function(doc) {
        // @todo [1] Confirm that we find textareas inside iframes and frames.
        if(!doc.location) { return; } // it's being cached, but not shown.
        var is_chrome = (doc.location.protocol == 'chrome:');
        var nodes = doc.getElementsByTagName('textarea');
        var i;
        for(i=0; i < nodes.length; i++) {
            that.refreshTextarea(nodes[i], is_chrome);
        }
        nodes = doc.getElementsByTagName('textbox');
        for(i=0; i < nodes.length; i++) {
            that.refreshTextarea(nodes[i], is_chrome);
        }
    };

    /**
     * This function is called regularly to watch changes to web documents.
     */
    that.monitor = {
        id: null,
        last_now:0,
        documents: [],
        /**
         * Starts or restarts the document monitor.
         */
        restart: function() {
            var rate = that.getRefresh();
            var id   = that.monitor.id;
            if (id) {
                clearInterval(id);
            }
            that.monitor.id = setInterval(that.monitor.watcher, rate);
        },
        /**
         * watches the document 'doc'.
         * @param {Object} doc The document to watch.
         */
        watch: function(doc, force) {
            if (!force) {
                /* Check that this is a document we want to play with. */
                var contentType = doc.contentType;
                var location = doc.location;
                var is_html = (contentType=='text/html' ||
                               contentType=='text/xhtml');
                //var is_xul=(contentType=='application/vnd.mozilla.xul+xml');
                var is_usable = (is_html) && 
                    location.protocol != 'about:' &&
                    location.protocol != 'chrome:';
                if (!is_usable) { 
                    that.debuglog('watch(): ignoring -- ',
                                  location, contentType);
                    return;
                }
            }

            that.refreshDocument(doc);
            that.monitor.documents.push(doc);
        },
        /**
         * Callback to be used by restart()
         * @private
         */
        watcher: function(offset) {
            var monitor = that.monitor;
            var rate = that.getRefresh();
            
            var now = Date.now();
            if (now - monitor.last_now < Math.round(rate * 0.9)) {
                that.debuglog('monitor.watcher(',offset,') -- skipping catchup refresh');
                return;
            }
            monitor.last_now = now;

            /* Walk the documents looking for changes */
            var documents = monitor.documents;
            that.debuglog('monitor.watcher(',offset,'): ', documents.length);
            var i;
            var did_delete = false;
            for(i in documents) {
                var doc = documents[i];
                if (doc.location) {
                    that.debuglog('refreshing', doc.location);
                    that.refreshDocument(doc);
                }
            }
        },
        /**
         * Stops watching doc.
         * @param {Object} doc The document to watch.
         */
        unwatch: function(doc) {
            var documents = that.monitor.documents;
            for(i in documents) {
                if (documents[i] === doc) {
                    that.debug('unwatching', doc);
                    delete documents[i];
                }
            }
            that.cleanCacheObjs();
            for(i=documents.length - 1; i >= 0; i--) {
                if(typeof(documents[i]) == 'undefined') {
                    documents.splice(i,1);
                }
            }
        }
    };

    /**
     * Callback whenever the DOM content in a window or tab is loaded.
     * @param {Object} event An event passed in.
     */
    that.onDOMContentLoad = function(event) {
        if (event.originalTarget.nodeName != "#document") { return; }
        var doc = event.originalTarget || document;
        that.monitor.watch(doc);
        return;
    };

    /**
     * Open the editor for a selected node.
     * @param {Object} node The textarea to get.
     */
    that.onEditNode = function(node) {
        var cobj = that.getCacheObj(node);
        if(cobj) {
            cobj.edit();
        }
        return;
    };

    /**
     * Triggered when the context menu is shown.
     * @param {Object} event The event passed in by the event handler.
     */
    that.onContextMenu = function(event) {
        if(event.target &&
           event.target.id == "itsalltext-context-popup") {
            var node = document.popupNode;
            var cobj = that.getCacheObj(node);
            var tag = node.nodeName.toLowerCase();
            var is_disabled = (!(tag == 'textarea' || 
                                 tag == 'textbox') ||
                               node.style.display == 'none' ||
                               node.getAttribute('readonly') ||
                               node.getAttribute('disabled')
                               );
            that.rebuildMenu(cobj.uid,
                             'itsalltext-context-popup',
                             is_disabled);
        }
        return true;
    };

    /**
     * Initialize the module.  Should be called once, when a window is loaded.
     * @private
     */
    var windowload = function(event) {
        that.debug("startup(): It's All Text! is watching this window...");

        // Start watching the preferences.
        that.preference_observer.register();

        // Start the monitor
        that.monitor.restart();

        var appcontent = document.getElementById("appcontent"); // The Browser
        if (appcontent) {
            // Normal web-page.
            appcontent.addEventListener("DOMContentLoaded", that.onDOMContentLoad,
                                        true);
        } else {
            that.onDOMContentLoad(event); 
        }
        // Attach the context menu, if we can.
        var contentAreaContextMenu = document.getElementById("contentAreaContextMenu");
        if (contentAreaContextMenu) {
            contentAreaContextMenu.addEventListener("popupshowing",
                                                    that.onContextMenu, false);
        }
    };
  
    // Do the startup when things are loaded.
    window.addEventListener("load", windowload, true);
    // Do the startup when things are unloaded.
    window.addEventListener("unload", function(event){that.monitor.unwatch(event.originalTarget||document); that.preference_observer.unregister();}, true);

};

/**
 * The command that is called when picking a new extension.
 * @param {Event} event
 */
ItsAllText.prototype.menuNewExtEdit = function(event) {
    var that = this;
    var uid = this._current_uid;
    var cobj = that.getCacheObj(uid);

    var params = {out:null};       
    window.openDialog("chrome://itsalltext/chrome/newextension.xul", "",
    "chrome, dialog, modal, resizable=yes", params).focus();
    if (params.out) {
        var ext = params.out.extension.replace(/[\n\t ]+/g,'');
        if(params.out.do_save) {
            that.appendExtensions(ext);
        }
        cobj.edit(ext);
    }
};

/**
 * The command that is called when selecting an existing extension.
 * @param {Event} event
 */
ItsAllText.prototype.menuExtEdit = function(event) {
    var that = this;
    var uid = that._current_uid;
    var ext = event.target.getAttribute('label');
    var cobj = that.getCacheObj(uid);
    cobj.edit(ext);
};

/**
 * Rebuilds the option menu, to reflect the current list of extensions.
 * @private
 * @param {String} uid The UID to show in the option menu.
 */
ItsAllText.prototype.rebuildMenu = function(uid, menu_id, is_disabled) {
    menu_id = typeof(menu_id) == 'string'?menu_id:'itsalltext-optionmenu';
    is_disabled = (typeof(is_disabled) == 'undefined'||!is_disabled)?false:(is_disabled&&true);
    var i;
    var that = this;
    var exts = that.getExtensions();
    var menu = document.getElementById(menu_id);
    var items = menu.childNodes;
    var items_length = items.length - 1; /* We ignore the preferences item */
    var node;
    that._current_uid = uid;
    var magic_stop_node = null;
    var magic_start = null;
    var magic_stop = null;

    // Find the beginning and end of the magic replacement parts.
    for(i=0; i<items_length; i++) {
        node = items[i];
        if (node.nodeName.toLowerCase() == 'menuseparator') {
            if(magic_start === null) {
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
    for(i = magic_stop - 1; i > magic_start; i--) {
        menu.removeChild(items[i]);
    }
   
    // Insert the new magic bits
    for(i=0; i<exts.length; i++) {
        node = document.createElementNS(that.XULNS, 'menuitem');
        node.setAttribute('label', exts[i]);
        node.addEventListener('command', function(event){return that.menuExtEdit(event);}, false);
        node.setAttribute('disabled', is_disabled?'true':'false');
        menu.insertBefore(node, magic_stop_node);

    }
    return menu;
};

ItsAllText = new ItsAllText();

